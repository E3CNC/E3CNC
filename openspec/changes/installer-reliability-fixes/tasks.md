## 1. Release Acquisition (already-implemented step-4 fix)

- [x] 1.1 Verify `ensureCurrentRelease()` wiring in `bootstrap.go` runs before the "Vendor Moonraker and Klipper" step and is a no-op when a current release exists.
- [x] 1.2 Confirm `releaseFetcher` package-variable seam in `release.go` is overridable in tests.
- [x] 1.3 Review existing `vendor_test.go` cases cover the fresh-install (no current) and reinstall (current exists) paths; add any missing scenario.

## 2. Service-Start Error Handling and Verification

- [x] 2.1 Refactor `startBootstrapServices` to check the errors from `systemctl start supervisor`, `supervisorctl reread`, and `supervisorctl update`, returning a wrapped error on failure.
- [x] 2.2 Add service verification after start: query `supervisorctl status` for `e3cnc-<instance>-moonraker` and `e3cnc-<instance>-klipper`, and report any that are not running.
- [x] 2.3 Introduce an injectable command-runner seam (package-private `runCmd` var) for tests, following the existing `releaseFetcher` pattern.
- [x] 2.4 Preserve the `--no-start` (StartServices=false) short-circuit returning nil.

## 3. Propagate Config Errors

- [x] 3.1 Update `installServices` to check and propagate the `writeFileSudo` error for each supervisor config (wrapped with the program name).
- [x] 3.2 Update `setupNginx` to capture and check the exit status of `nginx -t` and `nginx -s reload`, returning an error with the command output on failure.

## 4. Tests

- [x] 4.1 Add `services_test.go` unit tests for `startBootstrapServices`: command-error propagation, service-not-running detection, status-query failure, and `--no-start` no-op.
- [x] 4.2 Add unit tests for `installServices` writeFileSudo error propagation.
- [x] 4.3 Add unit tests for `setupNginx` nginx test/reload failure handling.
- [x] 4.4 Run `go test ./...` in `cli/go` to confirm no regressions (target `./internal/bootstrap/` first, then the full suite).

## 5. Documentation and Validation

- [x] 5.1 Add a CHANGELOG entry noting the installer now fails loudly on service-start/config errors instead of silently succeeding.
- [x] 5.2 Run `openspec validate` on the change and confirm all artifacts are complete.
