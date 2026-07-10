# Design System Implementation Plan — E3CNC UI

**Version:** 1.0  
**Date:** 2026-06-22  
**Author:** AI Agent  
**Status:** Draft for review

---

## 1. Why a Design System?

E3CNC UI inherited Mainsail's organic styling — a mix of Vuetify 3 defaults, ad-hoc CSS files, inline styles in Vue SFCs, and theme images scattered across `public/img/themes/`. As CNC-specific panels grow (jog, DRO, WCS, spindle, MDI), the lack of a shared design vocabulary makes each new panel a bespoke effort.

A design system will:

- **Eliminate visual drift** between CNC panels and the rest of the UI
- **Give CNC-specific components a consistent language** — jog wheels, DRO readouts, WCS grids, spindle controls
- **Make deep theming feasible** — one source of truth for colours, typography, spacing, motion
- **Reduce inline style spaghetti** — currently `useTheme.ts` pipes computed values into `:style` bindings; a token layer can replace that
- **Improve accessibility** by standardising contrast ratios, focus indicators, and touch targets
- **Speed up onboarding** for contributors building CNC panels

---

## 2. Current State Audit

### 2.1 What exists today

| Layer                            | What                                                                                                                 | Problems                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Vuetify theme**                | `src/main.ts` — dark/light with single `accent: '#ff9800'` override                                                  | Minimal. Every colour override is scattered in components.                                                        |
| **Vuetify config**               | `createVuetify({ theme: { dark, light } })`                                                                          | No shared colour tokens.                                                                                          |
| **Theme composable**             | `src/composables/useTheme.ts` — computed fg/bg colours, sidebar images, logo paths                                   | 200+ lines of computed values. Mixes colour calculation, image path logic, and CSS variable generation.           |
| **CSS files**                    | `src/assets/styles/{utils,page,sidebar,fonts,toastr,updateManager}.css`                                              | Global, flat, no design tokens. `page.css` uses CSS custom properties (`--v-theme-*`) that are Vuetify internals. |
| **SVG themes**                   | `public/img/themes/` — 9 sidebar logos, 1 sidebar background                                                         | Logo+background per theme works, but there's no tokenisation — just image swaps.                                  |
| **Colour constants**             | `src/store/variables.ts` — `defaultLogoColor`, `defaultPrimaryColor`, `colorArray`, `colorHeaterBed`, `colorChamber` | Mixed concerns — some are design tokens, some are defaults, some are sensor colours. No grouping.                 |
| **Panel layout**                 | `src/components/panels/Cnc/README.md` documents panel wiring                                                         | Panels use ad-hoc inline styles, computed colour bindings, no shared component primitives.                        |
| **Custom properties (CSS vars)** | `App.vue` sets `--v-btn-text-primary`, `--color-logo`, `--color-primary`, `--sidebar-logo` etc.                      | Good start but incomplete. Only ~10 CSS vars, mostly Vuetify overrides.                                           |
| **Fonts**                        | `0xProto Nerd Font Mono` in `fonts.css`                                                                              | Single monospace font for everything. Readability on dense DRO/JOG panels is untested at small sizes.             |

### 2.2 Design tokens that are missing

- Typography scale (headings, body, mono, DRO-display, label)
- Spacing scale (4px grid, padding, margin tokens)
- Colour palette (surface, on-surface, primary, secondary, error, CNC-specific accent)
- Border radius scale
- Elevation / shadow scale
- Motion duration / easing tokens
- Icon set conventions (MDI is used, but no icon size/enum standard)
- Breakpoint tokens (Vuetify defaults may not suit CNC dashboard layouts)
- CNC-specific token categories (axis colours X/Y/Z, spindle speed, feed rate, WCS identifiers)

---

## 3. Proposed Architecture

