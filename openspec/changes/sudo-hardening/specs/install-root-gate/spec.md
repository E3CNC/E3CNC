## ADDED Requirements

### Requirement: Install requires root
The `e3cnc-tui install` command SHALL require root (`EUID == 0`) before running any privileged install step.

#### Scenario: Root runs install
- **WHEN** `e3cnc-tui install` is run as root
- **THEN** the install SHALL proceed normally with no privilege gate

#### Scenario: Non-root runs install
- **WHEN** `e3cnc-tui install` is run as a non-root user
- **THEN** the command SHALL NOT run any privileged install step
- **AND** it SHALL print a message directing the user to run via `sudo ./install.sh` (or `sudo e3cnc-tui install`)

#### Scenario: install.sh hand-off remains root
- **WHEN** the install is launched via `sudo ./install.sh` (which hands off to `e3cnc-tui install`)
- **THEN** the hand-off inherits root and the install SHALL proceed

### Requirement: TUI install entry respects the root gate
The TUI "Installation Wizard" entry SHALL not run privileged bootstrap steps when the process is non-root, and SHALL surface a clear root-required message instead.

#### Scenario: Non-root TUI wizard
- **WHEN** a non-root user selects the Install wizard in the TUI
- **THEN** the wizard SHALL not start `bootstrap.Bootstrap()`
- **AND** it SHALL inform the user to run via `sudo ./install.sh`

#### Scenario: Root TUI wizard
- **WHEN** a root user selects the Install wizard in the TUI
- **THEN** the wizard SHALL proceed with the install flow

### Requirement: No interactive password prompt during install
The install flow SHALL NOT trigger an interactive sudo password prompt as a side effect of privilege escalation.

#### Scenario: Non-root install attempt
- **WHEN** a non-root user attempts install
- **THEN** the flow SHALL exit/redirect at the gate before any `sudo apt-get` or equivalent would prompt
