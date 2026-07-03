# AGENTS.md

This file documents the current state and capabilities of AI agents used in this project.

## Vue 2 → Vue 3 Migration Status

**Branch**: `vue3-migration` (parallel to `main`)

### Complete (v0.8.2 — all routes verified)

- Phase 1: All deps upgraded (Vue 3.5, Vuetify 3, vue-router 4, vue-i18n 11, vuex 4, Pinia 2, TS 5.7)
- Phase 2: Global infra (`createApp`, `@vue/compat` MODE 2, Vuetify 3, mitt, WebSocket composable, directives, router v4, i18n v11, Vuex 4)
- Phase 3: Router v4, i18n v11, Vuex 4 in place
- Phase 4: All `.ts` mixin files → `use*()` composables in `src/composables/` (20 composables)
- Phase 5: All 255+ `.vue` files rewritten from class components to `<script setup>`
- Phase 6: Vuetify 3 template migration (list-item, tabs, subheader, checkbox, table renames)
- Phase 7a: Mixin files deleted (`src/components/mixins/`)
- Phase 7b: `vue-debounce-decorator` removed
- Phase 7c: `@vue/compat` removed from `package.json` + `vite.config.ts` alias + compatConfig
- Phase 7d: `tsconfig.json` cleanup (`moduleResolution: "node"`, no `ignoreDeprecations`)
- Phase 7e: Removed `vite-plugin-checker`
- Phase 7f: Vuetify 3 slot syntax — all `#activator="{ on, attrs }"` → `#activator="{ props }"`, `v-bind="attrs" v-on="on"` → `v-bind="props"`
- Phase 7g: Bulk removal of all `const mdiXxx = mdiXxx` TDZ self-assignments (~200 lines across 100+ files)
- Phase 7h: All remaining `<overlay-scrollbars>` → `<OverlayScrollbarsComponent>` with imports (17 files)
- Phase 7i: All `$vuetify.breakpoint` → `useDisplay()` (4 files: TheTopbar, Timelapse, TemperaturePanelPresets, GcodefilesEntry)
- Phase 7j: All `v-data-table` sort model migrations: `.sync` → `v-model:`, string sortBy → array (HistoryListPanel, ConfigFilesPanel)
- Phase 8 (store migration): Created `src/store/runtime.ts` — socket singleton (`getSocket()`/`setSocket()`) + shared `$toast` via `useToast()`
- All mutation files: `Vue.set(state, key, val)` → `state[key] = val`, `Vue.delete(state, key)` → `delete state[key]`
- All action/mutation files: `Vue.$socket.emit/emitAndWait/emitBatch` → `getSocket().emit/emitAndWait/emitBatch`, `Vue.$toast.success/error` → `$toast.success/error`
- All store files: `import Vue from 'vue'` removed (zero remaining)
- `src/plugins/helpers.ts`: `Vue.set` → direct assignment, import removed
- `src/components/inputs/CodemirrorAsync.vue`: `Vue.component` → dynamic import from `Codemirror.vue`
- `src/components/webcams/streamers/DynamicCamLoader.ts`: `Vue.component` → exported `getDynamicCamImport()`
- **Zero `import Vue from 'vue'` remaining anywhere in `src/`**
- Fixed pre-existing runtime bugs: `i18n.t` → `i18n.global.t` in 5 files, `$vuetify.breakpoint` → `useDisplay()` in 4 files, `attrs['aria-expanded']` → `boolMenu` in TheNotificationMenu
- Removed ~200 redundant `const mdiXxx = mdiXxx` self-assignments across 100+ files (TDZ errors in `<script setup>`)
- All 7 routes verified in Chrome DevTools with zero console errors:
  - `/` Dashboard, `/allPrinters` Farm, `/cam` Webcam, `/console` MDI, `/files` G-Code Files, `/history`, `/timelapse`
  - `/config` Machine route also verified clean
- Build passes, dev server runs with zero console errors
- `@vue/compat` fully removed — app now runs on pure Vue 3.5 + Vuetify 3

### Complete (v0.8.2 — all routes verified)

- `/viewer` route verified — Babylon.js builds correctly, zero runtime errors

### Key Commits

