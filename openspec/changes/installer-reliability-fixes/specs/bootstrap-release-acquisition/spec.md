## ADDED Requirements

### Requirement: Ensure current release before vendoring
The system SHALL ensure a current release exists before the "Vendor Moonraker and Klipper" bootstrap step runs, so a fresh install never fails because `~/E3CNC/current` is missing.

#### Scenario: Fresh install with no current release
- **WHEN** the bootstrap runs on a fresh install where no release is activated
- **THEN** the system SHALL download and activate the latest E3CNC stack release before the "Vendor Moonraker and Klipper" step
- **AND** the "Vendor Moonraker and Klipper" step SHALL complete without a "no current release" error

#### Scenario: Reinstall where a current release already exists
- **WHEN** the bootstrap runs and a current release symlink already exists
- **THEN** the system SHALL skip the download and proceed directly to the steps (no-op)

#### Scenario: Download failure
- **WHEN** the latest release cannot be fetched or activated
- **THEN** the bootstrap SHALL fail with the "obtain E3CNC release" error and SHALL NOT proceed to the vendoring step

### Requirement: Release acquisition seam for tests
The system SHALL expose the release-acquisition entry point through an overridable package variable so tests can stage a fake local release offline.

#### Scenario: Test overrides the fetcher
- **WHEN** a test replaces the `releaseFetcher` package variable with a stub that stages a local fake release
- **THEN** `ensureCurrentRelease()` SHALL use the stub and activate the staged release without any network access

#### Scenario: Production default
- **WHEN** no test override is set
- **THEN** `fetchAndActivateLatestRelease()` SHALL find the latest `e3cnc-stack-*.tar.zst` GitHub artifact, download it, extract it into `~/E3CNC/releases/<version>`, and activate it as the current release
