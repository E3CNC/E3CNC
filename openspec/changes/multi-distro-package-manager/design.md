## Context

The current `installSystemPackages()` in `cli/go/internal/bootstrap/bootstrap_steps.go` hardcodes `apt-get update` and `apt-get install -y <packages>` for 15 packages. This was built solely against Debian 11 (BTT-CB1) hardware. The bash `install.sh` thin bootstrap at the repo root already supports downloading the Go binary from GitHub releases, but once `exec()` hands off to `e3cnc-tui install`, all system provisioning goes through this single apt-hardcoded function. There is zero package manager detection — no os-release parsing, no command scanning. The step is currently marked non-blocking (`false`), so on non-Debian systems the install "succeeds" while missing git, nginx, supervisor, python3-venv, and every other critical tool. This creates cryptic downstream failures.

### Current state diagram

```
┌───────────────┐     exec()      ┌──────────────────────────┐
│  install.sh   │ ──────────────▶  │ e3cnc-tui install        │
│ (bash shim)   │                  │ (Go BubbleTea TUI)       │
│               │                  │                          │
│ ✅ arch detect │                  │ Step [0/9]: apt-get      │ ← HARDCODED
│ ✅ download    │                  │ Step [1/9]: sudoers      │
│ ✅ verify sha  │                  │ Step [2/9]: directories  │
│ ✅ install bin │                  │ Step [3/9]: vendor       │
│                │                  │ ...                      │
└───────────────┘                  └──────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Support the installer on Debian/Ubuntu, Fedora/RHEL/Rocky, Arch Linux, openSUSE, and Alpine Linux
- Keep changes localized to `cli/go/internal/bootstrap/` — no changes to `install.sh`, TUI screens, or service configs
- Maintain the existing non-TUI flow (`e3cnc-tui install` with `--yes`) — only the package management layer changes
- Make package installation blocking so early failure prevents cascading cryptic errors

**Non-Goals:**
- Adding new distributions beyond the five listed above
- Package version pinning or repository configuration
- Rollback of installed packages
- Support for non-Linux platforms (macOS, Windows, WSL)
- Modifying the systemd/supervisor/service-layer code

## Decisions

### Decision 1: Flat structs per package manager, not a config-driven monolith

**Chosen:** Separate struct types (`AptManager`, `DnfManager`, etc.) each implementing `PackageManager` interface. Each struct's `Install()` method knows its own flag quirks inline.

**Rationale:** After examining six distro families, the command flags diverge too much for a clean config table. Consider:

| Operation | deb | dnf/rhel8+ | pacman | zypper | apk |
|-----------|-----|------------|--------|--------|-----|
| Auto-confirm | `-y` | `-y --allowerasing` | `--noconfirm` | `-y` | `--no-cache` |
| Update lists | `update` | `check-update` | `-Sy` | `refresh` | `update` |
| Install cmd | `apt-get install -y` | `dnf install -y --allowerasing` | `pacman -S --noconfirm` | `zypper install -y` | `apk add --no-cache` |
| Conflict resolution | APT auto-handles | `--allowerasing` needed | `--needed` + `--overwrite '*'` | `--allow-downgrade` | N/A |

A config table would be a 6×4 matrix with lots of nulls and edge cases. Flat structs are more explicit, easier to test in isolation, and make it trivial to add one-off logic (e.g., pacman's special `--needed --overwrite '*'`).

**Alternatives considered:**
- Single struct with embedded configuration map — rejected because flag divergence exceeds what a simple table handles well
- Shell-out to a distro-detection script first — rejected because we want zero external dependencies and pure-Go implementation

### Decision 2: Distrolib-lite vs runtime command scan

**Chosen:** Runtime command scan (`commandExists("apt-get")`) rather than reading `/etc/os-release`.

**Rationale:** `/etc/os-release` parsing adds complexity (ID_LIKE fallback, multiple files, format variations across minimal containers) without adding value. Checking for the actual binary that will execute the commands is simpler and more correct — if `apt-get` exists, we use apt; regardless of what `/etc/os-release` says.

**Data source for package name mapping:** An embedded JSON-like Go map (in `pkgdb.go`) keyed by the detected PM identifier. This avoids an external file dependency and keeps everything in compiled binaries.

### Decision 3: Making package installation blocking

**Chosen:** Convert step [0] from non-blocking to blocking. If core tools can't be installed, abort immediately.

**Rationale:** The current non-blocking behavior causes silent degradation — the installer continues but nginx, supervisor, python3, etc. are missing. Users then hit inscrutable errors 30 steps later. Failing fast with "couldn't install nginx" at step 0 is far more actionable than "service start failed: command not found" at step 8.

**Trade-off:** This increases friction for users who already have packages installed manually — they'll see an unnecessary (but harmless) failure message. Mitigation: if a package is already present, skip it rather than failing.

### Decision 4: Skip already-installed packages

**Chosen:** Before attempting install, check if each package is already present using the distro-native query command (`dpkg -l`, `rpm -q`, `pacman -Q`, etc.). Only request missing packages from the PM.

**Rationale:** Many users will run the installer on machines where some packages (git, curl) are already present. Attempting to reinstall them wastes time and triggers false positives in environments with strict package policies. The cost of querying 15 packages is negligible compared to the benefit of skipping reinstallation.

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Package name map has a typo for a distro | Medium | High — install fails silently for that distro | Each requirement has a scenario. Add integration tests for Fedora via Docker. Test against real Rocky Linux host. |
| `--allowerasing` on RHEL removes unexpected deps | Low | Medium | This is RHEL's own documented behavior — it only affects conflict resolution for explicitly requested packages. Not our bug. |
| Alpine musl incompatibility with Go binary | Unknown | High | The Go binary is statically linked (`CGO_ENABLED=0`). Should work on musl, but needs real testing. Mark as known limitation. |
| Containerized environments without a real init system | Low | Medium | Service-start steps already fail gracefully here. Package install works fine inside containers. |
| Large increase in code size (~200 lines) | N/A | Low | All new files are under `cli/go/internal/bootstrap/`. Existing code touches are limited to `bootstrap_steps.go`. |

## Migration Plan

This is a transparent replacement — no user-facing migration. The `install.sh` entry point, CLI arguments, TUI screens, and bootstrap step ordering all remain identical. Only the internal implementation of `installSystemPackages()` changes.

**Rollback:** Revert the commit. The old apt-hardcoded code remains in git history and restores original behavior instantly.

**Deployment:** Ship as part of the next release tag. No separate rollout needed since the thin `install.sh` fetches the latest binary from GitHub releases automatically.

## Open Questions

1. **Should we auto-suggest missing packages?** If `dnf` reports that a requested package name doesn't exist, should we try a common synonym (e.g., `python3-devel` → `python3-dev`)? Probably not — better to fail clearly and let the user report it.

2. **Alpine support level?** Alpine uses `apk` which is fully different. We can implement detection + basic install, but `avahi-utils` isn't available in Alpine repos (it's `avahi-compat-libdns_sd`). Does supporting Alpine mean supporting it end-to-end, or just "doesn't crash"? Clarify before committing to full Alpine compatibility.

3. **Do we need to handle Python modular streams on RHEL8+?** RHEL8/Fedora require `dnf module enable python39` before installing `python39-python3-pip`. Our preflight checks (which run before `installSystemPackages`) could detect this and prompt accordingly, or we could just fail with a clear message. Simpler to fail clear.
