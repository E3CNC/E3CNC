# e3cnc-tui: BubbleTea Enhancement Strategy

> Branch: `feat/tui-bubbletea-enhancements`
> Worktree: `/tmp/e3cnc-tui-enhance` (preserve this path for the session)
> Current versions: bubbletea v1.3.4 · bubbles v0.20.0 · lipgloss v1.1.0

## Goal

Make the e3cnc-tui **enjoyable** and **fool-proof** for CNC operators who may not be
terminal experts. Reduce cognitive load, prevent mistakes, and make every action feel
smooth.

---

## Current State Assessment

The TUI has a solid foundation but leaves UX on the table:

| Area             | Current                        | Problem                                  |
| ---------------- | ------------------------------ | ---------------------------------------- |
| Menu             | Custom list with manual cursor | No filtering/search, keyboard-only       |
| Text Input       | Manual keystroke tracking      | No cursor movement, paste, validation UI |
| Output View      | Flat text dump                 | Can't scroll back, no pagination         |
| Instance mgr     | Manual form list               | No text editing, no autocomplete         |
| Confirmations    | Custom y/n string match        | No visual confirmation component         |
| Install progress | Text-based spinners            | No progress bars, no estimated time      |
| Help             | Fixed footer text              | No interactive/exposed help panel        |
| Mouse            | None                           | Can't click anything                     |
| Tab completion   | None                           | Can't tab-complete instance names/paths  |

---

## Phase 1: Quick Wins (Low Effort, High Impact)

### 1.1 — Mouse Support

**Why:** Let users click menu items, back buttons, and confirmations instead of
navigating with arrow keys only. Critical for fool-proof UX.

**Implementation:**

```go
// main.go — add to tea.NewProgram options
tea.WithMouseCellMotion()
```

**Files to touch:**

- `cli/go/cmd/e3cnc-tui/main.go` — add `tea.WithMouseCellMotion()` to `NewProgram`
- `cli/go/internal/tui/model.go` — add `tea.MouseMsg` handler to route clicks
  - Check `msg.X`, `msg.Y` coordinates against menu item positions
  - Emit the same `SelectedCmd` as pressing Enter would

**Estimated:** ~50 lines
**Risk:** Low — mouse messages are just another message type in bubbletea

---

### 1.2 — Viewport for Output Display

**Why:** Command output (status, logs, diagnose) can be hundreds of lines. Currently
it's dumped flat with no scrolling. A scrollable viewport lets users page through
long output naturally.

**Implementation:**
Replace the flat string dump in `OutputViewModel` with `bubbles/viewport.Model`:

```go
import "github.com/charmbracelet/bubbles/viewport"

type OutputViewModel struct {
    output   string
    title    string
    ready    bool
    err      error
    vp       viewport.Model  // new
}

// In Update: route tea.WindowSizeMsg, viewport resize + key messages
// In View: render vp with content + footer help bar
```

**Key bindings to support:**

- `↑/↓` or `j/k` — scroll line by line
- `PgUp`/`PgDn` — scroll page by page
- `g`/`G` — top/bottom
- Mouse wheel scroll (automatic with mouse support)
- `b` — back to menu (already works)
- `q` — quit (already works)

**Files to touch:**

- `output.go` — embed viewport.Model, add Update routing, add View rendering
- `styles.go` — maybe a viewport border style
- `model.go` — route viewport key messages to output model

**Estimated:** ~80 lines
**Risk:** Low — well-documented component with clear API

---

### 1.3 — TextInput for Form Fields

**Why:** The instance create form currently uses manual key tracking. `bubbles/textinput`
provides cursor movement, backspace, paste, validation, and visual editing out of the box.

**Implementation:**
Replace the manual form state in `InstanceModel` with `textinput.Model`:

```go
import "github.com/charmbracelet/bubbles/textinput"

type InstanceModel struct {
    // ... existing fields ...
    createNameInput textinput.Model  // new
    createPortInput textinput.Model  // new
}
```

The textinput component handles:

- Character insertion/deletion
- Cursor movement (left/right)
- Paste (Ctrl+V / Cmd+V)
- Validation (we can add a ValidateFunc for instance name rules)
- Focus state and visual cursor

**Migration from current manual approach:**

- Remove `createName` / `createPort` strings
- Remove `createFocusedIdx` counter
- Remove manual keystroke handling in `handleCreateKey`
- Init textinput models with placeholder, char limit, validation
- Style them with lipgloss to match the theme

**Files to touch:**

- `instance.go` — replace form state, update Update/View
- `styles.go` — add textinput-focused style

**Estimated:** ~60 lines change
**Risk:** Low — textinput is the most-used bubbles component

---

### 1.4 — Progress Bar for Installation

**Why:** The install wizard shows text steps with a spinner but no visual progress.
A progress bar with percentage gives immediate feedback on how far along the install is.
Combined with the existing step tracking, it makes the install feel responsive.

**Implementation:**
Add `progress.Model` to the install execution dashboard:

