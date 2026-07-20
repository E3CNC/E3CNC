## ADDED Requirements

### Requirement: Update TUI wizard
The update command SHALL have a dedicated TUI wizard with at least 2 screens: a confirm screen and a progress+verification screen.

#### Scenario: Check current and latest version
- **WHEN** the update wizard starts
- **THEN** it SHALL detect the currently installed version and check GitHub for the latest release

#### Scenario: Show changelog
- **WHEN** the latest version differs from the installed version
- **THEN** the confirm screen SHALL display a changelog of changes between versions, fetched from GitHub release notes

#### Scenario: Confirm before update
- **WHEN** the confirm screen is displayed
- **THEN** the user SHALL press Enter to proceed with the update or 'q' to skip

#### Scenario: Update progress screen
- **WHEN** the update runs
- **THEN** the progress screen SHALL show: download, extract, activate, health checks

#### Scenario: No update available
- **WHEN** the installed version matches the latest GitHub release
- **THEN** the wizard SHALL display "Already up to date" and return to the menu

### Requirement: Hybrid rollback
The update SHALL support hybrid rollback: auto-rollback for critical health check failures, manual rollback for minor failures.

#### Scenario: Auto-rollback on critical failure
- **WHEN** a critical health check fails after update (Moonraker API, Klippy, CNC Agent)
- **THEN** the wizard SHALL automatically roll back to the previous version by re-symlinking
- **THEN** the wizard SHALL restart services after rollback
- **THEN** the wizard SHALL display a message explaining what failed and that the rollback was applied

#### Scenario: Manual rollback on minor failure
- **WHEN** a non-critical health check fails after update (frontend, journal, mDNS, nginx)
- **THEN** the wizard SHALL complete the update
- **THEN** the wizard SHALL show a warning with the failed checks
- **THEN** the wizard SHALL display a rollback button the user can press

#### Scenario: Rollback preserves new release
- **WHEN** a rollback is triggered (auto or manual)
- **THEN** the new release directory SHALL NOT be deleted — only the symlink is reverted
- **THEN** the new release SHALL be pruned on the next successful update

#### Scenario: Update already up to date
- **WHEN** no newer version is available
- **THEN** the wizard SHALL show "Already up to date" and exit