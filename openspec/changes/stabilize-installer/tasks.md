## 1. Go Bootstrap: Port Detection

- [x] 1.1 Create `cli/go/internal/bootstrap/ports.go` with `autoDetectPorts()` function using net.Listen
- [x] 1.2 Implement port scanning loop (start from default, try upward until free)
- [x] 1.3 Add `--port-detect` flag to cmdInstall for standalone port detection
- [x] 1.4 Wire autoDetectPorts() into bootstrap.Bootstrap() flow
- [x] 1.5 Add unit tests for port detection (free port, busy port, port range exhausted)

## 2. Go Bootstrap: Directory Migration

- [x] 2.1 Create `cli/go/internal/bootstrap/migration.go` with `migrateOldDir()` function
- [x] 2.2 Implement rename path (only old dir exists → rename to new)
- [x] 2.3 Implement merge path (both exist → filepath.Walk with skip-if-exists)
- [x] 2.4 Handle edge cases: symlinks, empty dirs, permission differences
- [x] 2.5 Add `--migrate-only` flag to cmdInstall for standalone migration
- [x] 2.6 Wire migrateOldDir() into bootstrap.Bootstrap() flow
- [x] 2.7 Add unit tests for migration (old dir only, both dirs, neither, symlink)

## 3. Go Bootstrap: Smart Backup

- [x] 3.1 Create `cli/go/internal/bootstrap/backup.go` with `backupExisting()` function
- [x] 3.2 Implement smart content backup (instances/ and logs/ only)
- [x] 3.3 Implement backup pruning (keep 5, remove oldest)
- [x] 3.4 Preserve file metadata (permissions, ownership, timestamps)
- [x] 3.5 Add `--backup-only` flag to cmdInstall for standalone backup
- [x] 3.6 Wire backupExisting() into bootstrap.Bootstrap() flow
- [x] 3.7 Add unit tests for backup (smart content, pruning, metadata preservation)

## 4. Install Thin Bootstrap

- [x] 4.1 Reduce install.sh to ~150 lines: pre-flight, download, verify, handoff
- [x] 4.2 Add `--max-time 120` to curl download
- [x] 4.3 Add SHA256 checksum verification after download
- [x] 4.4 Remove duplicate steps: port detection, migration, backup, deps, dirs, configs, services
- [x] 4.5 Update `--help` to include `--test-ports` flag
- [x] 4.6 Fix hardcoded `/home/biqu` path in test_port_detection()
- [x] 4.7 Add zstd to dependency verification list

## 5. Docker Integration Tests

- [x] 5.1 Create `tests/installer/docker_test.go` with Go test framework
- [x] 5.2 Create Dockerfile for test container (debian:12-slim + sudo + curl)
- [x] 5.3 Implement port detection test (free ports + port conflict)
- [x] 5.4 Implement migration test (old dir only + merge scenario)
- [x] 5.5 Implement backup test (smart content + pruning)
- [x] 5.6 Implement package install verification
- [x] 5.7 Implement directory creation verification
- [x] 5.8 Implement config generation verification
- [x] 5.9 Implement binary download verification
- [x] 5.10 Add test isolation (reset container state between scenarios)

## 6. Build & Release

- [x] 6.1 Build e3cnc-tui for arm64 and amd64
- [x] 6.2 Generate SHA256 checksums for binaries
- [x] 6.3 Update bin/e3cnc-tui-arm64 and bin/e3cnc-tui-amd64
- [x] 6.4 Run all existing tests (typecheck, lint, unit tests)
- [x] 6.5 Run Docker integration tests
- [x] 6.6 Manual smoke test on a real machine
- [ ] 6.7 Commit and push all changes