## Why

The current installer has two systems (bash install.sh + Go e3cnc-tui) that both handle system setup, creating duplication, drift risk, and hard-to-debug edge cases. The bash script has reliability bugs (port detection ordering, backup accumulation, no network timeouts) that make it brittle across different Linux environments. For a stable release, the installer needs to be reliable, testable, and maintainable.

## What Changes

- Move port auto-detection from bash to Go (net.Listen instead of ss parsing)
- Move directory migration (~/e3cnc → ~/E3CNC) from bash to Go
- Move backup from bash to Go (smart content: instances/ only, with pruning)
- Thin install.sh to only: pre-flight checks, binary download, handoff to Go
- Add Docker-based integration tests covering all install scenarios
- Go binary gains new subcommands: --port-detect, --migrate-only, --backup-only for testing
- Add --max-timeout to curl in the thin bootstrap
- No changes to the TUI wizard or Moonraker/Klipper interaction

## Capabilities

### New Capabilities
- `port-detection`: Auto-detect free ports for Admin UI, Moonraker, and Klipper services using net.Listen. Falls back to next available port if default is in use.
- `directory-migration`: Migrate from legacy lowercase ~/e3cnc to uppercase ~/E3CNC directory layout. Handles empty, existing, and merge scenarios.
- `smart-backup`: Pre-install backup of critical user data (instances/, logs/) only. Prunes old backups to prevent disk space accumulation.
- `thin-bootstrap`: Minimal bash bootstrap that downloads the Go binary and hands off all install logic to Go.
- `installer-integration-tests`: Docker-based test suite covering port detection, migration, backup, package install, and full flow scenarios.

### Modified Capabilities
- (none - no existing specs to modify)

## Impact

- `cli/go/internal/bootstrap/`: New files for port detection, migration, backup
- `cli/go/internal/commands/`: cmdInstall extended to call new bootstrap functions
- `install.sh`: Reduced from ~862 lines to ~150 lines
- `bin/e3cnc-tui-arm64`, `bin/e3cnc-tui-amd64`: Recompiled binaries
- `tests/installer/`: New Docker-based integration test suite
- No impact on Vue UI, Moonraker, or Klipper interaction