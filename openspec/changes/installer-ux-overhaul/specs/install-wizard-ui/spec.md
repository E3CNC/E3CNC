## ADDED Requirements

### Requirement: 3-screen install wizard
The TUI install wizard SHALL present exactly 3 screens: a loading/detection screen, a decision/confirm screen, and a merged progress+verification screen. The wizard SHALL support two modes: fresh install and import existing Klipper.

#### Scenario: Loading screen streams detections
- **WHEN** the wizard starts
- **THEN** the loading screen SHALL show individual detections as they complete (OS, Python, MCU, ports, disk space, sudo, GitHub access)

#### Scenario: Loading screen transitions automatically
- **WHEN** all detections complete
- **THEN** the wizard SHALL transition to the decision/confirm screen without user input

#### Scenario: Decision screen shows mode selector
- **WHEN** the decision screen is displayed
- **THEN** the user SHALL select between "Fresh install" and "Import existing Klipper" modes

#### Scenario: Decision screen shows auto-detected summary
- **WHEN** the decision screen is displayed
- **THEN** it SHALL show a summary of auto-detected values: MCU device, port availability, firmware status

#### Scenario: Decision screen accepts instance name
- **WHEN** the user enters a name on the decision screen
- **THEN** the wizard SHALL validate the name format (lowercase, numbers, hyphens) and check uniqueness against existing instances

#### Scenario: Decision screen confirms before install
- **WHEN** the user presses Enter on the decision screen
- **THEN** the wizard SHALL start the install pipeline

### Requirement: Merged progress and verification screen
The progress and verification screens SHALL be merged into a single screen. Health checks SHALL run as the final phase of the progress pipeline.

#### Scenario: Progress shows mode-specific steps
- **WHEN** the fresh install pipeline runs
- **THEN** the progress screen SHALL show 9 steps: system packages, sudoers, directories, vendor Moonraker+Klipper, virtualenvs, config files, system services, nginx+mDNS, start services
- **WHEN** the import pipeline runs
- **THEN** the progress screen SHALL show 7 steps: system packages, sudoers, detect existing Klipper, create E3CNC dirs, config Moonraker, nginx+mDNS, start services+integrate

#### Scenario: Verification runs as final phase
- **WHEN** all install steps complete
- **THEN** the verification phase SHALL run health checks: Moonraker API, Klippy, CNC Agent, Frontend, mDNS

#### Scenario: Verification blocks completion
- **WHEN** verification is running
- **THEN** the user SHALL wait for completion before proceeding

### Requirement: Inline error recovery
Error recovery SHALL be displayed as an inline overlay on the progress screen, not a separate screen.

#### Scenario: Retry failed step
- **WHEN** a step fails and the user presses 'r'
- **THEN** the wizard SHALL retry the failed step

#### Scenario: Skip failed step
- **WHEN** a step fails and the user presses 's'
- **THEN** the wizard SHALL skip the step and continue

#### Scenario: Abort and rollback
- **WHEN** a step fails and the user presses 'a'
- **THEN** the wizard SHALL abort and call the rollback function