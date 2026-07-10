# Architecture

## Overview

The system is split into five layers. Layer 0 is the CLI/TUI layer — the user's entry point to everything below.

### 0. CLI Tool (`e3cnc-tui`)

Single static Go binary with two modes:

```
                  e3cnc-tui (Go static binary)
                  │
                  ├── Interactive mode (TTY present, no args)
                  │   ├── Main menu (24 commands, categorized, keyboard nav)
                  │   ├── Install wizard (6 screens, 9 phases, goroutine-streamed)
                  │   ├── Instance manager (list, switch, create, delete)
                  │   └── Streaming output + spinner + cancellation
                  │
                  └── CLI mode (args provided or --yes flag)
                      └── commands.RunDispatch(cmd, jsonOut, args)
                          └── All 24 command handlers run in-process
```

**Key decisions:**

- All command handlers run as direct Go function calls — no subprocess overhead
- `commands.json` at repo root is the single source of truth for all 24 commands
- The binary applies its own `lipgloss` styling in TUI mode; CLI mode is plain text
- `--json` flag on every command for structured output (used by Moonraker CNC agent)

**Source layout:**

| Path                           | Purpose                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| `cli/go/cmd/e3cnc-tui/main.go` | Entry point (version, dispatch, signal handling)               |
| `cli/go/internal/command.go`   | Commands manifest loader (`commands.json`)                     |
| `cli/go/internal/config.go`    | State persistence (`~/.e3cnc-tui/state.json`, install journal) |
| `cli/go/internal/commands/`    | All 24 command handlers in Go                                  |
| `cli/go/internal/deploy/`      | Release management, health checks, backup/restore              |
| `cli/go/internal/instance/`    | Instance model, detection, path resolution                     |
| `cli/go/internal/bootstrap/`   | Fresh-install provisioning (replaces Ansible)                  |
| `cli/go/internal/tui/`         | BubbleTea models: menu, install wizard, instance manager       |
| `cli/go/Makefile`              | `CGO_ENABLED=0`, cross-compile targets                         |

**Package dependency graph:**

```
main.go
  ├── commands/ → deploy/, instance/, bootstrap/
  ├── tui/      → commands/, deploy/, instance/, bootstrap/
  ├── internal/ → (config, command)
  └── (standalone Go stdlib)
```

No external services, no frameworks, no Python runtime.

### 1. Klipper + Klipper Extras

- Executes motion and macro actions
- Owns authoritative machine state (motion, pins, temperatures, macros)
- Exposes state via queryable objects (`toolhead`, `gcode_move`, `print_stats`, `work_coordinate_systems`)
- The `[work_coordinate_systems]` extra plugin adds G10 L2/L20 support, six per-WCS offset tables (G54–G59) with JSON persistence

### 2. Moonraker CNC Agent

- Moonraker component (`cnc_agent.py`) registered under `[cnc_agent]` in `moonraker.conf`
- Owns CNC-specific state: spindle, coolant, units, WCS offsets, per-machine capabilities
- Exposes guarded command endpoints under `/server/cnc/*` (jog, set-zero, WCS select, spindle, coolant)
- Communicates with `e3cnc-tui` subprocess for deploy operations (update, rollback, releases, status)
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
                                                  │
                                                  └── subprocess ──> e3cnc-tui
                                                       (update, rollback, info)
```

The agent only owns what Klipper does not model. Read-only state is never duplicated.
Deploy operations are forwarded to `e3cnc-tui` via subprocess with `--json` output.

## Key Design Rules

- Machine coordinates and work coordinates are visually distinct
- The active WCS is always obvious
- Dangerous actions require confirmation
- Spindle/coolant state is visible during job execution
- Agent owns only what Klipper doesn't model
- `e3cnc-tui` applies its own lipgloss styling in TUI mode; plain text in CLI mode
- `commands.json` is the single source of truth for all command definitions
- Version is canonical in `package.json` and injected into the Go binary at build time via `-ldflags`
- The Go binary is a single static artifact — no runtime dependencies, no Python, no Ansible
