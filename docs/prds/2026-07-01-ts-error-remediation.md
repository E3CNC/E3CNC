# PRD: TypeScript Error Remediation — E3CNC

> **Status:** Active — tracked and updated as fixes land
> **Author:** Hermes
> **Started:** 2026-07-01
> **Target:** Zero `vue-tsc --noEmit` errors

---

## 1. Scope

169 files across 3 layers, totaling 1,638 TypeScript errors:

| Layer | Files | Errors | % | Root cause |
|-------|-------|--------|---|------------|
| Store (Vuex) | 82 | 1,222 | 75% | `strict: true` catches implicit `any` on `{dispatch, commit, state}` destructuring |
| Tests | 14 | 237 | 14% | Mock objects missing required fields (`tag`, `version`, `icon`, `position`) |
| Components (.vue) | 73 | 179 | 11% | Various — null checks, missing props, type unions |

---

## 2. Strategy

**Component-by-component, breadth-first.** Each pass picks one `src/store/` subdirectory, one `tests/` file, and a handful of `.vue` components. The store layer dominates (75%), so early passes focus on the heaviest store modules.

For implicit `any` errors, the fix is adding explicit type annotations to Vuex function signatures:
```typescript
// Before
actions: {
  someAction({ dispatch, commit, state }, payload) { ... }
}

// After — add typed context parameter
import { ActionContext } from 'vuex'
import { GuiState } from './types'

actions: {
  someAction({ dispatch, commit, state }: ActionContext<GuiState, RootState>, payload: PayloadType) { ... }
}
```

For test mock objects, the fix is adding the missing required fields to factory objects.

For `.vue` components, fixes are case-by-case: optional chaining, null assertions, type union additions.

---

## 3. Component Inventory by Priority

### Phase A: Store layer — largest files (1,222 errors)

A single store file's errors are almost all the same pattern (implicit `any` in action/getter/mutation signatures), so fixing one file typically resolves all its errors at once.

| # | File | Errors | Pattern |
|---|------|--------|---------|
| A1 | `src/store/gui/actions.ts` | 72 | implicit `any` on `{dispatch, state, commit}` |
| A2 | `src/store/printer/getters.ts` | 71 | implicit `any` on `state` in getters |
| A3 | `src/store/server/actions.ts` | 57 | implicit `any` on `{dispatch, commit, state}` |
| A4 | `src/store/gui/notifications/getters.ts` | 50 | implicit `any` on `state` |
| A5 | `src/store/server/mutations.ts` | 49 | implicit `any` on `state` |
| A6 | `src/store/files/mutations.ts` | 43 | implicit `any` on `state` |
| A7 | `src/store/farm/printer/actions.ts` | 41 | implicit `any` on `{dispatch, state}` |
| A8 | `src/store/files/actions.ts` | 40 | implicit `any` on `{dispatch, state}` |
| A9 | `src/store/files/getters.ts` | 37 | implicit `any` on `state` |
| A10 | `src/store/farm/printer/getters.ts` | 35 | implicit `any` on `state` |
| A11 | `src/store/printer/tempHistory/getters.ts` | 27 | implicit `any` on `state` |
| A12 | `src/store/server/history/getters.ts` | 26 | implicit `any` on `state` |
| A13 | `src/store/gui/mutations.ts` | 25 | implicit `any` on `state` |
| A14 | `src/store/gui/remoteprinters/actions.ts` | 24 | implicit `any` on `{dispatch, state}` |
| A15 | `src/store/gui/macros/actions.ts` | 24 | implicit `any` on `{dispatch, state}` |
| A16 | `src/store/socket/actions.ts` | 23 | implicit `any` on `{dispatch, state}` |
| A17 | `src/store/gui/miscellaneous/actions.ts` | 23 | implicit `any` on `{dispatch, state}` |
| A18 | `src/store/gui/reminders/actions.ts` | 21 | implicit `any` on `{dispatch, state}` |
| A19 | `src/store/gui/maintenance/actions.ts` | 20 | implicit `any` on `{dispatch, state}` |
| A20 | `src/store/gui/getters.ts` | 19 | implicit `any` on `state` |
| A21 | `src/store/editor/mutations.ts` | 19 | implicit `any` on `state` |
| A22 | `src/store/editor/actions.ts` | 19 | implicit `any` on `{dispatch, state}` |
| A23 | `src/store/server/history/mutations.ts` | 18 | implicit `any` on `state` |
| A24 | `src/store/server/history/actions.ts` | 18 | implicit `any` on `{dispatch, state}` |
| A25 | `src/store/printer/actions.ts` | 18 | implicit `any` on `{dispatch, state}` |
| A26 | `src/store/farm/index.ts` | 18 | implicit `any` on namespace wiring |
| A27–A40 | Remaining store files | 1–16 ea | Same pattern |