```go
import "github.com/charmbracelet/bubbles/progress"

type InstallModel struct {
    // ... existing fields ...
    progBar progress.Model  // new
}

// In startInstall:
m.progBar = progress.New(progress.WithDefaultGradient())

// In handleStepUpdate: calculate percent = float64(current+1) / float64(len(steps))
// In viewExecDashboard: render progress bar between steps and help
```

**Gradient:** Use `#00ff66` → `#00ffff` (green to cyan) to match existing theme.

**Files to touch:**

- `install.go` — add progress model, update viewExecDashboard
- `styles.go` — customize progress bar colors/full/empty chars

**Estimated:** ~30 lines
**Risk:** Very low — simple state → % mapping

---

## Phase 2: Structural Polish (Medium Effort, High Polish)

### 2.1 — Destructive Action Confirmation Component ✅ Done

**Why:** Currently delete instance and destructive install actions use manual
`y/n` string matching. `bubbles/confirm` provides a polished confirmation dialog
with focus management and keyboard handling.

**Implementation:**
Uses custom `ConfirmModel` (confirm.go) with:

- "Yes" / "No" buttons with keyboard navigation (Tab/arrows)
- Enter to confirm, Esc to cancel
- `y`/`n` quick keys
- Customizable prompt text and button labels
- Destructive actions highlighted in red
- Default focus is "No" (safer default)

**Commands covered:** uninstall, rollback, flash-mcu, init-config

---

### 2.2 — Interactive Help Overlay

**Why:** Currently help is a static footer. Bubbletea's help.Model supports
short/full help pages and can be toggled with `?`. Make help content rich
and per-screen contextual.

**Implementation:**
The `help.Model` is already imported but barely used. Enhance it:

1. On `?` keypress, toggle `help.ShowAll = !help.ShowAll`
2. Per-screen key bindings via the keyMap's `FullHelp()` method
3. Add a screen-specific help overlay that describes what each key does on
   the current screen

```go
// In model.go Update:
case tea.KeyMsg:
    if msg.String() == "?" {
        m.help.ShowAll = !m.help.ShowAll
    }
```

**Per-screen help content:**

- Main menu: navigation, search/filter, category jumps
- Instance manager: list navigation, create/delete, switch active
- Install wizard: step descriptions, recovery options
- Output view: scroll controls, search within output

**Files to touch:**

- `model.go` — add `?` toggle handler
- Sub-model Views — incorporate help rendering

**Estimated:** ~50 lines
**Risk:** Very low — help.Model already imported

---

### 2.3 — Terminal Title & Status Bar

**Why:** Set the terminal title so window managers/tabs show "e3cnc-tui" instead
of something generic. Add a status bar at the bottom showing current screen, version,
and active instance.

**Implementation:**

```go
// On init:
return tea.Batch(
    tea.SetWindowTitle("e3cnc-tui - E3CNC CLI"),
    // other cmds
)

// Status bar in root Model.View():
// Use lipgloss.JoinVertical to combine content with status bar
func (m Model) statusBar() string {
    screenName := [...]string{"Main Menu", "Install Wizard", "Error Recovery",
        "Instance Mgr", "Output View"}[m.state]
    return lipgloss.NewStyle().Foreground(ColorDim).Render(
        fmt.Sprintf("e3cnc-tui v%s · %s · %s", version, screenName, time.Now().Format("15:04")))
}
```

**Files to touch:**

- `model.go` — add statusBar(), include in View()
- `main.go` — pass version to TUI model

**Estimated:** ~40 lines
**Risk:** Very low

---

### 2.4 — Unified Error Handling & Recovery

**Why:** Error messages are scattered. Some appear as styled text, others as raw
errors. A consistent error/success notification system makes the TUI feel
professional and helps users recover from mistakes.

**Implementation:**
Add a notification bar to the root Model that displays brief status messages:

```go
type Notification struct {
    Text      string
    Type      string // "error", "success", "info", "warning"
    ExpiresAt time.Time
}

type Model struct {
    // ...
    notification *Notification
}

// In View(): render notification above content if active
// Auto-dismiss after 3s using tea.Tick
```

Replace scattered `loadErr` fields in sub-models with notification messages.

**Files to touch:**

- `model.go` — add Notification type and rendering
- `instance.go` — replace `loadErr` with root notifications
- `output.go` — integrate with notification system

**Estimated:** ~100 lines
**Risk:** Low — just a structured message system

---

## Phase 3: Power Features (Larger Effort, High Value)

### 3.1 — Table Component for Releases & Backups

**Why:** The releases and backups commands produce tabular data. Currently they
go to the output view as raw text. `bubbles/table` renders structured data with
column headers, sortable columns, and row selection — allowing users to pick
a release to rollback to or a backup to restore from directly in the TUI.

**Implementation:**
Replace the `StateOutputView` handler for `releases`, `backup`, `rollback` commands
with a dedicated table view:

