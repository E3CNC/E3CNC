## Context

E3CNC's Go CLI performs privileged operations in three packages with inconsistent patterns:

- `internal/bootstrap`: `exec.Command("sudo", ...).Run()` (bootstrap.go), `runSudo()` helper (pkgmgr.go), `runCommand("sudo", ...)` seam (bootstrap_steps.go), raw `exec.Command("sudo","tee",...)` (writeFileSudo).
- `internal/deploy`: `exec.Command("sudo", "supervisorctl", "status", ...)` in `checkService` — no `-n`.
- `internal/commands`: `cmdRestart` shells `systemctl restart`/`supervisorctl restart`/`nginx reload` via `bash -c` with **no sudo**; `cmdInstall` reaches `bootstrap.Bootstrap()` → `sudo apt-get`.

Two privilege contexts exist:
- **Context A (install)** runs as **root** via `sudo ./install.sh` → hands off to `e3cnc-tui install` as root. But the TUI install path does not gate on root, so a non-root user can reach `bootstrap.Bootstrap()` → `sudo apt-get` → password prompt. The `checkSudo()` preflight (`sudo -n true`) is advisory only; it never blocks.
- **Context B (runtime)** runs as the normal `biqu` user and must use non-interactive sudo for `supervisorctl status`/`restart`, `nginx reload`. Today `cmdRestart` uses no sudo (silent no-op) and `checkService` uses `sudo` without `-n` (risk of prompt; conflates errors).

The `TestRunDispatch_AllCommands` test hangs ~369s because it actually executes privileged commands from non-root CI.

## Goals / Non-Goals

**Goals:**
- Create one shared, non-interactive root-execution boundary (`RunAsRoot`) used by all privileged operations.
- Make the boundary testable via an Executor seam; fix the dispatch-test hang.
- Gate install to root-only with a clear message; keep the canonical `install.sh → e3cnc-tui install` root hand-off working.
- Fix runtime service management: `cmdRestart` works as `biqu`, `checkService` reports permission errors distinctly and never prompts.

**Non-Goals:**
- Not stripping the redundant install-path `sudo` calls (they become no-ops through `RunAsRoot`; stripping is cosmetic).
- Not changing the sudoers file content or NOPASSWD rules.
- Not addressing stale-pidfile `IsRunning` detection (separate concern).
- Not adding interactive per-command password prompting (the design is explicitly non-interactive).

## Decisions

### Decision 1: One shared `internal/rootrun` package
Create `cli/go/internal/rootrun` with:

```go
// RunAsRoot runs cmd as root, non-interactively.
// Root => run directly; otherwise => sudo -n (fail-fast, never prompts).
func RunAsRoot(args ...string) ([]byte, error) { return Exec(RootCmd(args...)) }

// Exec is the injectable seam (overridable in tests), defaulting to os/exec.
var Exec = func(name string, args ...string) ([]byte, error) {
    cmd := exec.Command(name, args...)
    return cmd.CombinedOutput()
}

func IsRoot() bool { return os.Geteuid() == 0 }
```

`RootCmd` returns `args` when root, or `["sudo","-n", args...]` otherwise. A separate `RunAsRootCombined`/writer variants can be added if needed for streaming.

**Rationale:** Privileged code lives in three packages; a shared package gives one definition of "run as root non-interactively" and one seam all tests can override. `sudo -n` uniformly handles the root case (no-op) and the NOPASSWD case, so the boundary does not need to special-case differently.
**Alternative considered:** A `runAsRoot` helper per package — rejected; duplicates the policy and the seam.

### Decision 2: Strict root gate on install
`e3cnc-tui install` (both `cmdInstall` and the TUI install entry) checks `rootrun.IsRoot()` first. If not root, print `Run via: sudo ./install.sh` (or `sudo e3cnc-tui install`) and return without running any privileged step.

