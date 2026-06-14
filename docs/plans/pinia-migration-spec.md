# Vuex → Pinia Migration Spec

**Status:** Draft
**Branch:** `vue3-migration` (continuation)
**Prerequisite:** Vue 3.5 + Vuetify 3 migration complete (all phases done)

---

## 1. Overview

Migrate the entire Vuex 4 store (28 namespaced modules, 150+ files) to Pinia. Pinia (`^2.3.0`) is already installed but unused. This migration eliminates Vuex boilerplate (mutations, `{ root: true }` dispatches, namespaced getter strings), enables proper TypeScript inference, and aligns with the Vue 3 ecosystem standard.

### Goals

- Replace all 28 Vuex modules with Pinia stores
- Eliminate the mutation layer entirely (Pinia has no mutations)
- Replace 100+ `{ root: true }` cross-module dispatches with direct store-to-store calls
- Type all store access properly (no more `store.getters['module/getter']` strings)
- Remove the `vuex` dependency from `package.json`
- Preserve all existing functionality with zero runtime regressions

### Non-Goals

- Refactoring state shape or store boundaries (migration-only, not a redesign)
- Migrating `runtime.ts` singletons (`getSocket`/`$toast`) — these stay as module-level singletons
- Migrating the orphaned `gui/reminders` module (dead code, will be deleted)

---

## 2. Current State Summary

### Architecture

| Aspect | Current |
|--------|---------|
| Store manager | Vuex 4 (`createStore`) |
| Module count | 28 namespaced modules across 8 top-level domains |
| Files | 150+ (index, types, state, getters, mutations, actions per module) |
| Pinia | Installed (`^2.3.0`), zero usage |
| Plugins | None |
| Subscriptions | None |
| Dynamic modules | `farm/printer` (registerModule/unregisterModule) |
| Cross-module calls | 100+ `{ root: true }` dispatches/commits |
| Component access | `useStore()` from vuex (untyped), `store.state.x.y`, `store.getters['x/y']`, `store.dispatch('x/y')` |
| Composables | 16 composables in `src/composables/`, all use `useStore()` |

### Module Inventory

```
Root (5 state keys, 3 getters, 3 mutations, 4 actions)
├── socket          (11 state, 3 getters, 8 mutations, 11 actions)
├── server          (22 state, 6 getters, 22 mutations, 20 actions)
│   ├── power       (1 state, 1 getter, 3 mutations, 5 actions)
│   ├── updateManager (6 state, 1 getter, 5 mutations, 3 actions)
│   ├── history     (6 state, 10 getters, 7 mutations, 9 actions)
│   ├── timelapse   (3 state, 0 getters, 4 mutations, 7 actions)
│   ├── jobQueue    (2 state, 2 getters, 3 mutations, 11 actions)
│   ├── announcements (2 state, 1 getter, 4 mutations, 6 actions)
│   └── sensor      (1 state, 1 getter, 3 mutations, 4 actions)
├── printer         (dynamic state, 28+ getters, 7 mutations, 11 actions)
│   └── tempHistory (4 state, 10 getters, 6 mutations, 4 actions)
├── files           (2 state, 14 getters, 17 mutations, 16 actions)
├── gui             (8 nested state, 7 getters, 17 mutations, 20 actions)
│   ├── console     (8 state, 2 getters, 2 mutations, 2 actions)
│   ├── gcodehistory (1 state, 1 getter, 3 mutations, 4 actions)
│   ├── macros      (3 state, 3 getters, 8 mutations, 8 actions)
│   ├── miscellaneous (1 state, 1 getter, 5 mutations, 5 actions)
│   ├── navigation  (1 state, 0 getters, 2 mutations, 5 actions)
│   ├── notifications (1 state, 2 getters, 2 mutations, 2 actions)
│   ├── presets     (2 state, 3 getters, 4 mutations, 4 actions)
│   ├── remoteprinters (1 state, 1 getter, 4 mutations, 7 actions)
│   ├── maintenance (1 state, 2 getters, 4 mutations, 8 actions)
│   └── webcams     (1 state, 1 getter, 2 mutations, 5 actions)
├── farm            (dynamic state, 5 getters, 0 mutations, 3 actions)
│   └── printer     (dynamic state, 4 getters, 7 mutations, 10 actions)
├── editor          (9 state, 1 getter, 9 mutations, 6 actions)
└── gcodeviewer     (3 state, 0 getters, 3 mutations, 3 actions)
```

