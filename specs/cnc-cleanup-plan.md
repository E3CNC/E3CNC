# CNC Cleanup Plan — Remove 3D-Printer-Only Features

## Goal

Strip all 3D-printer-specific functionality from the Mainsail-CNC fork, retaining only features relevant to CNC machine control (mills, routers, lasers, plasma cutters).

## Guiding Principle

If a feature exists solely because 3D printers need it and CNC machines don't, it goes.
If a feature is generic (temperature control, file management, G-code sending) it stays or gets trimmed.

---

## Phase 1: Farm — Multi-Printer → Multi-CNC

Repurpose the Farm feature for CNC machines instead of 3D printers. Keep all infrastructure, update terminology.

**Files to edit:**

| File | Change |
|---|---|
| `src/routes/index.ts` | Rename path `'/allPrinters'` → `'/allCncMachines'` |
| `src/pages/Farm.vue` | Update display labels from "Printers" → "CNC Machines" |
| `src/components/panels/FarmPrinterPanel.vue` | Rename to `FarmCncPanel.vue`, update labels |
| `src/components/ui/PrinterSelector.vue` | Update display labels |
| `src/components/TheSelectPrinterDialog.vue` | Update display labels |
| `src/components/settings/SettingsRemotePrintersTab.vue` | Rename to `SettingsRemoteCncMachinesTab.vue`, update labels |
| `src/composables/useNavigation.ts` | Update nav label "Printers" → "CNC Machines" |
| `src/components/TheTopbar.vue` | Update printer counter label |
| `src/components/ui/SidebarItem.vue` | Update route path reference |
| `src/locales/en.json` | Update translation keys/values |
| `src/store/farm/printer/` | Rename directory to `cnc/`, update references |
| `src/store/gui/remoteprinters/` | Rename directory to `remotecnc/`, update references |

---

## Phase 2: Remove Bed Mesh / Bed Screws / Bed Tilt

| Action | File |
|---|---|
| **Delete** | `src/composables/useBedMesh.ts` |
| **Delete** | `src/components/dialogs/TheBedScrewsDialog.vue` |
| Edit | `src/App.vue` — remove `<the-bed-screws-dialog />` |
| Edit | `src/store/printer/actions.ts` — remove `bed_mesh` profile handling |
| Edit | `src/store/printer/mutations.ts` — remove `setBedMeshProfiles`, profile deletion |
| Edit | `src/store/printer/getters.ts` — remove `existsBedTilt`, `existsBedScrews` |
| Edit | `src/components/settings/SettingsUiSettingsTab.vue` — remove bed screw toggles |
| Edit | `src/store/gui/types.ts` — remove `boolBedScrewsDialog`, `hideSaveConfigForBedMash` |
| Edit | `src/store/gui/index.ts` — remove default values |

---

## Phase 3: Remove Z-Offset / Z-Tilt / Screws Tilt Adjust

| Action | File |
|---|---|
| **Delete** | `src/composables/useZOffset.ts` |
| **Delete** | `src/components/panels/ToolheadControls/ZoffsetControl.vue` |
| **Delete** | `src/components/dialogs/TheScrewsTiltAdjustDialog.vue` |
| **Delete** | `src/components/dialogs/TheScrewsTiltAdjustDialogEntry.vue` |
| Edit | `src/App.vue` — remove `<the-screws-tilt-adjust-dialog />` |
| Edit | `src/composables/useControl.ts` — remove `existsZtilt`, `existsScrewsTilt`, `doZtilt` |
| Edit | `src/components/panels/ToolheadControls/CircleControl.vue` — remove Z-tilt action |
| Edit | `src/components/panels/ToolheadControls/CrossControl.vue` — remove Z-tilt action |
| Edit | `src/components/panels/ToolheadControlPanel.vue` — remove Z-tilt, Z-offset refs |
| Edit | `src/components/panels/ToolheadControls/ToolheadPanelSettings.vue` — remove `showZOffset` |
| Edit | `src/store/printer/actions.ts` — remove `clearScrewsTiltAdjust` |
| Edit | `src/store/printer/mutations.ts` — remove `clearScrewsTiltAdjust` |
| Edit | `src/store/printer/getters.ts` — remove `existsZtilt`, `existsScrewsTilt` |
| Edit | `src/store/gui/getters.ts` — remove default action `'ztilt'` |
| Edit | `src/store/gui/types.ts` — remove `actionButton`, `offsetZSaveOption`, `boolScrewsTiltAdjustDialog`, `showZOffset` |
| Edit | `src/store/gui/index.ts` — remove defaults |
| Edit | `src/composables/useDashboard.ts` — remove `'zoffset'` panel case |
| Edit | `src/components/settings/SettingsControlTab.vue` — remove Z-offset options |
| Edit | `src/components/settings/SettingsUiSettingsTab.vue` — remove screw tilt toggle |

