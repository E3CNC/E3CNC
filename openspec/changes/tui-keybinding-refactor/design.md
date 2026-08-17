## Context

The E3CNC CLI ships an interactive TUI (`e3cnc-tui`) built with BubbleTea. The root `Model` in `cli/go/internal/tui/model.go` defines a `defaultKeys` key map (Quit, Enter, Back, Help, Up, Down, Cancel) and embeds a `help.Model`, but **none of those bindings are actually used to match keys**. Instead:

- `model.Update()` manually checks `msg.String() == "ctrl+c"` and `m.state == StateMainMenu && msg.String() == "q"` for quit.
- Each sub-model (`menu.go`, `confirm.go`, `update.go`, `instance.go`, `output.go`, `install.go`) independently uses `switch msg.String()` with its own ad-hoc key strings.
- As a result, key behavior is inconsistent across screens, the footer/help text advertises bindings that don't work, and the defined bindings are dead code.

Users on constrained terminals (e.g. Raspberry Pi over SSH) report: `q` doesn't quit from some screens, `b` appears to refresh instead of going back, and the footer hints (`q quit`, `b back`) are misleading because behavior depends on the screen.

## Goals / Non-Goals

**Goals:**
- Wire up BubbleTea's `key.Matches(msg, binding)` API so declared bindings are actually honored.
- Establish a single consistent key-semantics contract across all screens.
- Replace footer key lists with a `?`-toggled BubbleTea help overlay, and keep only screen-specific action hints in footers.
- Add unit tests that lock in the key-handling behavior.
- Fix two small UI bugs discovered during exploration: confirm-dialog Yes/No wrapping on narrow terminals, and "Current: unknown" version on fresh installs.

**Non-Goals:**
- No new screens or commands.
- No changes to CLI commands, data formats, or install/deploy logic.
- No re-theming or redesign of the TUI beyond keybinding/help changes and the two small bug fixes.
- No changes to how commands are executed after a menu selection.

## Decisions

### Decision 1: Use BubbleTea `key.Matches()` everywhere
Replace all manual `switch msg.String()` / `msg.String() == "x"` checks with `key.Matches(msg, binding)`. Each model owns a `keys keyMap` and matches against it.

**Rationale:** Removes duplicated, stringly-typed key logic; makes bindings the single source of truth; idiomatic BubbleTea.
**Alternative considered:** Keep manual checks but standardize them — rejected because it leaves bindings as dead code and still duplicates logic per screen.

### Decision 2: Standardized key semantics contract
All screens follow one contract, implemented with a shared set of bindings:

| Key | Binding(s) | Behavior |
|-----|-----------|----------|
| Quit | `Ctrl+C` | Quit app, **any** state (global, handled at root) |
| Help | `?` | Toggle help overlay (global, handled at root) |
| Cancel | `q`, `esc`, `b` | Cancel / go back; no-op at root/main menu |
| Enter | `enter` | Confirm / select |
| Up | `up`, `k` | Navigate up |
| Down | `down`, `j` | Navigate down |
| Left | `left`, `h` | Toggle focus left (confirm dialog) |
| Right | `right`, `l` | Toggle focus right (confirm dialog) |
| Yes | `y` | Quick confirm (confirm dialog) |
| No | `n` | Quick cancel (confirm dialog) |

Semantics of `q`/`esc`/`b` are **screen-dependent but consistent**:
- At root/main menu: `q` quits; `esc`/`b` are no-ops (nothing to go back to).
- In any sub-screen/dialog: `q`, `esc`, `b` all cancel/go back.

**Rationale:** Matches user decision "Ctrl+C=quit, q=cancel everywhere"; simple, predictable mental model.
**Alternative considered:** Context-free `q`=quit everywhere — rejected; that would make `q` quit from mid-operation dialogs unexpectedly.

### Decision 3: Global keys handled at root; screen keys in sub-models
`Model.Update()` handles `Quit` (`Ctrl+C`) and `Help` (`?`) first, before dispatching. Screen-specific bindings (navigate, confirm, and the cancel/back/quit-if-root behavior) live in each sub-model.

**Rationale:** Global keys must work from every state; screen-specific keys differ per screen. Root-first handling avoids each sub-model re-implementing quit/help.
**Alternative considered:** A shared base model / interface with `ShortHelp()`/`FullHelp()` each model implements — rejected as over-engineering for the current screen count; a simple root-dispatch is sufficient and matches the existing structure.

### Decision 4: BubbleTea `bubbles/help` help overlay
The existing `help.Model` in the root model is promoted to a `?`-toggleable overlay. Each sub-model returns its screen-specific `ShortHelp()`/`FullHelp()`, which the root help model renders. Footers drop full key lists in favor of one-line action hints.

**Rationale:** help.Model is already a dependency (BubbleTea's bubbles), gives consistent rendering, and scales to many bindings without crowding each screen.
**Alternative considered:** Manual footer strings — rejected; they don't scale and are exactly the source of the "shows bindings that don't work" bug.

### Decision 5: Fix confirm-dialog narrow-terminal layout
Stack the Yes/No buttons vertically (or switch to vertical list) when `width` is below a threshold instead of wrapping a single `[ Yes ] [ No ]` line.

**Rationale:** Addresses the overflow report without a full redesign.
**Alternative considered:** Horizontal scroll — rejected as worse UX than vertical stacking on narrow terminals.

### Decision 6: Fix "Current: unknown" version
On fresh installs where no release is activated, `GetCurrentRelease()` returns nil and the version label falls back to "unknown". Change the label to "none" (or "not installed") to be accurate and less alarming.

**Rationale:** Removes a misleading/frightening message; trivial change affecting only the string label.

### Decision 7: Unit tests for key handling
Add `*_test.go` cases that feed `tea.KeyMsg` values into each model's `Update` and assert the resulting state/`tea.Cmd`. Cover: quit from each state, cancel/back per screen, help toggle, Enter navigation, y/n quick actions, and that the help bindings match the bindings map.

**Rationale:** The user selected unit-test-only validation. Key handling is pure/functional enough to test without a terminal.

## Risks / Trade-offs

- **[Refactor touches 8 files]** → Covered by the new unit tests; behavior verified via `go test ./...` in `cli/go`.
- **[Consistency change could surprise muscle-memory users]** → The prior behavior (esp. `b`=back, `q`=quit at root) is preserved; only genuinely inconsistent screens change. Documented in CHANGELOG.
- **[Changing quit from `q` to `Ctrl+C`-centric could annoy]** → `q` still quits at the root/main menu, so the common case is unchanged. `Ctrl+C` is the guaranteed-quit everywhere.
- **[help overlay hidden by default]** → Footer action hints still surface the most-used keys per screen; `?` reveals the full list. Matches BubbleTea conventions.

## Migration Plan

- Purely additive/presentational rewrite of the TUI input layer; no persisted state, no data migration.
- Rollback: revert the `cli/go/internal/tui/` changes; behavior returns to previous manual-check logic.
- Ship as a normal release after `go test ./...` passes and manual smoke test in a terminal.

## Open Questions

- Whether to also add a horizontal-scroll/other layout change to the main menu on very narrow terminals (menu overflow was reported). Treated as out of scope for this change; noted as follow-up.
- Whether the `Ender`-family MCU presets (currently missing from `hardware.go`) should be added here or as a separate change. Treated as separate.
