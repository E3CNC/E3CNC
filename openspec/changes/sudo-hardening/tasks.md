## 1. Shared rootrun Boundary

- [x] 1.1 Create `cli/go/internal/rootrun` package with `IsRoot()`, `RunAsRoot(args...)`, and an overridable `Exec` seam.
- [x] 1.2 Add `rootrun` unit tests: root vs non-root, NOPASSWD vs no-NOPASSWD, Exec override, IsRoot.

## 2. Route Privileged Calls Through the Boundary

- [x] 2.1 Update `internal/bootstrap/bootstrap.go` to use `rootrun.RunAsRoot` instead of raw `exec.Command("sudo", ...)`.
- [x] 2.2 Update `internal/bootstrap/backup_diff.go` to use `rootrun.RunAsRoot`.
- [x] 2.3 Update `internal/bootstrap/pkgmgr.go` (`runSudo`) to use `rootrun.RunAsRoot`.
- [x] 2.4 Update `internal/bootstrap/bootstrap_steps.go` (`runCommand("sudo", ...)` / `writeFileSudo`) to use `rootrun.RunAsRoot` where appropriate.
- [x] 2.5 Update `internal/deploy/deploy.go` `checkService` to use `rootrun.RunAsRoot` and distinguish permission errors from not-found.
- [x] 2.6 Update `internal/commands/hardware.go` `cmdRestart` to use `rootrun.RunAsRoot` (no more silent bash -c without sudo).
- [x] 2.7 Go build + vet: confirm all packages compile through the new boundary.

## 3. Install Root Gate

- [x] 3.1 Add a root gate to `cmdInstall` in `internal/commands/update.go` (return early with a "run via sudo ./install.sh" message when non-root).
- [x] 3.2 Add a root gate to the TUI install entry (install.go / preflight) so non-root users see a root-required message instead of starting `bootstrap.Bootstrap()`.
- [x] 3.3 Confirm `sudo ./install.sh → e3cnc-tui install` root hand-off still proceeds (add/adjust a test).

## 4. Fix the Dispatch Test Hang

- [x] 4.1 Update `TestRunDispatch_AllCommands` to inject a `rootrun.Exec` stub so it verifies routing without executing real privileged commands.
- [x] 4.2 Run `go test ./internal/commands/` to confirm it no longer hangs on a sudo password prompt.

## 5. Runtime Service Management Fixes

- [x] 5.1 Add/update tests for `cmdRestart` verifying it uses the boundary and returns errors on failure.
- [x] 5.2 Add/update health-check tests for the permission-vs-not-found distinction.

## 6. Validation and Documentation

- [x] 6.1 Run `go test ./...` in `cli/go` (dispatch test must no longer hang) and confirm no regressions.
- [x] 6.2 Add a CHANGELOG entry noting the unified non-interactive root boundary, the install root gate, and the runtime restart/health fixes.
- [x] 6.3 Run `openspec validate` and confirm all artifacts complete.

## 7. Optional Hardening

- [x] 7.1 (Optional) Add `setupSudoers` self-validation that checks runtime operations have matching NOPASSWD rules at install time.