---

## 3. Migration Strategy

### 3.1 Approach: Bottom-Up, Module by Module

Migrate leaf modules first (no downstream dependents), then work up to modules that depend on others. Use a **compatibility shim** during the transition so both Vuex and Pinia coexist.

### 3.2 Compatibility Shim

During the migration, a `createCompatibilityStore()` wrapper allows Pinia stores to be accessed via the old Vuex path strings. This lets us migrate incrementally without rewriting all 100+ component `store.dispatch()` calls at once.

```ts
// src/store/compat.ts — temporary, deleted after full migration
import { createPinia, setActivePinia, defineStore } from 'pinia'

// Re-exports Pinia stores under Vuex-like namespace paths
// Used by unmigrated components during transition
```

### 3.3 Migration Order

Ordered by dependency (dependents migrate after their dependencies):

| Wave | Modules | Rationale |
|------|---------|-----------|
| 0 | Setup Pinia in main.ts, create `compat.ts` | Infrastructure |
| 1 | `gcodeviewer`, `editor` | No dependents, simple state |
| 2 | `socket` | Foundation — many modules depend on it |
| 3 | `server` + all 7 sub-modules | Depends on socket |
| 4 | `printer` + `tempHistory` | Depends on server |
| 5 | `files` | Depends on printer, server |
| 6 | `gui` + all 10 sub-modules | Depends on printer, files, server |
| 7 | `farm` + `farm/printer` | Dynamic modules, depends on gui, server |
| 8 | Root store (state, getters, mutations, actions) | Top-level, depends on all |
| 9 | Delete Vuex, remove shim, clean up | Finalization |

---

## 4. Detailed Phase Plans

### Phase 0: Pinia Infrastructure

**Files to create/modify:**
- `src/store/pinia.ts` — `createPinia()` instance export
- `src/main.ts` — `app.use(pinia)` alongside `app.use(store)` (both active)
- `src/types/vuex.d.ts` — keep during transition, delete at end

**Acceptance criteria:**
- `import { useXStore } from '@/stores/x'` works in any component
- Existing Vuex store still functions unchanged
- `bun run build` passes

### Phase 1: Leaf Modules (gcodeviewer, editor)

**Files to create:**
- `src/stores/gcodeviewer.ts`
- `src/stores/editor.ts`

**Pattern for each migration:**

```ts
// Before (Vuex): 6 files — index.ts, types.ts, state.ts, getters.ts, mutations.ts, actions.ts
// After (Pinia): 1 file — editor.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSocket, $toast } from '@/store/runtime'

export const useEditorStore = defineStore('editor', () => {
  // State → refs
  const bool = ref(false)
  const filename = ref('')
  const sourcecode = ref('')
  // ...

  // Getters → computed
  const getKlipperRestartMethod = computed(() => { ... })

  // Mutations → inline (just set ref values)

  // Actions → functions
  async function openFile(payload: { ... }) { ... }
  async function saveFile() { ... }

  return { bool, filename, sourcecode, getKlipperRestartMethod, openFile, saveFile }
})
```

**Component migration pattern:**

```ts
// Before
import { useStore } from 'vuex'
const store = useStore()
store.dispatch('editor/openFile', payload)
computed(() => store.state.editor.filename)

// After
import { useEditorStore } from '@/stores/editor'
const editor = useEditorStore()
editor.openFile(payload)
computed(() => editor.filename)
```

**Acceptance criteria:**
- Editor opens, saves, and closes files correctly
- G-code viewer backup/restore works
- `bun run build` passes

### Phase 2: Socket Module

**Files to create:**
- `src/stores/socket.ts`

**Special considerations:**
- The socket module is the message router — `onMessage` dispatches to all other modules
- During transition, it needs to call into both Vuex and Pinia modules
- Use the compat shim or direct imports of other Pinia stores as they migrate

**Key state:**
```ts
const hostname = ref('')
const port = ref(0)
const path = ref('/')
const isConnected = ref(false)
const isConnecting = ref(false)
const loadings = ref<string[]>([])
const initializationList = ref<string[]>([])
```

