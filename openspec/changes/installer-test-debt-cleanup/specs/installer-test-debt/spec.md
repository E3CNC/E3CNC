# Installer Test Debt & Unattended/CLI Verification

## Current State
- TUI tests still depend on a pre-refactor 8-screen mental model in places.
- Update wizard has minimal coverage compared to install wizard coverage.
- Unattended/CLI entry text is mostly documented, but not explicitly verified by tests.

## Desired End State
- `go test ./internal/tui/...` is trustworthy for install/update flows.
- Stale references to removed screens/fields are gone.
- Unattended/CLI behavior is documented and has lightweight verification.

## Acceptance Criteria
- No stale references in `install_test.go` to removed screens/fields.
- `go vet ./...` fails only on accepted pre-existing legacy symbols, if any.
- Update wizard has unit tests for new, confirm, progress, rollback, and up-to-date states.
- Unattended/CLI entry paths are documented and have at least one verifiable test/check each.
