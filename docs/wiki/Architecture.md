# Architecture

## Overview

The system is split into five layers. Layer 0 is the CLI/TUI layer — the user's entry point to everything below.

### 0. CLI Tool (`e3cnc-cli` + `e3cnc-tui`)

Two-component CLI with hybrid Go/Python architecture:

```
                  e3cnc-cli (Python entry point)
                  │
                  ├── ~/e3cnc/current/bin/e3cnc-tui exists?
                  │   ├── YES → os.execv() to Go TUI binary
                  │   └── NO  → fall through to Python CLI
                  │
                  └── Go TUI (e3cnc-tui, BubbleTea)
                      │
                      ├── Interactive mode (TTY present)
                      │   ├── Main menu (24 commands, categorized, keyboard nav)
                      │   ├── Install wizard (6 screens, 9 phases)
                      │   ├── Instance manager (list, switch, create, delete)
                      │   └── Streaming output + spinner + cancellation
                      │
                      └── CLI mode (--yes or non-TTY)
                          └── Dispatches to Python subprocess with
                              E3CNC_FORCE_COLOR=1

Key design: The Go binary applies its own lipgloss styling. Python output
is plain text (isatty()=false when piped). The `commands.json` manifest
at cli/commands.json is the single source of truth for all 24 commands.
```

**Source layout:**

| Path | Purpose |
|---|---|
| `cli/go/cmd/e3cnc-tui/main.go` | Entry point (version, dispatch, signal handling) |
| `cli/go/internal/command.go` | Commands manifest loader (`commands.json`) |
| `cli/go/internal/runner.go` | Streaming subprocess with Ctrl+C cancellation (2s → SIGKILL) |
| `cli/go/internal/config.go` | State persistence (`~/.e3cnc-tui/state.json`) |
| `cli/go/internal/release_resolver.go` | Python CLI path resolution (release → repo) |
| `cli/go/internal/tui/model.go` | Root BubbleTea model (state machine) |
| `cli/go/internal/tui/menu.go` | Main menu (24 commands, categories) |
| `cli/go/internal/tui/install.go` | Install wizard (6 screens, 9 phases) |
| `cli/go/internal/tui/instance.go` | Instance manager (list, create, delete) |
| `cli/go/internal/tui/styles.go` | Lipgloss theme (green/cyan palette) |
| `cli/go/Makefile` | `CGO_ENABLED=0`, cross-compile for linux/arm64/amd64 + darwin/amd64 |

**Python fallback:** `cli/menu.py` and `cli/parser.py` are **preserved permanently** as bootstrap fallbacks. Fresh installs have no Go binary, so the Python path handles the first `install` command. After the first `update`, the Go binary exists in the release.

**Bootstrap flow:**

1. `e3cnc-cli` checks `~/e3cnc/current/bin/e3cnc-tui` → exec Go binary
2. If absent, tries `~/e3cnc/current/cli/` → run Python CLI from release
3. Falls back to repo checkout

### 1. Klipper + Klipper Extras

- Executes motion and macro actions
- Owns authoritative machine state (motion, pins, temperatures, macros)
- Exposes state via queryable objects (`toolhead`, `gcode_move`, `print_stats`, `work_coordinate_systems`)
- The `[work_coordinate_systems]` extra plugin adds G10 L2/L20 support, six per-WCS offset tables (G54–G59) with JSON persistence

### 2. Moonraker CNC Agent

- Moonraker component (`cnc_agent.py`) registered under `[cnc_agent]` in `moonraker.conf`
- Owns CNC-specific state: spindle, coolant, units, WCS offsets, per-machine capabilities
- Exposes guarded command endpoints under `/server/cnc/*` (jog, set-zero, WCS select, spindle, coolant)
- Does **not** re-expose read-only Klipper state — the frontend reads that directly

### 3. E3CNC UI Frontend

- Mainsail fork with CNC-native panels
- Read-only state from existing `printer` Vuex store (Klipper websocket subscription)
- CNC-specific state and commands from the agent
- Panels: DRO, Jog, WCS, Spindle & Coolant, CNC Status, MDI
- Built with Vue 3.5 + Vuetify 3 + TypeScript

### 4. Machine Profile (Optional)

- YAML file declaring capabilities: spindle mode, coolant channels, probing hardware, safety rules

## State and Command Flow

```
Klipper ──websocket objects──> Vuex store ──> CNC panels (read-only)
   │
   └──gcode/script──> Moonraker ──HTTP/WS──> CNC agent ──> guarded endpoints
```

The agent only owns what Klipper does not model. Read-only state is never duplicated.

## Key Design Rules

- Machine coordinates and work coordinates are visually distinct
- The active WCS is always obvious
- Dangerous actions require confirmation
- Spindle/coolant state is visible during job execution
- Agent owns only what Klipper doesn't model
- Go TUI applies its own styling; Python output is plain text (no ANSI passthrough)
- `cli/commands.json` is the single source of truth for all command definitions
- Version is canonical in `_e3cnc_shared.py` and injected into the Go binary at build time via `-ldflags`
