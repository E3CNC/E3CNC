## Why

The E3CNC CLI shells out to `sudo` in **inconsistent ways** across three packages with no single boundary or policy. This causes three distinct problems:

1. **`go test ./...` hangs for 369 seconds.** `TestRunDispatch_AllCommands` in `internal/commands` actually *executes* privileged commands (`install`, `uninstall`, `restart`, `deploy`). From a non-root CI/test environment these hit `sudo apt-get ...` interactively and block at a `Password:` prompt.
2. **The install path is ambiguous about privileges.** `install.sh` enforces root (`EUID 0`) and hands off to `e3cnc-tui install` *as root* — but the TUI install flow does not gate on root, so a non-root user can reach `bootstrap.Bootstrap()` → `sudo apt-get` → password prompt. The NOPASSWD preflight (`checkSudo`) is advisory only; it never blocks.
3. **Runtime service management is silent and inconsistent.** `cmdRestart` shells `systemctl`/`supervisorctl`/`nginx reload` via `bash -c` with **no sudo at all** (silently does nothing for a normal user), while `deploy.checkService` runs `sudo supervisorctl status` **without `-n`** (can prompt in the TUI) and conflates "permission denied" with "service not found".

There is no single "run as root" abstraction: raw `exec.Command("sudo", ...)`, a `runSudo` helper, a `runCommand` seam, and `sudo -n true` all coexist.

## What Changes

- **Introduce a single shared `rootrun` boundary** (new small package `cli/go/internal/rootrun`): `RunAsRoot(cmd...)` runs as root directly when `EUID == 0`, otherwise uses `sudo -n` (non-interactive, fail-fast, never prompts). It exposes a package-level `Executor` var as the test seam (mirroring the existing `runCommand`/`releaseFetcher`/`writeFileSudo` seams).
- **Route all privileged execution through `RunAsRoot`**: update `internal/bootstrap` (bootstrap.go, backup_diff.go, pkgmgr.go, bootstrap_steps.go), `internal/deploy` (deploy.go `checkService`), and `internal/commands` (hardware.go `cmdRestart`) to use the single boundary instead of ad-hoc `sudo` invocations.
- **Strict root gate on install**: `e3cnc-tui install` (and the TUI install entry) SHALL require `EUID == 0`. Non-root invocation emits a clear message pointing to `sudo ./install.sh` and exits without running privileged steps. The canonical `install.sh → e3cnc-tui install` root hand-off is unaffected.
- **Fix runtime service management**: `cmdRestart` SHALL run supervisor/systemctl/nginx commands via `RunAsRoot` (non-interactive). `checkService` SHALL report permission failures distinctly from "service not found" and never block on a prompt.
- **Fix the test hang**: dispatch tests inject a stub Executor so `TestRunDispatch_AllCommands` verifies command routing without executing real privileged commands.
- **Hardening options considered but NOT in scope**: stripping the redundant install-path sudo calls (they become no-ops through `RunAsRoot` anyway), pidfile/`IsRunning` staleness detection (separate concern).

## Capabilities

### New Capabilities
- `rootrun-boundary`: A single, shared, non-interactive root-execution boundary (`RunAsRoot`) with a testable Executor seam, used by all privileged operations across bootstrap, deploy, and commands. Never prompts; fails fast when neither root nor passwordless sudo is available.
- `install-root-gate`: `e3cnc-tui install` requires EUID 0. Non-root install attempts are blocked with a clear "run via sudo ./install.sh" message, keeping the canonical root hand-off working and preventing interactive password prompts mid-install.
- `runtime-service-management`: Runtime service actions (`restart`, health `checkService`) use the non-interactive boundary, silently-failing `cmdRestart` is fixed, and health checks distinguish permission failures from absent services.

### Modified Capabilities
- (none — this introduces new capability areas rather than changing existing spec requirements.)

## Impact

- **Code**: new `cli/go/internal/rootrun/` package; edits to `internal/bootstrap/{bootstrap,backup_diff,pkgmgr,bootstrap_steps}.go`, `internal/deploy/deploy.go`, `internal/commands/{dispatch,hardware,update}.go`, and `internal/tui/{install,install_preflight}.go`.
- **Tests**: `internal/commands/dispatch_test.go` (inject Executor stub), plus new `internal/rootrun/*_test.go`, and updates where sudo behavior changed.
- **Behavior**: non-root install is blocked with a helpful message (was: interactive prompt / hang); runtime restarts actually work for the `biqu` user (was: silent no-op); health checks distinguish permission errors.
- **Dependencies**: none.
- **No data/config migration**; sudoers file content unchanged.
