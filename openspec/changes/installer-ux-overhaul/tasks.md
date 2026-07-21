## 1. install.sh Polish

- [x] 1.1 Add `--help` flag with usage information
- [x] 1.2 Add `--version` flag
- [x] 1.3 Add colored output for success/error/warning messages
- [x] 1.4 Add download progress bar with transfer speed
- [x] 1.5 Improve error messages with context (available vs required disk space, supported archs)
- [x] 1.6 Update checksum verification to fail hard when .sha256 is missing

## 2. Loading Screen with Streaming Detection

- [x] 2.1 Create loading screen Bubble Tea model with per-detection streaming
- [x] 2.2 Implement detection order: OS → Python → git/curl/zstd → disk space → sudo NOPASSWD → GitHub API
- [x] 2.3 Implement MCU device scan with /dev/serial/by-id/ probing
- [x] 2.4 Implement port scan (8081, 7125, 7126) using net.Listen
- [x] 2.5 Implement auto-transition to decision screen when all detections complete
- [x] 2.6 Handle slow detections with timeout and graceful degradation

## 3. Decision/Confirm Screen (Screen 1)

- [x] 3.1 Create decision screen with mode selector (fresh vs import)
- [x] 3.2 Add instance name input field with inline validation (lowercase, numbers, hyphens)
- [x] 3.3 Add auto-detected summary display (dynamic per detection results)
- [x] 3.4 Add multi-MCU picker when >3 devices detected
- [x] 3.5 Implement Enter to install, 'r' to rescan, 'q' to quit
- [x] 3.6 Add firmware status display (detected / not detected)

## 4. Separate Bootstrap Pipelines

- [x] 4.1 Extract fresh install pipeline into its own step list
- [x] 4.2 Create import pipeline step list (7 steps: packages, sudoers, detect Klipper, create dirs, config Moonraker, nginx+mDNS, start+integrate)
- [x] 4.3 Implement heuristic Klipper detection (systemd scan, common paths, printer.cfg parsing)
- [x] 4.4 Implement backup+diff before config modification during import
- [x] 4.5 Implement import rollback that only cleans E3CNC-created artifacts
- [x] 4.6 Implement picker UI for multiple Klipper installs detected

## 5. Merged Progress + Verification Screen (Screen 2)

- [x] 5.1 Refactor existing progress dashboard to render mode-specific step lists
- [x] 5.2 Add verification phase as final step group in progress pipeline
- [x] 5.3 Add inline error recovery overlay (retry/skip/abort on the same screen)
- [x] 5.4 Add final summary with instance URL and next steps
- [x] 5.5 Make the progress component reusable across install, import, and update flows

## 6. Update TUI Wizard

- [x] 6.1 Create update Bubble Tea model
- [x] 6.2 Implement version check (current vs latest GitHub release)
- [x] 6.3 Implement GitHub release notes fetch for changelog display
- [x] 6.4 Create update confirm screen with changelog and version diff
- [x] 6.5 Create update progress screen (download → extract → activate → health checks)
- [x] 6.6 Implement hybrid rollback: auto-rollback on critical failures, manual on minor
- [x] 6.7 Keep new release directory on disk after rollback (prune on next successful update)
- [x] 6.8 Add "Already up to date" handling

## 7. Integration Tests

- [x] 7.1 Add test for 3-screen wizard loading and transition
- [x] 7.2 Add test for import existing Klipper flow with simulated Klipper install
- [x] 7.3 Add test for update wizard with version detection and changelog
- [x] 7.4 Add test for update auto-rollback on critical health check failure
- [ ] 7.5 Add test for install.sh --help and --version flags
- [x] 7.6 Add test for inline error recovery (retry/skip/abort)

## 8. Cleanup

- [x] 8.1 Remove unused screens from install.go (MCUSelect, Config, FirmwareCheck screens)
- [x] 8.2 Update main menu routing for new install wizard entry point
- [x] 8.3 Verify --unattended mode works with new flow (skip Screen 1, use defaults)
- [x] 8.4 Final regression test pass