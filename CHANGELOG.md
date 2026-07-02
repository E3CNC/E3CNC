# Changelog
## v0.9.4 (2026-07-02)
- **WCS preview Y-axis fix** — new `reverse_y_preview` profile setting (in `machine_profile.yaml`) fixes the SVG preview for machines homing at Y_max with `homing_positive_dir: False`. When `reverse_y_preview: true`, Y-axis maps min→top, max→bottom, matching the physical machine orientation.
- **Release pipeline automation** — CI now triggers on `git push origin v*` tags, creating full releases with zip + stack artifact + checksum. Push-to-main creates nightly pre-releases. Stack artifact search falls back through older releases if the latest one doesn't have one.
- **Nightly pre-releases** — every push to `main` creates/updates a `nightly-main-YYYYMMDD` pre-release with the frontend zip.
- **Stack artifact guard** — CI fails before publishing if the stack artifact wasn't built.
- **`bump-version.sh` creates git tags** — after bumping version files, the script creates a `v<newver>` tag. Added `--no-tag` flag to skip.
- **`package-lock.json` version synced** — `bump-version.sh` now also updates `package-lock.json`.
- **Robust profile loading** — `useCncProfile` composable handles socket URL not being available at mount time, with retry watcher and `.catch()` to prevent unhandled promise rejections.
- **CLI bundled into stack artifact** — `e3cnc-cli` now runs from the deployed release when available (`~/e3cnc/current/cli/`), keeping CLI and stack versions in sync. Falls back to repo checkout on fresh installs.
- **`--version` shows both versions** — when CLI version differs from deployed stack, shows both: `e3cnc CLI v0.9.2  |  Deployed stack: v0.9.3`. Same in TUI and numbered menu headers.
- **Passwordless sudo for service management** — `ensure_sudoers()` creates `/etc/sudoers.d/e3cnc` for passwordless `systemctl restart e3cnc-*`, `supervisorctl *`, and nginx reload. Created on first restart and during Ansible bootstrap.
- **Duplicate moonraker.conf section merge** — `fix_moonraker_config()` automatically merges duplicate `[section]` headers before restarting services.
- **Remove `[update_manager E3CNC]` residues** — all Moonraker `update_manager` integration removed. E3CNC handles all updates via `e3cnc-cli`.
- **Interactive uninstall per-instance** — `e3cnc-cli uninstall` shows numbered list when multiple instances exist, lets you choose which to remove (or all). `--instance` flag skips selection.
- **Uninstall only touches E3CNC instances** — KIAUH instances never affected. Only cleans up `~/e3cnc/` layout.
- **`prune-backups` command** — `e3cnc-cli prune-backups` removes old backups from `~/e3cnc/backups/`, keeping the 5 most recent. Supports `--keep` and `--dry-run`.
- **Backups stored in `~/e3cnc/backups/`** — both local and remote backups save to `~/e3cnc/backups/` instead of repo root. Restore searches this path automatically.
- **Numbered menu quit fix** — selecting quit in the numbered menu actually exits instead of re-displaying the menu.
- **KIAUH service detection fix** — `_read_service_name()` correctly ignores unrelated entries in `moonraker.asvc` (like `klipper_mcu`) so Moonraker service name is always derived from the instance name.
- **Issues closed**: #17 (KIAUH service detection), #20 (CLI cloned at wrong version), #21 (menu quit doesn't exit), #22 (CLI vs deployed version mismatch)


## v0.9.3 (2026-07-02)
- **Version centralization** — `package.json` is now the single source of truth for version. New `bump-version.sh` syncs `_e3cnc_shared.py` and inserts a changelog stub on each bump.
- **WCS restore to saved WCS** — the WCS auto-reset now saves the active WCS at job start and restores it on job end, instead of always defaulting to G54.
- **Macro safety pass** — all project-owned `.cfg` files now have inline comments on every command.