```
src/
├── design-system/
│   ├── tokens/
│   │   ├── index.ts              # named export of all token categories
│   │   ├── colors.ts             # colour palette + semantic aliases
│   │   ├── typography.ts         # font families, sizes, weights, line heights
│   │   ├── spacing.ts            # 4px-based scale (xs, sm, md, lg, xl, ...)
│   │   ├── border-radius.ts      # roundedness scale
│   │   ├── elevation.ts          # shadow / z-index scale
│   │   ├── motion.ts             # duration, easing curves
│   │   ├── breakpoints.ts        # responsive breakpoints (CNC-tuned)
│   │   └── cnc.ts                # CNC-specific: axis colours, WCS colours, jog/speed units
│   ├── components/
│   │   ├── CncCard.vue           # base card for CNC dashboard panels
│   │   ├── CncReadout.vue        # DRO-style numeric readout (large mono, units, sign)
│   │   ├── CncJogButton.vue      # jog direction button with axis colouring
│   │   ├── CncSlider.vue         # feed/spindle override slider
│   │   ├── CncWcsGrid.vue        # WCS coordinate grid cell
│   │   ├── CncAxisLabel.vue      # axis label (X/Y/Z/A/B/C) with colour
│   │   ├── CncStatusDot.vue      # status indicator (running/paused/error)
│   │   └── index.ts              # re-export all design-system components
│   ├── utilities/
│   │   └── helpers.ts            # colour contrast, unit formatting, DRO string formatting
│   └── composables/
│       └── useDesignTokens.ts    # reactive access to design tokens (read from store/theme)
│
├── assets/styles/
│   ├── design-tokens.css          # CSS custom properties generated from tokens/ (build step)
│   ├── reset.css                  # minimal reset (beyond Vuetify)
│   ├── typography.css             # generated from tokens/typography.ts
│   ├── utils.css                  # slimmed down, pruned of one-off overrides
│   ├── page.css                   # layout styles only (page-container, sidebars)
│   ├── sidebar.css                # sidebar-specific (unchanged)
│   ├── fonts.css                  # @font-face declarations (unchanged)
│   └── toastr.css                 # toast styles (unchanged or migrated later)
│
└── composables/
    └── useTheme.ts                # slimmed down — delegates to design-system tokens
```

### 3.1 Dependency direction

```
tokens/  ←  CSS custom properties (build-time generated)
   ↓
composables/useDesignTokens.ts
   ↓
design-system/components/  ←  used by panel components
   ↓
panels/, dialogs/, settings/ (consumer layer)
```

Tokens must never import from Vue, Vuetify, or the store — they are pure data.

---

## 4. Implementation Phases

### Phase 1 — Token Foundation (estimated: 3–4 sessions)

**Goal:** Define and publish all design tokens as a single source of truth.

- [ ] Create `src/design-system/tokens/` directory structure
- [ ] Implement `colors.ts`
  - Extract existing colours from `variables.ts` (`defaultLogoColor`, `defaultPrimaryColor`, `colorArray`, `colorHeaterBed`, `colorChamber`)
  - Add CNC-specific axis colours: `axisX: '#E53935'`, `axisY: '#43A047'`, `axisZ: '#1E88E5'`, etc.
  - Add semantic aliases: `surface`, `surfaceVariant`, `onSurface`, `primary`, `secondary`, `error`, `cncAccent`, `spindle`, `feedrate`, `wcsActive`, `wcsInactive`
  - Export a flat `ColorTokens` object and a `SemanticColors` object
- [ ] Implement `typography.ts`
  - Define font family stack: primary (`0xProto Nerd Font Mono`), fallback (`monospace`)
  - Define type scale: `label`, `body`, `bodySmall`, `heading`, `droReadout`, `droUnit`
  - Each entry: `{ fontFamily, fontSize, fontWeight, lineHeight, letterSpacing }`
- [ ] Implement `spacing.ts`
  - 4px base scale: `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32`, `xxxl: 48`
  - Named spacing for common uses: `panelPadding`, `cardPadding`, `buttonGap`
- [ ] Implement `border-radius.ts`
  - `none: 0`, `sm: 2`, `md: 4`, `lg: 8`, `xl: 12`, `full: 9999`
- [ ] Implement `elevation.ts`
  - Map Vuetify elevation classes to semantic uses: `panel`, `card`, `dialog`, `tooltip`, `modal`
- [ ] Implement `motion.ts`
  - Durations: `instant: 0`, `fast: 150`, `normal: 300`, `slow: 500`
  - Easings: `easeInOut`, `easeOut`, `easeIn`, `linear`
- [ ] Implement `breakpoints.ts`
  - Re-export Vuetify breakpoints or CNC-tuned overrides: `xs: 0`, `sm: 600`, `md: 960`, `lg: 1280`, `xl: 1920`
- [ ] Implement `cnc.ts` — CNC-specific tokens
  - Axis colours (as above)
  - WCS identifiers (`G54`–`G59`, `G59.1`–`G59.3`)
  - Speed unit labels (`mm/min`, `in/min`, `RPM`, `%`)
  - Jog increment presets (0.01, 0.1, 1, 10 mm)
  - DRO decimal places per axis
- [ ] Create `tokens/index.ts` — named export of all token modules

**Deliverable:** Pure TypeScript token modules with zero runtime dependencies. ~500 lines total.

---

### Phase 2 — CSS Custom Properties Bridge (estimated: 2 sessions)

**Goal:** Make tokens accessible in CSS without importing JS.

- [ ] Create a build-time script (`scripts/generate-tokens-css.mjs`) that:
  - Imports token definitions from `src/design-system/tokens/`
  - Generates `src/assets/styles/design-tokens.css` with `:root { --ds-* }` declarations
  - Emits both dark and light variants where applicable