```text
6c4ebe2c fix: eliminate remaining overlay-scrollbars and activator warnings
eebb3c50 fix: resolve runtime errors across all routes
ae77a107 fix: bulk cleanup of Vue 3 migration errors and warnings
8216fcf2 docs: update stale migration documentation (ARCHITECTURE.md, VUE_TYPESCRIPT.md, websocket.d.ts)
925839f2 fix: migrate deprecated Vuetify 2 props (small/x-small/tile/block/dense/text/accordion)
c7b0b9b1 fix: complete Vuetify 2→3 prop migration (text/outlined/input-value/tile/pagination) and fix runtime warnings
bbd9bfba fix: update v-snackbar slot from #action to #actions for Vuetify 3
0e83a883 refactor: update Vuetify 3 activator slot syntax across all components
bd1b78a7 feat: complete Vuetify 3 template migration, remove mixins, fix build
2b6fc4d5 chore: update bun.lock for Vue 3 ecosystem dependencies
7cca26d4 refactor: convert remaining components to script setup (phase 5)
efea7662 refactor: convert all settings components to script setup (phase 5)
273d7e36 refactor: convert all dialogs to script setup (phase 5)
d8e833ae refactor: convert all panels to script setup (phase 5)
6756f692 refactor: convert pages, app shell, and UI components to script setup
c1977b8b feat: add composables replacing mixins (phase 4)
d5e768fc phase2: global infrastructure for Vue 3
279ed528 phase1: upgrade to Vue 3 ecosystem + @vue/compat
```

## Ansible Migration (complete)

**Branch**: `main` (parallel to `vue3-migration`)

Replaced the bash-based `install_to_moonraker.sh` / `uninstall.sh` / `deploy.sh`
with Ansible playbooks for idempotent deployment.

| Phase | What                                                                    | Status |
| ----- | ----------------------------------------------------------------------- | ------ |
| 1     | `ansible/` skeleton (cfg, inventory, vars)                              | ✅     |
| 2–7   | 5 roles: bootstrap-stack, extractor, moonraker-config, macros, frontend | ✅     |
| 8–10  | Playbooks: `install.yml`, `deploy.yml`, `uninstall.yml`                 | ✅     |
| 11    | `--check` mode on all command tasks                                     | ✅     |
| 12    | INSTALLATION.md updated                                                 | ✅     |
| 14    | Bash scripts deprecated in docs (kept for legacy)                       | ✅     |

Note: `agent` and `klipper-extras` roles were removed in v0.8.2 — those components
now ship inside the `vendor/moonraker/` and `vendor/klipper/` snapshots and are
deployed by the bootstrap-stack role automatically.

### Single-Deploy Migration (branch: `single-deploy`, merged into `main`)

| Phase | What                                                                         | Status |
| ----- | ---------------------------------------------------------------------------- | ------ |
| 0     | Rename repo `E3CNC_UI`→`E3CNC`, flatten layout, move Moonraker source        | ✅     |
| 1     | Stack artifact inventory defined in plan                                     | ✅     |
| 2     | CI builds `e3cnc-stack-v*.tar.zst` artifact with checksum                    | ✅     |
| 3     | Staged runtime activation (`~/e3cnc/releases/`, `current` symlink, journal)  | ✅     |
| 4     | Migration path for existing installations                                    | ✅     |
| 5     | Config/schema migration system (migration script interface)                  | ✅     |
| 6     | Health checks (7 checks, auto-rollback on failure)                           | ✅     |
| 7     | CLI rewrite as stack apply tool (`./e3cnc-cli update` owns full deploy flow) | ✅     |
| 8     | Legacy Ansible retirement (`post_update.sh` delegates to `e3cnc-cli update`) | ✅     |

Plus fixes discovered during rollout:

- **Nightly CI releases**: `.github/workflows/build-frontend.yml` builds on every
  push to `main` and publishes `E3CNC-<version>.zip` (semver) as a `nightly-main-<YYYYMMDD>-<run_id>` GitHub release.
  Low-RAM devices (32-bit ARM) download the pre-built zip instead of running `vite build`.
- **`post_update_script`**: Moonraker update manager runs `build-scripts/post_update.sh`
  after every `git pull`, which downloads the nightly release, re-vendors the agent,
  re-deploys plugins, and restarts Moonraker automatically. Repo must be cloned
  manually first — Moonraker does not clone from scratch.
- **Fixed missing dep**: `vue-load-image` npm package was blocking CI builds.
  Replaced with a local Vue 3 component at `src/components/ui/VueLoadImage.vue`,
  and the npm import was removed from `src/main.ts`.

### Key commits

