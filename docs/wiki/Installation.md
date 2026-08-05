# Installation

E3CNC UI is a maintained fork of Mainsail extended with CNC-native dashboard panels, CAM metadata support, and a Moonraker CNC agent.

## Prerequisites

**Klipper** and **Moonraker** must already be installed and running on a Linux host.

Supported distributions and their package managers:

| Distribution              | Package manager | Notes                                        |
| ------------------------- | --------------- | -------------------------------------------- |
| Debian / Ubuntu / Raspberry Pi OS | `apt-get` | Primary target; fully tested                 |
| Fedora / RHEL / Rocky     | `dnf`           | Uses `--allowerasing` to resolve conflicts   |
| CentOS 7 / legacy RHEL    | `yum`           | Fallback for systems without `dnf`           |
| Arch Linux                | `pacman`        | Uses `base-devel` for build toolchain        |
| openSUSE / SLES           | `zypper`        |                                              |
| Alpine Linux              | `apk`           | Tested on musl via static binary             |

The installer auto-detects the package manager at runtime — no manual selection needed. Core system packages (`git`, `curl`, `unzip`, `zstd`, `nginx`, `supervisor`, `python3`, `python3-pip`, `python3-venv`, build tools, `avahi-utils`) are installed with distro-native names and flags. Packages that are already present are skipped.

The installer is a bash bootstrap script that downloads a single Go static binary — the only things needed on the target machine are:

| Dependency | Why                                         | Install                                  |
| ---------- | ------------------------------------------- | ---------------------------------------- |
| `git`      | Clone the repo                              | Auto-installed by bootstrap              |
| `python3`  | Moonraker/Klipper runtime (not for the CLI) | Auto-installed by bootstrap              |
| `curl`     | Download release artifacts                  | Auto-installed by bootstrap              |
| `unzip`    | Extract artifacts                           | Auto-installed by bootstrap              |
| `zstd`     | Extract compressed stack artifacts          | Auto-installed by bootstrap              |

> **No Go, no Node, no Bun** — everything runs as a pre-built static binary.

## Quick start

```bash
# Clone the repo
git clone https://github.com/E3CNC/E3CNC.git ~/E3CNC && cd ~/E3CNC

# Run the installer (sudo required)
sudo ./install.sh
```

The bootstrap script is intentionally thin — it validates the platform, downloads `e3cnc-tui`, verifies its SHA256 checksum, installs it to `/usr/local/bin`, then hands off to the Go binary:

1. **Pre-flight** — architecture detection (arm64/amd64) and disk space check
2. **Download binary** — fetches the latest `e3cnc-tui` release for your architecture
3. **Verify checksum** — requires a matching `.sha256` file; aborts if missing or mismatched
4. **Install binary** — installs to `/usr/local/bin/e3cnc-tui`
5. **Hand off** — launches the Go TUI install wizard (`e3cnc-tui install`)

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
| `--unattended`  | Run without prompts (passes `--yes` to the Go wizard) |
| `--dir <path>`  | Accepted by the script, but the Go wizard currently installs to `~/E3CNC` regardless |
| `--test-ports`  | Quick check: are ports 8081, 7125, 7126 free? Exits after test |

### Environment variables

| Variable               | Default      | Description                                     |
| ---------------------- | ------------ | ----------------------------------------------- |
| `E3CNC_DIR`            | `$HOME/E3CNC` | Accepted by `install.sh`; the Go wizard currently uses `~/E3CNC` |
| `E3CNC_ADMIN_PORT`     | `8081`       | Admin UI port (auto-detects fallback if busy)   |
| `E3CNC_MOONRAKER_PORT` | `7125`       | Moonraker API port (auto-detects fallback)      |
| `E3CNC_WEB_PORT`       | `80`         | Web UI port (used by nginx)                     |

### Port auto-detection

The installer checks if the default ports (8081, 7125, 7126) are available. If any are in use, it scans upward to find a free port. You can pre-verify with:

```bash
sudo ./install.sh --test-ports
```

This shows which ports are free and simulates the auto-detection logic without installing anything.

### The install UI

The bash installer is a minimal bootstrap with a clear progress flow:

- **Step logging** — colored step markers (`▸`) and status lines
- **Checksum verification** — aborts if the release `.sha256` is missing or mismatched
- **Detailed logging** — everything goes to stdout/stderr; the Go wizard writes the install journal to `~/.e3cnc-tui/`

Once it hands off, the **Go TUI install wizard** provides the full interactive UI (animated spinners, progress bars, green theme):

1. **Detection** — streams system checks live (9 pre-flight checks: Linux, Python 3.8+, git, curl, unzip, zstd, disk space >0.5 GB, sudo NOPASSWD, GitHub API reachable)
2. **MCU picker** — shows detected controller devices when more than 3 are found
3. **Klipper picker** — for import mode, picks an existing Klipper install
4. **Instance configuration** — name, Moonraker port, web port, mDNS hostname, start services toggle
5. **Execution dashboard** — real-time progress across all 9 install phases with timing and status indicators
6. **Error recovery** — if a step fails, offers retry, skip (optional steps), or abort with rollback
7. **Verification** — 7 health checks (Moonraker API, Moonraker service, Klippy, CNC agent, frontend, journal, Klipper service) plus next steps

For non-interactive TUI installs:

```bash
e3cnc-tui install --yes           # unattended (basic)
e3cnc-tui install --yes --name cnc_2  # unattended with instance name
e3cnc-tui install --check         # dry-run only
```

## Install logs

If something goes wrong during installation, a **single consolidated log** captures everything: the TUI wizard output, package-manager output (apt/dnf/pacman/zypper/apk), every step, and the final error.

| File | Location |
| ---- | -------- |
| **Consolidated install log** | `~/E3CNC/logs/install.log` |

The log is append-mode with a `=== E3CNC install attempt <timestamp> ===` header per run, so history survives retries. On failure the log ends with:

```
[11:21:22] ✗ step 4 (Vendor Moonraker and Klipper) FAILED: no current release: readlink /home/user/E3CNC/current: no such file or directory
[11:21:22] === INSTALL FAILED: step 4 (Vendor Moonraker and Klipper): no current release: ... ===
[11:21:22] Full install log: /home/user/E3CNC/logs/install.log
```

**When sharing logs for support**, send `~/E3CNC/logs/install.log` — it contains the failing step, the package-manager error output, and the environment context. The structured journal at `~/.e3cnc-tui/install-journal.json` has the machine-readable status/error pair.

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

# 6. Start Klippy (services are supervisor-managed)
sudo supervisorctl start e3cnc-default-klipper

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
