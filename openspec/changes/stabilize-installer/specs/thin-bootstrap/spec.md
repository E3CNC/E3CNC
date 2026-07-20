## ADDED Requirements

### Requirement: Thin bootstrap
install.sh SHALL be reduced to approximately 150 lines and handle only: sudo check, architecture detection, disk space check, binary download from GitHub, checksum verification, and handoff to `e3cnc-tui install`.

#### Scenario: Fresh install
- **WHEN** the user runs `sudo ./install.sh`
- **THEN** the installer SHALL check sudo access, detect architecture, verify disk space, download the binary, verify its checksum, and call `e3cnc-tui install` for all remaining steps

#### Scenario: Binary download failure
- **WHEN** GitHub is unreachable or the download fails
- **THEN** the installer SHALL retry once, then fail with a clear error message and instructions for manual download

#### Scenario: Checksum mismatch
- **WHEN** the downloaded binary's SHA256 does not match the published checksum
- **THEN** the installer SHALL delete the corrupted file and fail with a checksum error

#### Scenario: Unsupported architecture
- **WHEN** the system architecture is not arm64 or amd64
- **THEN** the installer SHALL fail with a message listing supported architectures

### Requirement: Network timeout
The curl download SHALL have a 120-second timeout to prevent infinite hangs on slow or broken networks.

#### Scenario: Network hang
- **WHEN** the network connection hangs during binary download
- **THEN** the installer SHALL timeout after 120 seconds and fail with a timeout error

#### Scenario: Slow connection
- **WHEN** the network is slow but still transferring data
- **THEN** the 120-second timeout SHALL apply to total transfer time, not connection time
