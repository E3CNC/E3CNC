<div align="center">
  <img src="docs/assets/e3c_logo.svg" alt="E3CNC UI" width="200">
</div>

# E3CNC

[![Release](https://img.shields.io/github/v/release/E3CNC/E3CNC?style=flat&label=Release&color=00FF00)](https://github.com/E3CNC/E3CNC/releases)
[![CI](https://github.com/E3CNC/E3CNC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/E3CNC/E3CNC/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/E3CNC/E3CNC?style=flat&label=License&color=00FF00)](https://github.com/E3CNC/E3CNC/blob/main/LICENSE)
[![Go Tests](https://github.com/E3CNC/E3CNC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/E3CNC/E3CNC/actions/workflows/ci.yml)

A modern, responsive CNC controller interface for Klipper-based machines — forked from [Mainsail](https://github.com/mainsail-crew/mainsail) and retargeted from 3D printing to CNC machine control. Built with **Vue 3.5**, **Vuetify 3**, and a **Go BubbleTea TUI**.

```bash
# Clone the repo
git clone https://github.com/E3CNC/E3CNC.git ~/E3CNC && cd ~/E3CNC

# Run the installer (sudo required)
sudo ./install.sh

# Or with custom options:
sudo ./install.sh --unattended          # no prompts
sudo ./install.sh --dir /opt/e3cnc  # custom dir
```

## What's New — Go BubbleTea TUI

The CLI is now a **single static Go binary** — zero runtime dependencies. Run `./e3cnc-tui` with no arguments to enter the interactive TUI, or pass a command for non-interactive mode.

| Feature | Description |
|---|---|
| **Install wizard** | 6-screen guided install: pre-flight checks, instance config, 9-step progress, error recovery, health verification, next steps |
| **Instance manager** | List, switch, create, and delete instances with live status indicators |
| **Real-time streaming** | Long-running commands show spinner + line-by-line output |
| **Cancellation** | Ctrl+C cleanly cancels running commands, returns to menu in <2s |
| **Non-interactive mode** | `--json` flag outputs structured data — works in scripts and over SSH |

The Go binary is included in every release at `bin/e3cnc-tui` (linux/arm64, ~3.8 MB, CGO_ENABLED=0).

## Quick Start

| Method | Command |
|---|---|
| **Install** | `./e3cnc-tui install` |
| **Interactive TUI** | `./e3cnc-tui` |
| **Instance manager** | Select "Instances" in the TUI |
| **Install wizard** | `./e3cnc-tui install` |
| **Detect MCU** | `./e3cnc-tui detect-mcu` |
| **Flash firmware** | `./e3cnc-tui flash-mcu` |
| **Generate config** | `./e3cnc-tui init-config` |
| **Update** | `./e3cnc-tui update` |
| **Status** | `./e3cnc-tui status` |

## Architecture

| Layer | Technology | Location |
|---|---|---|
| **CLI / TUI** | Go 1.26+ / BubbleTea | `cli/go/` |
| **Frontend** | Vue 3.5 + Vuetify 3 + TypeScript | `src/` |
| **Services** | Vendored Moonraker + Klipper | `vendor/` |

The Go binary (`e3cnc-tui`) handles all CLI commands natively — no Python runtime required. The Moonraker CNC Agent (`vendor/moonraker/`) communicates with the Go binary via subprocess for deploy operations.

## Docs

- [Full README with features](docs/README.md)
- [TUI documentation](docs/TUI.md)
- [Wiki (GitHub)](https://github.com/E3CNC/E3CNC/wiki)
- [Changelog](docs/CHANGELOG.md)
