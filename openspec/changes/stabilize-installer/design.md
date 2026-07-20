## Context

The current installer has two systems that both handle system setup:

1. **install.sh** (bash, 862 lines): Pre-flight checks, port detection, package installation, directory creation, binary download, service management, instance configuration
2. **e3cnc-tui install** (Go): Bootstrap.Bootstrap() runs the same steps (apt-get, mkdir, configs) again after install.sh hands off

This duplication causes:
- Port detection uses `ss -tuln` which requires `iproute2` (installed later in the script)
- Backups copy the entire E3CNC directory (including previous backups) → exponential growth
- No checksum verification of downloaded binary
- No network timeout on curl
- Hard to test (bash is hard to test; integration tests don't exist)

The fix: make the Go binary the single owner of installation logic, and reduce install.sh to a thin bootstrap that only downloads the binary and hands off.

## Goals / Non-Goals

**Goals:**
- Single system owns installation logic (Go binary)
- Port detection using net.Listen (reliable, no external tool dependency)
- Smart backup (instances/ only, with pruning)
- Directory migration from ~/e3cnc to ~/E3CNC in Go
- Thin install.sh (~150 lines, only pre-flight + download + handoff)
- Docker-based integration tests covering all scenarios
- Binary checksum verification

**Non-Goals:**
- Replacing the TUI install wizard (stays as-is)
- Systemd service management in Docker tests (not possible without privileged containers)
- MCU detection in tests (needs real hardware)
- Full end-to-end test with Moonraker/Klipper in Docker

## Decisions

### 1. Port detection: net.Listen instead of ss parsing

**Decision:** Use `net.Listen("tcp", fmt.Sprintf(":%d", port))` to check port availability.

**Rationale:**
- `ss -tuln` requires `iproute2` package (not always installed)
- net.Listen actually tries to bind the port, which is more accurate
- No external tool dependency
- Type-safe, testable in isolation

**Alternatives considered:**
- Reading `/proc/net/tcp` directly: More portable but complex hex parsing
- Using `ss` with fallback to `netstat`: Still needs external tools
- Using `exec.Command("ss")`: Just moves the bash problem into Go

### 2. Backup: smart content with pruning

**Decision:** Only backup `instances/` and `logs/` directories. Keep at most 5 backups, prune oldest on each new backup.

**Rationale:**
- `releases/` can be re-downloaded from GitHub
- `admin/` can be regenerated
- `backups/` should never be backed up (recursive problem)
- instances/ is the only irreplaceable user data
- 5 backups × ~25 MB = 125 MB max, safe even on 32 GB SD cards

**Alternatives considered:**
- Full directory backup: 1.1 GB per backup, fills SD card quickly
- No backup: Dangerous for a release installer
- Timestamp-based pruning (keep 7 days): More complex, less predictable

### 3. Migration: os.Rename with non-destructive merge

**Decision:** If only old dir exists, rename. If both exist, merge using filepath.Walk with skip-if-exists.

**Rationale:**
- `os.Rename` is atomic on the same filesystem
- Merge preserves both old and new data (user might have created files in both)
- Skip-if-exists prevents overwriting newer data with older data

### 4. Thin bootstrap: bash handles only what it must

**Decision:** install.sh only does: sudo check, arch detection, disk space check, binary download, checksum verification, handoff to Go.

**Rationale:**
- Chicken-and-egg problem: need something to download the Go binary
- Everything else (ports, migration, backup, deps, dirs, configs, services) is platform-independent and belongs in Go
- Bash is only needed for the initial download and system-level checks

### 5. Docker integration tests: Go test framework

**Decision:** Use Go's `testing.T` with `os/exec` to manage Docker containers. Single container per test suite, reset between scenarios.

**Rationale:**
- Integrates with existing Go test infrastructure (`go test -v ./tests/installer/`)
- Works in CI (GitHub Actions supports Docker)
- Single container reduces overhead vs one container per test
- Reset between tests ensures isolation

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| net.Listen behavior differs from ss (TIME_WAIT, IPv6, port security) | Add explicit documentation; test both IPv4 and IPv6; handle EACCES for privileged ports |
| Migration merge could miss edge cases (symlinks, permissions, special files) | Use filepath.Walk with explicit error handling; test with symlinks, read-only files, empty dirs |
| Go backup doesn't preserve file metadata like cp -a | Use os.Lchown, os.Chtimes, os.Chmod for metadata; or fall back to exec.Command("cp", "-a") for the copy |
| Docker tests can't test systemd service management | Separate concern: service management is tested manually; Docker tests cover everything else |
| Binary checksum: need to include checksums in GitHub releases | Add checksum generation to release workflow; verify SHA256 before executing binary |
| Recompiled binary may introduce new bugs | Run all existing tests before release; manual smoke test on a real machine |