```go
type ReleasesModel struct {
    table table.Model
    releases []ReleaseInfo
    loaded bool
}

// For rollback: fetch releases, show table, select one, confirm, execute
// For restores: fetch backups, show table, select one, confirm, execute
```

**Table columns:**

- Releases: Version, Date, Size, Channel (stable/nightly)
- Backups: ID, Date, Size, Instance

**Files to touch:**

- `tui/table.go` — new file for ReleasesModel / BackupModel
- `model.go` — add new state(s)
- `menu.go` — route specific commands to table view

**Estimated:** ~150 lines
**Risk:** Medium — new model, needs state management

---

### 3.2 — Menu Search/Filter

**Why:** The main menu has 18+ items. Typing to filter/search would be much
faster than arrow-keying through categories. The `bubbles/list` component
has built-in fuzzy filtering.

**Implementation:**
Replace `MenuModel` with `list.Model`:

```go
import "github.com/charmbracelet/bubbles/list"

type MenuItemData struct {
    label, cmd, desc, category string
    destructive bool
}

func (i MenuItemData) FilterValue() string {
    return i.label + " " + i.category + " " + i.desc
}

func (i MenuItemData) Title() string       { return i.label }
func (i MenuItemData) Description() string { return i.desc }
```

The list component provides:

- `/` to start filtering, type to narrow
- Fuzzy matching (uses `sahilm/fuzzy`)
- Shows matched characters highlighted
- Built-in pagination
- Status bar showing "N items"
- Esc to clear filter

**Trade-off:** list.Model uses `list.DefaultDelegate` which has its own rendering.
We'd need a custom `ItemDelegate` to preserve our category headers and destructive
item styling. This is doable but takes ~80 lines of delegate code.

**Alternative approach:** Keep custom menu but add a `/` key that shows a
filter/quick-jump overlay. Less polished but preserves existing layout.

**Files to touch:**

- `menu.go` — major refactor to use list.Model
- `styles.go` — list delegate styling
- `model.go` — adapt to list.Model interface

**Estimated:** ~200 lines
**Risk:** Medium-high — replaces core navigation pattern

---

### 3.3 — Instance Manager: Detail View & Actions

**Why:** Currently the instance list shows name + status + a detail line. Clicking
enter switches the active instance. Could be richer: show full details, provide
in-line actions (restart, stop, start services, view config).

**Implementation:**
Add a detail screen when pressing `enter` on an instance:

```
┌─ Instance: cnc ─────────────────────────────────┐
│                                                   │
│  ● Running                                       │
│                                                   │
│  Moonraker:  http://192.168.0.239:7126            │
│  Web UI:     http://192.168.0.239/               │
│  Config:     /home/biqu/printer_data/config       │
│  MCU:        /dev/serial/by-id/usb-Klipper...    │
│                                                   │
│  Actions:                                         │
│  [r] Restart Klipper   [m] Restart Moonraker      │
│  [s] Stop              [c] View config            │
│  [l] Logs              [b] Back to list           │
└───────────────────────────────────────────────────┘
```

**Files to touch:**

- `instance.go` — add detail screen, action dispatch
- `model.go` — new state or sub-state

**Estimated:** ~150 lines
**Risk:** Medium

---

## Implementation Order

```
Phase 1 (now):   1.1 + 1.2 + 1.3 + 1.4  →  Essential UX
Phase 2 (next):  2.1 + 2.2 + 2.3 + 2.4  →  Structural polish
Phase 3 (later): 3.1 + 3.2 + 3.3         →  Power features
```

Each phase is independently shippable. Do Phase 1 first — it's the lowest
effort for the biggest usability jump.

---

## Things to NOT change (keep as-is)

- **Overall architecture** — sub-model routing via `AppState` is clean and works
- **Style/color palette** — green/cyan theme is distinctive and readable
- **spinner.Model usage** — works great for indeterminate progress
- **help.Model integration** — already imported, just needs activation
- **backToMenuMsg pattern** — clean pattern for sub-model exit

---

## Files Summary (all changes under `cli/go/internal/tui/` and `cli/go/cmd/e3cnc-tui/`)

| File                    | Phase              | Change                                                |
| ----------------------- | ------------------ | ----------------------------------------------------- |
| `cmd/e3cnc-tui/main.go` | 1.1                | Add `tea.WithMouseCellMotion()`                       |
| `model.go`              | 1.1, 2.2, 2.3, 2.4 | Mouse handler, help toggle, status bar, notifications |
| `output.go`             | 1.2                | Replace flat output with viewport.Model               |
| `instance.go`           | 1.3, 2.1           | Use textinput, confirm for delete                     |
| `install.go`            | 1.4, 2.1           | Add progress bar, confirm for destructive             |
| `menu.go`               | 3.2                | (Phase 3) Use list.Model with custom delegate         |
| `styles.go`             | 1.4, 2.2           | Progress bar gradient, textinput style                |
| NEW `table.go`          | 3.1                | (Phase 3) Releases/backups table model                |
| `go.mod`                | 1.2, 1.3, 1.4      | Already have dependencies (bubbles v0.20.0)           |
