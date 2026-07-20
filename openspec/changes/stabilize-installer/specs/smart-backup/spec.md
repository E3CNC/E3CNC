## ADDED Requirements

### Requirement: Smart content backup
The installer SHALL create a pre-installation backup containing only user data (instances/ and logs/) rather than the entire E3CNC directory. The backup SHALL NOT include releases/, admin/, or backups/.

#### Scenario: Backup with existing instances
- **WHEN** `~/E3CNC/instances/` contains user configuration files
- **THEN** the installer SHALL create a backup at `~/E3CNC/backups/pre-install-<timestamp>/instances/`

#### Scenario: Backup excludes releases
- **WHEN** `~/E3CNC/releases/` contains downloaded binary releases
- **THEN** the installer SHALL NOT include the releases/ directory in the backup

#### Scenario: Backup excludes previous backups
- **WHEN** `~/E3CNC/backups/` contains previous backup directories
- **THEN** the installer SHALL NOT include the backups/ directory in the new backup

#### Scenario: Backup with --backup-only flag
- **WHEN** the user runs `e3cnc-tui install --backup-only`
- **THEN** the installer SHALL create a backup and exit without further installation

### Requirement: Backup pruning
The installer SHALL limit the number of stored backups to 5. When a new backup causes the count to exceed 5, the oldest backup SHALL be removed.

#### Scenario: Prune old backups
- **WHEN** 6 backups already exist and a new backup is created
- **THEN** the installer SHALL remove the oldest backup directory

#### Scenario: Under limit
- **WHEN** 3 backups exist and a new backup is created
- **THEN** the installer SHALL keep all 4 backups (no pruning needed)

#### Scenario: No pruning for first backup
- **WHEN** no backups exist and a new backup is created
- **THEN** the installer SHALL NOT attempt to prune

### Requirement: Backup preserves file metadata
The backup SHALL preserve file permissions, ownership, and timestamps.

#### Scenario: Preserve permissions
- **WHEN** a configuration file has mode 0600 (owner-only read/write)
- **THEN** the backed-up file SHALL also have mode 0600
