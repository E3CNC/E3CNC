# Changelog

## v0.9.9 (2026-07-04)

- **BubbleTea TUI migration (Phases 0–6)** — replaces the Python `simple-term-menu` with a Go BubbleTea terminal UI (`e3cnc-tui`). Static Go binary (~3.8 MB, `CGO_ENABLED=0`) that dispatches to the Python CLI for business logic.
- **Install wizard** — 6-screen guided installation: pre-flight checklist (9 checks, hard block), instance configuration (name/ports/hostname), 9-step execution dashboard with real-time progress and spinner, error recovery (retry/skip/abort), verification dashboard (7 health checks), next-steps guide (5 steps).
- **Instance management TUI** — list instances with live status (● running / ○ inactive), switch active instance, create new with inline form (name + port validation), delete with destructive confirmation. Integrated with `~/.e3cnc-tui/state.json` persistence.
- **Streaming output and cancellation** — long-running Python subprocesses stream output line-by-line. Ctrl+C sends SIGINT → 2s timeout → SIGKILL to the entire process group.
- **`e3cnc-cli` entry point updated** — detects `~/e3cnc/current/bin/e3cnc-tui` and forwards to Go binary via `os.execv()`. Falls back to Python CLI if absent. Python `cli/menu.py` and `cli/parser.py` preserved as permanent bootstrap fallbacks.
- **`bump-version.sh` builds Go binary** — now builds `cli/go/e3cnc-tui` with the correct version injected via `-ldflags` after bumping all version files.
- **CI: Go tests + build** — new `test-go` job runs 12 Go tests and verifies Go build on every push/PR. Release workflow builds `bin/e3cnc-tui` for `linux/arm64` and includes it in the stack artifact.
- **Stack artifact includes `bin/e3cnc-tui`** — the release artifact now ships the Go TUI binary alongside the frontend and CLI.
- **Go 1.26+ compatibility** — version injection via `-X` requires unexported variables. `main.Version` → `main.version` (lowercase).
- **12 Go tests** — command parsing (`FindCommand`, `IsKnownCommand`, `AllCommandNames`, `BuildPythonArgs`, `FormatArgsForDisplay`), state persistence (`SaveState`/`LoadState` round-trip, missing file, `InstallJournalPath`).
- **New root README.md** — GitHub landing page with TUI feature highlight and badges.

## v0.9.8 (2026-07-03)
- **Bootstrap moonraker.conf template** — single source of truth for new instance configs, eliminates duplicate sections and drift.
- **KIAUH import rewritten** — no longer copies KIAUH moonraker.conf. Extracts port, generates clean config from bootstrap template.
- **Mainsail user preferences imported** — GUI state (dashboard, theme, webcams) from KIAUH's Moonraker SQLite DB.
- **zstd dependency check** — clear error message instead of cryptic tar failure. Closes #24.
- **3D-printing features removed** — Nevermore sensor, manual probe, nozzle crosshair, UpdateManager, Announcements. 27 files deleted.
- **CLI command registry centralized** — single COMMAND_HANDLERS dict replaces 3 separate dispatch dictionaries.
- **Numbered menu shortcuts fixed** — typing a letter now dispatches the correct command.
- **Cancel/back options** — switch instance and create instance have explicit cancel.
- **450 tests passing** (+7 from v0.9.7).

## v0.9.7 (2026-07-02)
- **CLI command registry centralization** — all commands registered in a single `COMMAND_HANDLERS` dict in `cli/commands.py`, eliminating 3 separate dispatch dictionaries. New commands only need adding in one place.
- **`menu_args_factory()`** — replaced the bare `_Fake` class with a proper args factory that pre-configures all attributes to safe defaults.
- **Single menu item list** — TUI and numbered menus now share one `_ALL_COMMANDS` list instead of maintaining duplicate entries.
- **Numbered menu shortcut keys fixed** — typing a letter like `s` for Status now dispatches the correct command.
- **`prune-backups` dispatch fix** — was registered in parser but missing from `cli/__init__.py`.
- **`fix_moonraker_config` merge fix** — now preserves intervening sections between duplicates.
- **Cancel/back options** — switch instance and create instance prompts now have explicit cancel options.
- **443 tests passing** (+70 from v0.9.6).

