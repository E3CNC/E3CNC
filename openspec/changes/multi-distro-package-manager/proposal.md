## Why

The E3CNC installer only works on Debian-based systems because `installSystemPackages()` in the Go bootstrap hardcodes `apt-get` commands. On Fedora, RHEL/Rocky, Arch Linux, openSUSE, or Alpine, the installation fails immediately or silently continues with missing core dependencies (git, nginx, supervisor, python3-venv). This contradicts the "one-command install" promise documented in `e3cnc-development`. The bash `install.sh` thin bootstrap already supports multi-distro detection via curl, but the Go binary takes over the actual provisioning and has zero package-manager awareness.

## What Changes

- Replace hardcoded `apt-get` calls in `cli/go/internal/bootstrap/bootstrap_steps.go:installSystemPackages()` with a unified `PackageManager` interface
- Add package manager detection (`DetectPackageManager()`) that scans for `dpkg`, `rpm`, `pacman`, `zypper`, `apk` existence
- Create per-distribution package name resolution maps covering 15 core packages across 6 distro families (deb, fedora, rhel8+, arch, alpine, opensuse)
- Wire each distribution's unique flags (`-y` vs `--noconfirm` vs `--allowerasing` vs `--needed --overwrite '*'`)
- Convert the "Install system packages" step from non-blocking to blocking — if we can't install core tools, abort early with clear error feedback
- Add integration test entries for Fedora/Rocky in the existing Docker test harness

## Capabilities

### New Capabilities
- `multi-distro-package-manager`: Unified package management abstraction supporting apt, dnf/yum, pacman, zypper, apk with per-distro package name resolution and command flag variants

### Modified Capabilities
- None — no existing spec-level requirements are changing; this extends an un-specified implementation detail

## Impact

**Affected code:**
- `cli/go/internal/bootstrap/bootstrap_steps.go` — `installSystemPackages()` rewritten entirely
- `cli/go/internal/bootstrap/` — new files: `pkgmgr.go`, `distro_detect.go`, `pkgdb.go`
- `tests/installer/test-runner.sh` — add DNF/RHEL test scenario

**Not affected:**
- `install.sh` (thin bootstrap stays as-is — it only downloads the binary)
- TUI preflight checks (already verify tool existence, not installation)
- Supervisor/nginx config generation (works post-packages)
- Existing deb-only tests pass unchanged

**Dependencies added:** None (pure Go, stdlib only)