**Key complexity:**
- `onMessage` is a large switch/router that dispatches to ~8 different modules
- During transition: call migrated stores directly, keep `{ root: true }` for unmigrated ones
- After all modules migrate: all calls become direct store method calls

**Acceptance criteria:**
- WebSocket connects, reconnects, and routes messages correctly
- Loading states and initialization tracking work
- `bun run build` passes

### Phase 3: Server Module + Sub-modules

**Files to create:**
- `src/stores/server.ts`
- `src/stores/server/power.ts`
- `src/stores/server/updateManager.ts`
- `src/stores/server/history.ts`
- `src/stores/server/timelapse.ts`
- `src/stores/server/jobQueue.ts`
- `src/stores/server/announcements.ts`
- `src/stores/server/sensor.ts`

**Special considerations:**
- `server/history` has 10 computed getters (heaviest getter set)
- `server/timelapse` has 25+ settings state keys
- Cross-module: server actions dispatch to `printer/init`, `gui/saveSetting`, `files/getMetadata`

**Sub-module access pattern (Pinia):**
```ts
// Access a nested Pinia store from another store
import { useServerPowerStore } from '@/stores/server/power'

export const useServerStore = defineStore('server', () => {
  // Use power store internally if needed
  // Or expose as a separate store — components import what they need
})
```

**Decision: Flat vs nested stores.** Pinia doesn't have nested modules. Two options:
- **Option A:** Flat stores (`server`, `serverPower`, `serverHistory`, etc.) — simple, independent
- **Option B:** One `useServerStore` with sub-sections — mirrors Vuex nesting

**Recommendation: Option A (flat).** Each sub-module becomes its own `defineStore`. Components import only what they need. Cross-store dependencies are direct imports.

**Acceptance criteria:**
- Moonraker server state populates correctly
- Power devices toggle
- Update manager shows repos and updates
- Print history loads, notes save
- Timelapse settings save/load
- Job queue operations work
- Announcements dismiss
- Sensor data updates
- `bun run build` passes

### Phase 4: Printer Module + TempHistory

**Files to create:**
- `src/stores/printer.ts`
- `src/stores/printer/tempHistory.ts`

**Special considerations:**
- **Dynamic state keys** — printer state mirrors Klipper's object hierarchy. State is `{ [key: string]: any }`.
- With Pinia, use `ref<Record<string, any>>({})` and a `setData(key, value)` action that merges incoming data
- 28+ getters — many are derived from the dynamic state (e.g., `getExtruders` filters `printer.extruder*` keys)
- `tempHistory` maintains rolling time-series data with source/series arrays

**State pattern for dynamic keys:**
```ts
const printerState = ref<Record<string, any>>({})

function setData(data: Record<string, any>) {
  for (const [key, value] of Object.entries(data)) {
    printerState.value[key] = value
  }
}
```

**Acceptance criteria:**
- Printer state (temps, position, print progress, macros) populates from Klipper
- Temperature history chart renders with live data
- All 28+ getters return correct computed values
- `bun run build` passes

### Phase 5: Files Module

**Files to create:**
- `src/stores/files.ts`

**Special considerations:**
- Upload state machine (show, filename, progress, speed, cancel token)
- File tree is deeply nested recursive structure
- 14 getters including metadata lookups, thumbnail resolution, disk usage
- Depends on: `printer` (current file), `server` (registered directories)

**Acceptance criteria:**
- File browser loads directories, shows metadata, thumbnails
- File upload with progress works
- File delete/move/create operations work
- `bun run build` passes

### Phase 6: GUI Module + Sub-modules

**Files to create:**
- `src/stores/gui.ts`
- `src/stores/gui/console.ts`
- `src/stores/gui/gcodehistory.ts`
- `src/stores/gui/macros.ts`
- `src/stores/gui/miscellaneous.ts`
- `src/stores/gui/navigation.ts`
- `src/stores/gui/notifications.ts`
- `src/stores/gui/presets.ts`
- `src/stores/gui/remoteprinters.ts`
- `src/stores/gui/maintenance.ts`
- `src/stores/gui/webcams.ts`

