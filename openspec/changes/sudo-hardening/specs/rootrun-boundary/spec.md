## ADDED Requirements

### Requirement: Shared root execution boundary
The system SHALL provide a single shared abstraction, `RunAsRoot(args...)`, that executes a command as root, non-interactively. When the process runs as root (`EUID == 0`), it SHALL run the command directly. Otherwise it SHALL run it via `sudo -n` and fail fast if passwordless sudo is unavailable.

#### Scenario: Running as root
- **WHEN** the process has `EUID == 0`
- **THEN** `RunAsRoot("supervisorctl", "status")` SHALL execute `supervisorctl status` directly (no `sudo` prefix)

#### Scenario: Running as non-root with NOPASSWD
- **WHEN** the process is non-root but passwordless sudo is available
- **THEN** `RunAsRoot("supervisorctl", "status")` SHALL execute `sudo -n supervisorctl status`

#### Scenario: Running as non-root without NOPASSWD
- **WHEN** the process is non-root and `sudo -n` fails
- **THEN** `RunAsRoot` SHALL return the non-zero error promptly and SHALL NOT prompt for a password

### Requirement: Test seam for the execution boundary
The system SHALL expose the command executor as an overridable package-level variable so tests can replace real execution with a stub.

#### Scenario: Test overrides the executor
- **WHEN** a test sets `rootrun.Exec` to a stub
- **THEN** `RunAsRoot` SHALL invoke the stub instead of the real command

#### Scenario: Default executor
- **WHEN** no override is set
- **THEN** `RunAsRoot` SHALL run the command via the real `os/exec` mechanism

### Requirement: IsRoot helper
The system SHALL expose an `IsRoot()` helper returning whether the process runs with effective UID 0.

#### Scenario: Root process
- **WHEN** the effective UID is 0
- **THEN** `IsRoot()` SHALL return true

#### Scenario: Non-root process
- **WHEN** the effective UID is non-zero
- **THEN** `IsRoot()` SHALL return false
