## 1. Container Environment

- [x] 1.1 Add `supervisor` and `nginx` to the `apt-get install` list in `tests/installer/Dockerfile`.
- [x] 1.2 Verify `supervisorctl` and `nginx` are on `PATH` after the image build (add to `TestPackageInstall` or a new assertion).

## 2. Container-Friendly Service Start

- [x] 2.1 Add a package-private `systemdPresent()` helper in `bootstrap_steps.go` (checks `/run/systemd/system`).
- [x] 2.2 Update `startBootstrapServices` to start supervisor via `systemctl start supervisor` when systemd is present, and via `supervisord` (backgrounded) in the container fallback path.
- [x] 2.3 Keep the `supervisorctl reread` → `update` → `status` verification unchanged and running after either start method.

## 3. End-to-End Integration Test

- [x] 3.1 Add test helpers to `tests/installer/docker_test.go` to stage an offline release (vendored Moonraker + Klipper markers, `current` symlink) and stub `venv/bin/python` executables so programs can start.
- [x] 3.2 Add `TestServicesEndToEnd` that runs a full `e3cnc-tui install --name default` (no `--no-start`).
- [x] 3.3 Assert supervisor configs exist for `e3cnc-default-moonraker` and `e3cnc-default-klipper` under `/etc/supervisor/conf.d/`.
- [x] 3.4 Assert the nginx site config exists under `/etc/nginx/sites-available/` and `nginx -t` passes.
- [x] 3.5 Assert `supervisorctl status` reports both services `RUNNING` (with a bounded wait for startup).

## 4. Code Tests and Validation

- [x] 4.1 Add/update unit tests in `cli/go/internal/bootstrap/services_test.go` for the systemd-present vs container-fallback branches of `startBootstrapServices`.
- [x] 4.2 Run `go test ./...` in `cli/go` (target `./internal/bootstrap/` first, then the full suite).
- [x] 4.3 Run `cd tests/installer && go test -v -timeout 300s` to confirm the Docker e2e test passes.

## 5. Documentation and Validation

- [x] 5.1 Add a CHANGELOG entry noting the installer test suite now covers service-install/nginx/service-start end-to-end and `startBootstrapServices` starts supervisord in containers.
- [x] 5.2 Run `openspec validate` on the change and confirm all artifacts are complete.
