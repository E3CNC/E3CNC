## ADDED Requirements

### Requirement: Surface service-start errors
The system SHALL return an error when any service-start command fails during the "Start services" bootstrap step, instead of ignoring it.

#### Scenario: systemctl start supervisor fails
- **WHEN** `sudo systemctl start supervisor` returns a non-zero exit status
- **THEN** the "Start services" step SHALL fail with an error naming the failing command
- **AND** the installer SHALL report the step as failed

#### Scenario: supervisorctl reread or update fails
- **WHEN** `sudo supervisorctl reread` or `sudo supervisorctl update` returns a non-zero exit status
- **THEN** the "Start services" step SHALL fail with an error naming the failing command

#### Scenario: No-start flag
- **WHEN** `StartServices` is false (e.g. `--no-start`)
- **THEN** the step SHALL return nil and not run any service-start command (existing behavior preserved)

### Requirement: Verify services are running after start
After starting services, the system SHALL verify that the instance's Moonraker and Klipper supervisor programs are actually running and report those that are not.

#### Scenario: Both services running
- **WHEN** Moonraker and Klipper supervisor programs are both in a running state after start/update
- **THEN** the step SHALL succeed with no errors

#### Scenario: A service is not running
- **WHEN** one or more of the instance's supervisor programs is not running (e.g. FATAL, STOPPED, or absent) after start/update
- **THEN** the "Start services" step SHALL report which programs failed to start
- **AND** if verification is considered blocking, the step SHALL fail with details of the failing programs

#### Scenario: Status query failure
- **WHEN** `supervisorctl status` cannot be run (e.g. command not found or non-zero exit)
- **THEN** the step SHALL surface an error rather than silently treating the services as healthy
