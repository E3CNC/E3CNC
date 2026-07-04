# Contributing

## Development Setup

```bash
git clone https://github.com/E3CNC/E3CNC.git
cd E3CNC
bun install
bun run dev
```

The dev server starts with HMR. Open `http://localhost:5173` in your browser.

For Go TUI development:

```bash
cd cli/go
CGO_ENABLED=0 go build -o e3cnc-tui ./cmd/e3cnc-tui/
./e3cnc-tui          # open the interactive TUI
./e3cnc-tui --version
```

## Project Structure

| Path | Description |
|---|---|
| `src/` | Vue 3.5 frontend (TypeScript, Vuetify 3) |
| `cli/` | Python CLI package (commands, helpers, parser, menu) |
| `cli/go/` | Go BubbleTea TUI (`e3cnc-tui` — static binary) |
| `vendor/moonraker/` | Vendored Moonraker with CNC agent + MCP server |
| `vendor/klipper/klippy/extras/` | Klipper extra plugins (WCS) |
| `macros/` | CNC G-code macros |
| `ansible/` | Ansible playbooks and roles |
| `scripts/` | Install, deploy, and utility scripts |
| `docs/` | Landing page and documentation |
| `docs/wiki/` | Updated wiki page drafts |
| `tests/` | Unit tests (pytest, 454+) |

## Before Committing

1. Bump version: `./scripts/bump-version.sh` (or `./scripts/bump-version.sh --minor`)
2. Run `bun run build` — must pass
3. Run `python3 -m pytest tests/ -v --tb=short --no-header` — must pass
4. If Go code changed: `cd cli/go && go test ./internal/ -v && go vet ./...`
5. Validate changes in a headed browser — check console for errors

## Go TUI Conventions

- `e3cnc-tui` binary is built with `CGO_ENABLED=0` for cross-compilation
- Version is injected at build time: `-ldflags="-s -w -X main.version=<ver>"`
- Go 1.26+ requires **unexported** variables for `-X` injection (`version`, not `Version`)
- TUI models follow the standard BubbleTea pattern: `Init()`, `Update(msg) (Model, Cmd)`, `View() string`
- All commands are defined in `cli/commands.json` — edit that file, not hardcoded lists
- The Python fallback (`cli/menu.py`, `cli/parser.py`) is **never deleted**

## Pull Requests

- Keep changes focused on a single concern
- Include tests for new functionality
- Update documentation if behaviour changes
- Link related issues
