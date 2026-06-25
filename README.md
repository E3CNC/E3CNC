<div align="center">
  <img src="docs/assets/e3c_logo.svg" alt="E3CNC UI" width="200">
</div>

# E3CNC UI

[![Release](https://img.shields.io/github/v/release/E3CNC/E3CNC_UI?style=flat&label=Release&color=00FF00)](https://github.com/E3CNC/E3CNC_UI/releases)
[![Build Frontend](https://github.com/E3CNC/E3CNC_UI/actions/workflows/build-frontend.yml/badge.svg?branch=main)](https://github.com/E3CNC/E3CNC_UI/actions/workflows/build-frontend.yml)
[![License](https://img.shields.io/github/license/E3CNC/E3CNC_UI?style=flat&label=License&color=00FF00)](https://github.com/E3CNC/E3CNC_UI/blob/main/LICENSE)

A modern, responsive CNC controller interface for Klipper-based machines — forked from [Mainsail](https://github.com/mainsail-crew/mainsail) and retargeted from 3D printing to CNC machine control. Built with **Vue 3.5** and **Vuetify 3**.

```bash
git clone https://github.com/E3CNC/E3CNC_UI.git ~/E3CNC_UI && cd ~/E3CNC_UI
./e3cnc-cli install   # idempotent full install (wraps Ansible)
```

## Features

- **DRO** — live machine/work position, velocity, homed flags, axis limits, offset display
- **Jog** — directional pad, configurable step sizes (0.05mm–100mm), XY and Z feedrate sliders, feedrate override slider (M220, 10–300%), keyboard navigation with persistent toast, primary hover effects on jog buttons
- **WCS Offsets** — G54–G59 manager with interactive SVG preview (click-to-move, snap-to-grid, stock size visualization, home confirmation dialog, smooth tool dot animation)
- **SET ALL work zero** — single-button X/Y/Z zero reset with confirmation
- **Spindle & Coolant** — ON/OFF/CCW, RPM control, flood/mist toggles
- **MDI** — console-style command entry with WCS shortcuts
- **CAM Metadata** — tool, work envelope, feeds, spindle RPM in file cards
- **G-code Viewer** — 3D toolpath preview with stock/toolpath anchored to machine Z0, live toolhead in WCS coordinates, CAM WCS Origin metadata parsing
- **Job Start WCS Selection** — pre-start dialog to choose which WCS coordinates to use, all G54–G59 slots visible
- **Fusion 360 Post Processor** — `E3CNC_Fusion360.cps` with CAM WCS Origin comments for viewer integration
- **CNC-Safe Macros** — PAUSE/RESUME/CANCEL_PRINT with `rename_existing: BASE_*`, M3-M9 no-ops (no spindle wired), WCS-aware parking
- **WCS Klipper Plugin** — full G10 L2/L20 support with JSON persistence
- **Moonraker CNC Agent** — guarded endpoints for spindle, coolant, WCS, and CNC settings
- **Auto-Connect** — auto-discovers Moonraker on page load, single-printer auto-connect
- **Floating Panels** — any dashboard panel can be torn off into a draggable, resizable window
- **Scroll-to-Top** — floating button after scrolling 300px
- **Keyboard Jog** — arrow key jogging with toggle
- **State Persistence** — panel positions, editor files, dashboard scroll, grid settings survive reloads
- **E3CNC Theme** — green #00FF00 branding with custom SVG logo, persisted to Moonraker DB
- **Moonraker Update Manager** — add one section to `moonraker.conf` and updates are one-click; works alongside existing Mainsail installations
- **Ansible Deploy** — idempotent install/deploy/uninstall playbooks
- **Semver Releases** — version tags on `main`, GitHub releases, Moonraker update manager integration

## Quick Start

| Method | Command |
|--------|---------|
| **Install (existing Mainsail user)** | Add `[update_manager E3CNC_UI]` block to `moonraker.conf`, restart Klipper via UI, then update |
| **Install (full)** | `./e3cnc-cli install` |
| **Interactive menu** | `./e3cnc-cli` (with auto-loop after each command) |
| **Deploy** | `./e3cnc-cli deploy` |
| **Update / Redeploy** | `./e3cnc-cli update` |
| **Uninstall** | `./e3cnc-cli uninstall` |
| **Status** | `./e3cnc-cli status` |
| **Diagnostics** | `./e3cnc-cli diagnose` |
| **Backup** | `./e3cnc-cli backup` |
| **Restore** | `./e3cnc-cli restore <backup>` |
| **Check deps** | `./e3cnc-cli check` |
| **Remote install** | `./e3cnc-cli install --remote pi@cnc` |
| **Dry-run install** | `./e3cnc-cli install --check` |
| **Logs** | `./e3cnc-cli logs` |
| **Tab completion** | `source scripts/e3cnc-completion.sh` |
| **Select instance** | `./e3cnc-cli --instance cnc_2 status` or use the `[W]` menu option |

## Documentation

Full docs on the [wiki](https://github.com/E3CNC/E3CNC_UI/wiki):

- [Installation](https://github.com/E3CNC/E3CNC_UI/wiki/Installation)
- [Architecture](https://github.com/E3CNC/E3CNC_UI/wiki/Architecture)
- [API Reference](https://github.com/E3CNC/E3CNC_UI/wiki/API)
- [Features](https://github.com/E3CNC/E3CNC_UI/wiki/Features)
- [Changelog](https://github.com/E3CNC/E3CNC_UI/wiki/Changelog)
- [Contributing](https://github.com/E3CNC/E3CNC_UI/wiki/Contributing)

## Repository Structure

| Path | Purpose |
|------|---------|
| `src/` | Mainsail frontend (Vue 3.5, Vuetify 3, TypeScript) |
| `E3CNC/macros/` | Klipper CNC macros (homing override, PAUSE/RESUME, WCS) |
| `E3CNC/extras/` | Klipper WCS plugin (`work_coordinate_systems.py`) |
| `E3CNC/moonraker-mcp/` | Moonraker MCP (MCP server + CNC agent component) |
| `E3CNC/post_processors/` | Fusion 360 CAM post processors |
| `ansible/` | Ansible playbooks for install/deploy/uninstall |
| `_e3cnc_shared.py` | Shared command logic for the e3cnc-cli tool |
| `e3cnc-cli` | Unified CLI — full install, deploy, update, uninstall, status, backup, restore, diagnose, logs |
| `scripts/` | Utility scripts (install, deploy, download frontend) |
| `tests/test_e3cnc_cli.py` | Unit tests for the e3cnc-cli shared module (48 tests) |

## Contributors

- [Shadowphyre](https://github.com/Shadowphyre) — documentation, WCS integration review, project guidance
