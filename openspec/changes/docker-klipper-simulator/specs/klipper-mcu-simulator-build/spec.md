## ADDED Requirements

### Requirement: Simulator MCU binary is built from vendored source
The Docker image SHALL build the Klipper MCU firmware for the host simulator target (`CONFIG_MACH_SIMU=y`) from `vendor/klipper/` during image build.

#### Scenario: Build succeeds
- **WHEN** `docker compose build` runs
- **THEN** a binary at `vendor/klipper/out/klipper.elf` (or equivalent path) SHALL be produced with `CONFIG_MACH_SIMU=y`

#### Scenario: Kconfig configured
- **WHEN** the build runs
- **THEN** the Klipper `.config` SHALL have `CONFIG_MACH_SIMU=y` set

### Requirement: Simulator MCU runs as a Linux process
The simulator binary SHALL run as a Linux userspace process. It SHALL NOT require root or any hardware access.

#### Scenario: Binary runs
- **WHEN** the simulator binary is executed
- **THEN** it SHALL start and accept serial communication via stdin/stdout

### Requirement: Build is cached
The Docker build SHALL cache the Klipper build artifacts to avoid full recompilation on unrelated changes.

#### Scenario: Fast rebuild
- **WHEN** only Moonraker Python code changes
- **THEN** the Klipper simulator SHALL NOT be rebuilt (Docker layer cache SHALL be used)