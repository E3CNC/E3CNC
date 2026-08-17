## Why

The installer's service-provisioning steps — `installServices`, `setupNginx`, and especially `startBootstrapServices` (with its new fail-fast + `supervisorctl status` verification from the `installer-reliability-fixes` change) — have **no end-to-end test coverage**. The existing `tests/installer/` Docker integration suite runs inside a minimal `debian:12-slim` container that:

- does not install `nginx` or `supervisor` (even though `AllPackages()` in `pkgdb.go` lists both), and
- always runs the installer with `--no-start`, so the service-install, nginx-config, and service-start steps are never exercised in a realistic environment.

As a result, the very logic that was just hardened (failing loudly when `systemctl`/`supervisorctl` error and verifying Moonraker/Klipper actually run) is the least-tested wiring in the installer. A bug there only surfaces on real hardware (Raspberry Pi) or in a privileged container, after a long install. A container that mirrors the runtime target more closely — with `supervisor` and `nginx` present — lets us run and verify these steps automatically, close to how they behave on the device.

## What Changes

- **Extend the installer test container** (`tests/installer/Dockerfile`, Debian 12) to install `supervisor` and `nginx`, matching what `installSystemPackages` / `AllPackages()` provisions on real hardware. The container already grants the test user passwordless sudo, so the bootstrap steps that write to `/etc/supervisor/conf.d/` and `/etc/nginx/sites-*` can run.
- **Make `startBootstrapServices` container-friendly**: when the systemd init (`systemctl start supervisor`) is unavailable inside a container, fall back to starting the supervisor daemon directly (`supervisord`), then run `supervisorctl reread` / `update` / `status` as before. On real hardware the systemd path is unchanged. This lets the service-start step run end-to-end inside Docker.
- **Add an end-to-end Go integration test** in `tests/installer/docker_test.go` (`TestServicesEndToEnd`) that:
  1. Stages a local fake release (vendored Moonraker + Klipper, stubbed runnable venv) so `ensureCurrentRelease` is a no-op and `copyVendoredComponents` works offline (no GitHub dependency in tests).
  2. Runs a full `e3cnc-tui install --name default` in the container (not `--no-start`).
  3. Verifies `installServices` wrote the `e3cnc-default-moonraker` and `e3cnc-default-klipper` supervisor configs under `/etc/supervisor/conf.d/`.
  4. Verifies `setupNginx` wrote the nginx site config and that `nginx -t` passes.
  5. Verifies `startBootstrapServices` brought both programs up, e.g. `supervisorctl status` shows them `RUNNING`.
- **Add a CHANGELOG entry** and validate the OpenSpec change.

## Capabilities

### New Capabilities
- `installer-service-integration`: Docker-based, end-to-end coverage of the installer's service-provisioning steps (`installServices`, `setupNginx`, `startBootstrapServices`) against a Debian container that mirrors the runtime target more closely (supervisor + nginx present), including the container-friendly supervisor start path and offline release staging so the test needs no network.

### Modified Capabilities
- (none — the existing `installer-integration-tests` spec is extended naturally by adding a new service-integration capability rather than changing its existing requirements.)

## Impact

- **Code**: `cli/go/internal/bootstrap/bootstrap_steps.go` — `startBootstrapServices` gains a systemd-unavailable fallback to start supervisord directly.
- **Tests/Infra**: `tests/installer/Dockerfile` adds `supervisor` + `nginx`; `tests/installer/docker_test.go` adds `TestServicesEndToEnd` and release-staging/venv-stub helpers. `tests/installer/go.mod` unchanged.
- **Dependencies**: No new external deps. The Debian image already pulls sudo/curl; adding supervisor+nginx packages is additive.
- **Behavior**: On real hardware the systemd path is unchanged (fallback only triggers when `systemctl`/systemd is absent). No change to CLI commands or data formats.
