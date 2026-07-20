## Why

The installer and updater are the first and most frequently used touchpoints for every E3CNC user. The current install wizard runs 8 screens — more than necessary for a typical install — while the update path has no TUI at all. The `install.sh` bootstrap is bare-bones with no progress indication or error messages. This creates a jarring UX gap: polished install wizard → raw CLI output for updates — and a weak first impression from the bootstrap script. Reducing friction here directly improves user adoption and satisfaction.

## What Changes

- `install.sh` gets better UX: color output, download progress bar, meaningful error messages, `--help` and `--version` flags
- Install wizard reduced from 8 screens to 3: a loading/detection screen → a decision/confirm screen → a merged progress+verification screen
- Import existing Klipper becomes a first-class wizard path with heuristic detection and safe backup+diff
- Update command gets its own TUI wizard with changelog display and hybrid rollback (auto for critical failures, manual for minor)
- New integration tests for all flows

## Capabilities

### New Capabilities
- `install-wizard-ui`: 3-screen TUI install flow with loading detection, decision/confirm, and merged progress+verification screens; supports both mode-specific pipelines
- `import-existing-klipper`: Detect existing Klipper installations via heuristic scan, create E3CNC management layer without disrupting existing configs, backup+diff before modifying configs
- `update-wizard-ui`: TUI update flow with changelog display from GitHub releases, progress+verification screen, hybrid auto-rollback on critical failures

### Modified Capabilities
- `thin-bootstrap`: Add `--help` and `--version` flags; color output and download progress bar; meaningful per-check error messages
- `installer-integration-tests`: Add test scenarios for new install flows, import path, and update wizard

## Impact

- `cli/go/internal/tui/`: New `update.go` model; revised `install.go` and `install_screens.go` for 3-screen flow; new `import.go` for import pipeline
- `install.sh`: Revised with color output, progress bar, flag parsing
- `cli/go/internal/bootstrap/`: New import pipeline (separate from fresh install pipeline)
- `tests/installer/`: New tests for import and update flows