**Special considerations:**
- **Heaviest module** — 10 sub-modules, complex nested state, persisted to Moonraker DB
- `gui/index.ts` has 20 actions, many involving DB save/restore
- `gui/presets` — temperature presets used by control components
- `gui/macros` — macro groups with dynamic creation/update/delete
- `gui/miscellaneous` — LED/tool groups with upload/store lifecycle
- `gui/remoteprinters` — triggers `farm/registerPrinter` (cross-store dependency)
- Delete `gui/reminders` (orphaned, dead code)

**DB persistence pattern:**
```ts
// Current: gui/saveSetting commits to Vuex, then dispatches to Moonraker DB
// After: gui/saveSetting is a Pinia action that writes ref + calls Moonraker API
```

**Acceptance criteria:**
- All GUI settings persist to Moonraker DB and restore on reload
- Dashboard layout, panel arrangement, themes work
- Console filters, gcode history, macro groups work
- Webcam, preset, maintenance, notification settings work
- Remote printer configuration works
- `bun run build` passes

### Phase 7: Farm Module + Dynamic Sub-modules

**Files to create:**
- `src/stores/farm.ts`
- `src/stores/farm/printer.ts`

**Special considerations:**
- **Dynamic module registration** — Vuex uses `registerModule`/`unregisterModule`. Pinia equivalent: create/destroy store instances programmatically.
- Each farm printer gets its own WebSocket connection and state
- Pattern: maintain a `Map<string, ReturnType<typeof useFarmPrinterStore>>` or use Pinia's `const store = useStore()` with unique IDs

**Dynamic store pattern:**
```ts
import { defineStore, setActivePinia, createPinia } from 'pinia'

export const useFarmStore = defineStore('farm', () => {
  const printers = ref<Record<string, ReturnType<typeof useFarmPrinterStore>>>({})

  function registerPrinter(id: string, config: FarmPrinterConfig) {
    // Each farm printer gets its own Pinia store instance
    // Use a unique pinia instance per printer, or use a single store with dynamic keys
    printers.value[id] = createPrinterStore(id, config)
  }

  function unregisterPrinter(id: string) {
    printers.value[id].disconnect()
    delete printers.value[id]
  }
})
```

**Decision: One store with dynamic keys vs. factory-created stores.**
- **Recommendation:** One `useFarmStore` with a `printers: Ref<Map<string, PrinterState>>`. Each printer's state is a reactive object within the map. Actions on a printer take the `id` parameter. This avoids the complexity of dynamic Pinia store instances.

**Acceptance criteria:**
- Add/remove remote printers works
- Each farm printer connects, receives data, and displays in farm view
- Farm printer state (print progress, temps) updates live
- `bun run build` passes

### Phase 8: Root Store Migration

**Files to modify:**
- `src/store/index.ts` → delete or repurpose as re-export
- `src/store/types.ts` → delete (types move into individual stores)
- `src/store/actions.ts` → delete (root actions move to relevant stores)
- `src/store/mutations.ts` → delete
- `src/store/getters.ts` → delete
- `src/store/variables.ts` → keep (constants, not store-related)

**Root state → Pinia:**
```ts
// src/stores/app.ts — replaces root state
export const useAppStore = defineStore('app', () => {
  const packageVersion = ref(import.meta.env.PACKAGE_VERSION || '0.0.0')
  const debugMode = ref(import.meta.env.VUE_APP_DEBUG_MODE || false)
  const naviDrawer = ref<boolean | null>(null)
  const instancesDB = ref<'moonraker' | 'browser' | 'json'>('moonraker')
  const configInstances = ref<ConfigJsonInstance[]>([])

  // Root getters
  const getVersion = computed(() => packageVersion.value)
  const getTitle = computed(() => 'Mainsail')
  const getDependencies = computed(() => [...])

  // Root actions
  async function switchToDashboard() { ... }
  async function changePrinter(payload: ConfigJsonInstance) { ... }

  return { packageVersion, debugMode, naviDrawer, instancesDB, configInstances, ... }
})
```

**Acceptance criteria:**
- App version, debug mode, navi drawer, instance DB all work
- `bun run build` passes

### Phase 9: Component Migration + Cleanup

**Scope:** Update every component and composable that accesses the store.

