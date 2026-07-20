# E3CNC Beta Test Plan

**Target**: E3CNC v0.9.10+ (Pure Go CLI + multi-instance)  
**Audience**: Beta testers (familiar with Klipper/Moonraker/CNC basics)  
**Goal**: Validate stability, CNC workflows, and upgrade safety before general release.

---

## 🧪 Core Stability Tests

### 1. Multi‑instance Isolation

- **Steps**:
  1. Create two instances: `e3cnc-tui init-config --instance mytest` and `e3cnc-tui init-config --instance mytest2`.
  2. Verify each has its own directory under `~/E3CNC/instances/<name>/`.
  3. Change a setting (e.g., `max_velocity`) in `mytest`'s `printer.cfg`.
  4. Confirm `mytest2`'s `printer.cfg` is unchanged.
  5. In Mainsail, switch between instances and check the **Machine** tab shows the correct `.cfg` files for each.
- **Expected**: No cross‑talk; each instance manages its own files.

### 2. Vue 3 Migration Validation

- **Steps**:
  1. Open Chrome DevTools (non‑headless, remote‑debugging port 9222).
  2. Navigate to each of the seven core routes:
     - `/` (Dashboard)
     - `/allPrinters` (Farm)
     - `/cam` (Webcam)
     - `/console` (MDI)
     - `/files` (G‑Code Files)
     - `/history`
     - `/timelapse`
  3. For each page:
     - Confirm **zero** errors/warnings in the Console tab.
     - Ensure layout renders correctly at 1024×768 and 1920×1080.
     - Look for any leftover Vue 2 patterns (`$vuetify.breakpoint`, `Vue.component`, etc.) – none should appear.
- **Expected**: Clean console, responsive UI, pure Vue 3/Vuetify 3.

---

## ⚙️ CNC‑Specific Workflow Tests

### 3. Probing Workflows (EPICs #3‑9)

| Workflow                                  | Test Steps                                                                                                                                                      | Success Criteria                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Touch‑plate / Work Zero**               | - Attach a touch plate.<br>- Run the probe wizard.<br>- After probing, check that the selected WCS (G54‑G59) is updated with the new zero.                      | New zero persists in the selected WCS; machine moves correctly to the zeroed position.  |
| **Dry‑run Preview**                       | - Enable dry‑run mode in the probe settings.<br>- Start a probe cycle.<br>- Observe the on‑screen preview showing the planned offset before it is applied.      | Preview displays the offset; applying the probe updates the coordinate system as shown. |
| **Tool‑Setter**                           | - Install a tool‑setter probe.<br>- Change a tool manually.<br>- Trigger the tool‑sensor macro.<br>- Verify the tool length offset is updated and stored.       | Tool length offset changes correctly; subsequent moves respect the new length.          |
| **Edge / Corner / Center / Bore Probing** | - For each probe type, run the corresponding macro.<br>- Check that the probe completes without errors and updates the workpiece coordinate system accordingly. | All probing types generate valid motion and set the expected work offsets.              |

### 4. Safety Layer Verification

- **Steps**:
  1. Enable the shared safety layer (already active in probe macros).
  2. Intentionally trigger a fault during probing (e.g., hit a soft limit or simulate a probe failure).
  3. Observe that the machine stops immediately, goes into a safe state, and displays an alert.
  4. Follow the recovery procedure (reset, clear fault, re‑home if needed).
- **Expected**: Machine halts safely, no damage, clear error message, and recovery returns to a known state.

---

## 🛠️ CLI & Deployment Tests

### 5. Config Generation (`e3cnc-tui init-config`)

- **Steps**:
  1. Run `e3cnc-tui init-config` (optionally specify an instance).
  2. Inspect the generated `printer.cfg`.
  3. Verify presence of:
     - `[virtual_sdcard]` with `path: {printer_data_dir}/gcodes`
     - `[save_variables]` with `filename: {printer_data_dir}/variables.cfg`
     - All critical sections (mcu, printer, steppers, etc.) are present and contain helpful `!!! ADJUST` comments where needed.
     - No stray `!!! ADJUST` markers in sections that must be filled (e.g., `serial:` if MCU was detected).
- **Expected**: Config is ready to edit; no missing required sections.

### 6. Update Pipeline (`e3cnc-tui update` / Nightly)

- **Steps**:
  1. Trigger an update: `e3cnc-tui update` or wait for the nightly GitHub Action to push a new ZIP.
  2. Confirm the update runner:
     - Runs pre‑flight health checks.
     - Backs up current state.
     - Downloads and verifies the new artifact.
     - Activates the release.
     - Restarts services (Moonraker, Klipper, nginx).
     - Executes post‑update health checks.
  3. Simulate a health‑check failure (e.g., temporarily stop Moonraker) and verify the system automatically rolls back to the previous known‑good version.
  4. Ensure the `/releases/` directory retains the configured number of old releases (default 2).
- **Expected**: Smooth, atomic updates; rollback on failure; no manual intervention needed.

---

## 👤 User Experience Tests

### 7. First‑Run Flow

- **Steps**:
  1. Start with a fresh E3CNC image (or a clean `~/E3CNC` directory).
  2. Run `e3cnc-tui install` (if testing full install) or just `e3cnc-tui init-config`.
  3. Manually edit the generated `printer.cfg` to set at least:
     - MCU serial path
     - Stepper pins/directions
     - Travel limits (`position_max` for X/Y/Z)
     - Spindle/coolant configuration (if applicable)
  4. Restart Klipper: `sudo systemctl restart klipper` (or via the service manager).
  5. Open the web interface (Mainsail) and confirm:
     - No error banners.
     - The **Machine** tab lists `printer.cfg`, `moonraker.cfg`, `mainsail.cfg`.
     - Jogging axes works in the correct direction.
     - Spindle on/off (or PWM) responds as configured.
- **Expected**: From zero to a responsive CNC interface with basic manual control functioning.

---

## 📊 Non‑Functional Checks

| Area             | Check                                                                                           | Pass Criteria                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Performance**  | Page load time (first paint) on a RPi‑4‑class device                                            | < 3 seconds for core pages                                                                    |
| **Logs**         | Review `~/E3CNC/logs/installer.log` and `journal.json` after 10 min of idle                                | No repetitive warnings/errors; only expected startup/shutdown messages                        |
| **Backup**       | Run `e3cnc-tui backup` → verify archive → restore to a test location                            | Backup contains `config/`, `scripts/`, `database/`; restore brings system back to exact state |
| **Low‑RAM Mode** | Simulate a 1 GB RAM device by disabling the Vite dev server and using the pre‑built nightly ZIP | UI loads without OOM kills; interaction remains responsive                                    |

---

## 📝 How to Report

When you find an issue (or confirm a success), please include:

1. **Test ID** (e.g., “1. Multi‑instance isolation – step 3”)
2. **Exact steps** you performed (commands, clicks, settings changed)
3. **Expected outcome** vs **what actually happened**
4. **Relevant logs/screenshots**:
   - Browser console (copy‑paste or screenshot)
   - `journal.json` tail (last 20 lines)
   - Mainsail Machine tab view (if file listing is wrong)
5. **Instance name** used (e.g., `mytest`)
6. **Any workaround** you discovered

Please add your findings as a comment to the relevant GitHub issue or, if this is a new problem, open a new issue with the label `beta-test`.

---

**Thank you for helping improve E3CNC!**  
_Maintainers: @Futtawuh (Ravenkeeper) & the E3CNC team_
