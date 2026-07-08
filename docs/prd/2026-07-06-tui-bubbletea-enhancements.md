# PRD: e3cnc-tui BubbleTea Enhancements

**Date:** 2026-07-06
**Status:** Phase 1 ✅ Complete · Phase 2 ✅ Complete  
**Branch:** `feat/tui-bubbletea-enhancements`

---

## Problem

The e3cnc-tui CLI had a functional but spartan interface:
- Menu navigation was keyboard-only with no mouse support
- Command output was dumped as flat text with no scrollback
- Forms used manual keystroke tracking instead of proper text inputs
- Install wizard showed no progress bar and streamed verbose logs inline, causing display glitches
- Destructive commands ran immediately without confirmation
- Menu descriptions were unaligned and used inconsistent phrasing
- The install wizard failed entirely on the first error instead of continuing through non-blocking steps

## Goals

1. Make the TUI **enjoyable** to use — smooth, polished, responsive
2. Make the TUI **fool-proof** — confirm destructive actions, handle errors gracefully
3. Make the TUI **visually consistent** — aligned descriptions, branded ASCII art, coherent color theme

---

## Phase 1: Quick Wins (Completed)

### 1.1 — Scrollable Output View
**Files:** `output.go`
**What:** Replaced flat text dump with `bubbles/viewport`. Command output (Status, Diagnose, Logs) appears in a scrollable viewport with PgUp/PgDn, arrow keys, and mouse wheel support.

### 1.2 — Text Inputs for Forms
**Files:** `instance.go`, `install.go`
**What:** Replaced manual keystroke tracking with `bubbles/textinput`. Instance create form and install wizard now have proper text fields with cursor movement, paste, character limits, placeholders, and Tab to switch fields.

### 1.3 — Progress Bar
**Files:** `install.go`
**What:** Added `bubbles/progress` with green→cyan gradient to the install execution dashboard, showing completion percentage in real-time.

### 1.4 — Version Display
**Files:** `menu.go`, `main.go`
**What:** Version string passed from build ldflags to the TUI, displayed as `CLI version -> dev-<timestamp>` below the ASCII art banner.

---

## Phase 2: Structural Polish (Completed)

### 2.1 — Confirmation Dialogs
**Files:** `confirm.go`, `model.go`
**What:** Custom confirmation dialog with Yes/No buttons (Tab/arrows to switch, y/n quick keys, default focus on No). Applied to: Uninstall, Rollback, Flash MCU, Init Config. Previously these commands ran immediately without warning.

### 2.2 — ASCII Art Banner
**Files:** `menu.go`
**What:** E3CNC branded block-character logo (matching the browser console art) displayed at the top of the main menu in cyan/green.

### 2.3 — Aligned Descriptions with Dashes
**Files:** `menu.go`
**What:** Dynamic padding calculated from the longest label ("Installation Wizard" = 19 chars + 4 gap). Labels and descriptions connected with `---` dashes, all descriptions aligned at the same column.

### 2.4 — Color Theme
**Files:** `styles.go`
**What:** Replaced cyan (`#00ffff`) with green (`#00dd55`). Selected items always green bold. Descriptions: dim when not selected, green when selected.

### 2.5 — Tighter Menu Spacing
**Files:** `styles.go`, `menu.go`
**What:** Removed `MarginBottom` from section headers and extra newlines. Menu now fits in a 44-line terminal with the 6-line ASCII art banner visible.

### 2.6 — Renamed "Install" to "Installation Wizard"
**Files:** `menu.go`
**What:** Clearer label for the install entry point.

---

## Phase 3: Install Wizard Overhaul (Completed)

### 3.1 — Mode Selection Screen
**Files:** `install.go`
**What:** Install wizard starts by asking: "Import existing Klipper" or "Create new E3CNC instance". Selection determines whether pre-flight checks run or existing installation is detected.

### 3.2 — Non-blocking Step Execution
**Files:** `bootstrap.go`, `install.go`
**What:** Bootstrap steps classified as blocking or non-blocking:
- **Non-blocking** (system packages, sudoers, nginx config) — failure is logged and skipped automatically
- **Blocking** (directories, vendored components, virtualenvs, configs, services) — failure stops the install and shows error recovery screen

### 3.3 — Separate Log Viewport
**Files:** `install.go`
**What:** Verbose log output rendered in a dedicated `bubbles/viewport` panel below the step list. No more display glitches from inline log streaming. PgUp/PgDn scrolls the log panel independently. Verbose is on by default, toggle with `v`.

### 3.4 — Automatic Skip on Non-blocking Failure
**Files:** `install.go`
**What:** When all steps complete with only non-blocking failures, the verification screen is shown instead of the error recovery screen. Failed steps are listed as warnings.

---

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Custom confirm dialog vs bubbles/confirm | bubbles v0.20.0 doesn't have a confirm package |
| `backToMenuMsg` pattern | Clean sub-model exit without root model coupling |
| `textinput.Blink` on screen transition | Ensures cursor starts blinking immediately |
| Step blocking via `bool` field | Simple, explicit, easy to maintain |
| `lipgloss.JoinVertical` for layout | Native bubbletea, no external layout library needed |

## Dependencies Added

- `github.com/charmbracelet/bubbles` v0.20.0 (already indirect, now direct)
- `github.com/atotto/clipboard` (transitive via textinput)
- `github.com/charmbracelet/harmonica` (transitive via progress)

## Build

```bash
cd cli/go
# Dev build with timestamp
GOOS=linux GOARCH=arm64 go build -ldflags="-X main.version=dev-$(date +%m%d-%H%M%S)" -o e3cnc-tui ./cmd/e3cnc-tui/

# Release build
GOOS=linux GOARCH=arm64 go build -ldflags="-X main.version=v0.9.14" -o e3cnc-tui ./cmd/e3cnc-tui/
```

## Testing

```bash
cd cli/go
go test -short -count=1 ./internal/tui/
go test -short -count=1 ./internal/bootstrap/
# Full suite (requires CNC host):
go test -count=1 ./internal/tui/ -run TestTUI
```

## Future Work (not in scope for this PRD)

- Search/filter in menu (bubbles/list)
- Table view for releases/backups (bubbles/table)
- Status bar showing active instance and network info
- Interactive help overlay with per-screen key bindings
- Notification toast system for success/error messages
- Instance detail view with service controls
