# AGENTS.md

This file documents the current state and capabilities of this project.

## Current Architecture (v0.9.9)

E3CNC is a CNC machine management platform with three layers:

| Layer         | Technology                                     | Location  |
| ------------- | ---------------------------------------------- | --------- |
| **CLI / TUI** | Go 1.23 + BubbleTea                            | `cli/go/` |
| **Frontend**  | Vue 3.5 + Vuetify 3 + TypeScript               | `src/`    |
| **Services**  | Vendored Moonraker (Python) + Klipper (Python) | `vendor/` |

### Go TUI (`e3cnc-tui`)

Single static binary — no runtime dependencies. Two entry points:

- **Interactive TUI** (no args) — BubbleTea menu with install wizard, instance manager, command dispatch
- **CLI mode** (with args) — `e3cnc-tui status`, `e3cnc-tui update`, etc.

**Packages:**

| Package               | Purpose                                                               | Test Coverage     |
| --------------------- | --------------------------------------------------------------------- | ----------------- |
| `internal/tui/`       | BubbleTea models: menu, install wizard, instance manager, output view | ✅ 90+ tests      |
| `internal/commands/`  | Go-native implementations of all 24 CLI commands                      | ✅ 10+ tests      |
| `internal/deploy/`    | Release management, health checks (7 checks), backup/restore          | ✅ 15+ tests      |
| `internal/instance/`  | Instance model, filesystem detection, port allocation                 | ✅ 10+ tests      |
| `internal/bootstrap/` | Fresh-install provisioning (replaces Ansible), uninstall, rollback    | ✅ 4 tests        |
| `internal/config.go`  | Persistent state (`state.json`, install journal)                      | ✅ existing tests |
| `internal/command.go` | Command manifest types and lookup                                     | ✅ existing tests |

### Key decisions

- **Ansible retired** — replaced by `bootstrap.Bootstrap()` in Go
- **Python CLI removed** — archived; all operations run in-process
- **Single static binary** — CGO_ENABLED=0, ships as `e3cnc-tui`
- **Stack artifact** — release `.tar.zst` bundles frontend + vendor + binary
- **Nightly CI** — every push to `main` publishes a nightly pre-release

### Vue 3 Migration Status

All routes verified working on Vue 3.5 + Vuetify 3 + pure `<script setup>`:

- `/` Dashboard, `/allPrinters` Farm, `/cam` Webcam, `/console` MDI
- `/files` G-Code Files, `/history`, `/timelapse`, `/config`, `/viewer`

### CI Pipeline

| Workflow                    | Trigger                         | What it does                                        |
| --------------------------- | ------------------------------- | --------------------------------------------------- |
| `ci.yml`                    | Push/PR to `main`               | Go tests + build                                    |
| `build-frontend.yml`        | Tag push / main push / manual   | Build frontend + Go binary, create release artifact |
| `publish-moonraker-mcp.yml` | `moonraker-mcp-v*` tag / manual | Publish MCP server to PyPI                          |
