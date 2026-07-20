## ADDED Requirements

### Requirement: Migrate from legacy directory
The installer SHALL detect an existing `~/e3cnc` (lowercase) directory and migrate its contents to `~/E3CNC` (uppercase). Migration MUST be non-destructive: it SHALL NOT overwrite existing files in the target directory.

#### Scenario: Only old directory exists
- **WHEN** `~/e3cnc` exists but `~/E3CNC` does not
- **THEN** the installer SHALL rename `~/e3cnc` to `~/E3CNC`

#### Scenario: Both directories exist
- **WHEN** both `~/e3cnc` and `~/E3CNC` exist
- **THEN** the installer SHALL merge contents from `~/e3cnc` into `~/E3CNC`, skipping files that already exist in the target

#### Scenario: Neither directory exists (fresh install)
- **WHEN** neither `~/e3cnc` nor `~/E3CNC` exist
- **THEN** the installer SHALL create `~/E3CNC` with the standard directory structure

#### Scenario: Only new directory exists
- **WHEN** `~/E3CNC` exists but `~/e3cnc` does not
- **THEN** the installer SHALL skip migration and proceed with the existing directory

#### Scenario: Migration with --migrate-only flag
- **WHEN** the user runs `e3cnc-tui install --migrate-only`
- **THEN** the installer SHALL perform migration and exit without further installation steps

### Requirement: Migration handles edge cases
The migration SHALL handle symbolic links, special files, permission differences, and empty directories correctly.

#### Scenario: Old directory is a symlink
- **WHEN** `~/e3cnc` is a symbolic link to another directory
- **THEN** the installer SHALL follow the symlink and migrate the actual contents

#### Scenario: Merge with conflicting subdirectories
- **WHEN** both `~/e3cnc/instances/default/data/config` and `~/E3CNC/instances/default/data/config` exist
- **THEN** the installer SHALL keep both sets of files, preferring the existing files in `~/E3CNC`
