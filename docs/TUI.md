# E3CNC TUI — Go BubbleTea Terminal User Interface

> **Status:** Active — full Go rewrite complete  
> **Binary:** `e3cnc-tui` — single static Go binary (CGO_ENABLED=0)  
> **Source:** `cli/go/`

The E3CNC TUI is a keyboard-driven BubbleTea terminal UI. It handles all CLI
commands natively in Go — no Python runtime, no subprocess overhead.

## Architecture

### Pure Go — No Hybrid Layer

```
┌──────────────────────────────────────┐
│  e3cnc-tui (Go static binary)        │  ← ~3.8 MB, zero runtime deps
│  (cli/go/)                           │
│                                      │
│  ┌────────────────────────────┐      │
│  │  Interactive TUI (TTY)     │      │
│  │  • Main menu (24 commands) │      │
│  │  • Install wizard          │      │
│  │  • Instance manager        │      │
│  │  • Streaming output        │      │
│  └──────────┬─────────────────┘      │
│             │                         │
│  ┌──────────▼─────────────────┐      │
│  │  CLI mode (args / --json)  │      │
│  │  • commands.RunDispatch()  │      │
│  │  • In-process execution    │      │
│  │  • No subprocess overhead  │      │
│  └────────────────────────────┘      │
└──────────────────────────────────────┘
```

All command handlers run in-process via `commands.RunDispatch()`. There is no
Python subprocess — every command from `status` to `update` to `install` is
implemented directly in Go.

### Package Architecture

| Package | Purpose | Test Coverage |
|---|---|---|
| `internal/tui/` | BubbleTea models: menu, install wizard, instance manager, output view | ✅ 90+ tests |
| `internal/commands/` | Go-native implementations of all 24 CLI commands | ✅ 10+ tests |
| `internal/deploy/` | Release management, health checks (7 checks), backup/restore | ✅ 15+ tests |
| `internal/instance/` | Instance model, filesystem detection, port allocation | ✅ 10+ tests |
| `internal/bootstrap/` | Fresh-install provisioning, uninstall, rollback | ✅ 4 tests |
| `internal/config.go` | State persistence (`state.json`, install journal) | ✅ existing tests |
| `internal/command.go` | Command manifest loader (`commands.json`) | ✅ existing tests |

### Package Diagram

```
e3cnc-tui (main.go)
│
├── tui/                    ← BubbleTea models
│   ├── model.go            Root state machine
│   ├── menu.go             Main menu (24 items)
│   ├── install.go          Install wizard (6 screens, 9 phases)
│   ├── instance.go         Instance manager (list/create/delete)
│   ├── styles.go           Lipgloss theme (green/cyan)
│   └── model_test.go et al ← 90+ unit tests
│
├── commands/                ← All business logic
│   ├── dispatch.go          RunDispatch() — 24 command handlers
│   └── dispatch_test.go     Tests
│
├── deploy/                  ← Release operations
│   ├── releases.go          Scan, download, extract, activate
│   ├── health.go            7 health checks
│   ├── backup.go            Backup/restore
│   └── deploy_test.go       Tests
│
├── instance/                ← Instance model
│   ├── instance.go          Struct, detection, paths
│   └── instance_test.go     Tests
│
├── bootstrap/               ← Fresh install provisioning
│   ├── bootstrap.go         OS packages, venvs, systemd, configs
│   └── bootstrap_test.go    Tests
│
├── internal/
│   ├── command.go           commands.json loader
│   ├── config.go            State/install journal persistence
│   ├── command_test.go
│   └── config_test.go
│
└── cmd/e3cnc-tui/main.go    Entry point
```

## Using the TUI

### Starting

```bash
./e3cnc-tui                    # Open interactive TUI
./e3cnc-tui status             # CLI mode — run command, print output, exit
./e3cnc-tui --version          # Show version
./e3cnc-tui --help             # Show help
./e3cnc-tui install --yes      # Non-interactive mode (no TTY needed)
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
| OS (Linux) | `runtime.GOOS` |
| Python 3.8+ | `exec.LookPath("python3")` |
| git | `exec.LookPath` |
| curl | `exec.LookPath` |
| unzip | `exec.LookPath` |
| zstd | `exec.LookPath` |
| Disk space (≥0.5 GB) | `syscall.Statfs` |
| GitHub API reachable | HTTP HEAD to `api.github.com` |
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
Shows real-time progress across all 9 installation phases via goroutine-streamed
progress from `bootstrap.Bootstrap()`:

```
[1/9]  Install system packages ............. ✓ 8s
[2/9]  Create virtual environments ......... ✓ 14s
[3/9]  Install Python dependencies ........ ✓ 34s
[4/9]  Configure Moonraker ................ ✓ 3s
[5/9]  Download release .................. ◌ 12s
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