- [ ] Wire the script into `vite.config.ts` as a `buildStart` or `configResolved` hook
- [ ] Generate initial `design-tokens.css` with all tokens
- [ ] Import `design-tokens.css` in `src/main.ts`
- [ ] Update `App.vue` CSS vars to reference `--ds-*` tokens instead of hardcoded values

**Example output:**

```css
:root {
  --ds-color-surface: #1e1e1e;
  --ds-color-primary: #00ff00;
  --ds-color-axis-x: #e53935;
  --ds-color-axis-y: #43a047;
  --ds-color-axis-z: #1e88e5;
  --ds-spacing-sm: 8px;
  --ds-spacing-md: 12px;
  --ds-radius-md: 4px;
  --ds-font-dro-readout: 700 24px/1.2 '0xProto Nerd Font Mono', monospace;
  --ds-duration-normal: 300ms;
}
```

**Deliverable:** Auto-generated `design-tokens.css`, wired into build.

---

### Phase 3 — Composable (estimated: 1 session)

**Goal:** Reactive JS-side access to tokens for `:style` bindings and computed properties.

- [ ] Create `src/design-system/composables/useDesignTokens.ts`
  - Reads current colour mode from `useVuetifyTheme()` or the store
  - Returns reactive `DesignTokens` object with all token values
  - Handles dark/light colour swapping
  - Provides helper: `token('color.primary')` string lookup
- [ ] Refactor `src/composables/useTheme.ts` to delegate to `useDesignTokens`
  - Replace inline colour calculations with token references
  - Keep sidebar/image/path logic in `useTheme.ts` — only the colour/spacing/motion bits move to the composable

**Deliverable:** `useDesignTokens()` composable, `useTheme.ts` slimmed ~40%.

---

### Phase 4 — Base UI Components (estimated: 4–5 sessions)

**Goal:** Build reusable CNC-specific component primitives.

- [ ] **`CncCard.vue`** — base panel card
  - Props: `title`, `elevation`, `loading`, `collapsible`
  - Uses tokens for padding, border-radius, background, shadow
  - Consistent header bar with title + action slot
  - Replaces ad-hoc `v-card` + custom styling across all CNC panels
- [ ] **`CncReadout.vue`** — DRO-style numeric display
  - Props: `value`, `unit`, `decimals`, `axis`, `sign`, `fontSize`, `color`
  - Large monospaced readout with optional axis colour, signed display, blinking on change
  - Used in `DroPanel.vue`, `Wcs.vue`, `CncStatusPanel.vue`
- [ ] **`CncJogButton.vue`** — jog direction button
  - Props: `axis`, `direction` (`+`/`-`), `increment`, `disabled`, `continuous`
  - Axis-coloured arrow button with continuous-hold support
  - Replaces hand-crafted jog buttons in `JogPanel.vue`
- [ ] **`CncSlider.vue`** — feed/spindle override slider
  - Props: `value`, `min`, `max`, `step`, `unit`, `label`, `color`
  - Themed track, tick marks at common values (50%, 100%, 150%)
  - Used in `JogPanel.vue` (feedrate override, Z feed)
- [ ] **`CncWcsGrid.vue`** — WCS coordinate grid
  - Props: `axes`, `wcs`, `values`, `active`, `editable`
  - Renders a 2D grid (rows = WCS, cols = axes) with active cell highlighting
  - Replaces manual table in `Wcs.vue`
- [ ] **`CncAxisLabel.vue`** — axis label badge
  - Props: `axis` string (`X`/`Y`/`Z`/`A`/`B`/`C`)
  - Small coloured badge with the axis letter
- [ ] **`CncStatusDot.vue`** — status indicator
  - Props: `status` (`running`/`paused`/`error`/`idle`)
  - Pulsing/green/red/yellow dot
- [ ] **`index.ts`** — re-export all components for tree-shakeable imports

**Deliverable:** 8 reusable Vue components, each with Storybook-style usage comment block. ~1500 lines total.

---

### Phase 5 — Refactor Existing Panels (estimated: 4–5 sessions)

**Goal:** Rewire existing CNC panels to use design system components and tokens, removing inline styles and orphan colour bindings.

- [ ] **`DroPanel.vue`** — replace inline DRO display with `<CncReadout>`
- [ ] **`JogPanel.vue`** — replace jog direction buttons with `<CncJogButton>`; replace override sliders with `<CncSlider>`; wrap in `<CncCard>`
- [ ] **`Wcs.vue`** — replace WCS table with `<CncWcsGrid>`; replace WCS select with tokens
- [ ] **`SpindleCoolantPanel.vue`** — wrap in `<CncCard>`; use `<CncStatusDot>` for spindle state
- [ ] **`CncStatusPanel.vue`** — use `<CncReadout>` for position/speed; use `<CncAxisLabel>` for axis headers
- [ ] **`MdiPanel.vue`** — wrap in `<CncCard>`; use token-based button styling
- [ ] **`TemperaturePanel.vue`** — wrap in `<CncCard>`; use token colour for heater/chamber (already has `colorHeaterBed` / `colorChamber` constants)