**Files to update:**
- ~100+ component files with `store.dispatch`/`store.state`/`store.getters`
- 16 composables in `src/composables/`
- `src/main.ts` — remove `app.use(store)`, keep only `app.use(pinia)`

**Batch migration pattern (use sed/AST):**

```ts
// Before
import { useStore } from 'vuex'
const store = useStore()
store.dispatch('gui/saveSetting', { name: 'x', value: 1 })
store.state.printer.print_stats?.state
store.getters['printer/getPrintPercent']

// After
import { useGuiStore } from '@/stores/gui'
import { usePrinterStore } from '@/stores/printer'
const gui = useGuiStore()
const printer = usePrinterStore()
gui.saveSetting({ name: 'x', value: 1 })
printer.printerState.print_stats?.state
printer.getPrintPercent
```

**Search-and-replace patterns:**

| Vuex pattern | Pinia replacement |
|-------------|-------------------|
| `store.dispatch('module/action', payload)` | `useModuleStore().action(payload)` |
| `store.dispatch('module/action', payload, { root: true })` | Direct call to target store |
| `store.commit('module/mutation', payload)` | Direct ref assignment |
| `store.state.module.key` | `useModuleStore().key` |
| `store.getters['module/getter']` | `useModuleStore().getter` |
| `useStore()` from vuex | Specific `useXStore()` from pinia |

**Files to delete (after full migration):**
- `src/store/index.ts`
- `src/store/types.ts`
- `src/store/actions.ts`
- `src/store/mutations.ts`
- `src/store/getters.ts`
- `src/store/socket/` (entire directory)
- `src/store/server/` (entire directory)
- `src/store/printer/` (entire directory)
- `src/store/files/` (entire directory)
- `src/store/gui/` (entire directory)
- `src/store/farm/` (entire directory)
- `src/store/editor/` (entire directory)
- `src/store/gcodeviewer/` (entire directory)
- `src/types/vuex.d.ts`

**Files to keep:**
- `src/store/runtime.ts` — `getSocket()`/`setSocket()`/`$toast` singletons (not store-related)
- `src/store/variables.ts` — constants (themes, extensions, colors, limits)
- `src/store/files/cncMetadata.ts` — pure utility functions
- `src/store/files/cncApi.ts` — pure utility functions

**Acceptance criteria:**
- Zero `import { useStore } from 'vuex'` in codebase
- Zero references to `store.dispatch`, `store.commit`, `store.state`, `store.getters` with Vuex patterns
- `vuex` removed from `package.json`
- `src/types/vuex.d.ts` deleted
- All 7+ routes verified in Chrome DevTools with zero console errors
- `bun run build` passes

---

## 5. Cross-Cutting Concerns

### 5.1 Type Safety

Each Pinia store file exports its state interface:

```ts
// src/stores/editor.ts
export interface EditorState {
  bool: boolean
  filename: string
  permissions: string[]
  // ...
}

export const useEditorStore = defineStore('editor', () => {
  // state, getters, actions...
})
```

Components get full autocomplete:
```ts
const editor = useEditorStore()
editor.filename  // ✅ autocomplete
editor.nonexistent  // ❌ type error
```

### 5.2 Cross-Store Dependencies

**Pattern:** Direct imports. No more `{ root: true }`.

```ts
// In gui/presets store — needs to send gcode via printer store
import { usePrinterStore } from '@/stores/printer'

export const useGuiPresetsStore = defineStore('guiPresets', () => {
  const printer = usePrinterStore()

  function applyPreset(preset: Preset) {
    printer.sendGcode(preset.gcode)
  }
})
```

**Circular dependency prevention:** If store A imports B and B imports A, extract shared logic into a composable or a third store. Pinia handles this via late-binding (`useStore()` must be called inside functions, not at module scope for circular refs).

### 5.3 Runtime Singletons (`runtime.ts`)

**No change.** `getSocket()`/`setSocket()`/`$toast` remain as module-level singletons. Pinia stores import them directly:

```ts
import { getSocket, $toast } from '@/store/runtime'

// Inside a store action
getSocket().emit('server.database.list')
$toast.success('Saved')
```

### 5.4 Dynamic Module Registration (Farm)

