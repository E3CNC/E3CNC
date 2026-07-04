# Installation

E3CNC UI is a maintained fork of Mainsail extended with CNC-native dashboard panels, CAM metadata support, and a Moonraker CNC agent.

## Prerequisites

**Klipper** and **Moonraker** must already be installed and running.

The CLI only needs `git` and `python3` — everything else is auto-installed:

| Dependency | Why | Source |
|---|---|---|
| `git` | Clone the repo | Install manually: `sudo apt install git` |
| `python3` | Run the CLI and agent | Install manually: `sudo apt install python3` |
| `curl` | Download release artifacts | Auto-installed via `apt` |
| `unzip` | Extract release zips | Auto-installed via `apt` |
| `zstd` | Extract compressed stack artifacts | Auto-installed via `apt` |
| `ansible-playbook` | Run install/deploy playbooks | Auto-installed via `pip3 install --user ansible` |

> `bun`, `node`, and `Go` are **not** needed on the target machine — the frontend and TUI are downloaded as pre-built release binaries.

## Quick start

```bash
cd ~
git clone https://github.com/E3CNC/E3CNC.git
cd E3CNC
./e3cnc-cli install
```

The CLI opens a **6-screen interactive install wizard** (BubbleTea TUI when available, Python fallback otherwise):

1. **Pre-flight dashboard** — validates 9 checks (Python version, git, curl, unzip, zstd, disk space, GitHub API, Ansible, sudo access). **All must pass** — hard block.
2. **Instance configuration** — name, Moonraker port, web port, mDNS hostname, start services toggle
3. **Execution dashboard** — real-time progress across all 9 install phases with timing and status indicators
4. **Error recovery** — if a step fails, offers retry, skip (optional steps), or abort with rollback
5. **Verification dashboard** — 7 health checks (Moonraker API, Moonraker service, Klippy, CNC agent, frontend, journal, Klipper service)
6. **Next steps** — guided path: detect MCU → generate config → flash firmware → edit printer.cfg → restart Klipper

For non-interactive installs:

```bash
./e3cnc-cli install --yes --name cnc_2    # unattended install
./e3cnc-cli install --check               # dry-run only
```

### After install

1. **Refresh your browser** — hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) to load the CNC dashboard
2. **Detect your controller** — `./e3cnc-cli detect-mcu` — shows connected Klipper boards
3. **Generate config** — `./e3cnc-cli init-config` — creates a CNC printer.cfg with the detected MCU path
4. **Flash firmware** — `./e3cnc-cli flash-mcu` — builds and flashes Klipper firmware
5. **Verify install** — `./e3cnc-cli status` to confirm all 9 components are installed
6. **Run diagnostics** — `./e3cnc-cli diagnose` shows Moonraker API health, Klippy state, agent status, and nginx

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
e3cnc-cli detect-mcu

# 2. Generate printer.cfg with detected MCU path
e3cnc-cli init-config

# 3. Edit printer.cfg — search for "!!! ADJUST" and fill in your values
nano ~/e3cnc/instances/default/data/config/printer.cfg

# 4. Build and flash Klipper firmware
e3cnc-cli flash-mcu

# 5. Start Klippy
sudo systemctl start e3cnc-default-klipper
```

## Common operations

| Operation | Command |
|---|---|
| Full install | `./e3cnc-cli install` |
| Update stack | `./e3cnc-cli update` |
| Preview update | `./e3cnc-cli update --dry-run` |
| Uninstall | `./e3cnc-cli uninstall` |
| Status | `./e3cnc-cli status` |
| Check deps | `./e3cnc-cli check` |
| Diagnostics | `./e3cnc-cli diagnose` |
| Backup | `./e3cnc-cli backup` |
| Restore | `./e3cnc-cli restore <backup>` |
| List releases | `./e3cnc-cli releases` |
| Rollback | `./e3cnc-cli rollback` |
| Prune old releases | `./e3cnc-cli prune` |
| Prune old backups | `./e3cnc-cli prune-backups` |
| Manage instances | Select "Instances" in the TUI, or `./e3cnc-cli instances` |
| View logs | `./e3cnc-cli logs` |
| Admin page | `./e3cnc-cli admin-page` |
