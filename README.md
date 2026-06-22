# E3CNC (formerly mainsail-cnc)

[![Release](https://img.shields.io/github/v/release/isaaceliape/mainsail-cnc?style=flat&label=Release&color=00FF00)](https://github.com/isaaceliape/mainsail-cnc/releases)
[![Build Frontend](https://github.com/isaaceliape/mainsail-cnc/actions/workflows/build-frontend.yml/badge.svg?branch=main)](https://github.com/isaaceliape/mainsail-cnc/actions/workflows/build-frontend.yml)
[![License](https://img.shields.io/github/license/isaaceliape/mainsail-cnc?style=flat&label=License&color=00FF00)](https://github.com/isaaceliape/mainsail-cnc/blob/main/LICENSE)

A modern, responsive CNC controller interface for Klipper-based machines — forked from [Mainsail](https://github.com/mainsail-crew/mainsail) and retargeted from 3D printing to CNC machine control. Built with **Vue 3.5** and **Vuetify 3**.

```bash
git clone https://github.com/isaaceliape/mainsail-cnc.git ~/mainsail-cnc && cd ~/mainsail-cnc
ansible-playbook ansible/playbooks/install.yml   # idempotent full install
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
- **Ansible Deploy** — idempotent install/deploy/uninstall playbooks
- **Semver Releases** — version tags on `main`, GitHub releases, Moonraker update manager integration

## Quick Start

| Method | Command |
|--------|---------|
| **Install** | `ansible-playbook ansible/playbooks/install.yml` |
| **Deploy** | `ansible-playbook ansible/playbooks/deploy.yml` |
| **Uninstall** | `ansible-playbook ansible/playbooks/uninstall.yml` |
| **Legacy install** | `bash scripts/install_to_moonraker.sh` |

## Documentation

Full docs on the [wiki](https://github.com/isaaceliape/mainsail-cnc/wiki):

- [Installation](https://github.com/isaaceliape/mainsail-cnc/wiki/Installation)
- [Architecture](https://github.com/isaaceliape/mainsail-cnc/wiki/Architecture)
- [API Reference](https://github.com/isaaceliape/mainsail-cnc/wiki/API)
- [Features](https://github.com/isaaceliape/mainsail-cnc/wiki/Features)
- [Changelog](https://github.com/isaaceliape/mainsail-cnc/wiki/Changelog)
- [Contributing](https://github.com/isaaceliape/mainsail-cnc/wiki/Contributing)

## Repository Structure

| Path | Purpose |
|------|---------|
| `src/` | Mainsail frontend (Vue 3.5, Vuetify 3, TypeScript) |
| `E3CNC/macros/` | Klipper CNC macros (homing override, PAUSE/RESUME, WCS) |
| `E3CNC/extras/` | Klipper WCS plugin (`work_coordinate_systems.py`) |
| `E3CNC/moonraker-cnc-agent/` | Moonraker CNC component |
| `E3CNC/post_processors/` | Fusion 360 CAM post processors |
| `ansible/` | Ansible playbooks for install/deploy/uninstall |
| `scripts/` | Utility scripts (install, deploy, download frontend) |

## Contributors

- [Shadowphyre](https://github.com/Shadowphyre) — documentation, WCS integration review, project guidance
