## Context

The installer's runtime service steps live in `cli/go/internal/bootstrap/bootstrap_steps.go`:

- `installServices` writes two supervisor program configs under `/etc/supervisor/conf.d/` (`e3cnc-<instance>-moonraker`, `e3cnc-<instance>-klipper`), now propagating `writeFileSudo` errors (from `installer-reliability-fixes`).
- `setupNginx` writes a site config under `/etc/nginx/sites-available/` + symlinks it into `sites-enabled/`, running `nginx -t` and `nginx -s reload` (now error-propagating).
- `startBootstrapServices` starts supervisor, runs `supervisorctl reread`/`update`, then verifies both programs report `RUNNING` via `supervisorctl status`.

The existing Docker integration suite (`tests/installer/docker_test.go`) runs `e3cnc-tui install --no-start` inside a minimal `debian:12-slim` image. That image does not install `nginx` or `supervisor`, and every service test uses `--no-start`, so none of these three steps is ever exercised end-to-end in an automated environment. The recently added fail-fast/verification logic in `startBootstrapServices` has no automated coverage.

The container also lacks systemd, so `systemctl start supervisor` fails there — which is why the existing tests use `--no-start`. To exercise the real start path in a container, we need a supervisor daemon that runs without systemd.

## Goals / Non-Goals

**Goals:**
- Install `supervisor` and `nginx` in the Debian integration-test container so service steps match a realistic target.
- Add a systemd-unavailable fallback in `startBootstrapServices` so the full start path (supervisord → reread → update → status verification) runs inside the container; the real-hardware systemd path is unchanged.
- Add an end-to-end Docker test that runs a full install (no `--no-start`) and verifies runnable Moonraker/Klipper under `supervisorctl status`.
- Stage a local release offline so the e2e test needs no GitHub/network.

**Non-Goals:**
- No change to `installServices` or `setupNginx` logic (they already work and propagate errors).
- No change to the supervised service command lines / configs.
- No attempt to mocks systemd as "active" — we only add a container fallback for the missing init.
- Not a rebuild of the deploy health-check system.

## Decisions

### Decision 1: Add `nginx` and `supervisor` to the test container
Add both to the `apt-get install` list in `tests/installer/Dockerfile` (matching `AllPackages()` and what real hardware provisions).

**Rationale:** Matches the runtime target; the user already has passwordless sudo, so service steps can write `/etc/` paths.

### Decision 2: `startBootstrapServices` falls back to starting supervisord when systemd is absent
Detect systemd availability (e.g. by checking whether `/run/systemd/system` exists). If present, keep the existing `systemctl start supervisor` path. If absent (container), start the daemon directly with `supervisord -c /etc/supervisor/supervisord.conf` (backgrounded), then proceed with the unchanged `supervisorctl reread` → `update` → `status` flow.

**Rationale:** Supervisor itself needs no systemd; only the init invocation does. Falling back to `supervisord` lets the *entire* start+verify path run in Docker while leaving the device unchanged. The `runCommand`/`sudo` seam introduced earlier makes both branches unit-testable.

**Alternative considered:** Running `sudo service supervisor start` (SysV fallback). Rejected — not universally present in Debian slim and adds another conditional; `supervisord` is simpler and explicit.

**Alternative considered:** Using a fake systemctl shim in the container. Rejected — couples the container to a shell shim and diverges from how the code actually starts the daemon in a container.

### Decision 3: Guard the systemctl fallback with systemd detection, not error-only
Use a positive check for systemd presence (e.g. `os.Stat("/run/systemd/system")`) to choose the start path, rather than trying `systemctl` and falling back only on error.

**Rationale:** Deterministic and avoids a failed `systemctl` attempt producing confusing output/log noise in containers. Mirrors common convention (e.g. many init-aware tools check `/run/systemd/system`).

### Decision 4: E2E test uses a staged offline release + stubbed venv
- The test stages a fake release under `~/E3CNC/releases/<v>` with vendored Moonraker + Klipper markers, and symlinks `~/E3CNC/current` → it, so `ensureCurrentRelease` is a no-op and `copyVendoredComponents` works offline.
- It also stages stub `venv/bin/python` executables for Moonraker and Klipper (e.g. a small `sleep` loop / tail script) so the supervisor programs don't immediately FATAL from a missing interpreter, letting `supervisorctl status` report `RUNNING`.

**Rationale:** Mirrors the offline staging already proven in `bootstrap/vendor_test.go`, extended so the supervised programs are actually startable in the container without a real Klippy/Moonraker runtime.

### Decision 5: E2E test lives in `docker_test.go` alongside existing scenarios
Add `TestServicesEndToEnd` plus small helpers (stage release, stub venv, check supervisor status) to `tests/installer/docker_test.go`.

**Rationale:** Reuses the existing `startContainer`/`containerExec` harness and image build in `TestMain`.

## Risks / Trade-offs

- **[Determining "systemd present" is heuristic]** → `/run/systemd/system` is a reliable, widely used indicator; on real RPi hardware it exists. The fallback only activates in containers/systems genuinely lacking systemd.
- **[supervisord must already be configured to read `/etc/supervisor/supervisord.conf`]** → Debian's supervisor package ships that config; the fallback invokes it explicitly. If the standard conf path differs, the test surfaces it.
- **[Stub venv is a simplification]** → The e2e test verifies the *service wiring* (config written, programs start, status RUNNING), not a real Klippy. That matches the intent of "closer to hardware" service testing without requiring the Python runtime in the container.
- **[Supervisor may need a short settle time after update before running]** → The existing `startsecs=10` in the generated config already gates RUNNING; the test can add a bounded wait on `supervisorctl status` if needed.
- **[Running as `--no-start` tests still required]** → The existing scenarios keep using `--no-start` (they target pre-service steps); the new e2e test is the one that exercises services.

## Migration Plan

- Purely additive test infrastructure + a guarded code path. No data/config migration.
- Rollback: revert the `startBootstrapServices` fallback and the Dockerfile/test additions; existing behavior and tests remain intact.
- Ship after `go test ./...` in `cli/go` and `cd tests/installer && go test -v -timeout 300s` both pass.

## Open Questions

- Whether to background `supervisord` via `runCommand` (blocking until it daemonizes) versus a `nohup ... &`-style detached launch. Default: rely on supervisord's default daemonize behavior or a documented flag.
- Whether systemd detection should be an exported helper (`systemdPresent()`) for direct unit testing versus inline in `startBootstrapServices`. Default: small package-private helper, unit-testable.
