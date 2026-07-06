# Installation

E3CNC UI is a maintained fork of Mainsail extended with CNC-native dashboard panels, CAM metadata support, and a Moonraker CNC agent.

## Prerequisites

**Klipper** and **Moonraker** must already be installed and running on a Linux host (Debian/Ubuntu/Raspberry Pi OS).

The CLI is a single Go static binary — the only things needed on the target machine are:

| Dependency | Why | Install |
|---|---|---|
| `git` | Clone the repo | `sudo apt install git` |
| `python3` | Moonraker/Klipper runtime (not for the CLI) | `sudo apt install python3` |
| `curl` | Download release artifacts | Auto-installed by bootstrap |
| `unzip` | Extract artifacts | Auto-installed by bootstrap |
| `zstd` | Extract compressed stack artifacts | Auto-installed by bootstrap |

> `bun`, `node`, and `Go` are **not** needed on the target machine — everything runs as a pre-built static binary.

## Quick start

```bash
cd ~
git clone https://github.com/E3CNC/E3CNC.git
cd E3CNC
./e3cnc-tui install
```

The CLI opens a **6-screen interactive install wizard**:

1. **Pre-flight dashboard** — validates 9 checks (OS, Python, git, curl, unzip, zstd, disk space, GitHub API, sudo access). **All must pass** — hard block.
2. **Instance configuration** — name, Moonraker port, web port, mDNS hostname, start services toggle
3. **Execution dashboard** — real-time progress across all 9 install phases with timing and status indicators
4. **Error recovery** — if a step fails, offers retry, skip (optional steps), or abort with rollback
5. **Verification dashboard** — 7 health checks (Moonraker API, Moonraker service, Klippy, CNC agent, frontend, journal, Klipper service)
6. **Next steps** — guided path: detect MCU → generate config → flash firmware → edit printer.cfg → restart Klipper

For non-interactive installs:

```bash
./e3cnc-tui install --yes --name cnc_2    # unattended install
./e3cnc-tui install --check               # dry-run only
```

### After install

1. **Refresh your browser** — hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) to load the CNC dashboard
2. **Detect your controller** — `./e3cnc-tui detect-mcu` — shows connected Klipper boards
3. **Generate config** — `./e3cnc-tui init-config` — creates a CNC printer.cfg with the detected MCU path
4. **Flash firmware** — `./e3cnc-tui flash-mcu` — builds and flashes Klipper firmware
5. **Verify install** — `./e3cnc-tui status` to confirm all components are healthy
6. **Run diagnostics** — `./e3cnc-tui diagnose` shows Moonraker API health, Klippy state, agent status, and nginx

## Instance layout

Each instance lives under `~/e3cnc/instances/{name}/`:

```
~/e3cnc/instances/
├── default/
│   ├── data/
│   │   ├── config/
│   │   │   └── printer.cfg
│   │   │   └── moonraker.conf
│   │   ├── logs/
│   │   └── scripts/
│   └── frontend/
├── cnc_2/
│   └── ...
└── lab/
    └── ...
```

## Post-install workflow

```bash
# 1. Find your controller board
./e3cnc-tui detect-mcu

# 2. Generate printer.cfg with detected MCU path
./e3cnc-tui init-config

# 3. Edit printer.cfg — search for "!!! ADJUST" and fill in your values
nano ~/e3cnc/instances/default/data/config/printer.cfg

# 4. Build and flash Klipper firmware
./e3cnc-tui flash-mcu

# 5. Start Klippy
sudo systemctl start e3cnc-default-klipper
```

## Common operations

| Operation | Command |
|---|---|
| Full install | `./e3cnc-tui install` |
| Update stack | `./e3cnc-tui update` |
| Uninstall | `./e3cnc-tui uninstall` |
| Status | `./e3cnc-tui status` |
| Check deps | `./e3cnc-tui check` |
| Diagnostics | `./e3cnc-tui diagnose` |
| Backup | `./e3cnc-tui backup` |
| Restore | `./e3cnc-tui restore <backup>` |
| List releases | `./e3cnc-tui releases` |
| Rollback | `./e3cnc-tui rollback` |
| Prune old releases | `./e3cnc-tui prune` |
| Prune old backups | `./e3cnc-tui prune-backups` |
| Manage instances | Select "Instances" in the TUI, or `./e3cnc-tui instances` |
| View logs | `./e3cnc-tui logs` |
| Admin page | `./e3cnc-tui admin-page` |
