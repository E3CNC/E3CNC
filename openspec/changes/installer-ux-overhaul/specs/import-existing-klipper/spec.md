## ADDED Requirements

### Requirement: Detect existing Klipper installation
The installer SHALL detect existing Klipper installations on the machine using a heuristic scan.

#### Scenario: Detect via systemd service
- **WHEN** `klippy.service` is active or enabled in systemd
- **THEN** the installer SHALL record the service path and mark Klipper as detected

#### Scenario: Detect via common paths
- **WHEN** Klipper source exists at `/home/pi/klipper/` or `/home/*/klipper/`
- **THEN** the installer SHALL record the source path and Klipper version

#### Scenario: Detect printer.cfg
- **WHEN** a printer.cfg exists at common locations (`/home/pi/printer.cfg`, `/home/pi/klipper_config/printer.cfg`)
- **THEN** the installer SHALL parse the `[mcu]` section to identify the MCU device

#### Scenario: Multiple Klipper installs found
- **WHEN** multiple Klipper installations are detected
- **THEN** the installer SHALL present a picker in the decision screen for the user to select which one to import

#### Scenario: No Klipper found
- **WHEN** no existing Klipper installation is detected
- **THEN** the installer SHALL disable the import option and suggest a fresh install

### Requirement: Non-destructive import
The import SHALL create an E3CNC management layer around the existing Klipper install without modifying Klipper's own files.

#### Scenario: Backup before modifying configs
- **WHEN** the import pipeline needs to create or modify config files
- **THEN** the installer SHALL create a timestamped backup of any existing configs before writing

#### Scenario: Show diff before writing
- **WHEN** the import pipeline generates a moonraker.conf that references existing Klipper configs
- **THEN** the installer SHALL show a diff of what will change in the decision screen

#### Scenario: Import preserves existing Klipper service
- **WHEN** Klipper is already running via systemd
- **THEN** the installer SHALL NOT stop, restart, or modify the existing Klipper service

### Requirement: Import pipeline
The import pipeline SHALL have a separate step list from the fresh install pipeline.

#### Scenario: Import pipeline steps
- **WHEN** the import pipeline runs
- **THEN** it SHALL execute: system packages, sudoers, detect existing Klipper, create E3CNC directories, config Moonraker, nginx+mDNS, start services+integrate

#### Scenario: Import does not vendor Klipper
- **WHEN** the import pipeline runs
- **THEN** it SHALL NOT vendor a new copy of Klipper — it SHALL reference the existing installation

#### Scenario: Import does not create Klipper virtualenv
- **WHEN** the import pipeline runs
- **THEN** it SHALL NOT create a new Python virtualenv for Klipper

### Requirement: Import rollback
If the import fails, the rollback SHALL only clean up E3CNC-created artifacts and SHALL NOT touch the original Klipper files.

#### Scenario: Rollback cleans E3CNC additions
- **WHEN** the import is aborted after creating E3CNC directories and Moonraker config
- **THEN** the rollback SHALL remove E3CNC directories, Moonraker config, nginx config, and supervisor config
- **THEN** the rollback SHALL NOT modify any pre-existing Klipper files