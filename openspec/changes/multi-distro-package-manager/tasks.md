## 1. Core package manager interface and detection

- [x] 1.1 Create `cli/go/internal/bootstrap/pkgmgr.go` with `PackageManager` interface (methods: `Update()`, `Install([]string) error`, `Find(name string) bool`, `Resolve([]string) map[string]string`) and `DetectPackageManager()` function that scans for apt-get/dnf/yum/pacman/zypper/apk existence
- [x] 1.2 Implement `AptManager` struct implementing `PackageManager`: wraps `apt-get update` + `apt-get install -y <packages>`, uses deb package alias map
- [x] 1.3 Implement `DnfManager` struct implementing `PackageManager`: wraps `dnf check-update` (non-fatal) + `dnf install -y --assumeyes --allowerasing <packages>`, uses fedora/rhel8 package alias map
- [x] 1.4 Implement `YumManager` struct implementing `PackageManager`: similar to DnfManager but uses `yum` command instead of `dnf` (fallback for older systems), same RHEL package aliases
- [x] 1.5 Implement `PacmanManager` struct implementing `PackageManager`: wraps `pacman -Sy --noconfirm --needed --overwrite '*' <packages>`, uses arch package alias map with `base-devel` for build-essential
- [x] 1.6 Implement `ZypperManager` struct implementing `PackageManager`: wraps `zypper refresh -y` + `zypper install -y <packages>`, uses opensuse package alias map
- [x] 1.7 Implement `ApkManager` struct implementing `PackageManager`: wraps `apk add --no-cache --no-scripts <packages>`, uses alpine package alias map; note avahi-utils may not be available on Alpine (document limitation)

## 2. Package name resolution database

- [x] 2.1 Create `cli/go/internal/bootstrap/pkgdb.go` with embedded package alias maps covering 15 core packages across all 6 distro families
- [x] 2.2 Include all packages from original hard-coded list: git, curl, unzip, zstd, nginx, supervisor, python3, python3-pip, python3-venv, python3-dev, build-essential, libffi-dev, libssl-dev, avahi-utils, plus common extras (tree, iproute2)
- [x] 2.3 Handle distro-specific renames: python3-venv → python3-virtualenv (fedora/rhel8) / python-virtualenv (arch) / py3-virtualenv (alpine); python3-dev → python3-devel (fedora/rhel8/opensuse); build-essential → gcc-c++ (fedora/rhel8/opensuse) / base-devel (arch) / build-base (alpine); libssl-dev → openssl-devel (fedora/rhel8/opensuse) / openssl (arch)
- [x] 2.4 Mark universal packages (git, curl, unzip, zstd, nginx, supervisor, python3, python3-pip, avahi-utils) as having identical names across all distros

## 3. Replace hardcoded apt-get in bootstrap steps

- [x] 3.1 Rewrite `installSystemPackages()` in `cli/go/internal/bootstrap/bootstrap_steps.go` to call `DetectPackageManager()`, resolve generic package names via the detected PM's `Resolve()` method, and execute via the PM's `Install()` method
- [x] 3.2 Update step declaration to change non-blocking (`false`) to blocking (`true`) so package failures abort the install early
- [x] 3.3 Wire `bootstrap_steps.go` to use the new PackageManager interface instead of direct exec.Command calls for apt-get

## 4. Package pre-check optimization

- [x] 4.1 Add `Find(name string) bool` method to each PackageManager implementation that queries whether a package is already installed (e.g., `dpkg -l pkgname`, `rpm -q pkgname`, `pacman -Q pkgname`)
- [x] 4.2 Modify `Install()` to filter out already-installed packages before calling the PM — only request missing packages
- [x] 4.3 Log which packages are skipped (already installed) vs installed fresh for transparency

## 5. Unit tests

