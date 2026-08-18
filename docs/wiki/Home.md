# E3CNC

Welcome to the E3CNC wiki — a CNC-focused control stack built around Klipper, Moonraker, and a maintained Mainsail fork.

> **Landing page**: [E3CNC.github.io](https://E3CNC.github.io)

## Getting Started

- **[Installation](Installation)** — full install guide (Go CLI)
- **[Multi-Instance](Multi-Instance)** — setting up multiple instances (`~/E3CNC/instances/{name}/`)
- **[Architecture](Architecture)** — system design, Go BubbleTea TUI, state flow
- **[Version history](Changelog)** — release notes and version changes
- **[Contributing](Contributing)** — how to contribute

## Quick Start

**Prerequisites:** A Linux host running a supported distribution (Debian/Ubuntu, Fedora/RHEL/Rocky, Arch, openSUSE, or Alpine). **Klipper and Moonraker are bundled** — the installer vendors both and sets everything up automatically.

```bash
cd ~
git clone https://github.com/E3CNC/E3CNC.git ~/E3CNC
cd ~/E3CNC
sudo ./install.sh
```

After install, configure your controller:

```bash
./e3cnc-tui detect-mcu          # find your controller board
./e3cnc-tui init-config         # generate printer.cfg
./e3cnc-tui flash-mcu           # build and flash firmware
```

See the [Installation](Installation) page for details.

## CLI Tool — `e3cnc-tui`

A single **Go static binary** (`CGO_ENABLED=0`, ~7.8 MB) handling all operations:

| Mode                | How                         | Description                                                                 |
| ------------------- | --------------------------- | --------------------------------------------------------------------------- |
| **Interactive TUI** | `./e3cnc-tui` (no args)     | Keyboard-driven menu: install wizard, instance manager, command dispatch    |
| **CLI mode**        | `./e3cnc-tui <command>`     | Runs command, prints output, exits. Supports `--json` for structured output |
| **Non-interactive** | `./e3cnc-tui install --yes` | Collapses TUI to CLI output — works in scripts and over SSH                 |

Run `./e3cnc-tui --help` for all available commands.

### Interactive TUI Features

- **Install wizard** — 7-screen guided install: detection (9 pre-flight checks), MCU picker, Klipper picker, instance config, 9-step execution dashboard, error recovery (retry/skip/abort), verification (7 health checks) + next steps
- **Instance manager** — list instances with live status, switch active, create new, delete with confirmation
- **Real-time streaming** — long-running commands show spinner + line-by-line output
- **Cancellation** — Ctrl+C cleanly cancels and returns to menu in <2 seconds
- **JSON mode** — every command outputs structured JSON with `--json` flag

### Version display

Check your installed version:

```bash
./e3cnc-tui --version
```

The version is embedded in the binary at build time from the Git tag. To see the latest release, check [GitHub Releases](https://github.com/E3CNC/E3CNC/releases).

## What's New in v0.10.2

### 🔧 Installer Reliability Improvements

- **Automatic rollback** — if any blocking install step fails, the installer automatically cleans up partial state (services, configs, instance directory)
- **Air-gapped install support** — use `--artifact path/to/release.tar.zst` to install without internet access
- **Distro compatibility check** — validates your Linux distribution before starting installation, with clear error messages for unsupported systems
- **Service start control** — toggle service startup during install (`--no-start` flag or 's' key in TUI)
- **GitHub rate-limit handling** — automatic retry with exponential backoff on API rate limits

### 🛠️ Operational Improvements

- **Smart nginx startup** — starts nginx if not running (not just reload), fixing container deployments
- **Service verification** — polls supervisor services for RUNNING state with 16-second timeout
- **Deploy scripts/macros** — automatically copies `scripts/` and `config/macros/` from current release to instances
- **MCU auto-detection** — scans `/dev/serial/by-id/` → `/dev/ttyACM0` → `/dev/ttyUSB0` for printer.cfg generation

### 🧪 Test Coverage

- All Docker integration tests pass, including full end-to-end service verification
- Test stubs properly isolated to testuser's home directory

See the [Changelog](Changelog) for complete release notes.