## v0.9.6 (2026-07-02)
- **bump-version.sh commits before tagging** — the script now creates a git commit with the version bump before creating the tag. Previously the tag pointed at the old commit, so release builds had the wrong version.
- **Fixed `vv0.9.5` in version display** — `get_active_release_version()` returns versions with a `v` prefix (e.g. `v0.9.5`), which clashed with the hardcoded `v` in `_format_version()`. Stripped the prefix before display.
- **Fixed PermissionError reading sudoers file** — `ensure_sudoers()` now catches `PermissionError` when trying to read `/etc/sudoers.d/e3cnc` (root-owned `0440`). Treats it as "already configured" and skips.
- **e3cnc-cli wrapper fallback** — if the bundled release CLI fails, the wrapper now falls back to the repo checkout, preventing chicken-and-egg update problems.

## v0.9.5 (2026-07-02)
- **WCS preview Y-axis fix** — new `reverse_y_preview` profile setting (in `machine_profile.yaml`) fixes the SVG preview for machines homing at Y_max with `homing_positive_dir: False`. When `reverse_y_preview: true`, Y-axis maps min→top, max→bottom, matching the physical machine orientation.
- **Release pipeline automation** — CI now triggers on `git push origin v*` tags, creating full releases with zip + stack artifact + checksum. Push-to-main creates nightly pre-releases. Stack artifact search falls back through older releases if the latest one doesn't have one.
- **Nightly pre-releases** — every push to `main` creates/updates a `nightly-main-YYYYMMDD` pre-release with the frontend zip.
- **Stack artifact guard** — CI fails before publishing if the stack artifact wasn't built.
- **`bump-version.sh` creates git tags** — after bumping version files, the script creates a `v<newver>` tag. Added `--no-tag` flag to skip.
- **`package-lock.json` version synced** — `bump-version.sh` now also updates `package-lock.json`.
- **Robust profile loading** — `useCncProfile` composable handles socket URL not being available at mount time.
- **CLI bundled into stack artifact** — `e3cnc-cli` now runs from the deployed release when available (`~/e3cnc/current/cli/`), keeping CLI and stack versions in sync.
- **`--version` shows both versions** — when CLI version differs from deployed stack, shows both.
- **Passwordless sudo for service management** — `ensure_sudoers()` creates `/etc/sudoers.d/e3cnc` for passwordless `systemctl restart e3cnc-*`, `supervisorctl *`, and nginx reload.
- **Duplicate moonraker.conf section merge** — `fix_moonraker_config()` automatically merges duplicate `[section]` headers before restarting services.
- **Remove `[update_manager E3CNC]`** — all Moonraker `update_manager` integration removed.
- **Interactive uninstall per-instance** — shows numbered list when multiple instances exist, lets you choose which to remove (or all).
- **`prune-backups` command** — removes old backups from `~/e3cnc/backups/`, keeping the 5 most recent.
- **Backups stored in `~/e3cnc/backups/`** — instead of repo root.
- **Numbered menu quit fix** — selecting quit actually exits instead of re-displaying.
- **KIAUH service detection fix** — `_read_service_name()` correctly ignores unrelated entries in `moonraker.asvc`.

## v0.9.3 (2026-07-02)
- **Version centralization** — `package.json` is now the single source of truth for version. `bump-version.sh` syncs `_e3cnc_shared.py` and inserts a changelog stub on each bump.
- **WCS restore to saved WCS** — the WCS auto-reset saves the active WCS at job start and restores it on job end, instead of always defaulting to G54.
- **Macro safety pass** — all project-owned `.cfg` files have inline comments on every command.

## v0.9.2 (2026-07-01)
- **WCS auto-reset on job end** — auto-selects previously active WCS on job finish/cancel, preventing crashes from G53 moves in machine coordinates.
- **Safer FINISH_JOB/CANCEL_PRINT macros** — relative Z lifts instead of absolute, no G53 XY park.
- **All macros documented** — every G-code command in config files has inline comments.
- **10 unit tests** for WCS reset logic.