**Rationale:** The canonical flow already runs `e3cnc-tui install` as root (install.sh's exec hand-off inherits EUID 0). Gating only steers the non-root paths (TUI menu "Installation Wizard", direct `./e3cnc-tui install`) to the canonical entry. This removes the interactive `sudo apt-get` prompt in the TUI install UX.
**Alternative considered:** Permissive gate (allow root OR NOPASSWD non-root). Rejected after exploring — the wiki documents install.sh as canonical and hands off to `e3cnc-tui install` as root, so strict root keeps one consistent privilege model.

### Decision 3: Route all privileged calls through RunAsRoot
Replace ad-hoc sudo in bootstrap (`exec.Command("sudo",...)`), backup_diff, pkgmgr (`runSudo`), bootstrap_steps (`runCommand("sudo",...)`), deploy `checkService`, and commands `cmdRestart` with `rootrun.RunAsRoot`. Where output/error distinction matters (checkService), use the returned error/exit to distinguish permission vs not-found.

**Rationale:** Consolidates the boundary; removes silent-fail (`cmdRestart`) and prompt-risk (`checkService`); gives deploy health checks a clear distinction.
**Alternative considered:** Keeping the existing per-package helpers but adding `-n` — rejected; leaves three parallel sudo paths and no shared seam.

### Decision 4: Dispatch-test seam fixes the hang
`TestRunDispatch_AllCommands` overrides `rootrun.Exec` with a stub (no side effects, returns success). It then only verifies routing/parse behavior, never executing real privileged commands.

**Rationale:** The dispatch layer is `package commands`; `bootstrap`'s existing seams are unexported there. A shared `rootrun.Exec` accessible to the commands package is the reusable override point. This is the same pattern as `runCommand`/`writeFileSudo`/`releaseFetcher`.
**Alternative considered:** Skip privileged commands when not root — rejected; less robust (silent skips) and doesn't fix routing coverage.

### Decision 5: checkService error origin tracking
`checkService` runs `RunAsRoot` and inspects the error: a `sudo` permission failure (e.g. non-zero exit mentioning sudo/not in sudoers) is reported as "permission denied / sudo not available", while a clean exit with no matching status is "service not found".

**Rationale:** Distinct messages let the TUI tell users "your sudo is misconfigured" from "the service isn't there".

### Decision 6: setupSudoers self-validation (optional hardening)
After install, validate that each runtime `supervisorctl`/`restart`/`nginx` operation the TUI will issue has a matching rule in `/etc/sudoers.d/e3cnc`, surfacing gaps during install rather than mid-session.

**Rationale:** Since Context A runs as root, the sudoers file exists solely for Context B; asserting its correctness at install is cheap.
**Alternative considered:** Skip — the rules are already correct today; this is defensive. Flag as optional task.

## Risks / Trade-offs

- **[Changing cmdRestart to use sudo could behave differently where sudo is absent]** → `sudo -n` fails fast with a clear error rather than silently doing nothing; the TUI surfaces it. Strictly better than the current silent no-op.
- **[Replacing many sudo call sites risks regressions]** → Covered by existing unit tests plus new rootrun tests; the boundary is small and locally testable.
- **[Root gate changes non-root install UX]** → Previously it prompted/hung; now it tells the user to use `sudo ./install.sh`. Net improvement; documented in CHANGELOG.
- **[`sudo -n` requires NOPASSWD for runtime ops]** → That is already the design intent (setupSudoers writes NOPASSWD rules); enforced fail-fast surfaces misconfiguration early.

## Migration Plan

- Pure code change; no data/config migration. sudoers content unchanged.
- Rollback: revert `internal/rootrun` and the call-site updates; existing behavior/tests restored.
- Ship after `go test ./...` in `cli/go` passes (dispatch test no longer hangs) and targeted tests pass.

## Open Questions

- Whether to strip the now-redundant install-path `sudo` calls for cosmetics (out of scope by default).
- Whether pidfile-based `IsRunning` staleness detection should be folded in (out of scope by default; separate change).
- Whether `RunAsRoot` needs a streaming/stdout variant for long-running install steps (bootstrap writes to install log; the CombinedOutput default may suffice).
