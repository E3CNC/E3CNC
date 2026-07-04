<div align="center">
  <img src="docs/assets/e3c_logo.svg" alt="E3CNC UI" width="200">
</div>

# E3CNC UI

[![Release](https://img.shields.io/github/v/release/E3CNC/E3CNC?style=flat&label=Release&color=00FF00)](https://github.com/E3CNC/E3CNC/releases)
[![CI](https://github.com/E3CNC/E3CNC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/E3CNC/E3CNC/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/E3CNC/E3CNC?style=flat&label=License&color=00FF00)](https://github.com/E3CNC/E3CNC/blob/main/LICENSE)
[![Go Tests](https://github.com/E3CNC/E3CNC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/E3CNC/E3CNC/actions/workflows/ci.yml)

A modern, responsive CNC controller interface for Klipper-based machines — forked from [Mainsail](https://github.com/mainsail-crew/mainsail) and retargeted from 3D printing to CNC machine control. Built with **Vue 3.5**, **Vuetify 3**, and a **Go BubbleTea TUI**.

```bash
git clone https://github.com/E3CNC/E3CNC.git ~/E3CNC && cd ~/E3CNC
./e3cnc-cli install   # one-command full install
```

## What's New — BubbleTea TUI

The CLI now ships with a **Go BubbleTea Terminal UI** (`e3cnc-tui`) — a fast, keyboard-driven replacement for the old Python menu. Run `./e3cnc-cli` with no arguments to enter the interactive TUI.

| Feature | Description |
|---|---|
| **Install wizard** | 6-screen guided install: pre-flight checks, instance config, 9-step progress, error recovery, health verification, next steps |
| **Instance manager** | List, switch, create, and delete instances with live status indicators |
| **Real-time streaming** | Long-running commands show spinner + line-by-line output |
| **Cancellation** | Ctrl+C cleanly cancels running commands, returns to menu in <2s |
| **Non-interactive mode** | `--yes` flag collapses TUI to CLI mode — works in scripts and over SSH |

The Go binary is included in every release at `bin/e3cnc-tui` (linux/arm64, ~3.8 MB). The Python CLI is preserved as a permanent bootstrap fallback.

## Quick Start

| Method | Command |
|---|---|
| **Install** | `./e3cnc-cli install` |
| **Interactive TUI** | `./e3cnc-cli` |
| **Instance manager** | Select "Instances" in the TUI |
| **Install wizard** | `./e3cnc-cli install` |
| **Detect MCU** | `./e3cnc-cli detect-mcu` |
| **Flash firmware** | `./e3cnc-cli flash-mcu` |
| **Generate config** | `./e3cnc-cli init-config` |
| **Update** | `./e3cnc-cli update` |
| **Status** | `./e3cnc-cli status` |

## Docs

- [Full README with features](docs/README.md)
- [TUI documentation](docs/TUI.md)
- [Wiki (GitHub)](https://github.com/E3CNC/E3CNC/wiki)
- [Changelog](docs/CHANGELOG.md)