**Deliverable:** 6 panels migrated, all inline colour overrides replaced with token references. Visual diff should be zero.

---

### Phase 6 — Documentation & Governance (estimated: 2 sessions)

**Goal:** Make the design system discoverable and maintainable.

- [ ] Create `src/design-system/README.md` with:
  - Token catalogue (colour swatches, type specimens, spacing chart)
  - Component API reference
  - How to add a new token
  - How to add a new design-system component
  - Dark/light mode guidelines
- [ ] Add JSDoc style comments to all token exports
- [ ] Add usage comments to each design-system component (props, slots, examples)
- [ ] Optionally scaffold a lightweight token preview page (route `/design-tokens`) for visual inspection
- [ ] Add a `design-system-review` checklist to PR template (`.github/PULL_REQUEST_TEMPLATE.md`)

**Deliverable:** `README.md`, documented token API, PR checklist update.

---

### Phase 7 — Polish & Accessibility (estimated: 2 sessions)

**Goal:** Harden the system for production use.

- [ ] Audit all token colours for WCAG 2.1 AA contrast ratios (4.5:1 normal, 3:1 large)
- [ ] Add focus ring token and apply to all design-system components
- [ ] Ensure motion tokens respect `prefers-reduced-motion`
- [ ] Add touch target size token (44×44px minimum)
- [ ] Test DRO readout font rendering at small sizes (12px, 14px, 16px) on real CNC hardware
- [ ] Test dark/light mode toggle end-to-end on all CNC panels

---

## 5. File Change Summary

| Phase | Files to Create                                                                                                             | Files to Modify                                             | Files to Remove |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------- |
| 1     | `src/design-system/tokens/{colors,typography,spacing,border-radius,elevation,motion,breakpoints,cnc}.ts`, `tokens/index.ts` | —                                                           | —               |
| 2     | `scripts/generate-tokens-css.mjs`                                                                                           | `vite.config.ts`, `src/main.ts`, `src/App.vue`              | —               |
| 3     | `src/design-system/composables/useDesignTokens.ts`                                                                          | `src/composables/useTheme.ts`                               | —               |
| 4     | 8+ `src/design-system/components/*.vue` + `index.ts`                                                                        | —                                                           | —               |
| 5     | —                                                                                                                           | 6 `src/components/panels/Cnc/*.vue`, `TemperaturePanel.vue` | —               |
| 6     | `src/design-system/README.md`                                                                                               | `.github/PULL_REQUEST_TEMPLATE.md`                          | —               |
| 7     | —                                                                                                                           | Various component files                                     | —               |

**Total new files:** ~16  
**Total modified files:** ~12  
**Estimated total lines:** ~3,500 new code, ~500 removed (inline styles pruned)

---

## 6. Risks & Mitigations

| Risk                                            | Mitigation                                                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Token API churn** during early phases         | Keep Phase 1 short (one session per token file). Lock token shapes before Phase 3.                                                                                                             |
| **Existing inline styles are deeply entangled** | Migrate panel-by-panel; keep old styles until the new component is verified. No big-bang migration.                                                                                            |
| **Vuetify 3 theme changes** in future upgrades  | Wrap Vuetify theme access behind `useDesignTokens()` — only one composable needs updating.                                                                                                     |
| **Performance — reactive token waterfall**      | Tokens are plain objects, not reactive. Only `useDesignTokens()` is reactive. Components that render many DRO cells (WCS grid: 9×6 = 54 cells) use `computed` at the grid level, not per cell. |
| **Bundle size from design system**              | Tree-shakeable imports via named exports. No `plugin` registration — just import components where used.                                                                                        |

---

## 7. Success Criteria

1. Zero inline colour hex values in `src/components/panels/Cnc/` — all via tokens
2. `src/composables/useTheme.ts` <100 lines (from ~200)
3. Every CNC panel in Phase 5 renders identically before and after migration (visual regression)
4. `src/design-system/tokens/` can be consumed without importing Vue or Vuetify
5. Build passes (`bun run build`)
6. All 7 main routes load without console errors

---

## 8. Out of Scope

- Migrating the entire upstream Mainsail panel set (Temperature, Webcam, History, etc.) — only CNC panels + Temperature (already has colour constants)
- Creating a full component library with unit tests for every component — tests come later
- Creating a Figma/Sketch design spec — code-first tokens are sufficient for this team size
- Replacing Vuetify — the design system complements Vuetify, it doesn't replace it
