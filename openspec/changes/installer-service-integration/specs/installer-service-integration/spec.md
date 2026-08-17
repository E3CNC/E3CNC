## ADDED Requirements

### Requirement: Test container provides supervisor and nginx
The installer integration test container SHALL install the `supervisor` and `nginx` packages so the service-provisioning bootstrap steps can run against a realistic runtime target.

#### Scenario: Packages present in the test image
- **WHEN** the test container image is built
- **THEN** `supervisorctl` and `nginx` SHALL be available on `PATH`

#### Scenario: Service steps writable
- **WHEN** the installer's service steps run in the container as the test user
- **THEN** the test user SHALL be able to write supervisor configs under `/etc/supervisor/conf.d/` and nginx sites under `/etc/nginx/sites-*` (via passwordless sudo)

### Requirement: Supervisord starts without systemd
`startBootstrapServices` SHALL start the supervisor daemon in a container where systemd is unavailable, so the service-start step runs end-to-end in Docker.

#### Scenario: systemd available (real hardware)
- **WHEN** systemd is present (e.g. on a Raspberry Pi)
- **THEN** `startBootstrapServices` SHALL start supervisor via `systemctl start supervisor` (unchanged behavior)

#### Scenario: systemd unavailable (container)
- **WHEN** systemd/systemctl is not usable inside the container
- **THEN** `startBootstrapServices` SHALL start supervisord directly rather than failing on `systemctl`

#### Scenario: supervisorctl flow unchanged
- **WHEN** supervisor is running (by either start method)
- **THEN** `startBootstrapServices` SHALL still run `supervisorctl reread`, `supervisorctl update`, and verify service status via `supervisorctl status`

### Requirement: End-to-end service test
The installer integration suite SHALL include an end-to-end test that runs a full install (not `--no-start`) and verifies the service-provisioning steps.

#### Scenario: Full install writes supervisor configs
- **WHEN** a full `e3cnc-tui install --name default` runs in the test container
- **THEN** supervisor configs for `e3cnc-default-moonraker` and `e3cnc-default-klipper` SHALL exist under `/etc/supervisor/conf.d/`

#### Scenario: Full install configures nginx
- **WHEN** a full `e3cnc-tui install --name default` runs in the test container
- **THEN** an nginx site config for the instance SHALL exist under `/etc/nginx/sites-available/`
- **AND** `nginx -t` SHALL pass

#### Scenario: Services are running after start
- **WHEN** a full install (with service start) runs in the test container
- **THEN** `supervisorctl status` SHALL show the instance's Moonraker and Klipper programs as `RUNNING`

### Requirement: Offline release staging for the e2e test
The integration test SHALL stage a local fake release so `ensureCurrentRelease` and `copyVendoredComponents` work without network access.

#### Scenario: Staged release satisfies vendoring
- **WHEN** the test stages a release under `~/E3CNC/releases/` with vendored Moonraker and Klipper and activates it via `current`
- **THEN** a full install SHALL use the staged release (no download) and vendor Moonraker + Klipper successfully

#### Scenario: Stubbed venv keeps services runnable
- **WHEN** the test stages stub `venv/bin/python` executables for Moonraker and Klipper
- **THEN** the supervisor programs SHALL start and report `RUNNING` in `supervisorctl status` (rather than FATAL from a missing interpreter)