## v0.9.2 (2026-07-01)
- **WCS auto-reset on job end** — when a job finishes or cancels, the UI now auto-selects the previously active WCS (saved at job start) instead of always defaulting to G54. Prevents jog moves in machine coordinates (G53) that caused Z-axis crashes. Closes [issue #18](https://github.com/E3CNC/E3CNC/issues/18).
- **Safer FINISH_JOB macro** — replaced absolute G53 Z25 lift with relative Z10 lift and removed G53 XY park. Tool now lifts 10mm and stays above the work instead of potentially moving into tall stock or dragging across fixtures.
- **Safer CANCEL_PRINT macro** — removed G90 G0 X0 Y0 park that moved to machine origin (G53) after Klipper reset, which could crash into fixtures. Now just lifts Z10 and stops.
- **All macros documented** — every G-code command in `e3cnc_macros.cfg`, `wcs_macros.cfg`, and `macro_labels.cfg` now has inline comments.
- **10 unit tests** for WCS reset logic covering all print_stats transition combinations.
- **Version centralization** — `package.json` is now the single source of truth for version. New `bump-version.sh` script syncs it to `_e3cnc_shared.py` and inserts a stub entry in CHANGELOG.md on each bump. CLI version bumped from 0.8.4 to 0.9.2 to match frontend.

## v0.9.1 (2026-07-01)
- **Zero TypeScript errors** — resolved all 1,638 TS errors across store (1,222), tests (237), and components (179).
- **Store layer**: ActionContext, MutationTree, GetterTree type annotations across 82 files.
- **Test layer**: fixture typing + VTU v2 inference dead-end patches across 14 files.
- **Component layer**: Vuetify 3 slot renames, null safety, template type casts, event type unions across 73 `.vue` files.
- **Build**: `vue-tsc --noEmit` and `vite build` both pass clean.

## v0.9.0 (2026-06-30)
- **Interactive TUI menu** — full-screen menu with semi-graphical display, keyboard shortcuts (`[s]` Status, `[i]` Install, etc.), arrow key navigation, and inline descriptions for all 25 commands
- **Supervisor process management** — new `_e3cnc_supervisor.py` module manages Moonraker/Klipper via `supervisord` instead of systemd. Automatic registration on install/import, fallback to systemd when supervisor unavailable. Bootstrap stack Ansible role installs supervisor package.
- **`e3cnc-cli restart`** — new command to restart instance services (supervisor-aware, falls back to systemd)
- **Per-instance web ports** — first instance gets port 80, subsequent instances get 8080, 8081, ... Web port persisted in `moonraker.conf` as `# e3cnc_web_port: N`. All nginx configs generated and reloaded automatically.
- **Card-based admin page** — `/admin` endpoint rewritten as modern card layout with clickable IP-based URLs for each instance's Web UI, API, and config files
- **KIAUH import** — new `import-instance` command safely copies existing KIAUH instances into `~/e3cnc/instances/{name}/` layout without modifying originals. Handles port conflicts, generates nginx configs, registers with supervisor.
- **`migrate-instances` command** — batch migration of all KIAUH instances to the new E3CNC layout
- **`detect-mcu` / `flash-mcu` / `init-config`** — new CLI commands for MCU scanning, firmware flashing, and CNC printer.cfg generation
- **`admin-page` / `clilog`** — new CLI commands for admin page regeneration and viewing CLI operation logs
- **CLI logging** — all CLI operations logged with timestamps to `~/e3cnc/cli.log`
- **Klipper health checks made optional** — health checks for Klippy connection and Klipper process no longer trigger rollback, allowing updates on placeholder/printer-less instances
- **Persistent web ports on import** — `_compute_web_port()` now correctly assigns unique ports across imports. Web port written to `moonraker.conf` on `_create_new_instance()` and `import_kiauh_instance()`.
- **Fixed menu crash on `[p] Prune`** — `_Fake` args object was missing `keep` attribute
- **Fixed menu crash on `[s] Status`** — `get_active_instance()` no longer triggers selection prompt when `--instance` flag is provided
- **Fixed instance selection crash** — all `simple-term-menu` menus now use `[x]` bracket shortcuts for compatibility
- **`clear_screen=True`** on all menus — command output displays on a clean screen with visible "Press Enter" prompt before menu reloads
- **Frontend JS patch** — auto-detect port array patched to try `window.location.port` first, fixing multi-instance Moonraker connection in proxied environments
- **Comprehensive unit tests** — 180+ tests covering all CLI commands, parser, menu dispatch, MCU detection, health checks, and integration validation

## v0.8.4 (2026-06-29)
- **Fixed**: `sync_runtime_files()` now creates the scripts directory before copying `cnc_metadata_extractor.py`. On multi-instance fresh setups, the `scripts/` dir didn't exist yet, causing `FileNotFoundError`.

## v0.8.3 (2026-06-29)
- Version bump from v0.8.2 → v0.8.3
- No functional changes — marks the current release state after documentation updates
- Full v0.8.2 changelog below

## v0.8.2 (2026-06-29)
- **CLI commands added**: `detect-mcu` (scan USB/serial for controllers), `flash-mcu` (6 MCU presets, builds firmware), `init-config` (generates CNC printer.cfg template with auto-detected MCU path)
- **Update safety**: `--dry-run` flag previews changes without modifying anything. Pre-update backup now includes raw Moonraker SQLite DB (`moonraker-sql.db`) in addition to printer.cfg, moonraker.conf, and API export.
- **Viewer route verified**: Babylon.js gcode viewer loads correctly, zero runtime errors, 1.8 MB chunk code-split from main bundle.
- **Build code-split**: Vuetify (569 KB) and Vue core (206 KB) split into separate chunks. Index chunk reduced from 1.9 MB → 1.2 MB. Zero build warnings.
- **CI workflow**: Tests (pytest, 115 tests) + frontend build (bun) run on every push/PR. Cached pip and bun dependencies.
- **Integration tests fixed**: `.dockerignore` reduced build context from 5.4 MB → 288 KB. Pre-installed ansible + python3-pip/venv in Docker image. Added `vendor/klipper/scripts/klippy-requirements.txt` (Klipper deps were silently skipped). Switched to Linux MCU process (bidirectional serial) instead of host simulator (one-way only).
- **Real hardware test**: Full update v0.8.0→v0.8.2 on BTT-CB1 (Debian 11, Python 3.9, STM32G0B1 MCU). Auto-rollback verified, Klippy reconnection confirmed, all 6 health checks pass.
- **Python 3.9 compatibility**: Replaced `str | None` syntax with `'str | None'` string annotations for Debian 11 compatibility.
- **Health check retries**: Increased from 3→6 (30s max) for slower ARM boards.
- **DB backup fix**: Glob pattern broadened to match `*.db`, `*.sqlite`, `*.sqlite3` (real Moonraker uses `moonraker-sql.db`).

## v0.8.1 (2026-06-28)
- Fix `UnicodeEncodeError` in `print_banner()` on latin-1 terminals

## v0.8.0 (2026-06-28)
- **Single-deploy migration** — repo renamed `E3CNC_UI`→`E3CNC`, flattened layout, vendored Moonraker/Klipper upstream snapshots
- **Stack artifact** — CI builds `e3cnc-stack-v*.tar.zst` containing frontend, Moonraker components, Klipper extras, macros, scripts, and manifest
- **CLI rewrite** — `e3cnc-cli` now a unified stack-apply tool with `update`, `releases`, `rollback`, `prune`, and legacy commands
- **Staged runtime activation** — releases stored in `~/e3cnc/releases/` with `current` symlink, journal, auto-rollback on health check failure
- **7 health checks** — Moonraker API, CNC agent, metadata component, Klipper state, nginx config, web root, and metadata loaded verification
- **Fresh-install bootstrap MVP** — new Ansible role bootstraps a clean machine from zero: base packages, vendored Moonraker/Klipper, venvs, systemd units, nginx, placeholder printer.cfg
- **Web root rename** — `~/mainsail` → `~/e3cnc-web` for fresh bootstrap installs
- **Nightly CI releases** — pre-built frontend published as GitHub release on every push to `main`, with `post_update_script` automation

## v0.7.11 (2026-06-25)
- Comment out an existing `[update_manager mainsail]` block in `moonraker.conf` during install to avoid conflicts with `E3CNC`

## v0.7.10 (2026-06-25)
- Multi-instance detection now supports KIAUH-style layouts like `~/printer_test1_data`
- Use shared `~/moonraker`, `~/klipper`, and shared `~/mainsail` by default instead of inventing per-instance dirs
- Derive per-instance `moonraker_service`, `klipper_service`, and `moonraker_port` from instance metadata/config
- Make install/redeploy/uninstall health checks and restarts use the selected instance service and port
- Make status, diagnose, logs, backup, and restore instance-aware
- Prompt for local `sudo` credentials before non-interactive privileged steps
- Docker multi-instance test now models real shared-dir + per-service KIAUH setups

## v0.7.9 (2026-06-25)
- Multi-instance support — separate `moonraker_dir`/`klipper_dir` per instance in Ansible vars
- No more `community.general` dependency — replaced `ini_file` with `lineinfile`
- No more `bun`/`node` required on target — frontend is pre-built
- Auto-install missing deps (pip, ansible, curl, unzip) with PEP 668 fix
- Frontend download uses direct GitHub URL — no `node` needed for release lookup
- Add Docker test containers for fresh-install and multi-instance testing

## v0.7.8 (2026-06-25)
- Cleanup Vuetify 2 class leftovers across 20+ files
- Replace Vue 2 `vue-load-image` package with local Vue 3 component
- Fix TimelapseFilesPanel `sortBy` prop for Vuetify 3 data-table
- **Auto-install missing dependencies** — pip, ansible, curl, unzip installed automatically
- **No more community.general dependency** — replaced `ini_file` module with `lineinfile`
- **No more `bun`/`node` required** on target machine — frontend is pre-built
- **Multi-instance support** — separate `moonraker_dir`/`klipper_dir` per instance in Ansible vars
- **Ansible stdout_callback fixed** — uses `result_format=yaml` (compatible with community.general v12+)
- **PEP 668 handled** — `--break-system-packages` for Ubuntu 24.04+
- Add Docker test containers: `Dockerfile.fresh-install`, `Dockerfile.multi-instance`

## v0.7.7 (2026-06-25)
- Version compatibility check between `e3cnc-cli` and `_e3cnc_shared.py`
- Various bug fixes: auto-connect, auto-detect, font restore, Ansible fixes

## v0.7.6 (2026-06-25)
- Fix `run_ansible_playbook` — added missing `extra_vars` parameter

## v0.7.5 (2026-06-25)
- Interactive menu: loop, switch instance, confirmation prompts
- SSH validation, Ansible prerequisite check, `--instance` flag
- Multi-instance docs

## v0.7.3 (2026-06-24)
- **Moonraker MCP server** — 13 MCP tools for AI agent integration
- Package rename: `moonraker-cnc-agent` → `moonraker-mcp`
- Ansible fixes: printer.cfg includes, recursive var, download_frontend.sh
- Post-update script improvements, dry-run mode for backup restore

## v0.7.2 (2026-06-22)
- **Ndot57 theme** — new display font with configurable letter-spacing
- Font inheritance system via CSS custom properties
- Rem units across 25+ components
- DRO formatting improvements

## v0.7.1 (2026-06-22)
- Rename project from `mainsail-cnc` to `E3CNC UI`

## v0.7.0 (2026-06-22)
- Initial release under E3CNC organization
