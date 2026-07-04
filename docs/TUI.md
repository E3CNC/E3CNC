# E3CNC TUI — BubbleTea Terminal User Interface

> **Status:** Active (Phases 0–6 complete)  
> **Binary:** `e3cnc-tui` — static Go binary  
> **Source:** `cli/go/`

The E3CNC TUI replaces the Python `simple-term-menu` interface with a fast,
keyboard-driven BubbleTea terminal UI. It handles interactive commands
(install wizard, instance management) while dispatching non-interactive
commands to the Python CLI.

## Architecture

### Hybrid Go/Python Model

```
┌────────────────────────────────┐
│  BubbleTea Go Binary           │  ← e3cnc-tui (static binary)
│  (cli/go/)                     │
│                                │
│  ┌─────────────────────────┐   │
│  │  TUI (menu, progress,   │   │
│  │  confirmations, forms)  │   │
│  └──────────┬──────────────┘   │
│             │                   │
│  ┌──────────▼──────────────┐   │
│  │  runner.go              │   │  ← subprocess layer
│  │  • resolve Python path  │   │
│  │  • resolve release path │   │
│  │  • exec.CommandContext   │   │
│  │  • stream stdout/stderr  │   │
│  └──────────┬──────────────┘   │
└─────────────┼──────────────────┘
              │ exec.CommandContext
              │ env: E3CNC_FORCE_COLOR=1
┌─────────────▼──────────────────┐
│  Python CLI                     │  ← all business logic
│  (e3cnc-cli and cli/*.py)      │
│                                │
│  • Commands emit plain text    │
│  • Stderr = warnings, errors   │
│  • Exit code = success/fail    │
└────────────────────────────────┘
```

The Go binary does NOT attempt ANSI passthrough. Python output is plain text
(piped stdout means `isatty()` returns false). The Go binary applies its own
`lipgloss` styling to TUI chrome (menu, status bar, confirmation dialogs)
and displays Python's output as-is in a styled viewport.

### Bootstrap Flow

The `e3cnc-cli` Python script is the **sole entry point forever**. On startup:

1. **Check** `~/e3cnc/current/bin/e3cnc-tui` exists
   - YES → `os.execv()` to Go binary (invisible to the user)
   - NO → fall through to Python CLI
2. **Python path** handles fresh installs where no release exists yet

After the first `install` + `update`, the Go binary exists in the release
and future invocations forward transparently.

## Using the TUI

### Starting

```bash
./e3cnc-cli              # Opens interactive TUI (if TTY available)
./e3cnc-cli status       # CLI mode — dispatches to Python (no TUI)
./e3cnc-tui              # Same as above (if already in release path)
e3cnc-tui --version      # Show version
e3cnc-tui --help         # Show help
```

### Main Menu

| Key | Action |
|---|---|
| `↑`/`k` | Navigate up |
| `↓`/`j` | Navigate down |
| `Enter` | Select command |
| `q` | Quit |
| `?` | Toggle help |

Menu items are organized into sections:

| Section | Commands |
|---|---|
| **Setup** | Install, Update, Uninstall |
| **Monitor** | Status, Check Deps, Instances |
| **Hardware** | Detect MCU, Flash MCU, Init Config |
| **Manage** | Releases, Rollback, Backup, Restore |
| **Tools** | CLI Log, Diagnose, Logs, Admin Page |

Destructive commands (Install, Update, Uninstall, Flash MCU, Init Config,
Rollback) are highlighted in **red** when selected.

## Install Wizard

The TUI's most powerful feature — a 6-screen guided installation wizard:

### Screen 1 — Pre-Flight Dashboard
Validates the environment before any destructive operations:

| Check | Method |
|---|---|
| Python 3.8+ | `sys.version_info` |
| git | `shutil.which` |
| curl | `shutil.which` |
| unzip | `shutil.which` |
| zstd | `shutil.which` |
| Disk space (≥0.5 GB) | `os.statvfs` |
| GitHub API reachable | HTTP HEAD to `api.github.com` |
| ansible-playbook | `shutil.which` |
| Sudo (NOPASSWD) | `sudo -n true` |

