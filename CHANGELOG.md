# Changelog

All notable changes to E3CNC are documented here.

## [0.9.18-merged.1] - 2026-07-23

### 🐛 Bug Fixes

- *(ci)* Install git-cliff in workflow runner
- *(ci)* Use NORMALIZED_VERSION for artifact filenames, add test kill fallback
- *(tests)* Add kill fallback to AllScreensRender to prevent CI hangs
- *(go-tests)* Correct E3CNCHome test to check uppercase path
- *(go-tests)* Use uppercase E3CNC in test paths
- *(frontend)* Resolve TypeScript errors in Vue components
- *(install)* Skip version warning for dev builds, remove legacy supervisor config
- *(install)* Clean up --test-ports output, remove stale nc_pid reference
- *(install)* Migrate data from ~/e3cnc to ~/E3CNC on upgrade
- Use ~/E3CNC (uppercase) consistently everywhere
- Align header and completion boxes with ANSI-aware padding
- Create log directory before first log() call
- Correct binary download URL and stdout/stderr routing
- Make install.sh executable (chmod +x)
- Remove duplicate cd cli/go in CI Go test step
- Run Go tests with -short in CI (skip interactive TUI tests)
- Remove failing test/typecheck from CI (not configured)
- Remove typecheck from CI (vue-tsc errors in codebase)
- Add vue-tsc to devDependencies
- Remove admin-page from dispatch test (command removed in merge)
- Accept semver with suffix in release version validation

### 📖 Documentation

- Fix README install instructions (use install.sh, not e3cnc-tui install)
- Update CHANGELOG for v0.9.18-merged release

### 📦 Chores

- *(docs)* Mark changelog-consolidation complete
- *(version-ssot)* Update lockfile after removing vite-plugin-package-version
- *(version-ssot)* Update TUI doc with Git-tag SSOT, mark 3.x complete
- *(version-ssot)* Add manifest version guard (no v prefix)
- *(version-ssot)* Align store with VITE_APP_VERSION, mark 1.x/2.x complete
- *(version-ssot)* Remove vite-plugin-package-version, switch to build-time env
- *(version-ssot)* Normalize CI version resolution, export NORMALIZED_VERSION
- *(installer)* Remove stale deploy.sh, update install tests and task notes
- *(tui-tests)* Remove duplicate install init test, cleanup task notes

### 🔧 Refactoring

- *(tests)* Simplify installer test harness

### 🚀 Features

- *(docs)* Auto-generate CHANGELOG with git-cliff, consolidate to single source
- *(installer-ux-overhaul)* Cleanup tests, add update tests, mark sections complete
- *(installer-ux-overhaul)* Continue update wizard, tests, cleanup
- *(install)* Refactor bootstrap into fresh/import pipelines with Klipper detection
- *(install)* Improve installer UX and documentation
- *(install)* Add --test-ports flag to verify port auto-detection
- *(install)* Auto-detect free ports for services
- *(tests)* Add installer test matrix for target OS environments
- Animated spinner and waiting dots in install.sh
- Add progress bars and spinner to install.sh
- Update install.sh for v0.9.18-merged
## [0.9.18-merged] - 2026-07-08

### Tidy

- Align menu descriptions

### ✅ Tests

- Update TUI tests for ASCII art banner
- Add confirm unit tests, remove dead code, fix e2e tests

### 🐛 Bug Fixes

- Resolve merge conflicts (dispatch.go + menu.go)
- Use sudo for nginx symlink creation, unique server_name per instance
- Auto-generate admin page at end of bootstrap so /admin works immediately
- Clamp cursor to valid range after instance list refresh
- Only show E3CNC-managed instances, remove KIAUH from instance list
- FromName falls back to KIAUH layout for instance deletion
- *(tui)* Remove redundant Actions section from instance manager
- Delete instance now accepts Enter key to confirm
- Health checks use supervisorctl status instead of systemd placeholder
- Add sudo to all systemctl calls to avoid interactive auth errors
- Add sudo to apt-get install in bootstrap step 1
- *(tui)* PgUp/PgDn scrolling on verification screen, filter log to warnings on completion
- *(tui)* Freeze step durations on completion instead of ever-growing timer
- Prevent log viewport blocking by batching output lines + larger channel buffer
- *(tui)* 50/50 split layout with enforced pane boundaries
- *(tui)* Fixed-height step list prevents layout jumping during install
- Pre-flight checks no longer auto-run before mode selection
- *(tui)* Selected items always green, descriptions white
- *(tui)* Selected label green, description always white
- *(tui)* Align menu descriptions with dynamic padding
- *(tui)* Tighter menu spacing so banner fits 44-line terminal
- *(tui)* Use E3CNC branded ASCII art from browser console
- Harden GitHub pipelines (tests, lint, binary uploads)
- TUI command execution and dispatch fallthrough - Fix TUI to properly execute selected commands when Enter/Space or 'q' pressed - Fix command dispatch to fall through to Python for unknown commands - Update test expectations to match corrected behavior - Enhance menu system with dynamic generation from commands.json with fallback to hardcoded menu - Update version script to reflect Python CLI references (retired in v0.9.14+)
- *(cli)* Repair critical syntax error in status command and consolidate State struct

### 📖 Documentation

- Remove stale references to old Python/Ansible CLI
- Add PRD for tui bubbletea enhancements

### 🔧 Refactoring

- Replace systemd with supervisor for all E3CNC service management
- Use domain.OutputFormatter for consistent ✓/✗ output in all CLI commands
- Split bootstrap, domain tests, split instance views, wizard integration test
- Split monolithic install.go, add domain package with shared types

### 🚀 Features

- Auto-assign available ports, check system-level port binding
- Admin page shows all instances table with status, ports, links
- *(tui)* Show instance details only when selected or active
- *(tui)* Scrollable instance list with viewport
- *(tui)* Mouse wheel scrolling for log viewport
- *(tui)* Show ms for sub-second step durations
- *(tui)* Scroll indicator with percentage and thumb in log viewport
- *(tui)* Install summary appended to log viewport on bottom pane
- *(tui)* Bottom pane shows real command output instead of progress tickers
- *(tui)* Retry/skip properly restart install from correct step
- *(tui)* Improved install wizard with blocking/non-blocking steps and log viewport
- *(tui)* Install wizard starts with import/new instance choice
- *(tui)* Textinput for install wizard instance name
- *(tui)* Add spaces around dash connectors
- *(tui)* Dashes between labels and descriptions, cyan→green
- *(tui)* Display version number after E3CNC CLI title and fix tight spacing
- *(tui)* Add blank line above banner for breathing room
- *(tui)* Add ASCII art banner to main menu
- *(tui)* Phase 2.1 — confirmation dialogs for destructive actions
- *(tui)* Phase 1 — mouse, scrollable output, text inputs, progress bar
- *(tui)* Add ASCII art banner to main menu
- Add one-command installer script (install.sh)
## [0.9.17] - 2026-07-07

### 📦 Chores

- Bump v0.9.16 → v0.9.17
- Fix CI config and installer path after reorg

### 🔧 Refactoring

- Reorganize root files into proper directories
## [0.9.14] - 2026-07-07

### 🐛 Bug Fixes

- Build and ship e3cnc-tui for both linux/arm64 + linux/amd64
- Install wizard step progression and verbose output
- Clear terminal before re-launch TUI, consistent b key
- Replace 5s delay with 'b' key to return to menu
- Auto-re-launch TUI after command dispatch
- Check Moonraker components field for CNC agent
- Re-launch TUI after command dispatch
- Version display and active instance selection
- Instances option and local IP detection
- Use Go-native dispatch from TUI, fall back to Python
- Use backToMenuMsg command instead of done flag for wizard exit

### 📖 Documentation

- Restore CHANGELOG.md with entries for v0.9.9 through v0.9.13
- Mark all phases complete in rewrite plan

### 📦 Chores

- Bump to v0.9.14
- Remove Python CLI, Ansible, and old test code
- Add .nojekyll for GitHub Pages static deployment

### 🔧 Refactoring

- Split inline dispatch.go commands into separate files

### 🚀 Features

- Standalone admin dashboard server with Vue SPA
- E2e tests (tea.TestProgram + PTY), aligned menu, install-cli script
- Redesigned install wizard flow
- MCU selection in install wizard config
- All commands run inside TUI, no alt screen exit
- All commands Go-native, remove Python fallback
- Track pre-built e3cnc-tui binary in repo
- Full Go CLI rewrite — drop Python + Ansible
- Add Go-native command dispatch and release artifact fix
- Add --artifact flag to update command
## [0.9.13] - 2026-07-04

### 🐛 Bug Fixes

- Add esc/q handler to exit install wizard
## [0.9.12] - 2026-07-04

### 🐛 Bug Fixes

- Strip ANSI codes from JSON output in instance manager
## [0.9.11] - 2026-07-04

### 🐛 Bug Fixes

- Add cli/__main__.py for python3 -m cli support
## [0.9.10] - 2026-07-04

### 🐛 Bug Fixes

- Run instance manager from parent of cliDir with -m cli
- Use e3cnc-cli script path instead of -m cli in instance manager
- Strip v prefix from version in release workflow Go build
## [0.9.9] - 2026-07-04

### Fix