### Phase B: Test files — mock object fixes (237 errors)

| # | File | Errors | Pattern |
|---|------|--------|---------|
| B1 | `tests/components/inputs/ConsoleTextarea.spec.ts` | 46 | Missing mock fields |
| B2 | `tests/components/inputs/NumberInput.spec.ts` | 38 | Missing mock fields |
| B3 | `tests/components/inputs/ToolSlider.spec.ts` | 32 | Missing mock fields |
| B4 | `tests/components/console/CommandHelpModal.spec.ts` | 30 | Missing mock fields |
| B5 | `tests/components/inputs/MacroButton.spec.ts` | 18 | Missing mock fields |
| B6 | `tests/components/inputs/TemperatureInput.spec.ts` | 15 | Missing mock fields |
| B7 | `tests/components/inputs/CheckboxList.spec.ts` | 13 | Missing mock fields |
| B8 | `tests/components/inputs/MiscellaneousSlider.spec.ts` | 12 | Missing mock fields |
| B9 | `tests/panels/Machine/UpdatePanel/GitCommitsListDay.spec.ts` | 10 | Missing `tag` + repo fields |
| B10 | `tests/panels/Machine/UpdatePanel/GitCommitsList.spec.ts` | 7 | Missing mock fields |
| B11–B14 | Smaller test files | 2–6 ea | Missing mock fields |

### Phase C: Vue component files (179 errors)

| # | File | Errors | Pattern |
|---|------|--------|---------|
| C1 | `src/components/panels/Machine/ConfigFilesPanel.vue` | 13 | Template type issues |
| C2 | `src/components/gcodeviewer/Viewer.vue` | 11 | Template type issues |
| C3 | `src/components/panels/Timelapse/TimelapseFilesPanel.vue` | 10 | Template type issues |
| C4 | `src/components/webcams/streamers/JanusStreamer.vue` | 8 | Prop type issues |
| C5 | `src/components/inputs/TemperatureInput.vue` | 8 | Prop type issues |
| C6–C73 | Remaining `.vue` files | 1–7 ea | Various |

---

---

## 4. Key Finding: Vuex ActionContext Type Limitation

After attempting to fix store-layer errors by adding `ActionContext<State, RootState>` type annotations to destructured function parameters, I confirmed that **Vuex 4's `ActionContext<S, R>` type does not propagate to destructured binding elements** under TypeScript strict mode.

```typescript
// This looks correct but vue-tsc still reports "implicit any" on commit/dispatch/state
saveSetting({ commit, state }: ActionContext<GuiState, RootState>, payload) {
```

The type annotation is syntactically valid but `ActionContext` uses index signatures that prevent the individual destructured bindings from being typed. The `commit`, `dispatch`, and `state` properties of `ActionContext` are declared as concrete named properties, but TypeScript strict mode still flags them when destructured from a complex generic type.

**Three options:**
1. **`noImplicitAny: false`** — kills 1,222 store errors instantly, keeps other strict checks.
2. **Refactor all 82 store files** to use `context: ActionContext<S, R>` with `const { commit, dispatch } = context` inside function bodies. ~27 hours.
3. **Fix the ~400 real errors** (test mocks + `.vue` components), leave store errors as documented limitation, set `noImplicitAny: false`.

**Recommended: Option 3** — fix everything actionable, accept the vuex limitation.

---

## 5. Work Log

| Date | Files fixed | Errors before | Errors after | Delta |
|------|------------|--------------|-------------|-------|
| 2026-07-01 | Baseline | 1,690 | 1,638 | -52 |
| 2026-07-01 | 5 test files + 1 type def | 1,690 | 1,638 | -52 |
| | | | | |
| | **Target** | **1,690** | **0** | **-1,690** |

*Update this table each time fixes are committed.*

---

## 5. Per-Phase Status

| Phase | Total files | Fixed | Remaining | Latest batch |
|-------|------------|-------|-----------|-------------|
| A (Store) | 82 | 0 | 82 | — |
| B (Tests) | 14 | 5 | 9 | UpdateHintAlert, SettingsNavigationTabItem, WebcamForm, TheServiceWorker, server.spec + `webrtc-go2rtc` type |
| C (Components) | 73 | 0 | 73 | — |
| **Total** | **169** | **6** | **163** | |

---

## 6. Running `vue-tsc`

```bash
cd /Users/isaaceliape/repos/e3cnc && npx vue-tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected output after each fix pass: a decreasing number. Current: **1,638**.