**All checks must pass** before installation starts. This is a hard block —
the installer will not proceed with a failing environment.

### Screen 2 — Instance Configuration

| Field | Default | Validation |
|---|---|---|
| Instance name | `default` | Lowercase, numbers, hyphens; no conflicts |
| Moonraker port | Next available (7125+) | 1024–65535, not in use |
| Web port | 80 (8080 if taken) | No conflicts |
| mDNS hostname | `e3cnc` | DNS-safe |
| Start services | Yes | Toggle |

### Screen 3 — Execution Dashboard
Shows real-time progress across all 9 installation phases:

```
[1/9]  Bootstrap infrastructure ............ ✓ 14s
[2/9]  Install system packages ............. ✓ 8s
[3/9]  Configure Moonraker ................ ✓ 3s
[4/9]  Download release .................. ◌ 34s
[5/9]  Verify checksum .................... pending
...
```

| Key | Action |
|---|---|
| `v` | Toggle verbose log |
| `Ctrl+C` | Cancel (shows error recovery) |
| `↑`/`↓` | Scroll through steps |

### Screen 4 — Error Recovery
When a step fails, shows the error with actionable recovery options:

| Key | Action |
|---|---|
| `r` | Retry the failed step |
| `s` | Skip (for optional steps only) |
| `a` | Abort and rollback |

Each error includes a likely cause and suggested fix (e.g.,
`sudo chown -R $USER:$USER ~/e3cnc` for permission errors).

### Screen 5 — Verification Dashboard
Post-install health checks (7 checks):

| Check | Source |
|---|---|
| Moonraker API | HTTP 200 to `/server/info` |
| Moonraker service | `systemctl is-active` |
| Klippy | Socket check (placeholder = expected) |
| cnc_agent | Moonraker component list |
| Frontend | HTTP check on web port |
| Journal consistency | Validate install journal |
| Klipper service | `systemctl is-active` (expected inactive) |

Checks are color-coded: ✓ green (pass), ⚠ yellow (expected issue with
guidance), ✗ red (critical — must fix).

### Screen 6 — Next Steps
5 guided steps from "installed" to "running CNC":

1. Detect MCU
2. Generate printer.cfg
3. Flash firmware
4. Edit printer.cfg (search for `!!! ADJUST`)
5. Restart Klipper

## Instance Manager

Opened by selecting "Instances" in the main menu or running
`e3cnc-tui instances`.

```
● test-box         ← active
○ cnc_2
○ lab
```

| Key | Action |
|---|---|
| `↑`/`↓` | Navigate list |
| `Enter` | Switch active instance |
| `n` | Create new instance |
| `d` | Delete instance (with confirmation) |
| `r` | Refresh list |
| `q`/`esc` | Return to menu |

Instance data is fetched from `e3cnc-cli instances --json`. Active instance
is persisted to `~/.e3cnc-tui/state.json`.

## Subprocess Behaviour

### Streaming Output
Long-running commands (install, update, deploy) stream Python CLI output
line-by-line in real-time. A spinner animates while running.

### Cancellation
`Ctrl+C` sends SIGINT to the Python child process. If the process doesn't
exit within 2 seconds, SIGKILL is sent to the entire process group.

### Stdout/Stderr
- **Stdout** from Python is plain text in the TUI output viewport
- **Stderr** is captured separately and displayed with **red** styling
- Exit codes determine completion status coloring

## Non-Interactive Mode

When `--yes` is passed or stdin is not a TTY, the TUI collapses:
- **Pre-flight**: Runs all checks, prints failures and exits with code 1
- **Config**: Uses defaults or `--name`/`--port` flags
- **Execution**: Streams all output to stdout
- **Post-install**: Prints health checks and next steps, exits

```bash
# Run install without interactive TUI:
e3cnc-tui install --yes --name cnc_2
```

## Persistence