Rollback (`a`) calls `bootstrap.Rollback(cfg)` to stop services, remove
instance dirs, service files, and nginx configs — safe to retry fresh.

### Screen 5 — Verification Dashboard
Post-install health checks (7 checks via `deploy.RunHealthChecks()`):

| Check | Source |
|---|---|
| Moonraker API | HTTP 200 to `/server/info` |
| Moonraker service | `systemctl is-active` |
| Klippy | Socket check |
| cnc_agent | Moonraker component list |
| Frontend | HTTP check on web port |
| Journal consistency | Validate install journal |
| Klipper service | `systemctl is-active` |

Checks are color-coded: ✓ green (pass), ⚠ yellow (expected issue with
guidance), ✗ red (critical — must fix).

### Screen 6 — Next Steps
5 guided steps from "installed" to "running CNC":

1. Detect MCU: `e3cnc-tui detect-mcu`
2. Generate printer.cfg: `e3cnc-tui init-config`
3. Flash firmware: `e3cnc-tui flash-mcu`
4. Edit printer.cfg (search for `!!! ADJUST`)
5. Restart Klipper: `e3cnc-tui restart`

## Instance Manager

Opened by selecting "Instances" in the main menu or running
`./e3cnc-tui instances`.

```
● test-box         ← active
○ cnc_2
○ lab
```

| Key | Action |
|---|---|
| `↑`/`↓` | Navigate list |
| `Enter` | Switch active instance |
| `n` | Create new instance (name + port form) |
| `d` | Delete instance (with confirmation) |
| `r` | Refresh list |
| `q`/`esc` | Return to menu |

Instance data is fetched from `instance.DetectInstances()`. Active instance
is persisted to `~/.e3cnc-tui/state.json`.

## Subprocess Behaviour

### Streaming Output
Long-running commands (install, update, deploy) run in Go goroutines and
stream progress via channels. A spinner animates while running.

### Cancellation
`Ctrl+C` cancels the current operation cleanly. The BubbleTea model handles
it as a `tea.KeyMsg` and returns to the menu.

### JSON Output Mode
Every command supports `--json` for structured output:

```bash
./e3cnc-tui status --json
./e3cnc-tui instances --json
./e3cnc-tui releases --json
```

## Non-Interactive Mode

When `--yes` is passed or stdin is not a TTY, the TUI collapses:

- **Pre-flight**: Runs all checks, prints failures and exits with code 1
- **Config**: Uses defaults or `--name`/`--port` flags
- **Execution**: Streams all output to stdout
- **Post-install**: Prints health checks and next steps, exits

```bash
# Run install without interactive TUI:
./e3cnc-tui install --yes --name cnc_2
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
per-step timing, exit reason, error codes, and health check results.

## Build & Development

### Prerequisites
- Go 1.23+

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
# Run all Go tests (short mode skips integration tests needing live CNC)
go test ./... -short -count=1

# Go vet
go vet ./...

# Run integration tests (requires tmux + SSH to CNC host)
go test ./internal/tui/... -v -count=1
```

### Version Injection
Version is injected at build time via `-ldflags`:

```bash
go build -ldflags="-s -w -X main.version=0.9.9" -trimpath -o e3cnc-tui ./cmd/e3cnc-tui/
```

The canonical version source is `package.json`. `bump-version.sh` reads it
and passes it to the Go linker automatically.
**Note:** Go 1.26+ requires the variable to be **unexported** (lowercase `version`)
for `-X` injection — the `main.go` variable is deliberately lowercase.

### CI Integration
- **Go tests run** on every push/PR via `ci.yml` (`test-go` job)
- **Go binary built** in `build-frontend.yml` for release workflows
- **Stack artifact** includes `bin/e3cnc-tui` (linux/arm64, ~3.8 MB)

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | Pure Go | Single static binary, zero runtime deps, instant startup |
| TUI framework | BubbleTea | Native Go TUI framework, no Python bridge needed |
| Command contract | `commands.json` manifest | Single source of truth for all 24 command definitions |
| Execution model | In-process Go functions | Every command runs as a direct function call — no subprocess overhead |
| State persistence | JSON file at `~/.e3cnc-tui/state.json` | Simple, human-readable, no DB dep |
| Cross-compile | `CGO_ENABLED=0` + strip-only | UPX unreliable on ARM64 Go binaries |
| Version source | `package.json` | Single source; injected at build time via `-ldflags` |
| Install wizard: pre-flight | Hard block — all must pass | Destructive operation; environment readiness is non-optional |
| Install wizard: error recovery | Per-step retry/skip/abort | Avoids full restart for transient failures |
| HTTP client | Injectable interface | `deploy.DefaultHTTPClient` can be swapped in tests |
| OS guard | `runtime.GOOS` check | `systemctl/apt-get` calls fail fast with clear message on non-Linux |
