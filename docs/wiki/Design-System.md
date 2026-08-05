# Design System

A token-based design system for E3CNC UI's CNC-specific panels.

See the full implementation plan: `prd/design-system-plan.md` in the repository.

## Completed Work

### Theme font support
- `fontFamily` field added to `Theme` interface — themes can specify a custom font stack
- `letterSpacing` field added to `Theme` interface — themes can specify root letter-spacing
- Both values set as CSS custom properties (`--font-family`, `--letter-spacing`) on `document.documentElement`
- All component font-family and letter-spacing declarations removed — everything inherits from root
- Vuetify typography classes override with `font: inherit` to respect theme fonts
- Currently implemented for the Ndot57 theme (Ndot 57 Aligned font, 0.1rem letter-spacing)

### Rem units
- All `font-size` values across 25+ components converted from px and em to rem
- Ensures consistent scaling relative to root font size

### `--border-radius` variable
- `:root { --border-radius: 8px }` in `page.css`
- Applied to all `v-dialog` cards, sheets, and overlay content

## Phases

### Phase 1 — Token Foundation (next)
Pure TypeScript tokens: colors, typography, spacing, border-radius, elevation, motion, breakpoints, CNC-specific (axis colours, WCS identifiers, jog presets).

### Phase 2 — CSS Custom Properties Bridge
Build-time script generates `design-tokens.css` from TS tokens.

### Phase 3 — Composable
`useDesignTokens()` composable for reactive JS-side token access.

### Phase 4 — Base UI Components
`CncCard`, `CncReadout`, `CncJogButton`, `CncSlider`, `CncWcsGrid`, `CncAxisLabel`, `CncStatusDot`.

### Phase 5 — Refactor Existing Panels
Migrate all CNC panels to use design system components.

### Phase 6 — Documentation & Governance
README, JSDoc, PR template checklist.

### Phase 7 — Polish & Accessibility
WCAG AA contrast, focus rings, `prefers-reduced-motion`, 44×44px touch targets.

## Success Criteria

1. Zero inline colour hex values in `src/components/panels/Cnc/`
2. `useTheme.ts` <100 lines (down from ~200)
3. Visual regression match for all CNC panels
4. Build passes, all routes load cleanly