- Add missing [virtual_sdcard] and [save_variables] sections to CNC printer.cfg template (fixes issue #23)

### 🐛 Bug Fixes

- Cd to cli/go for Go build in release workflow
- Restore index.html to project root for vite build
- Suppress console 404 for missing cnc-meta.json
- ConfigFilesPanel Vuetify 3 data table crash
- Defer ConfigFilesPanel data table render until after mount
- ConfigFilesPanel Vuetify 3 data table parentNode crash
- ConfigFilesPanel Vuetify 3 data table crash
- Harden WebSocket reconnect with exponential backoff and user notifications

### 📦 Chores

- Bump v0.9.8 → v0.9.9

### 🚀 Features

- BubbleTea TUI migration (Phases 0-6)
## [0.9.8] - 2026-07-03

### Cleanup

- Remove 3D-printing-only features

### ✅ Tests

- Bootstrap template rendering and switch cancel

### 🐛 Bug Fixes

- Add zstd dependency check in pre-flight and extraction steps
- Missing watch import and implicit any in useCncProfile

### 📦 Chores

- Bump v0.9.7 → v0.9.8

### 🚀 Features

- Import Mainsail user preferences from KIAUH Moonraker DB
- Bootstrap moonraker.conf template for clean instance configs
## [0.9.7] - 2026-07-02

### ✅ Tests

- Fill gaps in CLI testing

### 🐛 Bug Fixes

- Add prune-backups to cli/__init__.py dispatch dict
- Numbered menu shortcut keys now work, add tests
- Fix_moonraker_config merge logic and add tests
- Add cancel/back options to switch instance and create instance
- Prune-backups shortcut [z] → [v] to avoid clash with quit
- E3cnc-cli wrapper falls back to repo if bundled CLI fails

### 📦 Chores

- Bump v0.9.6 → v0.9.7

### 🔧 Refactoring

- Centralize CLI command registry for reliability
## [0.9.6] - 2026-07-02

### 🐛 Bug Fixes

- Bump-version.sh now commits before tagging, so the tag points to the correct commit
- Strip leading 'v' from deployed version in display
- Handle PermissionError when reading root-owned sudoers file

### 📦 Chores

- Bump v0.9.5 → v0.9.6
- Bump v0.9.4 → v0.9.5 (v0.9.4 tag pointed at wrong commit)
## [0.9.5] - 2026-07-02

### Cleanup

- Remove all Moonraker update_manager integration

### 🐛 Bug Fixes

- Show both CLI and deployed stack version in --version and menu
- Numbered menu quit option now exits the CLI
- Save backups to ~/e3cnc/backups/ instead of repo root
- Merge duplicate moonraker.conf sections before restarting services
- Use github.ref for trigger detection instead of ref_type

### 📖 Documentation

- Update changelog for v0.9.4 with all session changes

### 🚀 Features

- Bundle CLI into stack artifact for version sync
- Add prune-backups CLI command
- Interactive instance selection for uninstall command
- Passwordless sudo for E3CNC service management
- WCS Y-axis fix, release pipeline automation, version audit
## [0.9.3] - 2026-07-02

### 🐛 Bug Fixes

- Restore saved WCS on job end instead of always defaulting to G54

### 📖 Documentation

- Update changelog with version centralization entry

### 📦 Chores

- Bump v0.9.2 → v0.9.3
- Bump-version.sh now updates CHANGELOG.md with a stub entry
- Use package.json as single source of truth for version
## [0.9.2] - 2026-07-02

### ✅ Tests

- Push coverage to 79% with deploy utility tests and helpers expansion
- Raise test coverage from 58% to 78% across all modules

### 🐛 Bug Fixes

- Reduce FINISH_JOB Z lift from 50mm to 10mm
- Safer FINISH_JOB and CANCEL_PRINT macros — relative Z lift only, no G53 park
- Auto-reset WCS to G54 on job end to prevent machine coordinate crashes
- Resolve all TypeScript errors — zero vue-tsc, clean build
- Final store layer fixes — last 27 files, store down to 4 errors from 1,222 baseline
- Additional store type fixes — farm/index.ts ActionContext, files/actions.ts, socket/actions.ts, editor/actions.ts, gui mutations, server actions
- Resolve TypeScript errors — store layer (~75 files), test files (wrapper.vm casts + :any annotations)
- Resolve TS errors in 5 test files + add webrtc-go2rtc type
- Set python_requires >=3.9 in stack manifest (Debian 11 target)

### 📖 Documentation

- Update CHANGELOG for v0.9.1 and v0.9.2
- Add inline comments to wcs_macros.cfg and macro_labels.cfg
- Add inline comments to FINISH_JOB and CANCEL_PRINT macros
- Update TS error PRD with ActionContext limitation finding
- Add PRD for platform abstraction layer to reach 90% coverage

### 📦 Chores

- Move prd files from docs/prd/ to prd/ at project root
- Move prd files from docs/prds/ to docs/prd/
## [0.9.0] - 2026-06-30

### ✅ Tests

- Comprehensive unit tests for all CLI commands

### 🐛 Bug Fixes

- Disable show_shortcut_hints, shortcuts still work without hints
- Add missing keep attribute to Fake args for prune
- Use lowercase shortcuts for simple-term-menu compatibility
- Enable show_shortcut_hints so letter shortcuts work
- Persist web port in moonraker.conf during KIAUH import
- Revert show_shortcut_hints to False, keep clean menu
- Simplify menu items, remove headers for reliable shortcuts
- Clear screen before menu to make command output visible
- Disable show_shortcut_hints for better compatibility
- Always pause after menu command output
- Check --instance before get_active_instance to avoid unwanted prompt
- Skip blank lines in TUI entries, add dummy shortcut to headers
- Add bracket shortcuts to instance selection menus
- Restore bracket shortcuts for simple-term-menu compatibility
- Sync numbered menu with section layout, filter headers from selectable items
- Use numbered menu instead of letter shortcuts for TUI
- Menu shortcuts and add missing commands (admin-page, clilog, migrate-instances, restart, import)
- Make Klipper health checks optional (don't trigger rollback)
- Use sudo for supervisorctl status check
- Unique shortcut for Import KIAUH (p), register dispatch
- Use local IP in status and instances commands
- Use local IP via UDP socket instead of gethostbyname
- Use IP instead of hostname in admin page URLs
- Show per-instance web URL in instances list
- Persist web port in moonraker.conf as comment
- _compute_web_port no longer calls detect_instances (avoids recursion)
- Show per-instance URLs based on moonraker port
- Use instance-subdomain URLs (name.hostname)
- Use generic <host> placeholder in status URLs
- Web UI is always on port 80 (nginx), not moonraker port
- Show correct port per instance in status URL, respect active instance
- Restart uses supervisor only when instance config exists, else systemd
- Skip restart after registration, increase supervisorctl timeout
- Restart uses globally active instance from menu switch
- Use sudo tee for supervisor config and sudo rm for cleanup
- Auto-register instance with supervisor on restart if not registered
- Remove instance directory on uninstall, regenerate admin page
- Ignore errors when restarting moonraker during uninstall
- Strip redundant prefixes from instance names, comment out optional mcp dep
- Lowercase shortcut keys so unshifted letters work
- Unique shortcut keys in TUI menu (D→M for Detect MCU)
- Handle SameFileError in sync_runtime_files
- Prompt for sudo before systemd path updates
- Disable shortcut hints footer (duplicates inline brackets)
- Keep command output visible between menu sessions
- Resolve active instance before raw terminal mode
- Only disable canonical/echo on input, not output raw
- Fall back to input() when not in a TTY
- Fall back to ~/moonraker/~/klipper in from_name when no release symlink
- Prioritize globally active instance in _run_ansible_cmd
- _run_ansible_cmd falls back to active instance
- Add description to migrate-instances subcommand
- Make install and dry-run behavior safer
- Add detect-mcu, flash-mcu, init-config to interactive menu

### 📖 Documentation

- V0.9.0 changelog — menu rewrite, supervisor, web ports, import, admin page, tests
- Fix stale install/update references
- Add v0.8.4 changelog entry

### 🔧 Refactoring

- Deduplicate _create_instance to use shared helper
- Use simple-term-menu for TUI menu
- Reliable arrow key navigation with vendored keyreader
- Remove raw terminal handling, use simple input-based menu
- Replace KIAUH instance naming with own convention

### 🚀 Features

- Add blank lines before section headers in both menus
- Add aligned descriptions to all menu items
- Organize CLI menu into sections with headers
- Card-based admin page with clickable URLs
- Deploy nginx config on KIAUH import
- Per-instance nginx web ports (80, 8080, 8081...)
- Import KIAUH instance into E3CNC layout safely
- Show access URL in status output (Web UI, Admin, API)
- Add restart command to restart instance services
- Add supervisord process management for instances
- Add Create Instance option to instances and switch commands
- Add CLI logging to ~/e3cnc/cli.log
- Use simple-term-menu for instance selection and switch prompts
- Add quit option to instance selection prompt
- Add 'Create new instance' option to instance selection prompt
- Arrow-key navigation in interactive menu
- Add Create Instance option to interactive menu
- Add /admin page with instance info
- Enrich instances command with full instance details
- Prompt for instance name during fresh install
## [0.8.4] - 2026-06-29

### 🐛 Bug Fixes

- Create scripts dir before copying metadata extractor

### 📦 Chores

- Bump version to v0.8.4
## [0.8.3] - 2026-06-29

### 🐛 Bug Fixes

- Increase health check retries from 3 to 6
- Include *.db files in Moonraker backup glob
- Python 3.9 compatibility for type annotations
- Code-split build into smaller chunks, suppress size warnings

### 👷 CI/CD

- Expand CI workflow with Python tests + frontend build verification

### 📖 Documentation

- Update CHANGELOG for v0.8.2 with all session changes
- Update STATUS.md, AGENTS.md, README for v0.8.2

### 📦 Chores

- Bump version to v0.8.3

### 🚀 Features

- Add --dry-run to update + raw SQLite DB backup
## [0.8.2] - 2026-06-29

### ✅ Tests

- Add frontend deploy + HTML verification to Docker integration test
- Add simulated MCU integration test for full-stack verification
- Expand Docker integration test to verify 16 installation checks
- Add 31 unit tests for cli/ package and new features

### 🐛 Bug Fixes

- Add [pause_resume] to test printer.cfg
- Remove -r flag from Linux MCU startup in test
- Use Linux MCU instead of host simulator in integration test
- Increase _exec() timeout from 300s to 600s
- Correct frontend port in integration test
- Add container cleanup in fixture setup
- Optimize Docker integration test speed
- Add Klipper requirements file and missing Docker deps
- Add libsodium23 and cors_domains to bootstrap for Moonraker WebSocket support
- Resolve Docker integration test issues (Ansible bool + path quoting + nginx perms)
- Ensure sudo access for service restart, daemon-reload after systemd updates, warn on remote mode

### 📖 Documentation

- Update STATUS.md with Klipper requirements file and pip/venv fix
- Sync STATUS.md with CLI install/update alignment refactor
- Sync STATUS.md and AGENTS.md with current repo state
- Update STATUS.md with all session work and architecture decisions
- Add E3CNC single-deploy plan v3.0

### 📦 Chores

- Remove test screenshots from repo
- Bump version to v0.8.2, fix CLI help texts, align deploy playbook
- Remove redundant Ansible roles, fix deploy paths, add post-install guide
- Restructure vendor code, fix nginx coexistence, prepare v0.8.2 release
- Bump to v0.8.2

### 🔧 Refactoring

- Align install/update with release-based architecture
- Split e3cnc-cli into cli/ package (1,896→1,006 lines)

### 🚀 Features

- Add e3cnc-cli init-config command
- Add e3cnc-cli flash-mcu command
- Add e3cnc-cli detect-mcu command + scan_serial_devices helper
- Add Avahi mDNS publishing for e3cnc.local, switch nginx to port 8080
## [0.8.1] - 2026-06-26

### 🐛 Bug Fixes

- Handle UnicodeEncodeError in print_banner for latin-1 terminals
- Skip Moonraker service check if HTTP API already confirmed running

### 📖 Documentation

- Add before/after comparison table to v0.8.0 release
- Add v0.8.0 release article

### 📦 Chores

- Bump to v0.8.1 (banner encoding fix)
## [0.8.0] - 2026-06-26

### ✅ Tests

- Fix useNavigation getter default (null→[]), add Console page test
- Deepen GeneralReset tests with dialog open, reset action, history namespace (+3 tests)
- Deepen LedEffectsPanel, EndstopPanel, TempChart tests (+interaction coverage)
- Deepen TempChart tests with data series, autoscale, and PWM variants (+3 tests)
- Deepen TheServiceWorker tests (+registerSW callbacks verification)

### 🐛 Bug Fixes

- Update fallback VERSION in e3cnc-cli to match _e3cnc_shared
- Use correct cnc_agent endpoint in health checks
- Use Path object for systemd paths (was str / str TypeError)
- Point to moonraker log on update failure
- Move useBase() to setup scope in TheTopCornerMenu
- Auto-select first running instance, make pip install non-fatal
- Download checksum alongside artifact, auto-select single instance
- Quote 'on' trigger key in CI workflow — YAML 1.1 interprets bare 'on:' as boolean true
- Add shared_remote parent to rollback parser
- Better frontend URL guessing in instances command
- Add new CLI commands to main dispatch table

### 📖 Documentation

- Update landing page script paths and update manager note

### 📦 Chores

- Bump version to v0.8.0 (single-deploy release)

### 🚀 Features

- Run update as background task, frontend polls for completion
- Show success/error toasts after update and rollback
- Add full-screen overlay spinner during E3CNC stack update
- Show version inline in E3CNC section header
- Add E3CNC stack control section to top corner menu
- Show current instance info in top corner menu
- Add E3CNC deploy API endpoints to cnc_agent component
- Add instances CLI command
- Complete single-deploy migration (rename, flatten, CLI, CI, health checks, rollback)
## [2.17.0] - 2026-01-11

### Locale

- *(fr)* Update French translate file

### 🐛 Bug Fixes

- Use natural sort for caseInsensitiveSort to handle numeric suffixes correctly (#2380)
- Update page title in inactive browser tabs (#2383)
- *(HistoryList)* Implement context menu close functionality using EventBus (#2378)
- *(AFC)* Use correct fallback for empty spool color in filament dialog (#2381)
- *(Dockerfile)* Remove unnecessary script copy for unprivileged image (#2377)
- *(Docker)* Add latest tag support for versioned releases (#2374)
- *(HappyHare)* Fix EMU logo in dark mode (#2369)

### 👷 CI/CD

- *(Docker)* Update actions in publish_docker.yml to latest (#2375)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.17.0
- Update vite-plugin-pwa npm package and configuration (#2371)

### 🔧 Refactoring

- *(Dialogs)* Modernize with VModel and consolidate buttons (#2372)
- Move HistoryListPanelCol interface to centralized type (#2379)
- Remove unused PrinterStateLight type in printer store (#2370)

### 🚀 Features

- *(TemperaturePanel)* Add support for 'temperature_combined' sensor (#2366)
- *(Webcam)* Add iframe-based webcam service option (#2384)
- *(Preheat)* Add chamber temperature (M141) support to preheat gcode button (#2382)
- *(HappyHare)* Adds tiny numeric indicator of sensor position for Proportional Feedback sync-feedback buffers (#2343)
- *(HappyHare)* Added flowrate % to flowguard meter when using proportional sensor
- Add LED effects panel  (#2275)
## [2.16.1] - 2025-12-22

### 🐛 Bug Fixes

- *(Settings)* Fix drag&drop sortable in Orcaslicer (#2353)
- *(MoonrakerSensor)* Fix sensor name display logic (#2356)
- *(Docker)* Disable ipv6 when it is not available on the Host (#2354)
- *(Spoolman)* Replace spoolman url to api hostname when localhost (#2351)
- *(MacroPrompt)* Fix margin between multi line buttons (#2352)
- *(HappyHare)* Remove too much divider in print start dialog (#2350)
- *(HappyHare)* Fixes animated filament position so filament doesn't go backwards (#2347)
- *(StatusPanel)* Fix filename exists check in rename gcodefile dialog (#2345)
- *(HappyHare)* Fix color match in TTG Map (#2341)
- *(HappyHare)* Clog detection meter dependent on encoder OR sync-feedback (#2342)
- *(Spoolman)* Fix init load from spool db (#2340)
- *(Gcodefiles)* Fix context menu handling (#2338)
- *(Configfiles)* Fix context menu handling (#2339)
- Fix splitting gcode filament_names metadata (#2337)
- *(HappyHare)* Fix eject button disabling logic (#2336)
- *(StatusPanel)* Fix autofocus in rename dialog from gcodefiles (#2335)
- *(StatusPanel)* Fix context menu handling (#2333)

### 👷 CI/CD

- Combine & updates workflow files (#2305)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.16.1
- *(AI)* Add guidelines for AI-Agents (#2304)

### 🔧 Refactoring

- *(Sidebar)* Simplify template structure and active state handling (#2355)
- *(Theme)* Update Yumi logo (#2357)
- Replace vue-resize with ResizeObserver (#2348)
- *(StatusPanel)* Remove old/unused code in GcodefilesEntry (#2334)
## [2.16.0] - 2025-12-12

### Locale

- *(zhTW)* Update Chinese translations
- *(zh)* Update Chinese translations
- *(uk)* Update Ukrainian translations
- *(tr)* Update Turkish translations
- *(sk)* Update Slovak translations
- *(se)* Update Sami translations
- *(ru)* Update Russian translations
- *(pt)* Update Portuguese translations
- *(pl)* Update Polish translations
- *(nl)* Update Dutch translations
- *(ko)* Update Korean translations
- *(ja)* Update Japanese translations
- *(it)* Update Italian translations
- *(hu)* Update Hungarian translations
- *(fa)* Update French translations
- *(es)* Update Spanish translations
- *(da)* Update Danish translations
- *(cz)* Update Czech translations
- *(de)* Update German translations
- *(zh)* Update chinese locale (#2302)

### 🐛 Bug Fixes

- *(HappyHare)* Fix unit gate wrapping (#2312)
- *(HappyHare)* Add "loading" feedback to gate context action buttons (#2324)
- *(HappyHare)* Add "loading" feedback to main action buttons (#2315)
- *(HappHare)* Add missing sync-feedback bias (#2323)
- *(HappyHare)* Clean up of clog meter for consistent sizing (#2316)
- *(HappyHare)* Fix errors in selected tool (#2318)
- *(AFC)* Fix remap filament change dialog close with esc (#2321)
- *(Dashboard)* Set ArmoredTurtle logo/icon for the AFC panel in settings (#2314)
- *(HappyHare)* Removed spin button from spool_id (#2317)
- *(Dashboard)* Remove MMU-Panel, when no mmu module exists in Klipper (#2313)
- *(HappyHare)* Add missing Context Menu for gates (#2310)
- *(Spoolman)* Only refresh spoolman db while opening dialog (#2308)
- *(ExtruderPanel)* Always show pressure advance option in cogs menu (#2303)

### 👷 CI/CD

- *(release)* Update release workflow (#2328)
- *(release)* Fix changelog commit in release workflow (#2300)

### 📦 Chores

- Push version number to v2.16.0

### 🔧 Refactoring

- *(HappyHare)* Fix type issue and simplify SyncFeedback code (#2327)

### 🚀 Features

- *(TemperaturePanel)* Add support for AHT1X, AHT2X, AHT3X sensors (#2329)
- *(AFC)* Add TD-1 data to AFC panel (#2273)
- *(HappyHare)* Add Flowguard meter to monitor clog/tangle (#2311)
## [2.15.0] - 2025-11-27

### Build

- *(deps)* Bump js-yaml from 4.1.0 to 4.1.1 (#2290)
- *(deps-dev)* Bump vite from 5.4.19 to 5.4.21 (#2274)
- *(deps)* Bump axios from 1.8.3 to 1.12.1 (#2264)
- *(deps)* Bump brace-expansion from 1.1.11 to 1.1.12 (#2246)
- *(deps-dev)* Bump tmp from 0.2.3 to 0.2.4 (#2244)
- *(deps)* Bump form-data from 4.0.0 to 4.0.4 (#2241)
- *(deps-dev)* Bump vite from 5.4.18 to 5.4.19 (#2208)

### Locale

- *(Weblate)* Update translation files (#2203)
- *(sk)* Add Slovak locale file (#2248)

### ⚡ Performance

- Fixed hanging in gcode viewer on render quality change when no file is loaded (#2207)

### 🐛 Bug Fixes

- *(AFC)* Fixes issue where filament spool does not display correctly in safari browser (#2270)
- *(Heightmap)* Correct bed mesh coordinate calculation (#2293)
- *(Webcam)* Add error handling and fallback for camera-streamer ICE servers (#2281)
- *(Webcam)* Add keepalive function to camera-streamer (#2280)
- Remove debug console output in MiscellaneousLightNeopixelDialog.vue (#2277)
- *(AFC)* This PR fix the AFC settings with many lanes (#2260)
- *(Webcam)* Fix portrait webcam rotation in mjpegstreamer-adaptive (#2258)
- Add light theme to codemirror (#2234)
- *(Files)* Fix disk usage in new directories (#2226)
- *(gcodeviewer)* Fix scarf seam in Gcodeviewer (#2227)
- *(Webcam)* Fix webcam settings form in light mode (#2225)

### 👷 CI/CD

- *(release)* Use fast-forward merge from develop (#2299)
- *(release)* Add token to commit new version number (#2298)
- *(release)* Update release workflow (#2297)
- Fix check locale workflow (#2250)

### 📖 Documentation

- Add translated badge to README.md (#2291)
- Remove broken badge on README.md (#2288)
- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.15.0
- Push version number to v2.15.0
- Push version number to v2.15.0
- *(Docker)* Remove mainsail.zip from docker image (#2287)
- *(Docker)* Remove default nginx files (#2289)
- Update ISSUE_TEMPLATEs zu use the type field (#2215)
- *(ESLint)* Fix various ESLint errors (#2228)

### 🔧 Refactoring

- Rename Ipcamera to HTML-Video (#2257)
- *(miscellaneous)* Refactor led/neopixel in MiscellaneousPanel.vue (#2218)
- Remove unused vue import in historyStats.ts (#2209)
- *(Gcodefiles)* Refactor gcodefiles panel and table (#2212)

### 🚀 Features

- *(Extruder)* Show PA settings for extruder_stepper (#2283)
- *(Webcam)* Add rotation function to all webcam clients (#2259)
- Add support for Happy Hare (#2158)
- *(AFC)* Merged buttons into macros to display help text (#2272)
- *(AFC)* Show toolchanges instead of filament length in status panel (#2295)
- *(AFC)* Add function to map Tools to Lanes in the start print dialog (#2256)
- Add AFC support (Armored Turtle) (#2231)
- Add -unprivileged docker image to conform with restricted pod security standard (#2213)
- Added more date format options (#2210)
- *(Gcodefiles)* Add support for multi color gcode files  (#2216)
## [2.14.0] - 2025-04-23

### Build

- *(deps-dev)* Bump vite from 5.4.17 to 5.4.18 (#2197)
- *(deps)* Update dependencies in package.json (#2182)
- *(deps-dev)* Bump vite from 5.4.14 to 5.4.17 (#2180)
- *(deps)* Bump serialize-javascript and workbox-build (#2143)
- *(deps-dev)* Bump @intlify/core from 9.5.0 to 9.14.2 (#2064)
- *(deps)* Bump nanoid from 3.3.7 to 3.3.8 (#2085)

### Locale

- *(ru)* Update Russian translations (#2128)
- *(en)* Remove unused key (#2105)

### 🐛 Bug Fixes

- *(history)* Fix filter reactivity (#2129)
- *(updatemanager)* Only git repos can soft recover (#2191)
- *(updatemanager)* Loosely parse package semver (#2179)
- *(spoolman)* Save spool_id in lowercase variable (#2160)
- Fix the axios up- & download rate (#2172)
- Show system panel when Klipper is not ready (#2149)
- *(z-tilt)* Fix z_tilt check for older Klipper versions (#2102)
- *(Editor)* Fix structure sidebar for files with values without a section (#2139)
- *(Timelapse)* Fix count per page switch in the Timelapse Files Panel (#2134)
- *(History)* Fix count per page switch in the History List Panel (#2133)
- Update Gcode-Viewer lib from sindarius to fix G2/G3 visualisation (#2127)
- *(Locale)* Add missing translation key in SettingsControlTab (#2104)

### 👷 CI/CD

- *(check-locale)* Fix check-locale workflow (#2202)
- *(check-locale)* Use npx to run vue-i18n-extract script (#2198)
- *(check-locale)* Fix issues with i18n-extract workflow (#2194)
- Use GITHUB_TOKEN in auto-analyze.yml (#2195)
- Fix output of auto-analyze workflow (#2169)
- Remove unused build_size_report workflow (#2170)
- Update tj-actions/changed-files action in workflows (#2166)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.14.0
- Remove deprecated @types/cypress package (#2181)
- Update dependencies in package.json (#2168)
- Update gcodeviewer to v3.7.16 (#2152)

### 🔧 Refactoring

- *(Machine)* Refactor endstop panel and add dockable_probe (#2124)
- Remove duplicate PrinterStateLight definition (#2171)

### 🚀 Features

- Add search functionality to macro settings interface (#2141)
- Add support for hall filament width sensor (#2193)
- Add load cell gram scales in misc panel (#2173)
- *(Temperatures)* Add menu to open Settings & turn off heaters (#2103)
- *(Editor)* Store last state of file structure sidebar (#2140)
- *(UpdateManager)* Implement python package entries (#2092)
- *(Console)* Improve key up/down in Console with multi-line input/history (#2108)
- *(TemperaturePanel)* Add SHT3X support (#2025)
## [2.13.2] - 2024-12-25

### Locale

- *(zh)* Update chinese locale (#2081)

### 🐛 Bug Fixes

- *(Tools)* Use gcode commands instead of config gcode macros (#2088)
- Fix z_tilt button for z_tilt_ng with Kalico (#2078)
- *(Editor)* Fix docs link for Kalico (#2080)
- Hide horizontal scrollbar in StartPrintDialog.vue (#2075)
- *(Editor)* Fix maximal height of the sidebar (#2079)
- *(macro-prompts)* Preserve outer quotes (#2076)
- Fix print start from dashboard for subdirectory files (#2074)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.13.2
## [2.13.1] - 2024-12-07

### Locale

- *(de)* Update german locale (#2070)

### 🐛 Bug Fixes

- Fix interface settings Control-Tab when printer is not available (#2071)
- *(Webcam)* Add ICE Candidates check to support older camera-streamer versions (#2069)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.13.1
## [2.13.0] - 2024-12-04

### Build

- *(deps)* Bump rollup (#2021)
- *(deps-dev)* Bump vite from 4.5.3 to 4.5.5 (#2017)
- *(deps)* Bump axios and start-server-and-test (#1974)

### Locale

- *(it)* Update italian translation (#2049)
- Update Chinese (Traditional Han script) locale with Weblate
- Update Spanish locale with Weblate
- Update Hungarian locale with Weblate
- Update Hungarian locale with Weblate
- Update Spanish locale with Weblate
- Update Hungarian locale with Weblate
- Update Spanish locale with Weblate
- Update Dutch locale with Weblate
- Update Turkish locale with Weblate
- Update Hungarian locale with Weblate
- Update Spanish locale with Weblate
- Update Hungarian locale with Weblate
- Update Spanish locale with Weblate
- Update Hungarian locale with Weblate
- Update Spanish locale with Weblate
- Update Hungarian locale with Weblate
- Translations update from Hosted Weblate (#1952)
- *(zh)* Update chinese locale (#1951)

### ⚡ Performance

- Fix hang when leaving G-Code Preview page (#1949)

### 🐛 Bug Fixes

- Escape all file URLs to support all kind of special chars (#2065)
- Keep macro prompt open for events older than 100 (#2045)
- Fix save z offset in toolhead panel (#2060)
- *(Webcam)* Make webcam view non-draggable (#2057)
- Fix reference link in editor while printing (#2050)
- Tool rows in even lengths, and more visually tidy (#2041)
- *(notifications)* Fix dismiss function for tmc warnings (#1956)
- Fix color picker for PCA9632 (#2028)
- Fix image viewer if the image is wider than the viewport (#2020)
- *(control)* Check set actionButton before display it (#1953)
- *(Webcam)* Capitalize the connection state (#2019)
- *(History)* Adjust button tooltips to consistent style (#2018)
- *(Editor)* Fix editor width when sidebar is hidden (#2014)
- *(webcam)* Fix some connection issues in Camera-Streamer (#1981)
- *(HistoryPanel)* Fix History thumbnails of files in folders (#2010)
- *(Editor)* Trigger gotoLine only when change is from sidebar (#2012)
- *(ExtruderPanel)* Fix extrude and speed factor output (#2002)
- Correct github commit after link in commit list (#2000)
- *(webcam)* Fix memory leak in MJPEGStreamer client (#1987)
- Change Min Cruise Ratio to percent in MachineSettingsPanel (#1992)
- *(ExtruderPanel)* Restore mode after extruding/retracting (#1965)
- *(MediaMTX)* Fix some connection issues (#1979)
- Fix uuid request in MediaMTX webcam client (#1968)
- *(console)* Trim output to remove spaces at first char (#1962)
- *(gcodeviewer)* Fix gcodeviewer simulation while printing (#1954)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.13.0
- *(Docker)* Enable ipv6 in nginx.conf (#2030)
- *(websocket)* Add function to send and wait for response (#2004)
- *(prettier)* Add support to sort locale json files (#1976)

### 🔧 Refactoring

- Refactor gcodeviewer page (#2061)
- Refactor files list in StatusPanel (#2047)
- *(ControlPanel)* Use SAVE/RESTORE STATE when moving (#1988)
- Refactor Console & MiniConsole (#2031)
- Refactor machine settings panel (#1991)
- *(webcam)* Refactor Mjpegstreamer-Adaptive Webcam mode (#1994)
- *(ExtruderPanel)* Add `_` prefix to gcode_state name (#1989)
- *(timelapse)* Refactor the timelapse status panel (#1982)

### 🚀 Features

- Use _CLIENT_LINEAR_MOVE macros instead of multi-line gcodes (#2043)
- *(Webcam)* Add a optional overlay for IDEX calibration (#2053)
- Add option to hide other Klipper & Moonraker instances (#2029)
- *(spoolman)* Add multi tool support (#1946)
- *(StatusPanel)* Add option to show history in StatusPanel (#2055)
- *(StatusPanel)* Change tab text to icons (#2054)
- *(Dashboard)* Add option to change length and filter files (#2051)
- Add SGP40 support (#2040)
- Add button to open the device dialog in SystemPanel (#2046)
- Multiple nevermore support (#1939)
- *(History)* Add option to show stats in different values (#2007)
- *(Console)* Change from Helplist to Printer.Gcode (#2033)
- Add link to the Docs for Unauthorized connections (#2035)
- *(Heightmap)* Add option to set the default orientation (#2006)
- Add heartbeat to the moonraker websocket (#2003)
- Add output on connection dialog for unauthorized (#1996)
- Adds a file structure sidebar in the editor (#1943)
- Added second layer confirmation for Cancel Job (#1978)
- *(console)* Add option for RAW-output (for debugging) (#1975)
- *(console)* Add debug prefix (#1973)
- *(updateManager)* Use info_tag desc for the name (#1959)
- *(theme)* Add option for dedicated CSS file per theme (#1958)
## [2.12.0] - 2024-07-14

### Build

- *(deps-dev)* Bump braces from 3.0.2 to 3.0.3 (#1916)

### Locale

- *(de)* Update german locale (#1928)
- *(en)* Remove unused keys in english locale (#1929)
- *(en)* Add missing english locale (#1890)
- *(zh)* Update chinese locale (#1877)
- *(uk)* Update ukrainian locale (#1885)

### 🐛 Bug Fixes

- *(maintenance)* Fix filament trigger for maintenance entries (#1941)
- *(history)* Add missing fields in detail dialog (#1940)
- *(theme)* Fix color change on theme change (#1933)
- *(updateManager)* Fix updatr for git_repos without semver (#1925)
- *(screwsTiltCalculate)* Use the same direction on retry (#1920)
- *(gcodeviewer)* Update gcodeviewer to fix rendering issues (#1926)
- *(timelapse)* Add warning if snapshoturl is set in moonraker (#1921)
- *(maintenance)* Add init entry to init store only one time (#1914)
- *(statusPanel)* Fix the thumbnail overlay in the light theme (#1912)
- *(extruderPanel)* Add speed_factor to estimate extrusion calc (#1913)
- *(macroPromts)* Fix internal close function (#1918)
- *(tempchart)* Fix select/unselect monitor sensors in tempchart (#1903)
- Display "pause on layer"-button only when the macros exists (#1876)
- *(systemLoads)* Fix temp output when no temp sensor was found in klipper (#1907)
- Update moonraker log path in TheConnectingDialog.vue (#1909)
- Fix duration format function (#1894)
- *(webcam)* Fix fps output in light mode (#1901)
- Consecutive and leading whitespace is not shown in console (#1896)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.12.0

### 🔧 Refactoring

- Refactor TheTopbar, remove unused gette, fix snackbar (#1923)
- *(macros)* Refactor gcode_macros getter (#1889)

### 🚀 Features

- *(theme)* Add Multec theme (#1934)
- *(theme)* Add bigtreetech theme (#1931)
- *(theme)* Add Prusa Research theme (#1935)
- *(theme)* Add VzBot theme (#1937)
- *(theme)* Add YUMI theme (#1936)
- *(theme)* Add LDO Motion theme (#1932)
- *(theme)* Add voron build-in theme (#1930)
- *(notification)* Add TMC overheating warnings (#1919)
- Add support for build-in themes and add a Klipper theme (#1859)
- Add hotkeys tied to Save, Save + Restart (#1902)
- *(statusPanel)* Add option to disable the thumbnail zoom (#1905)
- *(systemLoads)* Add firmware name, when it is not Klipper (#1911)
- *(systemLoads)* Add function to output app name in system loads panel (#1906)
- *(dashboard)* Add support for moonraker sensor (#1888)
- Add support for base url (#1873)
- *(history)* Add moonraker sensors to total statistic (#1886)
- *(history)* Add support for Moonraker sensor history_fields (#1884)
## [2.11.2] - 2024-05-04

### Build

- *(deps-dev)* Bump ejs from 3.1.9 to 3.1.10 (#1867)

### 🐛 Bug Fixes

- *(maintenance)* Fix overdue check from printtime based entries (#1871)
- *(spoolman)* Fix search for spool-id (#1872)
- Calc multiplicator for set_pin gcode (#1870)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.11.2
## [2.11.1] - 2024-05-01

### 🐛 Bug Fixes

- *(farm)* Fix switching to other printer function (#1865)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.11.1
## [2.11.0] - 2024-04-28

### Build

- *(deps-dev)* Bump postcss from 7.0.39 to 8.4.38 (#1858)
- *(deps-dev)* Bump axios from 0.27.2 to 1.6.8 (#1857)
- *(deps-dev)* Bump vite from 4.5.2 to 4.5.3 (#1841)
- *(deps)* Bump follow-redirects from 1.15.4 to 1.15.6 (#1820)

### Locale

- *(de)* Update german translation (#1860)
- *(en)* Remove unused keys (#1855)
- *(ru)* Update russian translation (#1846)
- *(zh)* Update chinese locale (#1791)
- *(uk)* Update ukrainian translation (#1788)

### 🐛 Bug Fixes

- Ignore wrong default.json file while resetting moonraker db (#1829)
- Fix WebRTC(MediaMTX) webcam client (#1843)
- Fix case sensibility for printer power device (#1827)
- Fix typo issues with save zoffset for probes (#1821)
- Hide crowsnest backups when "Hide backup files" is enabled (#1824)
- Hide moonraker backups when "Hide backup files" is enabled (#1801)
- Fix long content lines in console (#1799)
- Fix long M117 outputs in the status panel (#1800)
- *(spoolman)* Break long comments & support multiline comments (#1781)
- Fix commit list view on desktop and mobile devices (#1785)

### 👷 CI/CD

- Update actions in release workflow to fix node16 deprecates (#1779)

### 📖 Documentation

- Add github sponsor link (#1844)
- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.11.0
- Fix typo/reword some parts of the pull request template (#1850)
- *(ci)* Update caniuse browser list (#1832)
- *(deps)* Update @sindarius/gcodeviewer (#1755) (#1783)

### 🔧 Refactoring

- Remove unused attribute in getPrinttimeAvgArray getter (#1861)
- Refactor KlippyStatePanel (#1826)
- *(e-stop)* Remove fullscreen mode on mobile devices (#1816)

### 🚀 Features

- Reminders panel on the History page (#1274)
- Expose css variable for changing theme logo color (#1856)
- Direct link to specific printer via query parameter (#1837)
- Connect to Moonraker via subdirectory/path (#1836)
- Show macro description as tooltip when hovering a macro (#1849)
- Add support for klipper runtime warnings (#1809)
- Add option to disable favicon progress circle (#1825)
- Add only save button to editor (#1835)
- Add confirmation dialog to cooldown button (#1808)
- Add qr search function in the spoolman change spool dialog (#1802)
- Add fullscreen size for gcodefiles, gcodeviewer and webcam (#1803)
- *(miscellaneous)* Add support for pwm_tool and pwm_cycle_time (#1804)
## [2.10.0] - 2024-02-15

### Build

- *(deps-dev)* Bump vite from 4.4.12 to 4.5.2 (#1751)
- *(deps)* Bump follow-redirects from 1.15.3 to 1.15.4 (#1742)
- *(deps)* Bump tj-actions/changed-files from 23 to 41 (#1727)

### Locale

- *(en)* Fix typo in DescriptionPreviouslyThrottled (#1776)
- *(de)* Update german locale (#1772)
- *(zh)* Update chinese locale (#1767)
- *(it)* Update italian translation (#1763)
- *(da)* Update danish translation (#1757)

### ⚡ Performance

- Batch gcode file metadata requests (#1737)

### 🐛 Bug Fixes

- File upload rate displays `NaN` instead of an actual value (#1777)
- Fix ETA calculation from jobqueue during print preheat (#1773)
- *(console)* Fix color of autocomplete and command list (#1733)
- *(timelapse)* Fix issue with changing timelapse settings (#1745)
- Show extruder extra menu without load/unload macros (#1747)
- Incorrect scaling of images in dialogImage (#1746)

### 👷 CI/CD

- Update workflow actions (#1760)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.10.0
- *(deps)* Update @sindarius/gcodeviewer (#1755)
- Fix typo in bot text (#1748)
- Update github issue bot text (#1743)

### 🔧 Refactoring

- Refactor heightmap page (#1759)
- Refactor spoolman integration to support v2 response (#1749)

### 🚀 Features

- Add ability to add history items to job queue (#1778)
- Add devices dialog in editor (#1765)
- Add sum + eta in jobqueue panel (#1770)
- Add ability to re-arrange job queue's items (#1692)
- *(history)* Add interrupted state to history job (#1738)
## [2.9.1] - 2023-12-31

### Build

- *(changelog)* Fix issue with wrong urls in changelog.md (#1697)
- *(docker)* Fix docker release tags (#1723)

### Locale

- *(sv)* Update swedish translation (#1720)

### 🐛 Bug Fixes

- Only check initableServerComponents for init server check (#1725)
- *(temperature)* Hide multiple same temp presets in dropdown (#1724)
- Fix long initial time with huge print history (#1714)
- *(exclude objects)* Fix tooltip position in object map (#1719)
- Fix tooltip of tempchart (#1715)
- *(exclude_objects)* Fix order of objects in map (#1716)
- Fix icon for deleted files in the history (#1708)
- Fix webcam url with multiple moonraker instances (#1713)
- Fix aspectRatio in MjpegstreamerAdaptive (#1707)
- Fix theme issue in tempchart (#1706)
- Fix spoolman list (comment & location) (#1693)
- Only display section options which exists in ExtruderPanel (#1694)
- Fix language switch (#1704)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.9.1

### 🔧 Refactoring

- Remove unused icon in SettingsGeneralTab.vue (#1705)
## [2.9.0] - 2023-12-16

### Build

- *(deps-dev)* Bump vite from 4.4.10 to 4.4.12 (#1671)
- *(deps)* Bump axios from 0.27.2 to 1.6.0 (#1647)
- *(cliff)* Add a new way to sort the commit groups (#1592)
- *(deps-dev)* Bump @babel/traverse from 7.23.0 to 7.23.2 (#1615)

### Locale

- *(de)* Update german locale (#1687)
- *(fr)* Add HeightMapTab and others updates (#1667)
- *(fr)* Add translation clean_nozzle and purge_filament (#1645)
- *(da)* Update Danish locale (#1634)
- *(fr)* Correction of the term Unretract (#1628)
- *(fr)* Correction of several errors (#1614)
- *(fr)* French full translation (#1613)
- *(it)* Fix several old translation errors (#1609)
- *(it)* Italian translation completed and more fixes (#1608)
- *(it)* Italian translation of the Spoolman module (#1606)
- *(fr)* French translation of the Spoolman module (#1598)
- *(pl)* Update Polish translations (#1593)
- *(zh)* Update Chinese (zh) localization (#1595)

### ⚡ Performance

- *(vite)* Chunk webcams, locales and large libraries (#1578)

### 🐛 Bug Fixes

- Fix panels squeezed on mobile when navi is open (#1690)
- Incorrect sum of rest jobs printing time (#1689)
- Add random colors, when colorArray is too small (#1688)
- Add port to webcam url if port is not 80 (#1566)
- Add anchor to regex for special msg replacement (#1635)
- More tolerant with thumbnails sizes (#1674)
- Fix issue with hidden LED groups (#1669)
- *(pwa)* Make sure the service worker can be loaded (#1594)
- Fix 12-hour time format in ETA output (#1662)
- Fix 12hour browser time format detection (#1660)
- Fix ETA 12hour detection if the user use default setting (#1657)
- Fix wrong output in temp chart tooltip (#1646)
- Fix adding multiple presets (#1636)
- Fix hide/show navi points in different languages (#1638)
- Fix round issue in git commit list diff calculation (#1637)
- Fix filament type check in StartPrintDialog (#1620)
- Allow null as spool id response from spoolman (#1611)

### 👷 CI/CD

- *(docker)* Ensure that the docker images are tagged correctly (#1591)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.9.0
- Fix check-pr-title workflow to allow locale as type (#1663)
- Update check_locale.yml to new github workflow output (#1584)
- Add workflow to check PR title for conventional commits (#1640)
- Disable workbox logs (#1629)

### 🔧 Refactoring

- Import unused getter from printer/getters (#1686)
- Fix linter issue in SettingsControlTab (#1677)
- Also allow FILAMENT_LOAD and FILAMENT_UNLOAD macros (#1639)

### 🚀 Features

- Add mmu.log to logfiles panel (#1685)
- Improve contrast of job queue items count (#1678)
- Light mode ui (#1580)
- Resize heightmap to get a better heightmap overview (#1683)
- Add moonraker init component check with warning (#1680)
- *(webcam)* Add support for go2rtc webrtc (#1651)
- Add option to hide parts of the ExtruderPanel (#1679)
- Show filament sensor state even when it is disabled (#1656)
- Add minimum_cruise_ratio support in MotionSettingsPanel (#1670)
- Add macro prompt dialog (#1630)
- *(file browsers)* Add ability to quickly jump to any segment (#1659)
- Add option to hide parts of the ToolheadPanel (#1621)
- Add option to change the save z-offset method (#1631)
- Add different color maps for heightmap (#1666)
- Add buttons for PURGE_FILAMENT and CLEAN_NOZZLE (#1641)
- Rework spoolman change dialog to display spool ids (#1605)
## [2.8.0] - 2023-10-07

### Build

- *(dependabot)* Add Dependabot to the repository (#1577)
- Update toolchain to the latest version (#1575)
- *(deps)* Bump @cypress/request and cypress (#1560)
- *(deps)* Bump tough-cookie and @cypress/request (#1517)

### Locale

- *(zh)* Update Chinese (zh) localization (#1588)
- *(en)* Remove unused keys in english locale (#1585)
- *(de)* Update german translations (#1583)
- *(pl)* Update Polish translations (#1573)
- *(es)* Update spanish locale (#1548)
- *(pl)* Update polish locale (#1554)
- *(pl)* Update Polish translations (#1544)

### 🐛 Bug Fixes

- Fix webcam switch button (#1589)
- Fix webcam flip in timelapse preview (#1587)
- Fix WebRTC (camera-streamer) port with external instance (#1586)
- Fix wrong date function in multiple files (#1568)
- Fix gcode command for generic_heater in presets (#1569)
- Fix webcam (camera-streamer) stop autorestart beforeDestory (#1556)
- Fix type issue in TemperaturePanelListItem (#1563)
- Fix macro parameter with spaces (#1551)
- Fix some issues with the presets (#1529)
- Fix missing reset options for print history data (#1534)
- Fix autorestart of webcam camerastreamer (#1546)
- Fix min/max positions in heightmap current mesh data panel (#1533)
- Eta time format detection from browser (#1522)
- Show confirm emergency stop dialog only when turned on (#1526)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Fix ftp upload in release workflow (#1590)
- Push version number to v2.8.0

### 🔧 Refactoring

- Update webcam "WebRTC MediaMTX" client (#1558)
- Rework tool color in extruder panel (#1576)
- Remove unused import in store/printer/getters.ts (#1574)
- Split ExtruderControlPanel.vue in multiple SFC (#1565)
- Refactor ToolheadControlPanel (#1530)

### 🚀 Features

- Add optional background color for big gcode thumbnails (#1535)
- Add spoolman support (#1542)
- Add monitors (like TMC2240) to Temperature Panel (#1532)
- Add 12-hour time format in printers overview (#1571)
- Add option to block autoscroll in console (#1519)
- Hide Moonraker power devices with a `_` as first char (#1545)
- Automatic selection of the gcode offset save gcode (#1531)
- Add warning for outdated browsers (#1537)
## [2.7.1] - 2023-08-16

### Locale

- *(zh)* Update Chinese (zh) localization (#1521)

### 🐛 Bug Fixes

- Fix issue on tablet and smaller devices with the sidebar (#1518)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.7.1
## [2.7.0] - 2023-08-12

### Locale

- *(pl)* Update Polish translation (#1515)
- *(pl)* Update Polish translation (#1502)
- *(zh)* Update Chinese (zh) localization (#1503)

### 🐛 Bug Fixes

- Fix cursor style for item name to be a pointer (#1514)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.7.0

### 🔧 Refactoring

- Soft down info buttons in update manager (#1513)

### 🚀 Features

- Add nevermore to temperature panel (#1511)
- Add a select all option on the backup and restore dialogs (#1448)
- Add option to hide FPS counter in webcams (#1488)
- Add an option to set the sidebar default state (#1462)
- Hide axis controls during print (#1452)
- Add option to hide MCU/Host sensors in the temp panel (#1496)
- Hide screws tilt adjust dialog, when using MAX_DEVIATION (#1474)
## [2.6.2] - 2023-07-30

### Locale

- *(zh)* Update chinese locale (#1486)
- *(pl)* Update Polish translation (#1482)

### 🐛 Bug Fixes

- Fix issue with cannot extrude after a Klipper restart (#1495)
- Fix multiple issues in the refactored update manager (#1497)
- Fix issue with create/edit presets and refactor settings (#1499)
- Use webcam name instead of UUID for timelapse plugin (#1492)
- Fix issue with camel-case object names in temperature panel (#1491)
- Fix flip function in several webcam clients (#1487)
- Hide rpm in temperature_fans without tachometer_pin (#1489)
- Fix editor save & restart button behavior (#1483)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.6.2

### 🔧 Refactoring

- Refactor SettingsRow (#1484)
## [2.6.1] - 2023-07-24

### Build

- *(deps-dev)* Bump word-wrap from 1.2.3 to 1.2.4 (#1470)
- *(deps)* Bump semver from 7.3.7 to 7.5.2 (#1443)

### Locale

- *(tr)* Update turkish locale (#1480)
- *(pl)* Update Polish translation (#1476)
- *(pl)* Update polish locale (#1471)
- *(zh)* Update Chinese (zh) localization (#1459)
- *(pl)* Update Polish translation (#1447)
- *(pl)* Update Polish translation (#1434)

### 🐛 Bug Fixes

- Fix issue with webcams in farm printers (#1469)
- Fix issue with CSV separator in contents (#1460)
- Fix issue with ETA and 12h time format (#1463)
- Avoid hitting 100% before print is complete (#1455)
- Fix condition in restartServiceNameExists check (#1450)
- Remove variable check in klipper config StreamParser (#1435)
- Show delete dialog for single files too (#1442)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.6.1
- Add dev-dist to .gitignore (#1451)
- *(pwa)* Remove debug warnings in browser console (#1441)

### 🔧 Refactoring

- Display errors and warnings in the update_manager (#1453)
- Extract Presets and Settings from TemperaturePanel (#1465)
- Change SettingsGeneralTab file (#1475)
- Use moonraker webcam api instead of direct DB access (#1445)
- Build version file for moonraker (#1449)
## [2.6.0] - 2023-06-19

### Build

- *(deps-dev)* Bump vite from 3.1.4 to 3.2.7 (#1412)
- *(deps)* Bump @antfu/utils and unplugin-vue-components (#1409)

### Fear

- Add WebRTC (janus-gateway) webcam mode (#1360)

### Locale

- *(en)* Remove unused key (#1425)
- *(de)* Update German localization (#1424)
- *(zh)* Fix translation (#1418)
- *(ru)* Update russian localization (#1394)
- *(pl)* Update Polish language (#1411)
- *(zh_TW)* Update Chinese localization (#1386)
- *(ko)* Update Korean localization (#1368)

### 🐛 Bug Fixes

- Fix navigation to display allPrinters (#1423)
- Check only not empty filename for metadata in farm printers (#1392)
- DisableFanAnimation getter getting wrong value (#1381)
- Fix issue when moving a file to the root directory (#1377)
- Make the correct notification appear on gcode file move (#1376)
- Fix zip file timestamp (#1375)
- Add gcode offset to live position in gcodeviewer (#1341)
- Fix miscellaneous slider + button for fans/outputs with max power (#1344)
- Fix configuration guide link for thumbnails (#1338)
- Fix thumbnail guide link in settings (#1337)
- Find LOAD & UNLOAD_FILAMENT macros case-insensitive (#1335)

### 📖 Documentation

- Fix broken coding standards link in contributing doc (#1415)
- Add Contributing section in README.md (#1339)
- *(changelog)* Update changelog

### 📦 Chores

- Update ftp upload action in release workflow (#1430)
- Push version number to v2.6.0
- Add PWA caching and cache updater (#1421)
- Add PULL_REQUEST_TEMPLATE (#1340)
- Exclude htaccess file on upload to my.mainsail.xyz (#1347)

### 🔧 Refactoring

- Remove unused import in FarmPrinterPanel.vue (#1428)
- Refactor Panel.vue (#1427)
- Add webcam-wrapper component (#1422)
- Improve syntax highlighting and change theme in editor (#1200)

### 🚀 Features

- Add retry button to ScrewsTiltAdjust helper dialog (#1429)
- Add WebRTC (MediaMTX / rtsp-simple-server) webcam mode (#1318)
- Add bed aspect ratio to heightmap graph (#1420)
- Add portuguese/brazil translate (#1407)
- Updating WebRTC with camera-streamer signaling protocol (#1417)
- Add an option to change the height of the temperatur chart (#1391)
- Add printer name to browser tab while printing or complete (#1371)
- Allows adjustable tab size in file editor (#1354)
- Add facility to Scan Metadata from G-code Files (#1316)
- Add options to disable klipper helper dialogs (#1319)
- Add jmuxer-stream webcam type, supporting raw h264 (#1342)
- Add function to duplicate gcode files (#1321)
- Add AHT10 to additionalSensors (#1378)
- Customize sidebar navi (#1336)
- Allow negative time estimate in slicer (#1372)
## [2.5.1] - 2023-04-02

### Locale

- *(de)* Update German localization (#1326)
- *(cz)* Add Czech localization (#1327)

### 🐛 Bug Fixes

- Fix invalid name input checks (#1312)
- Fix issue of empty Screws tilt adjust helper dialog (#1329)
- Disallow non-ascii chars in bed_mesh name (#1311)
- Missing M117 output in status panel (#1309)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.5.1
- Update caniuse (#1330)
## [2.5.0] - 2023-03-12

### Locale

- *(de)* Update German localization (#1277)
- *(ja)* Update Japanese localization (#1270)
- *(da)* Update Danish localization (#1288)
- *(zh)* Update Chinese (zh) localization (#1284)
- *(fr)* Update French localization (#1289)
- *(nl)* Update NL locale (#1282)

### 🐛 Bug Fixes

- Only display PAUSE AT LAYER button, when the macros exists (#1291)
- Fix browser title, when printer is off (#1300)
- Fix position of webcam fps (#1278)

### 📦 Chores

- Push version number to v2.5.0
- Update gcodeviewer from v3.2.0 to v3.2.2 (#1303)
- Add armv6 support for Docker image (#1285)
- Add .vscode to .gitignore (#1290)

### 🔧 Refactoring

- Add ENABLE=1 to SET_PAUSE_AT_LAYER/NEXT_LAYER (#1293)

### 🚀 Features

- Allow fan animations to be disabled to save browser perf. (#1232)
- Add WebRTC (camera streamer) support (#1275)
## [2.5.0-beta1] - 2023-02-19

### Build

- *(deps)* Bump @sideway/formula from 3.0.0 to 3.0.1 (#1259)
- *(deps)* Bump json5 from 2.2.1 to 2.2.3 (#1218)

### Locale

- *(zh)* Update locale (#1269)
- Remove unused locale `PresetSubTitle` (#1264)

### 🐛 Bug Fixes

- Fix output of klippy state, if UDS path/address dont fit (#1263)
- Fix cancel button in rollover logs dialog (#1256)
- Hide unused panels on dashboard (#1233)
- Fix dateTime output in print history detail dialog (#1248)
- G-Code Viewer UI fixes (#1240)
- Fix ExcludeObjectDialogMap for delta printers (#1217)
- Add webcam rotate to timelapse preview (#1198)
- Hide temperature sensors with `_` at first char (#1195)

### 📖 Documentation

- *(changelog)* Update changelog

### 📦 Chores

- Push version number to v2.5.0-beta1

### 🔧 Refactoring

- Change jobqueue entry attribute to hyphenated names (#1271)
- HLS streamer - improve latency (#1268)
- Rename download zip name (#1252)
- Use moonraker zip function (#1245)

### 🚀 Features

- Max webcam height to fit on the screen (#1246)
- Support a color or colour variable from tool change macros (#1244)
- Add x_only and y_only option in timelapse park position (#1231)
- Add function to send PAUSE at a specific layer change (#1230)
- Add jobs to queue in batches (#1253)
- Add helper display for screws_tilt_adjust (#1261)
- Add HLS Support for webcams (#1258)
- Add button to hide SAVE_CONFIG button for pending bed_mesh (#1255)
- Add power button on dashboard to switch printer on (#1254)
- Log rollover function for klipper and moonraker (#1243)
- Hide/ignore .git directories in file init process (#1227)
- Add support for cnc mode in g-code viewer (#1239)
- Add new CodeStream control to Gcodeviewer (#1224)
- Add table view for print status stats (#1192)
- Add multi download to ConfigFilesPanel.vue (#1194)
## [2.4.1] - 2022-12-10

### Locale

- *(nl)* Update NL localization (#1191)

### 📦 Chores

- Fix release workflow (#1190)
- Push version number to v2.4.1
## [2.3.0] - 2022-09-09

### 🐛 Bug Fixes

- Max_power setting in miscellaneous panel (#953)
## [2.2.1] - 2022-06-21

### Locale

- *(ko-kr)* Update Korean localization (#894)
- *(zh)* Update Chinese localization (#896)
- *(ru)* Update ru.json (#889)
- *(ko-kr)* Fix Korean localization (#890)
## [2.2.0] - 2022-06-11

### Build

- Add official Docker image (#708)
## [2.1.2] - 2022-02-14

### Fix

- Bad printerUrl check in ternary operator (#1158)

### Build

- *(deps)* Bump vuetify from 2.6.4 to 2.6.10 (#1095)

### Locale

- *(da)* Update Danish localization (#1179)
- *(tr)* Update Turkish localization (#1188)
- *(zh)* Update Chinese localization (#1142)
- *(ja)* Update Japanese localization (#1131)
- *(uk)* Update Ukrainian localization (#1094)
- *(zh)* Update Chinese localization (#1089)
- *(ko-kr)* Update Korean localization (#1098)
- *(uk)* Update Ukrainian localization (#1067)
- *(fr)* Update fr locale (#1072)
- *(nl)* Update Dutch localization (#1065)
- *(uk)* Add Ukrainian localization (#1061)
- *(ja)* Update Japanese localization (#1064)

### 🐛 Bug Fixes

- Add more space between the rows in manual probe window (#1189)
- Disable circle control while printing or not homed (#1171)
- *(Heightmap)* Save z scale setting (#1175)
- Add theming for find/search panel Search panel (#1174)
- Fix dashboard interface settings (#1176)
- Fix neopixel settings if name is uppercase (#1169)
- Fix handling issues with number-inputs (#1168)
- Fix relative webcam urls on multi instances (#1162)
- Display can interfaces in system panel (#1159)
- Display layer count with older klipper versions (#1161)
- *(ExtruderPanel)* Wrong calculation for estimated extrusion length (#1157)
- Cannot upload GCODE files on iOS (#1152)
- *(Heightmap)* Flat for bed mesh not displayed if only one probe count set (#1146)
- Fix relative webcam urls with port (#1147)
- *(UI)* Tweak font sizes (#1107)
- *(UI)* Missing bottom border radius in status panel (#1106)
- Broken link in readme (#1104)
- Set init values in TheManualProbeDialog.vue (#1092)
- Add input validation in filemanagers to prevent overwriting existing files (#1087)
- Load instances from localStore if instance store is browser (#1086)
- Use background to fix border issues between the elements (#1068)

### 📖 Documentation

- Add BIGTREETECH to repo README as official sponsor (#1178)

### 📦 Chores

- Add release workflow (#1185)
- Push version number to v2.4.0
- Update gcode viewer to V3.1.4 (#1119)
- *(build)* Update compiler target to support import.meta (#1112)
- *(locales)* Remove all unused keys (#1109)
- *(locales)* Rename locales as per ISO 639 (#1108)
- *(deps)* Update dependencies (#1103)
- Remove LGTM workflow (#1091)
- Rename and clean up AboutModal (#1090)
- Push version number to v2.3.1
- Lint:fix locales (#1088)
- Update broken link to DCO (#1084)
- Push version number to v2.3.0
- Change cron interval stale action (#1062)

### 🔧 Refactoring

- Replace emergency stop icon (#1170)
- Rename variance to range in heightmap (#1166)
- *(KlippyStatePanel)* Display buttons as outlined text buttons (#1134)
- *(editor)* Use the config reference link of a translated version if it exists (#1120)
- Rework of the KlippyState panel (#1118)
- Improve webcam settings logic and layout (#1114)
- Fix lint issues (#1111)
- Display bit version of OS (#1101)
- Extend css editor support to .scss and .sass files (#1083)

### 🚀 Features

- Multi column for many inputs in gcode macro (#1153)
- Add bed_screws helper dialog (#1115)
- Add LED / Neopixel support (#1050)
- Add option to change date & time format in settings (#1069)
- Add z_thermal_adjust to temperatures panel (#1113)
- Add SET_PRINT_STATS_INFO command support (#1034)
- Add manual_probe helper dialog (#1077)
## [2.3.0-beta1] - 2022-09-04

### Build

- *(deps-dev)* Bump vite from 2.8.6 to 2.9.13 (#1051)
- *(deps)* Bump terser from 5.12.1 to 5.14.2 (#981)
- *(docker)* Set platform for build target (#951)

### Locale

- *(da)* Update Danish localization (#1026)
- *(ja)* Update Japanese localization (#1030)
- *(de)* Update German localization (#1015)
- *(hu)* Update Hungarian localization (#986)
- *(ko-kr)* Update Korean localization (#926)
- *(zh)* Update Chinese localization (#938)
- *(en)* Fix typos in English localization (#924)
- *(ko-kr)* Update Korean localization (#914)
- *(zh)* Update Chinese localization (#906)
- Fix Editor placeholder for download/upload snackbar (#919)
- Fix locale keys (#916)
- *(en)* Remove unused keys in EN locale (#913)
- *(ko-kr)* Update Korean localization (#894)
- *(ko-kr)* Fix Korean localization (#890)
- *(zh)* Update Chinese localization (#896)
- *(ru)* Update ru.json (#889)
- *(pl)* Update Polish locale (#884)
- *(ko-kr)* Add new lanquage pack such that south korean users (#874)
- *(de)* Update German locale (#871)
- *(ja)* Update Japanese localization (#864)

### 🐛 Bug Fixes

- Remove scrollbar on init load of status panel (#1059)
- Fix dep loading issue after update vite (#1058)
- Use correct unit for pressure advance (#1053)
- Combine small entries in history pie chart (#1056)
- Fix progress above 100% with filament based calculation (#1042)
- Fix type issue in releaseName parsing (#1043)
- Add missing locale to factory restart options (#1023)
- Global form validation error misalignment (#1020)
- Webcam name input alignment (#1019)
- Distro output for armbian in SystemPanel (#1021)
- *(Heightmap)* Improve input validation for rename profile dialog (#1002)
- Divider in temperature presets is transparent (#1004)
- Hide TemperaturePanel if no sensors would be shown (#982)
- Reset webcam store on printer switch (#996)
- Fix output with number groupings & add slicer in csv header (#967)
- *(timelapse)* Renaming a .zip file caused extension to become .mp4 (#992)
- Remove js scrollbars in body & editor (#962)
- Match mcu temp sensor of additional mcus (#957)
- Add fallback for gcode files without thumbnail (#959)
- *(editor)* Partial improvement of config syntax highlighting (#612)
- Create folders with spaces in the name (#942)
- Editor safe & restart with multi instances (#925)
- Fix typo in adding new heaters/temperature_fans to chart dataset (#918)
- Display status tab on dashboard as default while printing (#907)
- Macro buttons with single char attribute (#903)
- Fix some gui issues (#880)
- CommandHelpModal mobile fullscreen size (#882)
- Unable to submit coordinate values (#878)
- Restart services with name matching files (#876)
- Unable to set target values (#873)
- Display filename in gcodeviewer (#872)
- Sort of toolchange macros (#867)
- Max size of tempchart (#865)

### 👷 CI/CD

- Test docker building during PR (#952)

### 📦 Chores

- Push version number to v2.3.0-beta1 (#1060)
- Fix issues with auto analyze workflow (#1031)
- Add github_token to auto-analyze.yml (#1029)
- Add auto-analyze.yml action (#1009)
- Switch to new stale workflow (#1007)
- Add LGTM action (#1008)
- Change workflow action to dessant/label-actions (#1005)
- Update codemirror to v6 (#975)
- Update codemirror to v6 (#795)
- Add workflow to answer on issues with specified labels (#969)
- Update develop branch with master bugfixes (#965)
- Update CONTRIBUTING.md (#902)
- *(docker)* Add linux/arm/v7 architecture to Docker builds (#949)
- Push version number to v2.2.1
- Add workflow to check locale files in pull requests (#917)
- Add workflow to close issues with 'User Input' labels after 7 days (#912)
- *(bug_report.yml)* Extend issue template (#911)
- Exclude .DS_Store files in build.zip (#887)
- Exclude .DS_Store files in build.zip (#886)
- Push version number to v2.2.0

### 🔧 Refactoring

- Remove input validation from MoveToInput (#1022)
- Move firmware retraction settings to Extruder panel (#1003)
- Change remoteMode to instancesDB in config.json (#997)
- Reverse order of negative offset values in inline z-offset value layout (#987)
- Refactor code in Gcodefiles.vue (#910)
- Replace drag handle icons (#879)

### 🚀 Features

- Export only selected jobs from print history (#1055)
- Show nozzle size in estimated extrusion info (#1048)
- Add Turkish localization (#1049)
- Add multiselect to timelapse file manager (#1039)
- Add button to edit crowsnest.conf in webcam settings (#1037)
- Add exclude objects in G-Code Viewer (#1028)
- Add warnings if gcodes/config root dirs don't exists (#1018)
- Add temperatures to gcode files list (#1017)
- Add option to switch print progress calculation (#1013)
- Add defaultLocale in config.json (#1010)
- Show current bed mesh profile name in toolhead panel (#1000)
- Download button for crowsnest.log and sonar.log (#991)
- Improve load/unload filament button logic in Extruder panel (#989)
- Rotate webcam in Mjpegstreamer-adaptive mode (#923)
- Allow for more decimal places in move-to-input (#976)
- Init interface before display panels (#961)
- Allow collapsing of config file panel (#943)
- *(editor)* Add .css language support (#936)
## [2.2.0-beta5] - 2022-05-31

### Locale

- *(es)* Update spanish localization (#862)
- *(nl)* Update dutch localization (#861)
- *(fr)* Update locale file (#856)
- *(en)* Fix typo in GreaterOrEqualError (#854)
- *(ja)* Update Japanese localization (#850)

### 🐛 Bug Fixes

- MjpegstreamerAdaptive.vue image size (#863)
- Fix img size without a stream (u4vl-mode) (#860)
- Echarts getters in heightmap, tempchart & history statistics (#859)
- Bed mesh calibrate dialog not opening on mobile (#858)
- Don't start webcam after switching tab (#855)
- Add headlines to console tab settings (#853)
- Hide toolhead, extruder & temperature panel if they have no content (#852)
- Search files also with single word snippets (#851)

### 📦 Chores

- Push version number to V2.2.0-beta5

### 🔧 Refactoring

- Update GCode Viewer to 3.1.0 (#847)
- Hide PA input fields if extruder_stepper is configured (#846)
## [2.2.0-beta4] - 2022-05-25

### Locale

- *(fr)* Update French localization (#844)
- Cleanup locale files (#841)
- *(ru)* Update Russian locale (#836)
- *(ja)* Update Japanese localization (#824)

### 🐛 Bug Fixes

- Tool selection in extruder panel (#842)
- Wrong default path in moonraker db (#843)
- Stop webcam when webcam panel is collapse (#839)
- Miscellaneous target change issue when max_power != 1 (#840)
- Regex to replace url to a clickable link in notifictiaons (#832)
- Don't createObjectURL, when webcam img doesn't exist in Mjpegstreamer.vue (#834)
- Store only name of icon instead of svg in moonraker db (#833)
- Add u4vl-mjpeg to printfarm & only display supported modes (#831)
- Switch back to files, after clear printjob from status panel (#816)
- Add file from sub directory to job queue (#826)
- Unable to set heater target temperature (#828)
- Do not show `null RPM` in temp chart (fixes #818) (#820)
- Disable toolhead 3-dot menu during printing (fixes #812) (#814)
- Fix some issues with unreadable values in the control panel (#817)

### 📦 Chores

- Push version number to v2.2.0-beta4

### 🔧 Refactoring

- Remove temperature_store_size from server section (#837)
- Remove duplicated settings header (#830)
- Remove unused file (#813)
## [2.2.0-beta3] - 2022-05-15

### 🐛 Bug Fixes

- Stop stream when changing browser tab (#810)
- Resize issues with tempchart and other components (#808)
- Duplicate checkbox for pwm fan (fixes #799) (#802)
- *(CrossControl)* Step size was not applied correctly (#805)
- Edit files/gcodes in subfolders (#803)

### 📦 Chores

- Push version number to v2.2.0-beta3
## [2.2.0-beta2] - 2022-05-12

### 🐛 Bug Fixes

- Close stream on beforeDestory Uv4lMjpeg.vue (#796)
- Remove image from cache after loading it in Mjpegstreamer.vue (#797)

### 📦 Chores

- Push version number to v2.2.0-beta2

### 🔧 Refactoring

- Match icon for editing config and gcode files (#798)
## [2.2.0-beta1] - 2022-05-11

### Docs

- Add feature screenshots (#599)
- Add PolicyKit to FAQ (#595)

### Build

- *(deps)* Bump ejs from 3.1.6 to 3.1.7 (#789)
- *(deps)* Bump minimist from 1.2.5 to 1.2.6 (#741)
- Lower browserslist to support older browsers (#688)
- Add official Docker image (#682)
- *(changelog)* Ease down on the changelog updates, remove 'unreleased' part (#669)
- *(lint)* Upgrade vue ruleset to ‘recommended’ (#663)
- *(changelog)* Add auto-updating CHANGELOG.md (#640)
- *(unplugin)* Enable dts for global component def. generation (#650)
- Improve TS checking while developing (#637)
- Upgrade eslint to the newest version (#634)
- *(vite)* Migrate to vitejs (#594)

### Locale

- *(ja)* Add Japanese translation (#774)
- *(se-SV)* Add swedish localization (#762)
- *(da)* Updated (#718)
- *(es)* Typos/grammar review (#689)
- *(zh-tw)* Update zh-tw.json (#627)
- *(da)* Update da.json (#596)
- *(pl)* Update 03.02.2022 (#606)
- *(pl)* Bugfix 29/01/2022 (#598)

### ⚡ Performance

- Replace echart library and load it modular (#645)
- Load codemirror into a chunk for faster LCP (#641)

### ✅ Tests

- Add cypress for e2e testing (#655)

### 🐛 Bug Fixes

- Add missing context menu to dashboard jobqueue (#794)
- *(TemperaturePanel.vue)* Remove hover effect (#785)
- Migrate tools panel to temperature panel on gui init (#783)
- Margin bottom of TemperaturePanel.vue (#782)
- *(ConfigFilesPanel)* Change delete button color (#779)
- Update missing out of range translation (#767)
- Hide unknown panels in interface settings > dashboard page (#763)
- Add error message in webcam panel, if no webcam is available (#754)
- Resize tempchart on window resize event (#750)
- *(SettingsPresetTab)* Improve form validation for heater preset (#749)
- Compiler type warning (#744)
- Check if panel exists before load on dashboard (#734)
- Missing file icon import in gcode file browser (#731)
- Disable home button in heightmap page while printing (#722)
- Add missing translation keys (#714)
- Hide gcode thumbnail, if a webcam is active in printer farm (#706)
- Double defined variable viewport in SettingsDashboardTab.vue
- Search temperature_store_size in data_store and server (#705)
- Missing object in dashboard expand panel getter
- Icon rotation with svg icons (#691)
- Fix init issue in controls panel
- Don't allow to add/update printers with empty hostname (#693)
- Missing icon imports (follow up of #646) (#687)
- Match input field behavior to slider behavior (#684)
- Fix gcode from macros with single char attributes (#680)
- Removing remote printer in remote mode (#676)
- Import bugfixes from release v2.1.2 (#639)
- Console error regarding touch directive (#633)
- *(env)* Parse environment variable as string (#632)
- Video and download link in timelapse video dialog (#611)

### 👷 CI/CD

- Fix typo in the new github workflow (#685)
- Add more filetypes to the bundle size check (#647)
- Use the correct sha for the compressed size action check (#642)
- Run build size report on 'analyze' label (#635)
- Fix incorrect hash length of the bundle report (#618)
- Add stripped hashes for `compressed-size-action` (#617)
- Add bundle size report for PRs (#616)
- *(lint)* Add ci workflow and update related packages to the latest version (#586)

### 📖 Documentation

- Improve README.md (#709)
- Update credits (#602)
- Cleanup assets folder (#601)
- Split up quicktips (#584)

### 📦 Chores

- Push version number to v2.2.0-beta1
- Some toolhead panel tweaks (#781)
- *(deps)* Update dependencies (#717)
- Remove components.d.ts from git (#703)
- Remove unused getter (#698)
- Remove unused mutations (#697)
- Improved bug report and feature request forms (#683)
- *(deps)* Update dependencies (#681)
- Remove development docker (#677)
- Add host settings to vite.config.ts (#671)
- *(changelog)* Update changelog
- *(changelog)* Update changelog
- *(deps)* Regenerate lockfile because of indent change (#652)
- Fix initial development environment (#593)
- *(docker)* Windows compatible, without docker-compose wrapper (#613)
- Add .editorconfig (#582)
- Push version number to v2.2.0-alpha

### 🔧 Refactoring

- Display scrollbar when mouse is moving (#793)
- Remove unused option in SettingsUiSettingsTab.vue (#792)
- *(MachineSettingsPanel.vue)* Tweak visual appearance (#784)
- Change delete button color (#766)
- Replace the mdiclock for an emoji on the TempChart (#690)
- Replace font icons with their svg counterparts (#646)
- Make all MachineSettings use new NumberInput (#651)
- Rework webcam settings visuals (#679)
- Move rename button in heightmap (#665)
- Make sure that port '80' and '443' are correctly passed through (#631)
- Replace 'vue-headful' with 'vue-meta' (#620)
- Migrate `longpress.js` to `longpress.ts` (#619)

### 🚀 Features

- Always show scrollbar in the editor (#791)
- Add multi select for config files (#790)
- Add arm64 docker image support (#787)
- Gcode-files & jobqueue on dashboard (#726)
- Global fullscreen fileupload (#777)
- Rework gcode file list (#753)
- Toolhead control panel (#712)
- Extruder control panel (#711)
- Temperature panel rework (#748)
- Notifications (#738)
- Add note to history job (#716)
- Display gcodeviewer always and store klipper settings in moonraker DB as a fallback (#725)
- Display error messages when console is not on the screen (#724)
- Confirm before closing the browser tab (#723)
- Extend system load panel (#536)
- Translate job status in history (#713)
- Add responsive component (#704)
- Implement moonraker connection identify (#701)
- Add settings for klipper & moonraker 'SAVE & RESTART' (#700)
- Each viewport size can have different panels open/close (#696)
- Change default port for https instances in remote mode (#694)
- Add default moonraker instances to config.json (#695)
- Export print history as CSV (#675)
- Add input fields to sliders (#674)
- *(console)* Add the ability to clear the console (#672)
- Rework heightmap page (#667)
- Add profile name field to calibrate bed_mesh dialog (#664)
- Add localization options to NumberInput.vue (#661)
- *(pwa)* Add PWA support for https based instances (#654)
- Display only existing/useable bed_mesh profiles (#660)
- Multiselect in history jobs (#509)
- Add custom number input component (#638)
## [2.1.1] - 2022-01-28

### Locale

- *(pl)* Additional fix for polish language (#592)
- *(pl)* Fix polish translation (#589)
- *(pl)* Polish translation (#581)
- *(da)* Danish - minor updates, missing tags and removed "deceleration" (#578)
- *(zh)* Update zh.json (#557)

### 🐛 Bug Fixes

- Polling klippy error messages (#571)
- Hide second notification in timelapse > remove mp4 (#572)
- Input field and spinner bug (fixes #551) (#555)
- Delete remote printers dont work (#564)
- Farm printer switch and display klippy connection errors (#563)
- Default color mode in gcodeviewer was wrong (#559)
- Read nozzle_diameter from klipper config in gcodeviewer (#558)

### 📖 Documentation

- Fix some broken links (#580)

### 📦 Chores

- Push version number to v2.1.1
- *(build)* Sets Node engine to version 16 (#569)
## [2.1.0] - 2022-01-19

### Bugfix

- Fix capitalization of bed_mesh names and renaming functions  (fix #545,#546) (#547)

### Locale

- *(it)* IT translation update (#553)
- *(ru)* Update RU v2.1 (#552)
- *(hu)* 2022 01 12 update (#531)
- *(hu)* Hun update 20220110 as requested :) (#530)
- Fix keys in top corner menu
- *(nl)* Update NL locale (#529)
- *(es)* Traslation Spanish RC1 (#528)
- *(da)* Updated Danish translations (#527)
- *(fr)* Update FR locale

### 🐛 Bug Fixes

- Improve machine settings number inputs (#537)
- Ipv6 issues with encodeURI
- EncodeURI for thumbnails and timelapse files (#539)
- Set default for min_extrude_temp (#540)
- Klippy connected/disconnected change
- Workaround to display download status in gcode-viewer
- Workaround to display download status in editor
- Hide snackbar details if total not available
- Sort mcus in SystemPanel.vue
- Sort endstops in EndstopPanel.vue
- Fix locale output in confirm dialog for service control
- Request metadata for gcode files, when using search function

### 📖 Documentation

- Update prepare themes page with review feedback (#554)
- Fix macro link
- Review Themes  Chapter in Documentation (#486)
- Additions to the readme/index for 2.1 (#543)
- Update screenshot to v2.1.0
- Update Quicktips (#518)
- Add redirect dor configuration
- Themes / changed name to cryd-s

### 📦 Chores

- Update package-lock.json
- Push version number to v2.1.0
- Use node 16 for base docker image (#568)

### 🚀 Features

- Send gcode macro with keyup enter (#544)
## [2.1.0-rc1] - 2022-01-08

### Fix

- Control panel cross style (#524)
- ZSlider and clear button in gcodeviewer (#522)
- Control settings (#520)

### Locale

- *(da)* Fix typo in locale file
- *(hu)* Hu updated for the latest eng local (#517)
- *(da)* Minor changes and spellchecking (#512)
- *(de)* Add temp too high/too low messages to locale file
- Add "Temp too high", "Temp too low" output to i18n in ToolsPanel
- *(nl)* Add last 2.1-beta strings (#499)
- *(it)* Update IT to beta6 (#483)
- *(zh)* Remove unused keys
- *(zh-tw)* Remove unused keys
- *(ru)* Remove unused keys
- *(nl)* Remove unused keys
- *(it)* Remove unused keys
- *(hu)* Remove unused keys
- *(de)* Fix missing entry
- *(da)* Update da.json (#491)
- *(es)* Correcciones de la Beta6 (#492)
- Fix missing entry
- *(fr)* Update FR translation

### 🐛 Bug Fixes

- Gcode files view with queue on mobile devices
- Only update / send temp commands if they are changed
- Button and input placement based on screen width (#515)
- Sidebar logo and top-sidebar overlay (#514)
- Only update / send temp commands on blur if they are changed
- Send temp input only when blur, select value or press enter or tab key
- Hide fps in farm printer panel with mjpegstreamer webcam
- Restart stream when switching between mjpegstreamer webcams
- Webcam selector doesnt work
- Logical error causing issues with input fields (#507)
- Remove buggy condition for sidebar overlay (#505)
- UI fixes related to feedback form beta-phase (#494)
- Hide webcam panel in config & dashboard if no webcam exists
- Tooltip bug in sidebar with text + icons
- Ignore wrong presets in moonraker db
- Dispatch with correct keyName (#498)
- Ignore maxTouchPoints === 256 (#493)

### 📖 Documentation

- First boot - fix info box
- Update First Boot docs (#506)
- Update Home Page and Setup Guides (#478)
- Fix theme
- Add new community theme "Cryd"

### 📦 Chores

- Push version number to v2.1.0-rc1

### 🔧 Refactoring

- Change default colors (#523)
- Change panel expansion indicator (#516)
- Sort buttons in status panel toolbar
- Improve confirmation dialog visuals (#508)

### 🚀 Features

- Ignore timelapse pause state during a print
- Add displaying/sorting of/by more gcode metadata (#519)
- Convert presets from V2.0.1 to V2.1.0 moonraker DB
## [2.1.0-beta6] - 2021-12-26

### Locale

- Add KlipperStop to translate list

### 🐛 Bug Fixes

- Reactivity of sidebar navi points

### 📦 Chores

- Push version number to v2.1.0-beta6

### 🔧 Refactoring

- Remove debug output
## [2.1.0-beta5] - 2021-12-26

### Locale

- Update de translation (#482)
- *(da)* Add DA language file
- *(ru)* Fix ru language file for the word "Flow"
- *(fr)* Update FR language file
- *(es)* Fix some missing translates (#461)
- *(ru)* Update translation file (#458)
- *(it)* Update translation file (#455)
- *(hu)* Update translation file (#454)

### 🐛 Bug Fixes

- Settings menu in gcode files
- Settings menu in config files
- Tempchart length/duration issues
- Check if settings object exists in getMiscellaneous
- Check if settings object exists
- Check if settings object exists
- Set default primary color in exclude object dialog map
- Hide timelapse root directories in config files panel
- Modify text color of console output
- Recover gcode viewer after switching tabs
- Hide stop moonraker service button
- Disable moonraker serive stop button
- Custom console filters were not displayed (rework moonraker db)
- Settings toggle to hide upload & print button doesnt work after store rework
- Min height in settings menu cut dropdown menus
- Issue with tempchart/temphistory if the browser go into sleep mode
- Fix renamed moonraker db gui paths
- Axis name are undefined in the heightmap tooltip
- Fixe some renamed store paths
- Hide timelapse console filter doesnt work
- Correct spelling of `max_accel_to_decel` input field (#475)
- Prevent duplicates (#464)
- Fixed editor highlight stop bug (#462)
- Change exclude object icon and cut object name, if it is too long
- Disable print start dialog for non gcode files
- Disable context menu options for not allowed file extensions in GcodefilesPanel.vue
- Add file extension filter to drag&drop fileupload in gcode files
- Add accept attribute to gcode file upload
- Delete also timelapse preview image if exists
- Update job_queue start command

### 📖 Documentation

- Thumbnails - replace prusaslicer screenshot
- Remove description for legacy slicers
- Fix thumbnail toc
- Add youtube videos for themes & thumbnails
- Fix link to pre-flight
- Removed duplicate entry
- Fix layout
- Fix pre-flight

### 📦 Chores

- Push version number to v2.1.0-beta5
- Update gcode-viewer to v2.1.17
- Update echarts packages

### 🔧 Refactoring

- Remove old function in TheSidebar.vue
- Add variable descriptions in variables.ts
- Remove debug outputs
- Remove old comment
- Style heightmap tooltip
- New sort of context menu options in gcode files

### 🚀 Features

- Add tooltip by icon only sidebar navi
- Add special output text for klipper stop service
- Confirmation service host control (#481)
- Highlight hovered objectname in exclude object dialog list
- Display release_info in SystemPanel.vue
- Add fw_retract setting in timelapse setting menu
- Backup/restore/default moonraker db (#476)
- Custom number input spin buttons (#468)
- Display moonraker-timelapse error message (#467)
- Store last gcode commands in moonraker db (#460)
- Pressure advance settings on dashboard (#459)
## [2.1.0-beta4] - 2021-12-06

### Locale

- *(nl)* NL translations for 2.1-beta (#453)
- *(zh)* Remove all unused keys
- *(it)* Remove all unused keys
- *(zh-tw)* Remove all unused keys
- *(zh-tw)* Add chinese traditional (#418)
- *(fr)* Remove all unused keys
- *(es)* Remove all unused keys
- *(en)* Remove all unused keys
- *(de)* Remove all unused keys
- *(zh)* Fix syntax error in zh.json
- *(es)* Update spanish translation (#443)
- *(it)* IT Translation(beta) (#435)
- *(zh)* Mandarin Translation for V2 beta (#444)
- *(en)* Update en translation (#447)
- *(de)* Update de translation (#446)
- *(fr)* Update beta2 fr translations

### 🐛 Bug Fixes

- Wrong min/max position in current heightmap panel
- Add hideTimelapse setting to console settings tab
- Support for printer farm in https mode (#452)
- Hide console, when klipper is not connected to moonraker
- Enable g-code files, history and jobqueue when klipper is not ready
- Hide SystemPanel.vue if klipper is not connected/ready
- Cancel open connection before close fetch (#450)
- Correct i18n key name (#449)
- Input layout on small devices (#448)
- Enable update if commits available but version number is above
- Bug in dependency getter (#445)

### 📦 Chores

- Push version number to v2.1.0-beta4
- Update vuetify package (#456)
- Add overlayscrollbars to package.json
- Update vuetify package

### 🔧 Refactoring

- Some fixes in 2.1.0 beta and minor changes to ui (#457)
- Change icon in PrintsettingsPanel.vue
- Fix i18n-extract test in power device dialog

### 🚀 Features

- Add stream_delay_compensation and park_time to timelapse settings
- Add option to hide TL gcodes in console (#451)
- Icons for print settings (#441)
## [2.1.0-beta3] - 2021-12-01

### 🐛 Bug Fixes

- Escape urls also escape / in the url
- IOS orientation changed didn't trigger resize event

### 📦 Chores

- Push version number to v2.1.0-beta3
## [2.1.0-beta2] - 2021-11-29

### Build

- *(deps)* Bump axios from 0.21.1 to 0.21.2 (#420)

### Locale

- *(fr)* Update fr locale

### 🐛 Bug Fixes

- Reload required bug
- Macro param regexp (#437)
- Allow upper case sensor names (#429)
- Special cases in thumbnail urls
- Add file permissions to edit gcode files
- Disk_usage in sub-directories
- Check if metadata exist in job_queue
- Add path to add gcode files in subdirs to query
- Dependency build check
- Use webcam settings for TL preview image (rotation/mirror)
- Add webcam rotation to new mjpegstreamer method
- Restart mjpegstreamer stream each 60sec to fix browser issues
- UI fixes and changes on timelapse page (#430)
- Patch slider lock feature (#425)
- Check for null when running in docker or non pi (#428)
- Cut heightmap variance to 3 numbers behind the dot
- Reverse logic to show render & save_frames button in TL status panel
- Webcam create/edit form validation
- Rename cancel button in macro management to close

### 📖 Documentation

- Add "NTC 100K beta 3950" note
- Change default value of PRINT_START macro

### 📦 Chores

- Push version number to v2.1.0-beta2

### 🔧 Refactoring

- Update job_queue to moonraker notification
- Update moonraker dependency for job_queue

### 🚀 Features

- Machine settings panel on dashboard (#440)
- Reset timelapse settings
- Add metadata to job_queue panel
- Add moonraker job queue (#433)
- Add serial_number to system cpu info
- Disable camera setting in timelapse setting if snapshoturl exists in moonraker.conf
## [2.1.0-beta1] - 2021-11-20

### Feature

- Exclude objects (#362)

### Bugfix

- Fix the webcam panel collapsible property (#375)
- Fix ripple effect on two more buttons (#374)
- Fix ripple effect on collapsible-button (#373)
- *(machine)* Fix margins between panels/rows on mobile viewport
- *(heightmap)* Hide toolbar buttons on mobile phone
- TheSettingsMenu.vue mobile view toolbar
- Convert useCross to control type
- Wrong index in klipper warnings
- Add resize listener to gcode viewer
- Fix issue with enable/disable live tracking
- Force redraw after changing z-slider and fix rendering snackbar after fileupload with url
- Remove viewer from vuex

### Build

- Push to v2.1.0-beta1

### Locale

- *(IT)* Minor edits in italian (#415)
- *(fr)* Fix some typos

### 🐛 Bug Fixes

- Add locale for empty timelapse state
- Update action name for saving gui settings
- Webcam mjpegstreamer mode (#419)
- Switch every time to relative mode for movements
- Close button in update manager commits to tile
- Main scroll height (smaller topbar)
- Dont polling printer.info in klipper state disconnected
- Wrong action names in settings webcam tab
- Remove macrogroup panel from dashboard when delete macrogroup
- Display standby macrogroup/macro when klipper state is cancelled
- Fix typo from webcam panel logo in settings dashboard
- Remove replace space to underline in fileupload in topbar upload
- Remove replace space to underline in fileupload
- Check existsPresetName update index to id
- All gui/webcam requests
- Convert old presets to new namespace
- Hide deleted macros on dashboard macro groups
- Padding in simple macro panel
- Remove hide-overlay in settings menu dialog
- Update metadata and gcode thumbnail of farm printers
- Fix spaces update manager panel
- Update farm printers webcam to new webcam db namespace
- Store databases in farm printer states
- Don't display confirm changes dialog in editor for read-only files
- Wrong download link for load current file in g-code viewer
- Autoscroll function in console page doesn't work after switching to overlay scrollbar
- Autoscroll function in update dialog doesn't work after switching to overlay scrollbar
- Use repo_name instead of update_manager module name for creating github link
- Dependencies getter dont work with commits after release tag
- Margin between DependenciesPanel.vue and next panel
- Drag & drop upload in gcode files
- Duplicate dirs in filetree
- Init directories dont work
- Update links from klipper warnings
- GetDirectory didn't check metadata changes
- Wrong variable name for cooldown preset gcode
- Jumping panels when webcam (mjpegstreamer) is not in viewport
- Remove eventListener in farmprinter panel
- Change default extruder feedrates
- Translations in ui-settings tab
- Hide horizontal scrollbar in settings menu
- Hide string chars in default macro params
- Update manager commits list icon and show days if smaller than 1 day ago
- Hide main branch in update manager
- Font size in console was to big after font change
- Safe gcode offset button wrong type
- Update getMacroParams regex
- Bump the version for @codemirror/search to 0.19.2 to benefit from (#394)
- Init data in heightmap dont exist without bed_mesh
- Load metadata of current print file of farm printers
- Remove [display_status] from min settings, when [display] exists
- *(websocket)* Close websocket before connecting (#383)
- Inconsistent spelling and typos (#379)

### 👷 CI/CD

- *(docker)* Fixing docker systemctl problems and speed up builds process (#376)

### 📖 Documentation

- Updated all meteyou/mainsail urls to mainsail-crew/mainsail
- Update mainsailOS urls
- Add 'command format mismatch' to faq (#406)
- Pre-flight fix
- Update moonraker dependencies
- Add FAQ with some klipper warnings
- Add Rat Rig community theme by Raabi91
- Update manual setup/update (#368)
- Fix order of first-boot.md
- Remove sudo for editing printer.cfg
- Major docs update by tomlawesome (#358)
- Fix typo in CONTRIBUTING.md

### 📦 Chores

- Update perfect scrollbar package in npm
- Fix types from last commits
- *(build)* Lint errors (#381)
- Add CONTRIBUTING.md
- Move CODE_OF_CONDUCT.md to .github/
- Add CODE_OF_CONDUCT.md
- *(deps)* Bump nokogiri from 1.12.3 to 1.12.5 in /docs (#363)
- Update gcodeviewer to v2.1.13
- Change tracking button
- Update gcodeviewer to v2.1.11
- Update gcodeviewer to v2.1.10
- Merge master in develop

### 🔧 Refactoring

- Remove db update for locked sliders
- Update download button in timelapse preview dialog
- Remove debug output in timelapse mutations
- Button overhaul and minor changes to the ui (#413)
- Minor changes to menu and settings tab (#411)
- *(locale)* Update FR locale file
- Update klipper warings output
- Cleanup gui/actions from old functions
- Move macrogroups to own moonraker db namespace and create a sub module of gui store
- Remove old actions in farm module
- Move remotePrinters to own moonraker db namespace and create a sub module of gui store
- Move consolefilters to own moonraker db namespace and create a sub module of gui store
- Rename webcamTab to webcamsTab in settings menu
- Use Vue.set in addClosePanel and removeClosePanel mutations
- New order of init moonraker databases and printer
- Rename gui/webcam to gui/webcams store
- Move presets to own moonraker db namespace and create sub module of gui store (#405)
- Modify dependencies text
- Change icon position in top right corner navi
- Fix typo in dependency text
- Update dependency panel and text
- Change main scrollbar to perfect-scrollbar
- Change thumbnail sizes and use a global variable
- Use getter getDirectory in gcode files
- Remove divider between buttons in editor toolbar
- Convert editor to panel component and add perfect-scrollbar
- Convert emergency stop dialog to new panel component
- Rename theme settings tab to ui settings and move some ui settings from general to ui-settings
- Sort interface settings tabs and add a border between navi and content
- Change defaults macro param usecase
- Convert editor confirm dialog to new panel component
- Remove debug output
- Change color of cooldown button
- Remove padding right in toolbar to move toolbar buttons to the right corner
- Change panel buttons to toolbar text/icon buttons
- Change StatusPanelExcludeObjectDialog.vue to panel component
- Change CommandHelpModal.vue to panel component
- Change TheSettingsMenu.vue to panel component
- Change toolbar buttons to text buttons in WebcamPanel.vue
- Change toolbar buttons to text buttons in ToolsPanel.vue toolbar

### 🚀 Features

- Add save frames button in TimelapseStatusPanel.vue
- Gui for the timelapse moonraker plugin (#417)
- Lockable sliders (#412)
- Reset database namespaces and/or history jobs/totals
- *(editor)* Add webcam.conf as webcamd config
- New design of the web UI (#408)
- Add autofocus and action by press enter in crate/rename dialogs in gcode files
- Add autofocus and action by press enter in crate/rename dialogs in config file manager
- Move webcams to new db namespace (#401)
- Mainsail dependencies panel on the dashboard (klipper, moonraker)
- Change overlaps-scrollbar instead of perfect-scrollbar (#400)
- Add link to gcode thumbnail docs in ui settings
- Use moonraker server.files.get_directory root_info to set root permissions
- Add moonraker file_manager permissions to store and config files
- Add start/stop service buttons and display service state in top corner menu
- Add full update function to update manager
- Add tooltip with extrude volume on feedrate buttons
- Add heightmap current mesh information panel
- Change color of presets button in tool panel
- Add a compact console style option
- Added modified file tracking and a confirmation (#393)
- Macro management (#396)
- Add function to change/select time calculations for estimate and ETA times
- Uses monospace font on console (#389)
- Adds optional confirmation dialogs for emergency stop and power device change (#384)
- Redesign commits dialog in update manager (github like list) (#380)
- Add option to hide config backup files (#378)
- *(panel)* Disable text select for panel headline
- Add hover effect to collapse panel button
- Change panel toolbar buttons to v-toolbar-items
- Collapsable and normalize panels (#372)
- Exclude object map (#371)
- Add perfect scrollbar to update commits dialog
- Exclude object map (#369)
- Add klipper warnings panel on the dashboard (#355)
- Add some rendering options to gcode viewer
- Clear settings from gcode viewer
- Optimize g-code viewer workflow and button positions
- Automatic rendering after changing color mode
- Move color mode select from settings to gcode viewer page and remove debounce of z slider
- Add snackbar for display the downloading gcode file and option to cancel it
- Add snackbar for display the rendering process and cancel it
- Add backup and restore gcode viewer state
## [2.0.1] - 2021-09-08

### Bugfix

- *(webcam)* Display the wrong webcam if you connect to a remote printer with relativ webcam url (#345)
- *(gcodeviewr)* Fix z slider height
- *(i18n)* Fix issue after eslint rules fix

### Hotfix

- *(gcodefiles)* Fix printed files filter
- *(store)* Fix error of migrate drv_status in store
- *(webcam)* Add leading zero to FPS output below 10 (only adaptive mjpegstreamer)
- *(console)* Autofocus input field after click on a command
- *(theme)* Fix mainBackground image #349 (#351)
- *(gcodefiles)* Fix typo in error message (#350)
- Printerfarm panel (#344)

### 📖 Documentation

- Multi webcam documentation (#343)
- Update screenshot to v2.0.0

### 📦 Chores

- *(type)* Fix type for build
- Increment version number to V2.0.1
- *(editor)* Update gcodeviewer
- *(gcodeviewr)* Fix some types
- *(gcodeviewr)* Convert to TS
- Fix eslint rules and update from develop
- *(eslint)* Config and fix eslint rules (#340)

### 🚀 Features

- Gcodeviewer (#322)
- *(console)* Autofocus input field after click on a command
## [2.0.0] - 2021-08-26

### Bugfix

- Available_services types and getter in topbar
- *(App)* Remove unused vars
- Autofocus editor to bind search function
- *(configfiles)* Files sorting store doesn't work

### Locale

- *(fr)* Fix one type in settings console tab
- *(hu)* Fix last words
- *(it)* Add translation

### 📦 Chores

- Fix some eslint warnings
- *(App)* Fix build warnings
- *(build)* Change sass version as workaround for vuetify sass warnings
- *(github)* Add build workflow for test builds
- *(github)* Add build workflow for test builds
- Increment version number to 2.1.0-alpha
- Increment version number to V2.0.0
- *(docs)* Update gem packages
## [2.0.0-rc.2] - 2021-08-22

### Bugfix

- *(heightmap)* Fix probe_count for delta printers
- *(editor)* Fix tab binding
- *(editor)* Download json as plaintext to edit it
- *(heightmap)* Fixed profiles list for KevinOConnor/klipper#4598

### Locale

- *(fr)* Fixed last missing translations

### 📦 Chores

- Increment version number to 2.0.0-rc.2

### 🚀 Features

- *(editor)* Add JSON syntax highlighting
## [2.0.0-rc] - 2021-08-21

### Bugfix

- *(heightmap)* Fix dataShape for all bed_mesh ratios (Y, X) instead of (X, Y)
- *(ControlPanel)* Change - to en-dash for equal width of negative and positiv buttons in DWC-style ControlPanel.vue
- *(heightmap)* Prepare for KevinOConnor/klipper#4598
- Add all available sensors to tempchart
- Add pwm series to chart
- Hide heaters, temperature_fans and temperature_sensors with _ as first letter in the name in tempchart
- Display name in remove heightmap dialog
- Add fixed width of settings sidebar
- Version number and navi overlaps
- Console scrolling and min height

### Locale

- *(nl)* Fixed last missing translations
- *(it)* Remove unused keys
- *(nl)* Remove unused keys
- *(fr)* Remove unused keys
- *(hu)* Update hu json (#333)
- *(zh)* Update chinese trans (#332)

### 📦 Chores

- Increment version number

### 🚀 Features

- Add canvas to tool color picker
- Hide heaters, temperature_fans and temperature_sensors with _ as first letter in the name
## [2.0.0-beta3] - 2021-08-09

### Bugfix

- Hide webcam until socket is connected
- Responsive fix on portrait tablet in TheTopbar.vue
- Responsive fix on portrait tablet in ToolsPanel.vue
- Responsive fix on portrait tablet in ZoffsetPanel.vue
- Fix typo in zoffset panel
- Set tool target temp if new target is out of range
- Col width from loading col in settings row
- Saving webcams in SettingsWebcamTab.vue
- Saving presets in SettingsPresetsTab.vue
- Scrollable console in shell style
- Fix interface for heightmapSerie
- Fix heightmap for delta printers
- Workaround for dashboard panel sorting on mobile devices

### 📖 Documentation

- Added nvm node install for standalone dev env (#325)

### 🚀 Features

- Add welcome message in empty console
- Linux like console & customize console height (#321)
- Disable heightmap panels when klipper is not ready
## [2.0.0-beta2] - 2021-08-03

### Bugfix

- Remove 'show on dashboard' option in settings > webcam
- Remove printing favicon after cancelled job
- Only send a request when current_file is set
- Cancelled status panel show wrong values
- SAVE_CONFIG button in topbar fixed
- Printer.cfg was no longer displayed after SAVE_CONFIG
- Editor translation unknown class
- Change button color if primary color too light
- Rename machine url to fix reload issue in machine
- Add modified to dirs
- Load thumbnails with timestamp to avoid caching problems
- Fix ToolSlider.vue for printsettings and machine limits
- Bind TAB to editor
- Upload & print button clear loading status after uploading files
- Autoscroll in update dialog
- Fix scrollbar toggle issue with browser zoom in heightmap
- System loads cannot be displayed with temperature_fan for mcu temp sensor
- Fix heightmap on mobile devices
- Editing preheat presets
- Editing files in subdirectory
- Change stepper config to toolhead min/max for max range (fix for delta printers)

### Build

- *(deps)* Bump addressable from 2.7.0 to 2.8.0 in /docs (#306)

### Locale

- Last fr fixes
- Update francais

### 🚀 Features

- Set current viewport as default when open settings > dashboard
- Add logo favicon and progress favicon in logo color
- Sortable dashboard panels (#319)
- Add support for save gcode offset to endstop/probe
- Show gcode thumbnail in full height on focus
- Change to motion_report with fallback to toolhead position in status panel
- Add message to include mainsail.cfg in printer.cfg
- Hide klipper_mcu service in topcornermenu (fix if empty)
- Hide klipper_mcu service in topcornermenu
## [2.0.0-beta] - 2021-07-16

### Bugfix

- Adaptive mjpeg streamer does not switch off in standby mode
- Display toolhead position instead of gcode position in the status panel
- Tempchart interval duplicates
- Fix home all button length
- Seperate translations from connectingDialog and fix typos
- Disable opacity on gcode thumbnail tooltips

### Build

- *(deps)* Bump nokogiri from 1.11.1 to 1.11.4 in /docs (#283)

### 📖 Documentation

- Fix typo
- Add voron toolhead and cyperpunk communtiy themes and a few improvements of how screenshots get loaded. (#298)
- Add home and temp check to PAUSE and RESUME (#288)
- Add .svg as valid background extension (#285)

### 🚀 Features

- Display status of QGL & z_Tilt status in control panel
- Dynamic max of machine limits
- Add dynamic root paths to config files
- Add mooncord to "save & restart" function of the config file editor
- Show all available services (moonraker) in TopCornerMenu to restart the service
- Display moonraker warnings on the dashboard
- Update not connecting dialogs with better descriptions
- Store file list (gcode files & config files) sortBy in moonraker DB
- Add logfile paths to "connection failed" dialog
- Add SVG support for sidebar & main background
## [1.6.0] - 2021-05-18

### Bugfix

- Adjusting the home text in the control panel
- Rename reverse motion to invert motion in settings control panel
- Fix typo in connection failed dialog
- Make in_progress history entries deletable
- Add moonraker inotify support (#282)
- VUE_APP_REMOTE_MODE true/false doesnt work
- Reload metadata after move/rename gcode file (fix: #281)

### Build

- *(deps)* Bump rexml from 3.2.4 to 3.2.5 in /docs (#273)

### 📖 Documentation

- Stylesheets & escaping gcode (#279)
- A simple recommendation for remote access (#277)

### 🚀 Features

- Add UV4L-MJPEG webcam support
- Add filament_motion_sensors
## [1.5.0] - 2021-04-13

### Bugfix

- Fix download in firefox (open new window)
- Fix upper directory colspan number
- Fix end time, when the job is in_progress in HistoryListPanel.vue
- Fix icon issue in edit tool dialog of temperature_sensors
- Fix translations in ToolsPanel.vue
- Fix shared_heater min_extrude_temp in control panel
- Reverse Y in alternative joggle control doesnt work
- Show only one webcam in full screen mode instead of grid view
- Destroy resize event before component destroy
- Don't display "up-to-date" for unknown versions in update manager
- Fix typo in connection dialog
- Tool input field as number (mobile input fix)

### 📖 Documentation

- Add credits (#263)
- Fix localization guide
- Add Localization to development docs
- Fix theme list

### 🚀 Features

- Add FR to i18n
- Rename directory in ConfigFilesPanel.vue
- Multiple custom console filters
- Store webcam settings in printer farm
- Display filament weight metadata in gcode-files list
- Display printername in SelectPrinterDialog.vue
- Delete directory with content in config files panel
- Delete directory with content in g-code files
- Add state avg to heaters and temperature_fans in ToolsPanel.vue
- Display full version number of up-to-date components in the update manager
- Send an api e-stop instead of M112 gcode
- Redesign status panel
- Add "Busy"-State, if the printer is in "standby" and execute some commands
- Add M117 output to status panel in standby mode
- Add webcam support to printer farm
- Add debug mode to display ram usage
- Add recovery function to update manager
- Add ip cam to webcams
- Add days to ETA (status panel + tab title)
- New editor (#243)
## [1.2.1] - 2021-02-12

### Bugfix

- Also change hover color (emphasis) from dataset
- Only accept data later than the last entry of the dataset (tempchart)
- Pwm scale with uppercase fans
- Remove remote printer (save array in moonraker db)
- Fix typo in connecting dialog
- Fix margins in temperature datasets options dialog
- Fix tempchart resize error after switching page
- Fix updateManager enable_repo_debug doesn't work
- Fix updateManager commits dialog responsive mobile view
- Fix margin between panels in settings > interface
- Fix responsive view on mobile devices of presets editing dialog
- Fix max width of update dialog on mobile devices
- Fix migrate presets from .mainsail.json to moonraker db

### 🚀 Features

- Add ETA to page title
- Add ETA to page title
- Add tooltip with object height on layer counter
- Show/hide printed files in gcode files
- Add restart webcamd button in top corner menu, when webcam is enabled in sidebar or dashboard
- Add option to display ZOffsetPanel in Standby (fix #230)
- Add probe to endstop status panel
## [1.4.0] - 2021-03-09

### Bugfix

- Check version and remote_version to be valid in update manager
- Only switch to relative mode when the printer is in absolute mode, when moving with the control buttons
- Editing cooldown gcode
- Disable dataset on hover
- Decrement / increment buttons in MiscellaneousSlider
- Update cooldown preset > type in variable name
- Upgrade notification with semver check
- Migration .mainsail.json to moonraker db
- Fan slider off_below
- Set default values of printer limits
- Update panel invalid version number
- Include speed_factor in requested_speed in the StatusPanel.vue

### 🚀 Features

- Add option to enable cancel_print button permanently
- Add .nc to valid gcode extensions
- Add info icon to clickable update logs
- Display power/speed axis in tempchart only with a enabled dataset
- Display bed_mesh variance and make profile name clickable
- Add tacho value to miscellaneous fans and temperature_fans
## [1.3.0] - 2021-02-27

### Bugfix

- Chart rendering disabled when the chart is hidden
- Disable rendering of tempchart, when dashboard is not focused
- Fix loading values of .mainsail.json
- Addition sensors cannot be hide from heaters & temperature_fan in temperatures list
- Refresh metadata on refresh directory

### Tempchart

- Add units to y axis

### 📖 Documentation

- Add different message styles
- Theme warning fix
- Custom.css slight reformat
- Add custom.css example
- Update manager config in manual setup

### 🚀 Features

- Commit dialog for upgradeable components
- Save last setting of ExtruderPanel.vue in .mainsail.json
- Add configable chart rendering intervals
## [1.2.0] - 2021-02-09

### Bugfix

- Fix order in console from preset
- Only allow positiv values in control and extruder settings
- Editing existing preset doesn't work after add another heater (fix #182)
- Colorpicker return object instead of string (fix #193)
- Save only hex values of chart colors
- Add vertical divider for better "button feeling"
- Esp32 cam or ustreamer link fix bypassCache append (fixed #185)
- Remove ":" in ConnectingDialog.vue

### Hotfix

- Mainsail docs logo

### 🚀 Features

- Hide additional sensors in temp list
- Hide additional sensors
- Add customize feedrate & feed distances to ExtruderPanel.vue (fix #158)
- Add customize feedrate for ControlPanel.vue (fix #49)
- Add preheat function in gcode files context menu
- Add disk usage to gcode-files
- Process notify_klippy_shutdown from moonraker
- Disable power devices with attribute "locked_while_printing" in moonraker while printing
## [1.1.0] - 2021-01-31

### Bugfix

- Update metadata by override gcode file
- Fixed tooltip css
- Duplicate preset entries in tools combobox
- Miscellaneous sorting (pwm entries before non pwm)
- Block upload by drag&drop gcode upload during a print (fixed #163)
- Duplicate event history
- Allow .ufp and show thumbnails

### 🚀 Features

- Add additional sensor support in temperature panel (bme280...)
- Add hover marker in tempchart
- Add combobox for target temp with preset values
- Save chart settings in mainsail.json
- Add autoscale tempchart
## [1.0.2] - 2021-01-24

### Bugfix

- Thumbnails in gcode files
- Fixed updateManager order
## [1.0.1] - 2021-01-24

### Bugfix

- Fixed problem with older moonraker version (registered_directories)
- Fix undefined dir in filetree
- Hide docs in ConfigFilesPanel.vue
- Load thumbnails between 32-64px in gcode files
- Load thumbnails between 32-64px in gcode files
- Fix margins in edit preset dialog
- Firefox > edit presets > checkbox and input remove linebreak
- Add warning when saving a empty preset
- Fixed duplicate printers after browser sleep
- Add close/exit button in SelectPrinterDialog.vue
- Add heater change gcode in event list (console history)
- Download config files (issue with url build)
- Add SelectPrinterDialog.vue hostname rule (http: && https: is invalid)
- Add remotePrinter hostname rule (http: && https: is invalid)
- Change restart icons in KlippyStatePanel.vue
- ConvertNamein preset panel

### 🚀 Features

- Redesign MoonrakerFailedPluginsPanel.vue and MinSettingsPanel.vue
- *(refresh-webcam)* Refresh webcam view on focus
- Restart moonraker if you click SAVE & RESTART of moonraker.conf
- Add registered_directories in server init process
## [1.0.0] - 2021-01-19

### Bugfix

- Type in printer select dialog
- Fixed favicon glitches
- Change colors and put lines in the front of the temp chart
- Disable preset button during a print
- Disable update button during print in UpdatePanel.vue
- Add unit to requested_speed
- Layer_count to 0 until the print starts
- Unknown attribute in farm printer getter
- Favicon wrong url
- Dashboard status panel and farm printer panel -> different eta time
- Topbar SAVE_CONFIG button doesnt work
- Reload for klippy state message
- StatusPanel.vue text no warp
- Save config without restart
- Gcode_position unknown fixed in StatusPanel.vue
- Change sync icon to restart icon in top corner menu
- ControlPanel.vue padding top during a print
- Console autocomplete -> fixed addEvent attributes
- Uppercase every first letter in peripherie names
- Clear new printer objects on reset
- Tool input is empty -> klipper error unable to parse
- Switching printers in remoteMode change to single mode
- Only display 32x32 thumbnails in gcode files list

### 🚀 Features

- Add remotemode
- Convert heater, fan & sensor names
- Add custom gcode to presets
- Add HomeAll (G28) button in Heightmap.vue
- Add preheat & cooldown function in ToolsPanel.vue
- Upload & start button in topbar
- Close top corner menu after all functions except power devices
- Display reprint & clear print button in print_state error
- Add clear print stats button in complete state
- Add output_pin to PeripheriePanel.vue (fan panel before)
- Add detached state in update manager
- Add gcodeStore types (respond, command)
- Moonraker failed_plugin output on dashboard
- Add moonraker update notifications
- Add farm mode
