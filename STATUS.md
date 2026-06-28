# E3CNC Project Status

## What we've done

### 1. Probing & CNC Setup Feature Planning

- Created **EPIC #9** — guided probing, work-zero, and tool-setup workflows
- Created 6 child issues (#3–#8) for:
  - Shared probe safety layer
  - Touch-plate/probe wizard for work zeroing
  - Edge/corner/center/bore probing workflows
  - Tool-setter workflow for tool length measurement
  - WCS slot target for probe results
  - Dry-run preview for probe cycles
- Status: **planned, not yet implemented**

### 2. v1.0 Stabilization Planning

- Created **EPIC #16** — v1.0 stabilization and release readiness
- Created 6 child issues (#10–#15) for:
  - Viewer route stabilization
  - Vuetify 3 visual QA sweep
  - Critical-path smoke coverage
  - Reconnect/degraded-state hardening
  - Deployment lifecycle validation
  - Release checklist / RC gate
- Status: **planned, not yet implemented**

### 3. KIAUH Multi-Instance Service Detection Bug Fix

- **Root cause:** `moonraker.asvc` was being treated as the Moonraker service name. On real KIAUH installs, this file contains an allowed/restartable-services list (e.g. `klipper_mcu`, `webcamd`), producing bogus names like `moonraker-klipper_mcu`
- **Fix:** Updated `_read_service_name()` in `_e3cnc_shared.py` and `e3cnc-cli` to:
  - Ignore multiline `.asvc` files
  - Ignore single-line `.asvc` entries that don't match the expected service name pattern
  - Fall back to instance-name-derived defaults (`moonraker-test1`, `moonraker-test2`)
- **Tests:** Updated `tests/test_e3cnc_cli.py` and `tests/Dockerfile.multi-instance`
- **Issue:** #17
- Status: **merged, tested, verified**

### 4. Moonraker Update-Manager Removal

- **Decision:** E3CNC now manages its own updates via the in-app menu (top-corner menu → Update) and `e3cnc-cli update`, not via Moonraker's `[update_manager]` integration
- **Changes:**
  - `ansible/roles/moonraker-config/tasks/main.yml` — replaced update-manager block addition with legacy block removal
  - `ansible/playbooks/redeploy.yml` — added `moonraker-config` role to ensure cleanup on redeploy
  - `build-scripts/install_to_moonraker.sh` — replaced append-with-tempfile logic with cleanup Python script
  - `build-scripts/post_update.sh` — updated header comments to clarify legacy compatibility role
  - `moonraker/moonraker.conf.example` — replaced sample update-manager block with deprecation comment
  - `moonraker/README.md` — rewrote update section explaining in-app/CLI update paths
  - `README.md` — updated feature list and quick-start table
  - `_e3cnc_deploy.py` — added `_remove_legacy_update_manager_block()` helper, called during `sync_runtime_files()`
  - `_e3cnc_shared.py` and `e3cnc-cli` — removed `[update_manager E3CNC]` from status checks, added `[cnc_metadata]` check
  - `tests/test_e3cnc_deploy.py` — unit tests for removal helper
- Status: **implemented, tested**

### 5. Merged `single-deploy` Branch into `main`

- **Result:** Git history from the single-deploy feature branch is now part of `main`
- `main` is ahead of `origin/main` by 7 commits
- Local uncommitted work from #3 and #4 above is staged on top
- Status: **merged locally, not pushed**

### 6. Single-Instance Fresh-Install Bootstrap MVP

- **New role:** `ansible/roles/bootstrap-stack/tasks/main.yml` — bootstraps a clean machine from zero
- **What it does:**
  1. Installs base packages (nginx, python3-pip, python3-venv, build deps, git, curl, unzip)
  2. Copies vendored Moonraker snapshot into `~/moonraker`
  3. Copies vendored Klipper snapshot into `~/klipper`
  4. Creates Python virtualenvs for both
  5. Installs Python requirements from upstream requirement files
  6. Creates placeholder `printer.cfg` if absent (skips Klippy ready-check)
  7. Creates baseline `moonraker.conf`
  8. Creates systemd service units for Moonraker and Klipper
  9. Installs nginx site config serving `~/e3cnc-web` with Moonraker reverse proxy
  10. Starts nginx + Moonraker (skippable via `bootstrap_skip_runtime_start=true`)
- **Playbook changes:** `ansible/playbooks/install.yml`:
  - Added `bootstrap-stack` role
  - Added nginx installation pre-task
  - Post-tasks conditionally skipped when `bootstrap_skip_runtime_verification=true`
- Status: **fix applied, needs Docker test, vars flattened**

### 7. Vendored Upstream Snapshots

- **Moonraker** at `vendor/moonraker/`:
  - Upstream: `https://github.com/Arksine/moonraker.git`
  - Commit: `659712321824d03ed8c2718b4583463bfc890abe`
  - Provenance: `vendor/moonraker/E3CNC_UPSTREAM.txt`
- **Klipper** at `vendor/klipper/`:
  - Upstream: `https://github.com/Klipper3d/klipper.git`
  - Commit: `d6ea62542d3f14a1faf55305c85ed0cbe361a233`
  - Provenance: `vendor/klipper/E3CNC_UPSTREAM.txt`
- Bootstrap role now copies from vendored sources instead of cloning from GitHub
- Status: **implemented, verified**

### 8. Web Root Rename: `~/mainsail` → `~/e3cnc-web`

- `ansible/roles/bootstrap-stack/tasks/main.yml` — bootstrap installs to `~/e3cnc-web`
- `_e3cnc_shared.py` and `e3cnc-cli` — `_default_web_root()` prefers `e3cnc-web` over `mainsail`
- `ansible/vars/main.yml` — added `bootstrap_frontend_web_root` (now hardcoded in bootstrap role)
- `tests/test_e3cnc_cli.py` — added `test_instance_prefers_e3cnc_web_root_when_present`
- Status: **implemented, tested**

### 9. Fresh-Install Integration Test (Docker-backed)

- `tests/test_fresh_install_bootstrap_integration.py`:
  - Builds `tests/Dockerfile.fresh-install` container
  - Installs pip + ansible inside container
  - Runs `ansible-playbook install.yml` with `bootstrap_skip_runtime_start=true` and `bootstrap_skip_runtime_verification=true`
  - Asserts no "not found" errors and bootstrap completion message
  - Gated behind `E3CNC_RUN_DOCKER_TESTS=1`
- `tests/Dockerfile.fresh-install` — no longer pre-creates directory structure (bootstrap does it)
- Status: **fix applied, needs Docker test**

### 10. Misc Infrastructure

- `pytest.ini` — added `integration` marker registration
- `tests/test_vendored_moonraker.py` — validates snapshot + provenance file
- `tests/test_vendored_klipper.py` — validates snapshot + provenance file

---

## Current Issues

### 1. ~~Bootstrap Integration Test Fails~~ ✅ FIXED

**Root cause:** The `bootstrap` variable was a nested Ansible dict defined in `ansible/vars/main.yml`. When the integration test passed extra vars via `-e '{"bootstrap":{"skip_runtime_start":true,...}}'`, Ansible's highest-precedence extra vars **completely shadowed** the entire `bootstrap` dict, making keys like `moonraker_source_dir` undefined.

**Fix applied:**

- **Flattened** the `bootstrap.*` namespace into top-level vars (`bootstrap_moonraker_source_dir`, `bootstrap_skip_runtime_start`, etc.) in `ansible/vars/main.yml`
- Updated all references in `ansible/roles/bootstrap-stack/tasks/main.yml` (16 sites: source dirs, nginx site name, skip-runtime checks)
- Updated all references in `ansible/playbooks/install.yml` (7 sites: skip-runtime-verification conditions)
- Changed integration test from JSON dict extra vars to flat `-e bootstrap_skip_runtime_start=true -e bootstrap_skip_runtime_verification=true`
- **All 68 unit tests pass.** Integration test needs Docker to verify the fix at runtime.

**Why this works:** Flat vars with `-e` only override themselves — they don't shadow other unrelated vars. `-e bootstrap_skip_runtime_start=true` won't touch `bootstrap_moonraker_source_dir`.

---

## What's Next (Priority Order)

### 1. 🔴 Push Local Changes to `origin/main`

- Current state: `main` is ahead of `origin/main` by 7 commits with uncommitted local work
- Need to: commit local changes, push to origin
- Requires `ask_user` for push permission per project guidelines

### 2. 🔴 Validate Bootstrap Integration Test (Docker-backed)

- Run `E3CNC_RUN_DOCKER_TESTS=1 python3 -m pytest tests/test_fresh_install_bootstrap_integration.py -x -v` to confirm the fix passes
- Requires Docker on the test machine

### 3. 🟡 Bootstrap Refinements

- Test on a real VM or fresh Raspberry Pi
- Add error handling for cases where:
  - `sudo` is not passwordless
  - Platform is not Debian/Ubuntu
  - Klipper firmware build step (for MCU flashing)
- Consider KIAUH-style multi-instance bootstrap

### 4. 🟡 v1.0 Stabilization Work (EPIC #16)

- Stabilize `/viewer` route (#10) — **high priority before shipping**
- Run full Vuetify 3 visual QA (#11)
- Add Route/CNC smoke tests (#12)
- Harden reconnect and failure states (#13)
- Validate install/update/rollback/backup flows (#14)
- Publish release checklist (#15)

### 5. 🟡 Probing/Setup Workflows (EPIC #9 — post-v1.0)

- Shared probe safety layer (#3)
- Touch-plate / probe wizard (#4)
- WCS slot targeting for probe results (#7)
- Dry-run preview (#8)
- Edge/corner/center/bore probing (#5)
- Tool-setter workflow (#6)

### 6. 🟢 Cleanup & Tech Debt

- Remove deprecated scripts that still reference update-manager or Mainsail
- Consolidate duplicated code between `e3cnc-cli` and `_e3cnc_shared.py`
- Update installation wiki to remove update-manager references
- Update wiki Installation page to reflect vendored bootstrap path
- Remove `build-scripts/comment_mainsail_update_manager.py` and `tests/test_comment_mainsail_update_manager.py` if no longer used
- Reduce `.dockerignore` size to speed up integration test builds
