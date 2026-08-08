## Purpose

Define the multi-distro package manager capability for the E3CNC installer. The installer SHALL detect the installed package manager at runtime and install core system packages using distro-native names and flags, supporting Debian/Ubuntu, Fedora/RHEL/Rocky, Arch Linux, openSUSE, and Alpine Linux.

## Requirements

### Requirement: Package manager detection
The installer SHALL detect the installed package manager at runtime by scanning for available commands (`apt-get`, `dnf`, `yum`, `pacman`, `zypper`, `apk`). If no supported package manager is found, installation SHALL abort with a clear error message listing supported families.

#### Scenario: Debian/Ubuntu system with apt-get
- **WHEN** `apt-get` exists on the system PATH during `installSystemPackages()`
- **THEN** the installer SHALL use `AptManager` to execute package operations

#### Scenario: Fedora/RHEL system with dnf
- **WHEN** `dnf` exists on the system PATH during `installSystemPackages()`
- **THEN** the installer SHALL use `DnfManager` to execute package operations

#### Scenario: Arch Linux system with pacman
- **WHEN** `pacman` exists on the system PATH during `installSystemPackages()`
- **THEN** the installer SHALL use `PacmanManager` to execute package operations

#### Scenario: No supported package manager
- **WHEN** none of `apt-get`, `dnf`, `yum`, `pacman`, `zypper`, `apk` exist on the system PATH
- **THEN** the installer SHALL fail with an error like `"unsupported package manager: please run this installer on a supported Linux distribution"`

### Requirement: Distro-specific package name resolution
The installer SHALL resolve generic package identifiers to distro-specific names using a built-in alias database. The resolution map must cover all 15 core packages across every supported distro family. When a package has no variant for the detected distro, the canonical (generic) name is used.

#### Scenario: python3-venv resolves correctly on deb
- **WHEN** the installer needs `python3-venv` on a Debian-based system
- **THEN** it SHALL install `python3-venv`

#### Scenario: python3-venv resolves correctly on fedora
- **WHEN** the installer needs `python3-venv` on a Fedora system
- **THEN** it SHALL install `python3-virtualenv` (note the different package name)

#### Scenario: python3-venv resolves correctly on arch
- **WHEN** the installer needs `python3-venv` on an Arch Linux system
- **THEN** it SHALL install `python-virtualenv`

#### Scenario: libssl-dev resolves correctly on fedora
- **WHEN** the installer needs `libssl-dev` on a Fedora system
- **THEN** it SHALL install `openssl-devel` (not `libssl-devel`)

#### Scenario: build-essential resolves correctly on arch
- **WHEN** the installer needs `build-essential` on an Arch Linux system
- **THEN** it SHALL install `base-devel`

#### Scenario: Universal package passthrough
- **WHEN** the installer needs a package that has identical names across all distros (e.g., `git`, `curl`)
- **THEN** it SHALL pass the package name through unchanged

### Requirement: Per-distro command flags
Each package manager implementation SHALL use the correct flag conventions for its ecosystem: auto-confirm, conflict resolution, and list-update commands must match distro expectations.

#### Scenario: apt-get uses -y for auto-confirm
- **WHEN** installing packages via AptManager
- **THEN** the command passes `-y` to automatically confirm installation

#### Scenario: dnf uses -y with --allowerasing on RHEL-family
- **WHEN** Rocky/RHEL Linux is detected (rpm-based, dnf present) and installing `curl` while `curl-minimal` conflicts
- **THEN** the command includes `--assumeyes` AND `--allowerasing` flags

#### Scenario: pacman uses --noconfirm
- **WHEN** installing packages via PacmanManager
- **THEN** the command passes `--noconfirm` to skip interactive prompts

#### Scenario: zypper uses -y
- **WHEN** installing packages via ZypperManager
- **THEN** the command passes `-y` to automatically confirm installation

#### Scenario: apk uses --no-cache
- **WHEN** installing packages via ApkManager
- **THEN** the command passes `--no-cache --no-scripts` for minimal installation

### Requirement: Package update before install
Each package manager implementation SHALL refresh package lists before attempting installation, using the distro-native mechanism.

#### Scenario: apt-get runs update
- **WHEN** AptManager.Install() is called
- **THEN** `apt-get update` executes first, and if it fails, Install() returns an error without attempting to install packages

#### Scenario: dnf runs check-update
- **WHEN** DnfManager.Install() is called
- **THEN** `dnf check-update` executes first (non-blocking), and if it fails the failure is logged but not fatal (dnf may work without prior check)

#### Scenario: pacman refreshes sync database
- **WHEN** PacmanManager.Install() is called
- **THEN** `pacman -Sy` executes first to refresh the local package database

### Requirement: Blocking package installation step
The "Install system packages" bootstrap step SHALL be treated as blocking — if package installation fails, the installer shall abort the entire installation rather than continuing with missing dependencies. The failure message SHALL list which packages could not be installed.

#### Scenario: Partial package failure is blocking
- **WHEN** some packages in the required set fail to install (e.g., nginx not available in repo)
- **THEN** the installer SHALL abort with a descriptive error including the failed package names

#### Scenario: Complete success allows continuation
- **WHEN** all 15 core packages install successfully
- **THEN** the installer SHALL proceed to the next bootstrap step ("Configure sudoers")