Pinia does not have `registerModule`. The farm store manages dynamic printers via a reactive map:

```ts
export const useFarmStore = defineStore('farm', () => {
  const printers = ref(new Map<string, FarmPrinterState>())

  async function registerPrinter(id: string, config: PrinterConfig) {
    const printerState = reactive(createDefaultFarmPrinterState(id, config))
    printers.value.set(id, printerState)
    await connectPrinter(printerState)
  }

  async function unregisterPrinter(id: string) {
    const printer = printers.value.get(id)
    if (printer) {
      printer.socket.instance?.close()
      printers.value.delete(id)
    }
  }
})
```

### 5.5 Testing

Pinia stores are plain functions. Test them directly:

```ts
import { setActivePinia, createPinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'

describe('editor store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens a file', async () => {
    const editor = useEditorStore()
    await editor.openFile({ filename: 'test.cfg', permissions: ['r'] })
    expect(editor.filename).toBe('test.cfg')
    expect(editor.bool).toBe(true)
  })
})
```

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking WebSocket message routing | Migrate `socket.onMessage` last for its dispatch targets; test each route |
| Farm dynamic module registration | Prototype early (Phase 7), validate with multiple printers |
| Cross-store circular imports | Use late-binding `useStore()` in actions, not top-level imports |
| Component access regression | Migrate components in same wave as their store; build + manual QA per wave |
| Missing mutations → race conditions | Pinia actions are synchronous by default; use `pinia.devtools` to verify |
| Large blast radius | Each phase is independently shippable; old and new coexist during transition |

---

## 7. Acceptance Criteria (Global)

- [ ] Zero `import { useStore } from 'vuex'` anywhere in `src/`
- [ ] Zero `import { createStore } from 'vuex'` anywhere in `src/`
- [ ] `vuex` removed from `package.json` dependencies
- [ ] `src/types/vuex.d.ts` deleted
- [ ] All old `src/store/` module directories deleted (keep `runtime.ts`, `variables.ts`, `cncMetadata.ts`, `cncApi.ts`)
- [ ] `bun run build` passes with zero errors
- [ ] All 7 routes verified in Chrome DevTools: Dashboard, Farm, Webcam, Console, G-Code Files, History, Timelapse
- [ ] Config/Settings route verified
- [ ] Farm: add/remove remote printers works
- [ ] WebSocket reconnects correctly
- [ ] Temperature history chart renders
- [ ] File upload/download works
- [ ] GUI settings persist to Moonraker DB

---

## 8. Estimated Scope

| Metric | Count |
|--------|-------|
| New Pinia store files | ~20 |
| Component files to update | ~100+ |
| Composable files to update | 16 |
| Vuex files to delete | ~130 |
| Type definition files to delete | 1 (`vuex.d.ts`) |
| Estimated LoC delta | -2000 (eliminate mutations, boilerplate) |

---

## 9. File Structure (Target)

```
src/
  stores/                        # NEW — all Pinia stores
    app.ts                       # Root app state
    socket.ts                    # WebSocket connection
    server.ts                    # Moonraker server
    server/
      power.ts
      updateManager.ts
      history.ts
      timelapse.ts
      jobQueue.ts
      announcements.ts
      sensor.ts
    printer.ts                   # Klipper printer state
    printer/
      tempHistory.ts
    files.ts                     # File tree + upload
    gui.ts                       # GUI settings root
    gui/
      console.ts
      gcodehistory.ts
      macros.ts
      miscellaneous.ts
      navigation.ts
      notifications.ts
      presets.ts
      remoteprinters.ts
      maintenance.ts
      webcams.ts
    farm.ts                      # Multi-printer farm
    editor.ts                    # Config editor
    gcodeviewer.ts               # G-code viewer

  store/                         # KEPT (slim)
    runtime.ts                   # getSocket, setSocket, $toast
    variables.ts                 # Constants
    files/
      cncMetadata.ts             # Pure utility
      cncApi.ts                  # Pure utility
```

---

## 10. Out of Scope

- State shape redesign (this is a 1:1 migration)
- New Pinia plugins (e.g., pinia-plugin-persistedstate)
- Store unit tests (can be added incrementally after migration)
- Removing the orphaned `gui/reminders` module (separate cleanup task)
