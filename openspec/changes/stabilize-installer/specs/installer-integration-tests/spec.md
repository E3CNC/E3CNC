## ADDED Requirements

### Requirement: Docker-based integration tests
The test suite SHALL verify installer behavior inside a Debian 12 Docker container. Tests SHALL cover port detection, port conflict, directory migration (single, merge), smart backup, backup pruning, package installation, directory creation, config generation, and binary download.

#### Scenario: Port detection
- **WHEN** the test runs port detection inside a Docker container with no services on default ports
- **THEN** the test SHALL verify that ports 8081, 7125, 7126 are reported as free

#### Scenario: Port conflict
- **WHEN** a service is bound to port 8081 before the installer runs
- **THEN** the test SHALL verify the installer auto-assigns port 8082 or the next available

#### Scenario: Migration from old directory
- **WHEN** `~/e3cnc` exists with configuration files
- **THEN** the test SHALL verify migration creates `~/E3CNC` with the same files

#### Scenario: Migration merge
- **WHEN** both `~/e3cnc` and `~/E3CNC` exist with different files
- **THEN** the test SHALL verify both sets of files exist in `~/E3CNC` after merge

#### Scenario: Smart backup excludes releases
- **WHEN** `~/E3CNC/releases/` exists with binary files
- **THEN** the test SHALL verify the backup does not contain releases/

#### Scenario: Backup pruning
- **WHEN** 5+ backup directories already exist
- **THEN** the test SHALL verify a new backup prunes the oldest

#### Scenario: Package installation
- **WHEN** the installer runs package installation
- **THEN** the test SHALL verify git, curl, and python3 are installed

#### Scenario: Directory creation
- **WHEN** the installer creates the directory structure
- **THEN** the test SHALL verify `~/E3CNC/{releases,instances,backups,logs}` exist

#### Scenario: Config generation
- **WHEN** the installer generates configurations
- **THEN** the test SHALL verify moonraker.conf exists in the instance config directory

#### Scenario: Binary download
- **WHEN** the thin bootstrap downloads the binary
- **THEN** the test SHALL verify `/usr/local/bin/e3cnc-tui` exists and is executable

#### Scenario: Test isolation
- **WHEN** each test scenario completes
- **THEN** the test SHALL reset the container state (remove ~/E3CNC, ~/e3cnc) to prevent cross-test contamination
