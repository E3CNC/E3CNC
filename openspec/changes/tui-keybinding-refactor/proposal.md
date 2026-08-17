## Why

The E3CNC CLI (e3cnc-tui) has a key binding system that is defined but never wired up: `defaultKeys` in `model.go` declares bindings for `Quit`, `Back`, `Enter`, `Up`, `Down`, `Cancel`, and `Help`, but every sub-model (menu, confirm, update, instance, output, install) uses manual `switch(msg.String())` checks that don't match the declared bindings. This produces inconsistent behavior — the footer says "q quit" but `q` only quits from the main menu; the footer says "b back" but `b` does nothing in the main menu; help text (`?`) shows bindings that don't work. Users on small-screen terminals (Raspberry Pi) report that `q` doesn't quit, `b` refreshes instead of going back, and the menu overflows off-screen.

## What Changes

- **Refactor `model.go`** to use BubbleTea's `key.Matches(msg, binding)` system instead of manual `switch(msg.String())` checks. Define global keys (`Ctrl+C` = quit, `?` = help) at the root level; each sub-model defines its own screen-specific bindings.
- **Standardize key semantics** across all screens:
  - `Ctrl+C` → quit app (from any state)
  - `q` → cancel / go back (screen-dependent; at root/main menu, `q` quits)
  - `Esc` / `B` → cancel / go back (screen-dependent; at root/main menu, does nothing)
  - `Enter` → confirm / select
  - `?` → toggle help overlay
  - `↑/↓` → navigate (screen-dependent)
- **Replace footer-based help with BubbleTea's help overlay**: press `?` to toggle a help overlay showing all bindings for the current screen. Remove key lists from footers (keep only screen-specific action hints).
- **Fix confirm dialog layout**: Yes/No buttons stacked vertically on narrow terminals instead of wrapping on a single line.
- **Fix version display**: Show "Current: none" instead of "Current: unknown" on fresh installs where no release has been activated.
- **Add unit tests** for key binding logic: test `key.Matches()` with various key combinations, test help overlay toggle, test screen transitions.

## Capabilities

### New Capabilities
- `tui-keybindings`: Standardized key binding system using BubbleTea's `key.Matches()` API. Global keys (quit, help) at root level; screen-specific bindings per sub-model. Replaces manual `switch(msg.String())` checks.
- `tui-help-overlay`: BubbleTea help overlay toggled by `?` key. Replaces footer-based help text. Each screen shows screen-specific action hints in the footer instead of full key lists.

### Modified Capabilities
- `tui-main-menu`: Footer changes from "↑/↓ navigate · enter select · q quit · ? help" to "↑/↓ navigate · enter select · q quit · ? help" (unchanged text, but `q` now works consistently as quit from main menu, and `esc`/`b` are documented as no-op at root).
- `tui-confirm-dialog`: Footer changes from "←/→ or Tab: switch · Enter: confirm · y/n: quick · esc: cancel" to "←/→ toggle · enter confirm · y/n quick · esc/q/b cancel". Yes/No buttons stacked on narrow terminals.
- `tui-update-dialog`: Footer changes from "↑/↓: select · Enter: confirm · q: cancel" to "↑/↓ select · enter confirm · q/esc/b cancel". Version display shows "none" instead of "unknown" on fresh installs.
- `tui-instance-manager`: Adds `q` as quit (in addition to `b`/`esc` as back).
- `tui-output-view`: Adds `q` as quit (in addition to `b`/`esc` as back).

## Impact

- **Code**: `cli/go/internal/tui/` — 8 files modified (model.go, menu.go, confirm.go, update.go, instance.go, output.go, install.go). ~300 lines changed.
- **Dependencies**: Adds `github.com/charmbracelet/bubbles/help` to go.mod (already a dependency of BubbleTea, no new external dependency).
- **Tests**: `cli/go/internal/tui/*_test.go` — add unit tests for key binding logic.
- **Backward compatibility**: No breaking changes to CLI commands or data formats. Only UI behavior changes (keybindings and help display).
