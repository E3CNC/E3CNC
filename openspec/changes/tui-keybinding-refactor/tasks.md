## 1. Key Binding Architecture

- [ ] 1.1 Refactor `model.go` key handling to use `key.Matches(msg, binding)` instead of `msg.String()` comparisons; define global bindings (Quit=`Ctrl+C`, Help=`?`) at root.
- [ ] 1.2 Replace the combined `defaultKeys` map with per-screen binding definitions owned by each sub-model, and remove the dead `defaultKeys` global.
- [ ] 1.3 Update root `Model.Update()` to handle global keys (`Ctrl+C` quit, `?` help) before dispatching to sub-models.

## 2. Screen-Specific Key Bindings

- [ ] 2.1 Update `menu.go` to use bindings: `q`=quit at root, `esc`/`b`=no-op, `enter`=select, `up`/`k`, `down`/`j` navigate.
- [ ] 2.2 Update `confirm.go` to use bindings: `left`/`right` toggle focus, `enter` confirm/cancel, `y`/`n` quick, `q`/`esc`/`b` cancel.
- [ ] 2.3 Update `update.go` to use bindings: `up`/`down` navigate, `enter` confirm/cancel, `q`/`esc`/`b` cancel.
- [ ] 2.4 Update `instance.go` to use bindings: `up`/`down`/`enter`, `q` quit, `b`/`esc` back.
- [ ] 2.5 Update `output.go` to use bindings: `b`/`esc` back, `q` quit.
- [ ] 2.6 Update `install.go` screen-specific key handling to use bindings while preserving existing screen flow.

## 3. Help Overlay

- [ ] 3.1 Implement `?`-toggled help overlay using `bubbles/help` at the root model; wire each sub-model's `ShortHelp()`/`FullHelp()` into it.
- [ ] 3.2 Replace per-screen footer key lists with one-line action hints; ensure hint text matches actual bindings.
- [ ] 3.3 Verify help overlay content reflects the binding contract (Ctrl+C=quit, screen-dependent cancel).

## 4. Related Bug Fixes

- [ ] 4.1 Fix confirm-dialog Yes/No button wrapping on narrow terminals (stack vertically below a width threshold).
- [ ] 4.2 Fix "Current: unknown" version label to show "none"/"not installed" on fresh installs (no activated release).

## 5. Tests

- [ ] 5.1 Add unit tests for `model.go` key handling: quit via Ctrl+C from every state, help toggle, dispatch.
- [ ] 5.2 Add unit tests for `menu.go` key bindings (navigate, select, quit at root).
- [ ] 5.3 Add unit tests for `confirm.go` and `update.go` bindings (focus toggle, enter, y/n, q/esc/b cancel).
- [ ] 5.4 Add unit tests for `instance.go`/`output.go` bindings (navigate, back, quit).
- [ ] 5.5 Run `go test ./...` in `cli/go` to confirm no regressions.
