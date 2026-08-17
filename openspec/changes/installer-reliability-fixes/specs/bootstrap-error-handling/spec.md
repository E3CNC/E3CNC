## ADDED Requirements

### Requirement: Propagate writeFileSudo errors in installServices
The system SHALL return an error when a supervisor config file cannot be written during the "Install system services" step, instead of ignoring it.

#### Scenario: Supervisor config write succeeds
- **WHEN** both the Moonraker and Klipper supervisor config files are written successfully
- **THEN** the "Install system services" step SHALL complete with no error

#### Scenario: Supervisor config write fails
- **WHEN** `writeFileSudo` fails to write the Moonraker or Klipper supervisor config
- **THEN** the "Install system services" step SHALL return an error identifying the config that could not be written

### Requirement: Propagate nginx config errors in setupNginx
The system SHALL return an error when the nginx configuration test or reload fails during the "Configure nginx and mDNS" step.

#### Scenario: nginx config valid
- **WHEN** `sudo nginx -t` succeeds and `sudo nginx -s reload` succeeds
- **THEN** `setupNginx` SHALL complete with no error

#### Scenario: nginx config test fails
- **WHEN** `sudo nginx -t` returns a non-zero exit status
- **THEN** `setupNginx` SHALL return an error with the nginx test output

#### Scenario: nginx reload fails
- **WHEN** `sudo nginx -s reload` returns a non-zero exit status
- **THEN** `setupNginx` SHALL return an error rather than silently proceeding

### Requirement: Error messages identify the failing step
The system SHALL return errors that name the specific failing operation so the cause is actionable.

#### Scenario: Failure detail
- **WHEN** any of the above operations fails
- **THEN** the returned error SHALL include the operation name and the underlying cause (e.g. `write supervisor config e3cnc-<instance>-klipper: <err>`)