---

## Phase 4: Remove Filament Sensors, Charts, Maintenance Reminders

| Action | File |
|---|---|
| **Delete** | `src/components/inputs/FilamentSensor.vue` |
| **Delete** | `src/components/charts/HistoryFilamentUsage.vue` |
| Edit | `src/components/panels/MiscellaneousPanel.vue` — remove `FilamentSensor` import |
| Edit | `src/store/printer/getters.ts` — remove `getFilamentSensors` |
| Edit | `src/store/printer/types.ts` — remove `PrinterStateFilamentSensors` |
| Edit | `src/store/variables.ts` — remove filament metadata fields |
| Edit | `src/store/files/types.ts` — remove filament metadata fields |
| Edit | `src/store/gui/maintenance/` — remove filament reminder logic |
| Edit | `src/composables/useHistoryStats.ts` — remove filament aggregation |
| Edit | `src/plugins/helpers.ts` — remove `filamentWeightFormat`, `filamentTextColor` |
| Edit | `src/store/gui/index.ts` — remove filament from calc options |
| Edit | `src/store/gui/types.ts` — remove filament from calc options |

---

## Phase 5: Remove MMU / AFC / Multi-Material

| Action | File |
|---|---|
| **Delete** | `src/plugins/mmuIcons.ts` |
| **Delete** | `src/plugins/afcIcons.ts` |
| Edit | `src/store/variables.ts` — remove `mmu_print`, `'mmu'`, `'afc'` refs |
| Edit | `src/store/gui/types.ts` — remove `view.afc` and `view.mmu` |
| Edit | `src/store/gui/index.ts` — remove `view.afc` and `view.mmu` defaults |
| Edit | `src/store/files/types.ts` — remove `mmu_print` |

---

## Phase 6: Remove Spoolman

| Action | File |
|---|---|
| **Delete** | `src/components/ui/SpoolIcon.vue` |
| Edit | `src/store/variables.ts` — remove `'spoolman'` from `initableServerComponents` |
| Edit | `src/composables/useBase.ts` — remove `spoolman` server config ref |

---

## Phase 7: Remove Extruder-Specific Logic

| Action | File |
|---|---|
| **Delete** | `src/composables/useExtruder.ts` |
| Edit | `src/store/printer/getters.ts` — remove `getExtruders`, `getExtruderStepper`, `canExtrude` |
| Edit | `src/store/variables.ts` — remove `extruder_colors` from `allowedMetadata` |
| Edit | `src/store/files/types.ts` — remove `extruder_colors` |
| Edit | `src/store/gui/types.ts` — remove `extruderColors` from gcodeViewer |
| Edit | `src/store/gui/index.ts` — remove default `extruderColors` |
| Edit | `src/components/gcodeviewer/Viewer.vue` — remove extruder color loading, nozzle diameter |
| Edit | `src/store/farm/printer/getters.ts` — remove extruder key filtering |

---

## Phase 8: Remove Temperature Presets

| Action | File |
|---|---|
| **Delete** | `src/store/gui/presets/` (entire directory) |
| **Delete** | `src/components/settings/Presets/` (entire directory) |
| **Delete** | `src/components/panels/Temperature/TemperaturePanelPresets.vue` |
| Edit | `src/store/gui/index.ts` — remove presets module import |
| Edit | `src/components/TheSettingsMenu.vue` — remove `SettingsPresetsTab` |

---

## Phase 9: Trim Exclude Object from G-code Viewer

| Action | File |
|---|---|
| Edit | `src/components/gcodeviewer/Viewer.vue` — remove exclude-object dialog template, computed refs, printer state subscription |

---

## Phase 10: Build & Verify

1. `bun run build` — zero errors
2. All routes load without console errors: `/`, `/console`, `/files`, `/viewer`, `/history`, `/config`, `/allCncMachines`
3. `bun run vitest run` — all tests pass (update tests for removed helpers)