### State File
`~/.e3cnc-tui/state.json` stores:
```json
{
  "active_instance": "default",
  "theme": "dark",
  "last_install_id": "20260704-153022-a3b2"
}
```

### Install Journal
`~/.e3cnc-tui/install-journal.json` records every install attempt with
per-step timing, exit reason, error codes, and health check results. Schema
version 1 — locked at PRD time.

## Build & Development

### Prerequisites
- Go 1.23+
- Python 3.8+ (for business logic)

### Building
```bash
cd cli/go

# Build for current platform
make

# Cross-compile all targets
make build-all

# Verify version injection
make verify
```

### Build Targets

| Target | Binary | Size |
|---|---|---|
| Current platform | `bin/e3cnc-tui` | ~3.7 MB |
| Linux ARM64 | `bin/e3cnc-tui-linux-arm64` | ~3.8 MB |
| Linux AMD64 | `bin/e3cnc-tui-linux-amd64` | ~3.8 MB |
| macOS AMD64 | `bin/e3cnc-tui-darwin-amd64` | ~3.9 MB |

All builds use `CGO_ENABLED=0` with `-ldflags="-s -w -X main.version=<ver>"`.

### Testing
```bash
# Run all Go tests
go test ./internal/ -v -count=1

# Go vet
go vet ./...
```

### Project Structure
```
cli/go/
├── go.mod
├── go.sum
├── Makefile                       ← CGO_ENABLED=0, cross-compile targets
├── cmd/
│   └── e3cnc-tui/
│       └── main.go                ← Entry point (version, TUI, dispatch)
├── internal/
│   ├── command.go                 ← Commands manifest loader + parser
│   ├── command_test.go            ← Tests
│   ├── config.go                  ← State persistence
│   ├── config_test.go             ← Tests
│   ├── release_resolver.go        ← Python CLI path resolution
│   ├── runner.go                  ← Subprocess lifecycle + streaming
│   ├── tui/
│   │   ├── model.go               ← Root BubbleTea model (state machine)
│   │   ├── menu.go                ← Main menu view
│   │   ├── install.go             ← Install wizard (6 screens)
│   │   ├── instance.go            ← Instance management TUI
│   │   └── styles.go              ← Lipgloss theme (green/cyan)
│   └── tui/
└── bin/                           ← Build artifacts
```

### Version Injection
Version is injected at build time via `-ldflags`:

```bash
go build -ldflags="-s -w -X main.version=0.9.8" -trimpath -o e3cnc-tui ./cmd/e3cnc-tui/
```

The canonical version source is `_e3cnc_shared.py` (`VERSION` constant).
`bump-version.sh` reads it and passes it to the Go linker automatically.
**Note:** Go 1.26+ requires the variable to be **unexported** (lowercase `version`)
for `-X` injection — the `main.go` variable is deliberately lowercase.

### CI Integration
- **Go tests run** on every push/PR via `ci.yml` (`test-go` job)
- **Go binary built** in `build-frontend.yml` for release workflows
- **Stack artifact** includes `bin/e3cnc-tui` (linux/arm64)

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| ANSI handling | Go applies own lipgloss; Python output is plain text | `isatty()` disables Python ANSI when piped |
| Python fallback | Preserved permanently as bootstrap fallback | Fresh install has no Go binary |
| Command contract | `cli/commands.json` manifest | Single source of truth; CI validates both parsers |
| Subprocess model | `exec.CommandContext` + streaming pipes | Native Go cancellation, exit code forwarding |
| State persistence | JSON file at `~/.e3cnc-tui/state.json` | Simple, human-readable, no DB dep |
| Cross-compile | `CGO_ENABLED=0` + strip-only | UPX unreliable on ARM64 Go binaries |
| Version sync | Build-time `-ldflags` | Single source: `_e3cnc_shared.py` |
| Install wizard: pre-flight | Hard block — all must pass | Destructive operation; environment readiness is non-optional |
| Install wizard: error recovery | Per-step retry/skip/abort | Avoids full restart for transient failures |