- [x] 5.1 Create `cli/go/internal/bootstrap/pkgmgr_test.go` with unit tests for `DetectPackageManager()` testing each supported path (mocked command existence checks)
- [x] 5.2 Test each PackageManager's Resolve() method with known inputs verifying correct distro-specific output
- [x] 5.3 Test AptManager.Resolve("python3-venv") returns map["deb":"python3-venv"]
- [x] 5.4 Test DnfManager.Resolve("python3-venv") returns map["fedora":"python3-virtualenv","rhel8+":"python3-virtualenv"]
- [x] 5.5 Test PacmanManager.Resolve("build-essential") returns map["arch":"base-devel"]
- [x] 5.6 Test ZygpperManager.Resolve("libssl-dev") returns map["opensuse":"openssl-devel"]
- [x] 5.7 Test ApkManager.Resolve("libssl-dev") returns map["alpine":"openssl-dev"]
- [x] 5.8 Test Find() returns true for existing packages and false for non-existent ones (uses mocked lookPath — real system state not required)
- [x] 5.9 Go vet passes on all new files with no warnings

## 6. Integration testing

- [x] 6.1 Add Fedora/Rocky test entries to the existing Docker-based test harness in `tests/installer/` (create `Dockerfile.fedora` or `Dockerfile.rocky` if not present)
- [x] 6.2 Verify `bash -n` syntax check passes on any shell scripts used by the integration tests
- [x] 6.3 Run integration tests against real Rocky Linux hardware (`ssh cnc`) or compatible environment if available — Docker Rocky 9 (dnf + --allowerasing) verified end-to-end; real hardware run remains for release validation
- [x] 6.4 Document any distribution-specific limitations discovered during testing (e.g., Alpine avahi-utils not in repos) — Docker testing surfaced two real bugs, both fixed:
  - `discardWriter` returned `(0, nil)` violating io.Writer contract → exec.Cmd failed with "short write" on apt-get update (unit tests never exercised Install; Docker did)
  - `ZypperManager.Find()` used `zypper search --quiet` which exits 2 (flag unsupported) → replaced with `rpm -q` (canonical RPM-family presence query)
  - Arch pacman cannot run under QEMU emulation (seccomp/alpm sandbox) — install probe skipped under emulation, detection + resolution still verified; full suite runs on real Arch hardware
  - Reusable runner: `tests/installer/test-pkgmgr-docker.sh` (builds static amd64 test binary, runs Detect/Resolve/Install probe per distro container)

## 7. Documentation and cleanup

- [x] 7.1 Update `e3cnc-development` skill to reflect multi-distro support (add to supported distributions table)
- [x] 7.2 Update `installer-script-patterns` skill notes about the Go-side package management parity
- [x] 7.3 Add a comment at the top of `bootstrap_steps.go` listing supported distributions with their corresponding package managers
- [x] 7.4 Run `go vet ./internal/bootstrap/...` and `go build ./cmd/e3cnc-tui/` to verify no compilation issues
- [x] 7.5 Ensure the Go binary still compiles with `CGO_ENABLED=0 GOOS=linux GOARCH=arm64` for CNC deployment
- [x] 7.6 Update wiki pages (`docs/wiki/Installation.md` — supported distributions table, auto-detected package manager, distro-native installs; `docs/wiki/Features.md` — Bootstrap in Go row mentions multi-distro PM) and `docs/AGENTS.md` (bootstrap test count 4 → 40+)
- [x] 7.7 Consolidate install logs into `~/E3CNC/logs/install.log` (single file to share for support):
  - New `cli/go/internal/bootstrap/install_log.go` — append-mode consolidated log with per-attempt headers, `InstallLogf()`, `InstallLogWriter()` (replaces the old discard sink so package-manager stderr is now captured)
  - `bootstrap.go` — logs every step start/complete/fail + final error
  - `tui/install.go` — tees the wizard's captured stdout/stderr into the log; closes log after journal write
  - `commands/update.go` — CLI install path opens/closes the log, appends INSTALL FAILED marker
  - `docs/wiki/Installation.md` — new "Install logs" section telling users to share `~/E3CNC/logs/install.log`
