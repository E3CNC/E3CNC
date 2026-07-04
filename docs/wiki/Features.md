# Features

## CNC Dashboard

| Feature | Description |
|---|---|
| **DRO** | Live machine/work position, velocity, homed flags, axis limits, offset display |
| **Jog** | Directional pad, configurable step sizes (0.05mm–100mm), XY and Z feedrate sliders, feedrate override (M220, 10–300%), keyboard navigation |
| **WCS Offsets** | G54–G59 manager with interactive SVG preview, click-to-move, snap-to-grid, stock size visualization |
| **SET ALL work zero** | Single-button X/Y/Z zero reset with confirmation |
| **Spindle & Coolant** | ON/OFF/CCW, RPM control, flood/mist toggles |
| **MDI** | Console-style command entry with WCS shortcuts |
| **Job Start WCS Selection** | Pre-start dialog to choose G54–G59 coordinates |

## G-code & CAM

| Feature | Description |
|---|---|
| **CAM Metadata** | Tool number, work envelope, feeds, spindle RPM in file cards |
| **G-code Viewer** | 3D toolpath preview with stock anchored to machine Z0, live toolhead in WCS, CAM WCS Origin parsing |
| **Fusion 360 Post Processor** | `E3CNC_Fusion360.cps` with CAM WCS Origin comments for viewer integration |

## CLI & TUI

| Feature | Description |
|---|---|
| **BubbleTea TUI** | Keyboard-driven terminal UI with install wizard, instance manager, real-time streaming, and cancellation |
| **Install Wizard** | 6-screen guided install: pre-flight checks (9), instance config, 9-step execution dashboard, error recovery (retry/skip/abort), verification (7 health checks), next steps |
| **Instance Manager** | List, switch active, create, delete instances with live status indicators. Persisted to `~/.e3cnc-tui/state.json` |
| **Streaming Output** | Long-running commands show real-time line-by-line output with spinner animation |
| **Cancellation** | Ctrl+C cleanly cancels running subprocess (SIGINT → 2s timeout → SIGKILL) |
| **Non-Interactive Mode** | `--yes` flag collapses TUI to CLI mode for scripts and SSH |
| **Python Fallback** | Python CLI preserved as permanent bootstrap — fresh installs work without Go binary |
| **cross-compiled Go binary** | ~3.8 MB, `CGO_ENABLED=0`, supports linux/arm64, linux/amd64, darwin/amd64 |

## Deployment & Operations

| Feature | Description |
|---|---|
| **Ansible Deploy** | Idempotent install/deploy/uninstall playbooks |
| **Single-Deploy Layout** | `~/e3cnc/releases/<version>/` with `current` symlink. Atomic activation via `current.new` → rename |
| **Health Checks** | 7 checks after every install/update: Moonraker API, service, Klippy, CNC agent, frontend, journal, Klipper |
| **Auto-Rollback** | If critical health checks fail after update, automatically reverts to previous release |
| **7-component status** | Check all components: repo, agent, config, plugins, macros, frontend, release |
| **Diagnose** | Probes Moonraker API, Klippy state, CNC agent, metadata agent, nginx |
| **Backup/Restore** | Timestamped snapshots of frontend, config, and WCS offsets |

## Macros & Plugins

| Feature | Description |
|---|---|
| **CNC-Safe Macros** | PAUSE/RESUME/CANCEL_PRINT with `rename_existing`, M3-M9 no-ops, WCS-aware parking |
| **WCS Klipper Plugin** | G10 L2/L20 support with JSON persistence. Six WCS offset tables (G54–G59) |
| **Moonraker CNC Agent** | Guarded endpoints for spindle, coolant, WCS, jog, and settings |
| **Moonraker MCP Server** | Model Context Protocol server for AI agent integration |

## Frontend

| Feature | Description |
|---|---|
| **Auto-Connect** | Auto-discovers Moonraker on page load, single-printer auto-connect |
| **Floating Panels** | Any dashboard panel can be torn off into a draggable, resizable window |
| **Keyboard Jog** | Arrow key jogging with toggle |
| **State Persistence** | Panel positions, editor files, dashboard scroll, grid settings survive reloads |
| **E3CNC Theme** | Green #00FF00 branding, custom SVG logo, persisted to Moonraker DB |
| **In-App Stack Updates** | Update, rollback, and release info from the E3CNC menu |
| **Semver Releases** | Version tags on `main`, GitHub releases + nightly pre-releases |

## Release & CI

| Feature | Description |
|---|---|
| **Semver Releases** | Version tags on `main` trigger GitHub releases |
| **Nightly Pre-Releases** | Every push to `main` creates/updates a `nightly-main-YYYYMMDD` pre-release |
| **Stack Artifact** | `e3cnc-stack-v<ver>.tar.zst` containing frontend, Moonraker, Klipper extras, macros, CLI, TUI binary, manifest |
| **CI** | Python tests (454) + Go tests (12) + frontend build on every push/PR |
