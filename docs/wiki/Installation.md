# Installation

E3CNC UI is a maintained fork of Mainsail extended with CNC-native dashboard panels, CAM metadata support, and a Moonraker CNC agent.

## Prerequisites

**Klipper** and **Moonraker** must already be installed and running on a Linux host (Debian/Ubuntu/Raspberry Pi OS).

The installer is a bash bootstrap script that downloads a single Go static binary — the only things needed on the target machine are:

| Dependency | Why                                         | Install                     |
| ---------- | ------------------------------------------- | --------------------------- |
| `git`      | Clone the repo                              | `sudo apt install git`      |
| `python3`  | Moonraker/Klipper runtime (not for the CLI) | `sudo apt install python3`  |
| `curl`     | Download release artifacts                  | Auto-installed by bootstrap |
| `unzip`    | Extract artifacts                           | Auto-installed by bootstrap |
| `zstd`     | Extract compressed stack artifacts          | Auto-installed by bootstrap |

> **No Go, no Node, no Bun** — everything runs as a pre-built static binary.

## Quick start

```bash
# Clone the repo
git clone https://github.com/E3CNC/E3CNC.git ~/E3CNC && cd ~/E3CNC

# Run the installer (sudo required)
sudo ./install.sh
```

The installer walks through **12 steps** with a live progress bar and animated spinners:

1. **Migrate old data** — migrates from `~/e3cnc` (lowercase, legacy) to `~/E3CNC` if found
2. **Backup existing** — timestamps a full backup of any existing install
3. **Auto-detect free ports** — checks 8081, 7125, 7126 and auto-assigns alternatives if busy
4. **Install dependencies** — detects your package manager (apt/dnf/yum/pacman/zypper) and installs git, curl, unzip, zstd, supervisor, python3-pip, iproute2
5. **Create directory structure** — `~/E3CNC/{releases,instances,backups,logs}`
6. **Download binary** — fetches latest `e3cnc-tui` from GitHub releases for your architecture
7. **Verify binary** — checks it's executable and responds to `--version`
8. **Verify capabilities** — confirms `install` and `status` commands are available
9. **Configure supervisor** — sets up supervisor (legacy, now managed by TUI)
10. **Start services** — launches Moonraker and admin UI
11. **Configure instance** — prompts for instance name and controller type
12. **Initialize instance** — runs `e3cnc-tui install` for guided configuration

### Installer options

```bash
sudo ./install.sh                        # interactive (default)
sudo ./install.sh --unattended           # no prompts, uses defaults
sudo ./install.sh --dir /opt/e3cnc       # custom installation directory
sudo ./install.sh --test-ports           # verify port availability only
sudo ./install.sh --help                 # show all options
```

| Option          | Description                              |
| --------------- | ---------------------------------------- |
| `--unattended`  | Run without prompts (instance: "default", controller: "BTT-CB1") |
| `--dir <path>`  | Install to a custom directory instead of `~/E3CNC` |
| `--test-ports`  | Quick check: are ports 8081, 7125, 7126 free? Exits after test |

### Environment variables

| Variable               | Default      | Description                                     |
| ---------------------- | ------------ | ----------------------------------------------- |
| `E3CNC_DIR`            | `$HOME/E3CNC` | Override installation directory                 |
| `E3CNC_ADMIN_PORT`     | `8081`       | Admin UI port (auto-detects fallback if busy)   |
| `E3CNC_MOONRAKER_PORT` | `7125`       | Moonraker API port (auto-detects fallback)      |
| `E3CNC_KLIPPER_PORT`   | `7126`       | Klipper API port (auto-detects fallback)        |

### Port auto-detection

The installer checks if the default ports (8081, 7125, 7126) are available. If any are in use, it scans upward to find a free port. You can pre-verify with:

```bash
sudo ./install.sh --test-ports
```

This shows which ports are free and simulates the auto-detection logic without installing anything.

### The install UI

The bash installer features:

- **Animated progress bar** — `[████████████░░░░░░░░░░] 50%` across 12 steps
- **Green theme** — green headers, checkmarks, and borders
- **Spinner animation** — rotating Braille spinner while long commands run
- **Success box** — green-bordered summary with ports and next steps
- **Detailed logging** — everything goes to `~/E3CNC/logs/installer.log`

### What the TUI install wizard does

After the bootstrap finishes and downloads `e3cnc-tui`, it launches the Go TUI install wizard which adds 6 more screens:

1. **Pre-flight dashboard** — validates 9 checks (OS, Python, git, curl, unzip, zstd, disk space, GitHub API, sudo access). All must pass or it hard-blocks.
2. **Instance configuration** — name, Moonraker port, web port, mDNS hostname, start services toggle
3. **Execution dashboard** — real-time progress across all 9 install phases with timing and status indicators
4. **Error recovery** — if a step fails, offers retry, skip (optional steps), or abort with rollback
5. **Verification dashboard** — 7 health checks (Moonraker API, Moonraker service, Klippy, CNC agent, frontend, journal, Klipper service)
6. **Next steps** — guided path: detect MCU → generate config → flash firmware → edit printer.cfg → restart Klipper

For non-interactive TUI installs:

```bash
e3cnc-tui install --yes           # unattended (basic)
e3cnc-tui install --yes --name cnc_2  # unattended with instance name
e3cnc-tui install --check         # dry-run only
```

## Instance layout

Each instance lives under `~/E3CNC/instances/{name}/`:

```
~/E3CNC/instances/
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
# 1. Open browser → http://<host_ip>:8081
# 2. Find your controller board
e3cnc-tui detect-mcu

# 3. Generate printer.cfg with detected MCU path
e3cnc-tui init-config

# 4. Edit printer.cfg — search for "!!! ADJUST" and fill in your values
nano ~/E3CNC/instances/default/data/config/printer.cfg

# 5. Build and flash Klipper firmware
e3cnc-tui flash-mcu

# 6. Start Klippy
sudo systemctl start e3cnc-default-klipper

# 7. Verify everything is healthy
e3cnc-tui status
e3cnc-tui diagnose
```

## Migration from legacy installs

If you have an existing install under the old `~/e3cnc` (lowercase) directory, the installer **automatically migrates** it:

1. If `~/E3CNC` doesn't exist yet but `~/e3cnc` does → moves the whole directory to `~/E3CNC`
2. If both exist → merges old data into the new location (non-destructive, won't overwrite existing files)
3. A backup is always created before any migration

## Common operations

| Operation          | Command                                                   |
| ------------------ | --------------------------------------------------------- |
| Interactive TUI    | `e3cnc-tui` (no args)                                     |
| Full install       | `sudo ./install.sh`                                       |
| Update stack       | `e3cnc-tui update`                                        |
| Uninstall          | `e3cnc-tui uninstall`                                     |
| Status             | `e3cnc-tui status`                                        |
| Check deps         | `e3cnc-tui check`                                         |
| Diagnostics        | `e3cnc-tui diagnose`                                      |
| Backup             | `e3cnc-tui backup`                                        |
| Restore            | `e3cnc-tui restore <backup>`                              |
| List releases      | `e3cnc-tui releases`                                      |
| Rollback           | `e3cnc-tui rollback`                                      |
| Prune old releases | `e3cnc-tui prune`                                         |
| Prune old backups  | `e3cnc-tui prune-backups`                                 |
| Manage instances   | Select "Instances" in the TUI, or `e3cnc-tui instances`   |
| View logs          | `e3cnc-tui logs`                                          |
| Admin page         | `e3cnc-tui admin-page`                                    |
| Port test          | `sudo ./install.sh --test-ports`                            |
