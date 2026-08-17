## Why

Fresh installations of E3CNC on bare hardware (e.g. Raspberry Pi over SSH) intermittently fail and then report broken services with no clear cause. Three related reliability problems were found in the bootstrap installer:

1. **Fresh-install step-4 failure**: The "Vendor Moonraker and Klipper" step copied the vendored components out of `~/E3CNC/current`, but on a fresh install no release exists yet, so that step failed with "no current release: readlink .../current: no such file or directory". A fix already exists in code (`ensureCurrentRelease()` in `release.go`) but was never captured as a change or verified end-to-end against a real fresh install.
2. **Health checks fail after install**: The final "Start services" step (`startBootstrapServices`) runs `systemctl start supervisor`, `supervisorctl reread`, and `supervisorctl update` via `exec.Command(...).Run()` and ignores every error — then never verifies that the services actually came up. The installer reports success even when Moonraker/Klipper never started, so post-install `RunHealthChecks()` fails.
3. **Silent error-swallowing elsewhere**: `installServices` ignores the error from `writeFileSudo(...)`, and `setupNginx` ignores the results of `nginx -t` / `nginx -s reload`, so failed steps can appear successful and leave a broken install.

These make the installer unreliable and hard to diagnose: failures are hidden, and health checks fail with no actionable cause.

## What Changes

- **Capture the step-4 "Vendor Moonraker and Klipper" fix as a formal change**: verify `ensureCurrentRelease()` / `fetchAndActivateLatestRelease()` correctly download and activate the latest release (or use a staged local release in tests) before the vendoring step, so a fresh install never fails at step 4. (Logic already implemented; this change documents and hardens it.)
- **Fail-fast on service start errors**: `startBootstrapServices` SHALL return an error when `systemctl start supervisor`, `supervisorctl reread`, or `supervisorctl update` fail, instead of ignoring them.
- **Verify services actually started**: After starting/updating, `startBootstrapServices` SHALL verify that the instance's Moonraker and Klipper supervisor programs are running (e.g. via `supervisorctl status`) and report which ones failed.
- **Propagate `writeFileSudo` errors in `installServices`**: if a supervisor config cannot be written, return the error so the install fails loudly.
- **Propagate nginx config errors in `setupNginx`**: check the exit status of `nginx -t` and `nginx -s reload` and return an error if they fail.
- **Add unit tests** for: `ensureCurrentRelease` no-op vs download paths, service-start error propagation, service status verification, and nginx/writeFileSudo error handling.

## Capabilities

### New Capabilities
- `bootstrap-release-acquisition`: Ensures a current release exists before the vendoring step on fresh installs. Covers `ensureCurrentRelease()` (no-op when a release exists; download+activate otherwise) and the test seam via `releaseFetcher` so fresh-install step-4 never fails for lack of `~/E3CNC/current`.
- `bootstrap-service-verification`: After the final install step, the installer SHALL surface service-start errors and verify that the instance's Moonraker/Klipper services actually started, so health checks don't fail silently post-install.
- `bootstrap-error-handling`: Bootstrap steps SHALL propagate errors instead of ignoring them — specifically `writeFileSudo` failures in `installServices` and `nginx -t`/`nginx -s reload` failures in `setupNginx`.

### Modified Capabilities
- (none — new installer reliability concerns are additive; existing `thin-bootstrap`, `multi-distro-package-manager`, and `smart-backup` specs are unchanged)

## Impact

- **Code**: `cli/go/internal/bootstrap/` — `bootstrap_steps.go` (startBootstrapServices, installServices, setupNginx), and hardening for `release.go`/`bootstrap.go` as needed.
- **Tests**: `cli/go/internal/bootstrap/` — add cases to existing `vendor_test.go` and a new `services_test.go`.
- **Behavior**: Failed service start or config writes now fail the install with a clear step error instead of silently passing. No change to CLI commands, config formats, or data.
- **Already-implemented**: The step-4 `ensureCurrentRelease()` logic and its `vendor_test.go` regression tests already exist; this change documents them and verifies they satisfy the new spec.
