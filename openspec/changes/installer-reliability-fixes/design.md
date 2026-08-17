## Context

The E3CNC fresh-install bootstrap lives in `cli/go/internal/bootstrap/`. During a real fresh install on hardware (an RPi over SSH), the "Vendor Moonraker and Klipper" step failed because `copyVendoredComponents` read `~/E3CNC/current`, which does not exist before the first release is downloaded. A fix was implemented ad hoc: `release.go` adds `ensureCurrentRelease()` (mirroring the `update` flow) to fetch + activate the latest release before the steps, plus a `releaseFetcher` package variable to make it testable. Regression tests live in `vendor_test.go`.

Beyond that fix, two classes of problems remain unfixed:
- `startBootstrapServices` (the "Start services" step) runs supervisor-related commands with `exec.Command(...).Run()` and discards all errors, and never checks that Moonraker/Klipper actually came up.
- `installServices` ignores the error from `writeFileSudo(...)`, and `setupNginx` ignores the exit status of `nginx -t` and `nginx -s reload`.

Consequences: the installer reports success even when services are broken, post-install `RunHealthChecks()` fails, and failures are hard to diagnose because the root cause is hidden.

## Goals / Non-Goals

**Goals:**
- Formally capture and harden the already-implemented step-4 release-acquisition fix so fresh installs never fail for a missing `current` symlink.
- Make the "Start services" step fail fast on command errors and verify that Moonraker/Klipper actually started.
- Propagate `writeFileSudo` and `nginx` errors instead of swallowing them.
- Add unit tests covering each new behavior, building on the existing `vendor_test.go` seam.

**Non-Goals:**
- No changes to the install/update TUI UX or command surface.
- No re-work of the multi-distro package-manager or thin-bootstrap flows.
- No new installer features beyond the reliability fixes.
- Not a rebuild of the health-check system in `deploy`; only making the installer's service start verifiable so those health checks are meaningful.

## Decisions

### Decision 1: Keep and document `ensureCurrentRelease()` as the step-4 fix
Retain the existing `ensureCurrentRelease()` / `fetchAndActivateLatestRelease()` implementation and the `releaseFetcher` test seam. The change formalizes it under the `bootstrap-release-acquisition` spec and adds end-to-end cases.

**Rationale:** The fix already mirrors the proven `update` flow and has passing regression tests; rewriting it would add risk with no benefit.
**Alternative considered:** Moving release acquisition into a separate command — rejected; bootstrapping the release is a prerequisite of the steps, not a user-facing action.

### Decision 2: Fail fast + verify in `startBootstrapServices`
Rewrite `startBootstrapServices` to:
1. Return an error if any of `systemctl start supervisor`, `supervisorctl reread`, or `supervisorctl update` fails (capture stderr/stdout and wrap the error).
2. After update, query `supervisorctl status` for the instance's `e3cnc-<instance>-moonraker` and `e3cnc-<instance>-klipper` programs. If either is not `RUNNING`, include which ones in the returned error.
3. Introduce an injectable command-runner seam (package-level `var` of a `runCmd func(...) ([]byte, error)` type) so tests can simulate success/failure without a real supervisor.

**Rationale:** Turning silent success into an explicit "these services did not start: X, Y" error makes post-install health-check failures diagnosable and actionable.
**Alternative considered:** Blocking on a health-check poll inside bootstrap (reusing `deploy.RunHealthChecks`) — rejected as heavier and coupling bootstrap to HTTP state; `supervisorctl status` is sufficient to confirm process startup, and `deploy.RunHealthChecks` already runs right after in the TUI/CLI flow.

### Decision 3: Propagate `writeFileSudo` errors in `installServices`
Check the error returned by `writeFileSudo` for each supervisor config and return a wrapped error (`write supervisor config <name>: %w`).

**Rationale:** A missing supervisor config silently leaves the service not managed by supervisor — the exact kind of hidden failure this change exists to eliminate.

### Decision 4: Propagate nginx errors in `setupNginx`
Capture and check the exit status of `nginx -t` and `nginx -s reload`; return the captured output on failure. Note `setupNginx` is a **non-blocking** step, so errors are collected by the existing step-error aggregation rather than halting the install.

**Rationale:** A bad nginx site config otherwise looks like success while the web UI is unreachable.
**Alternative considered:** Verifying the site is serving over HTTP — rejected; `nginx -t` is the standard config-preflight and much simpler.

### Decision 5: Non-blocking steps stay non-blocking
`Configure sudoers`, `Configure nginx and mDNS`, and (per existing behavior) `Start services` remain non-blocking/step-error-aggregated as defined by the step table; the new error propagation feeds into that existing mechanism rather than changing blocking semantics.

**Rationale:** Avoids regressing installs that are otherwise usable (e.g. missing avahi); the goal is accurate failure reporting, not gratuitously aborting installs.

## Risks / Trade-offs

- **[`supervisorctl status` may not exist on some distros]** → Treat a failed status query as an error (per spec) but make it a clear, identified failure; the error text points at the command that failed.
- **[Async startup race — service may still be warming up when status is read]** → Check status after `supervisorctl update` returns; supervisor's `startsecs` already gates "RUNNING". Could add a short bounded retry if needed, noted as follow-up.
- **[Behavior change: installs now fail where they silently passed]** → This is the intended outcome; failures were real (broken services), now they surface with a cause. CHANGELOG will note it.
- **[Test-only seams (`runCmd`, `releaseFetcher`) add surface area]** → Kept tiny and package-private; they mirror the established `releaseFetcher` pattern already in the package.

## Migration Plan

- No data/config migration; purely installer behavior.
- Rollback: revert `bootstrap_steps.go`/`release.go` edits; existing `ensureCurrentRelease` wiring in `bootstrap.go` and `vendor_test.go` remain compatible.
- Ship after `go test ./...` in `cli/go` passes, then verify with a real fresh install on the RPi.

## Open Questions

- Whether "Start services" should become blocking so a failed service start aborts before health checks. Default is to keep existing blocking semantics and rely on the aggregated step-error + health-check flow to surface the problem.
- Whether to add a bounded retry loop for `supervisorctl status` to tolerate slow startups. Default: no retry this change (follow-up if flaky on real hardware).
