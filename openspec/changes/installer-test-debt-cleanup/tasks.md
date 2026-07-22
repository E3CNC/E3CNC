# Tasks: Installer Test Debt Cleanup & Unattended/CLI Verification

## 1. Audit legacy test debt

- [x] 1.1 Scan `cli/go/internal/tui/install_test.go` for stale references to removed screens/fields
- [x] 1.2 Scan other `*_test.go` files under `cli/go/internal/tui/` for the same legacy symbols
- [x] 1.3 Document exact stale symbols and locations in a short report

Audit result: no stale references remain in `install_test.go` or sibling TUI tests. The current installer already uses the 3-screen wizard paths: `ScreenDetection`, `ScreenDecision`, `ScreenExecDashboard`, plus `ScreenKlipperPicker` and `ScreenMCUPicker`.

## 2. Fix install test baseline

- [x] 2.1 Replace stale enum/field references in `install_test.go` with current wizard symbols
- [x] 2.2 Add/split tests so they cover current screens: `Detection`, `Decision`, `ExecDashboard`
- [x] 2.3 Remove duplicated/unused init tests and consolidate coverage

Change: removed duplicate `TestInstallInitReturnsMultipleCommands` from `install_test.go`.

## 3. Verify unattended/CLI entry paths

- [x] 3.1 Verify `install.sh --help` / `--version` coverage
- [x] 3.2 Verify `docs/TUI.md` documents `install --yes`
- [x] 3.3 Avoid duplicate shell-output tests; rely on existing e2e coverage in `tests/installer/cli_e2e_test.go`

## 4. Finalize menu/routing hygiene

- [x] 4.1 Audit `model.go` menu routing for install/update/unattended entry points
- [x] 4.2 Update docs if a flag/path changed
- [x] 4.3 Regression checklist for installer launch modes

Result: existing docs already describe the supported paths.

## 5. Validation

- [x] 5.1 Run targeted Go tests for TUI/commands
- [x] 5.2 Run `go vet ./...`
- [x] 5.3 Commit cleanup as one focused change

Note: `go test ./internal/tui/...` execution is slowed by tmux-based integration tests that require live hardware, so validation uses targeted unit-test selection during development.
