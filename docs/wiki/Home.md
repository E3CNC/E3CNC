# E3CNC

Welcome to the E3CNC wiki — a CNC-focused control stack built around Klipper, Moonraker, and a maintained Mainsail fork.

> **Landing page**: [E3CNC.github.io](https://E3CNC.github.io)

## Getting Started

- **[Installation](Installation)** — full install guide (CLI, Ansible, bash)
- **[Multi-Instance](Multi-Instance)** — setting up multiple instances (`~/e3cnc/instances/{name}/`)
- **[Architecture](Architecture)** — system design, hybrid Go/Python TUI, state flow
- **[API Reference](API)** — CNC agent endpoint documentation
- **[Moonraker MCP](Moonraker-MCP)** — MCP server tools, G-code reference, printer object queries, and AI agent integration
- **[Design System](Design-System)** — token-based design system plan
- **[Version history](Changelog)** — release notes and version changes
- **[Contributing](Contributing)** — how to contribute

## Quick Start

**Prerequisites:** Klipper + Moonraker installed, plus `git` and `python3`.
The CLI auto-installs everything else (ansible, curl, unzip, zstd).

```bash
cd ~
git clone https://github.com/E3CNC/E3CNC.git
cd E3CNC
./e3cnc-cli install
```

After install, configure your controller:

```bash
./e3cnc-cli detect-mcu          # find your controller board
./e3cnc-cli init-config         # generate printer.cfg
./e3cnc-cli flash-mcu           # build and flash firmware
```

See the [Installation](Installation) page for details.

## CLI Tool — `e3cnc-cli` + `e3cnc-tui`

The CLI now has **two** components:

| Component | Language | Purpose |
|---|---|---|
| `e3cnc-cli` | Python | Shell entry point + all business logic |
| `e3cnc-tui` | Go (BubbleTea) | Interactive TUI, install wizard, instance manager |

Run `./e3cnc-cli` with no arguments to open the interactive TUI.
Run `./e3cnc-tui --help` for available commands.

**Dispatch order:** The Python entry point checks for the Go binary in the deployed release first (`~/e3cnc/current/bin/e3cnc-tui`). If found, it forwards to the Go TUI. Otherwise it falls back to the Python CLI. This means fresh installs work without the Go binary, and the TUI becomes available after the first update.

### Version display

`e3cnc-cli --version` shows the CLI version:

```
e3cnc v0.9.8                                 # same version
e3cnc CLI v0.9.2  |  Deployed stack: v0.9.8  # different versions
```

### Interactive TUI Features

- **Install wizard** — 6-screen guided install: pre-flight checks, instance config, 9-step progress tracking, error recovery (retry/skip/abort), health verification, next steps guide
- **Instance manager** — list instances with live status, switch active, create new, delete with confirmation
- **Real-time streaming** — long-running commands show spinner + line-by-line output
- **Cancellation** — Ctrl+C cleanly cancels running commands, returns to menu in <2 seconds

### Non-interactive mode

Pass `--yes` flag or pipe stdin for non-TTY mode. The TUI collapses to CLI output.

```bash
./e3cnc-cli install --yes        # non-interactive install
./e3cnc-cli install --check      # dry-run (no changes)
```

### Version display (legacy)

The TUI and CLI versions match the deployed stack via build-time injection:

```
./e3cnc-tui --version
e3cnc-tui v0.9.8
```
