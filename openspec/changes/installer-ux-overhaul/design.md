## Context

The current install flow has 8 TUI screens (ModeSelect → PreFlight → MCUSelect → Config → FirmwareCheck → ExecDashboard → Verification → ErrorRecovery). The update flow has no TUI — it runs a CLI command inside a raw scrollable text viewport. The `install.sh` bootstrap is a minimal 116-line script with no color, no progress bar, and terse error messages.

The existing bootstrap pipeline is monolithic — a single `Bootstrap()` function with 9 steps. There is no mode branching; the "import existing Klipper" concept exists in the TUI (Screen 0: Mode Select) but the pipeline treats both modes identically.

## Goals / Non-Goals

**Goals:**
- Reduce install wizard from 8 screens to 3: loading/detection → decision/confirm → progress+verification
- Add a dedicated TUI update wizard with changelog and hybrid rollback
- Polish `install.sh` with color output, download progress bar, `--help`/`--version` flags, and better error messages
- Implement a separate import pipeline for wrapping existing Klipper installations
- Add backup+diff safety before modifying configs during import
- Add integration tests for all new flows

**Non-Goals:**
- Package manager distribution (brew/apt) — out of scope
- Firmware flashing during install — remains a separate post-install step
- Multi-instance install flow — one instance per wizard run
- Offline install support — deferred
- Remote install via SSH — deferred

## Decisions

### 1. 3 screens instead of 8
The current 8 screens give each step its own moment, but most users press Enter through 5 of them. The 3-screen flow collapses passive screens into a single decision point and runs detection in a brief loading phase.

Loading screen: streaming per-detection progress (2-5 seconds), transitions automatically.
Screen 1: mode selection + instance name + auto-detected summary. User confirms or adjusts.
Screen 2: merged progress pipeline + verification. Error recovery shown inline as an overlay.

### 2. Separate bootstrap pipelines per mode
Fresh install and import have fundamentally different steps (import skips vendor Klipper, virtualenvs, and has its own detection/backup steps). Rather than branching inside a shared pipeline, each mode has its own step list. The TUI renders whichever pipeline is active.

### 3. Hybrid rollback for updates
Critical health checks (Moonraker API, Klippy, CNC Agent) trigger auto-rollback on failure — the user never sees a broken state. Minor checks (frontend, journal, mDNS, nginx) surface as warnings with an optional manual rollback button on the final screen.

### 4. Heuristic scan for import
Scan in order: systemd service status → common paths (/home/pi/klipper, /home/*/klipper) → printer.cfg parsing for MCU. Multiple matches show a picker in Screen 1.

### 5. Backup + diff for import safety
Before modifying configs, snapshot the printer.cfg and show a diff of what Moonraker will add. User confirms before any write.

### 6. Reusable progress component
Screen 2 uses the same Bubble Tea component for install, import, and update flows. The pipeline emits typed steps, the TUI renders them identically.

## Risks / Trade-offs

- [Loading timing] The loading screen blocks for 2-5 seconds. Users with slow MCU enumeration (USB hubs) may see 5+ seconds. Mitigation: show per-detection progress so the user sees activity.
- [Multi-MCU in Screen 1] If a machine has 3+ MCUs, an inline selector in Screen 1 is cramped. Mitigation: if >3 MCUs detected, expand to a full-screen picker (back to current behavior).
- [Import path edge cases] Klipper could be installed in unusual locations (system-wide pip install, Docker, custom prefix). The heuristic scan will miss these. Mitigation: fallback to "not found, try fresh install" with a hint.
- [Changelog API dependency] The update wizard fetches release notes from GitHub API. If GitHub is unreachable, no changelog shown — update still proceeds.
- [Rollback data loss] Auto-rollback removes the new release directory. If the user wanted to inspect it, it's gone. Mitigation: keep `releases/<new-version>/` even after rollback, with a prune-on-next-update cleanup.