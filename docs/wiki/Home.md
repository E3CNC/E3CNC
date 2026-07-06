# E3CNC

Welcome to the E3CNC wiki — a CNC-focused control stack built around Klipper, Moonraker, and a maintained Mainsail fork.

> **Landing page**: [E3CNC.github.io](https://E3CNC.github.io)

## Getting Started

- **[Installation](Installation)** — full install guide (Go CLI)
- **[Multi-Instance](Multi-Instance)** — setting up multiple instances (`~/e3cnc/instances/{name}/`)
- **[Architecture](Architecture)** — system design, Go BubbleTea TUI, state flow
- **[API Reference](API)** — CNC agent endpoint documentation
- **[Moonraker MCP](Moonraker-MCP)** — MCP server tools, G-code reference, printer object queries, and AI agent integration
- **[Design System](Design-System)** — token-based design system plan
- **[Version history](Changelog)** — release notes and version changes
- **[Contributing](Contributing)** — how to contribute

## Quick Start

**Prerequisites:** Klipper + Moonraker installed, plus `git` and `python3`.
The CLI auto-installs everything else (curl, unzip, zstd).

```bash
cd ~
git clone https://github.com/E3CNC/E3CNC.git
cd E3CNC
./e3cnc-tui install
```

After install, configure your controller:

```bash
./e3cnc-tui detect-mcu          # find your controller board
./e3cnc-tui init-config         # generate printer.cfg
./e3cnc-tui flash-mcu           # build and flash firmware
```

See the [Installation](Installation) page for details.

## CLI Tool — `e3cnc-tui`

A single **Go static binary** (`CGO_ENABLED=0`, ~3.8 MB) handling all operations:

| Mode | How | Description |
|---|---|---|
| **Interactive TUI** | `./e3cnc-tui` (no args) | Keyboard-driven menu: install wizard, instance manager, command dispatch |
| **CLI mode** | `./e3cnc-tui <command>` | Runs command, prints output, exits. Supports `--json` for structured output |
| **Non-interactive** | `./e3cnc-tui install --yes` | Collapses TUI to CLI output — works in scripts and over SSH |

Run `./e3cnc-tui --help` for all available commands.

### Interactive TUI Features

- **Install wizard** — 6-screen guided install: pre-flight checks, instance config, 9-step progress tracking, error recovery (retry/skip/abort), health verification, next steps guide
- **Instance manager** — list instances with live status, switch active, create new, delete with confirmation
- **Real-time streaming** — long-running commands show spinner + line-by-line output
- **Cancellation** — Ctrl+C cleanly cancels and returns to menu in <2 seconds
- **JSON mode** — every command outputs structured JSON with `--json` flag

### Version display

```bash
./e3cnc-tui --version
e3cnc-tui v0.9.9
```