```text
dbdf554a docs: update for pre-built nightly releases and automatic post_update_script
2c071436 chore: rename nightly release asset from mainsail.zip to E3CNC.zip
cb3dcb81 fix: embed version.json in nightly release zip
629e4cc5 chore: update bun.lock after adding vue-load-image dependency
3f4b9c0c fix: add missing vue-load-image dependency to package.json
8b0a6aa1 fix: use bun instead of npm in build-frontend workflow
9abe3de4 fix: use pre-built frontend via nightly release instead of building on-device
3214a9a2 feat: implement Ansible playbooks for install/deploy/uninstall
a9144473 spec: add Ansible migration plan
```

## Gemini CLI Agent

- **Purpose**: Interactive CLI agent specializing in software engineering tasks for this project.
- **Current Role**: Frontend maintenance, docs sync, single-deploy migration
- **Access**: shell commands, file system, Chrome DevTools, SSH to the CNC host using `ssh cnc` (configured in `~/.ssh/config`). Always access the CNC host within a `tmux` session — use `tmux new-session -s cnc 'ssh cnc'` or `tmux attach -t cnc` if one already exists.
- **Package Manager**: Bun (not npm). Use `bun install`, `bun run`, `bunx`.
- **Dev Server**: Run within `tmux`; check for existing sessions first. HMR is active.
- **CLI**: `./e3cnc-cli` — unified CLI with single-deploy stack commands: `install` (bootstrap + artifact), `update` (alias `redeploy`), `releases` (alias `rel`), `rollback`, `prune`, plus legacy `install`/`deploy`/`uninstall`/`status`/`backup`/`restore`/`diagnose`/`check`/`logs`, and management `instances`/`migrate`.
- **Ansible**: Playbooks at `ansible/playbooks/` used for initial bootstrap (bootstrap-stack + moonraker-config). Content deployment (extractor, macros, frontend) now delivered via stack artifact downloaded by `e3cnc-cli install` and `e3cnc-cli update`.
- **Wiki**: The project wiki is available at `~/repos/E3CNC_UI.wiki/` (cloned from `https://github.com/E3CNC/E3CNC.wiki.git`). Update `Home.md` and `Changelog.md` when shipping significant changes.
- **CI**: Releases are triggered manually via GitHub Actions (`workflow_dispatch`). Check status with `gh run list`.

## Operational Guidelines

- **Ask before pushing**: Never push to remote without asking the user first.
- **Version bump**: Update the version number in `package.json` before each commit. Follow semver — bump the patch version for bug fixes, minor version for features. The version is used by the nightly release asset name and the update manager.
- **Build verification**: Always run `bun run build` after changes. The build must pass before committing.
- **Browser validation**: Always validate changes using the headed browser before committing. Use `playwright-cli` to navigate the app, interact with changed components, and verify the expected behavior. Check the **browser console** for any errors or warnings introduced by your changes.
- **Playwright MCP**: Always use a **non-headless (headed)** browser instance when using Playwright MCP for browser automation. This ensures you can visually observe interactions in real-time and intervene when needed.
- **Store layer**: Store migration is complete — all Vue 2 patterns (`Vue.set`, `Vue.$socket`, `Vue.$toast`, `import Vue`) removed.
- **`@vue/compat`**: Fully removed — app runs on pure Vue 3.5 + Vuetify 3.
- **Runtime fixes applied**: `i18n.global.t`, `useDisplay()`, `boolMenu`, removed `const mdiXxx = mdiXxx` TDZ bugs across 100+ files.
- **32-bit ARM builds**: Do NOT run `bun run build` on 32-bit ARM — it OOMs. Use `build-scripts/download_frontend.sh` or CI nightly releases instead.
- **Moonraker update manager**: Has `post_update_script: ~/E3CNC/build-scripts/post_update.sh` which now delegates to `./e3cnc-cli update` (single-deploy flow). Repo must be cloned manually first (Moonraker does not clone from scratch).
- **Single-deploy layout**: Releases are staged at `~/e3cnc/releases/<version>/` with a `~/e3cnc/current` symlink. Run `./e3cnc-cli releases` to list, `./e3cnc-cli rollback` to revert.
- **Stack artifact**: CI builds `e3cnc-stack-v<ver>.tar.zst` containing frontend, Moonraker components, Klipper extras, macros, scripts, and manifest. Published alongside the frontend zip.
- **Ask before pushing**: Never push to remote without asking the user first.
