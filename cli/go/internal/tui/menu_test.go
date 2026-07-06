package tui

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewMenuModel(t *testing.T) {
	m := NewMenuModel("")

	if len(m.items) == 0 {
		t.Fatal("NewMenuModel(): items should not be empty")
	}
	if m.cursor != 0 {
		t.Errorf("NewMenuModel(): cursor = %d, expected 0", m.cursor)
	}
	if m.SelectedCmd != "" {
		t.Errorf("NewMenuModel(): SelectedCmd should be empty, got %q", m.SelectedCmd)
	}

	// Verify all 4 sections are present
	seenCategories := map[string]bool{}
	for _, item := range m.items {
		if item.Category != "" {
			seenCategories[item.Category] = true
		}
	}
	for _, cat := range []string{"Setup", "Monitor", "Hardware", "Manage", "Tools"} {
		if !seenCategories[cat] {
			t.Errorf("NewMenuModel(): missing category %q", cat)
		}
	}

	// Verify no duplicate command names
	seenCmds := map[string]bool{}
	for _, item := range m.items {
		if item.Command != "" {
			if seenCmds[item.Command] {
				t.Errorf("NewMenuModel(): duplicate command %q", item.Command)
			}
			seenCmds[item.Command] = true
		}
	}

	// Verify Quit is the last non-empty item
	lastCmd := ""
	for _, item := range m.items {
		if item.Command != "" {
			lastCmd = item.Command
		}
	}
	if lastCmd != "quit" {
		t.Errorf("NewMenuModel(): last command should be 'quit', got %q", lastCmd)
	}
}

func TestMenuInit(t *testing.T) {
	m := NewMenuModel("")
	cmd := m.Init()
	if cmd != nil {
		t.Errorf("MenuModel.Init() should return nil, got non-nil")
	}
}

func TestMenuNavigateDown(t *testing.T) {
	m := NewMenuModel("")
	initial := m.cursor

	// Navigate down twice
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m2 := mod.(MenuModel)

	if m2.cursor != m.skipEmpty(initial+1, 1) {
		t.Errorf("After Down: cursor = %d, expected %d", m2.cursor, m.skipEmpty(initial+1, 1))
	}

	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'j'}})
	m3 := mod.(MenuModel)

	if m3.cursor == m2.cursor {
		t.Errorf("After 'j': cursor should have moved, stayed at %d", m3.cursor)
	}
}

func TestMenuNavigateUp(t *testing.T) {
	m := NewMenuModel("")
	// Move down a few times first
	m.cursor = 5

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m2 := mod.(MenuModel)

	if m2.cursor != m.skipEmpty(5-1, -1) {
		t.Errorf("After Up: cursor = %d, expected %d", m2.cursor, m.skipEmpty(5-1, -1))
	}

	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'k'}})
	m3 := mod.(MenuModel)

	if m3.cursor == m2.cursor {
		t.Errorf("After 'k': cursor should have moved, stayed at %d", m3.cursor)
	}
}

func TestMenuNavigateWrapAround(t *testing.T) {
	m := NewMenuModel("")

	// Press Up from top should wrap to bottom
	m.cursor = 0
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m2 := mod.(MenuModel)

	if m2.cursor != m.skipEmpty(len(m.items)-1, -1) {
		t.Errorf("Wrap up: cursor = %d, expected last valid item", m2.cursor)
	}

	// Press Down from bottom should wrap to top
	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyDown})
	m3 := mod.(MenuModel)

	if m3.cursor != m.skipEmpty(0, 1) {
		t.Errorf("Wrap down: cursor = %d, expected first valid item", m3.cursor)
	}
}

func TestMenuNavigateSkipsEmptyItems(t *testing.T) {
	m := NewMenuModel("")

	// Cursor on an item right before a separator
	// Item 2 is "Uninstall" (index 2, after items at 0,1,2, then separator at 3)
	m.cursor = 2 // "Uninstall"

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m2 := mod.(MenuModel)

	// Should skip the empty separator at index 3 and land on index 4 ("Status")
	if m2.items[m2.cursor].Command != "status" {
		t.Errorf("After Down from Uninstall: cursor on %q, expected 'status'",
			m2.items[m2.cursor].Command)
	}
}

func TestMenuEnterSelectsItem(t *testing.T) {
	m := NewMenuModel("")

	// Cursor at "Install" (index 0)
	m.cursor = 0
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(MenuModel)

	if m2.SelectedCmd != "install" {
		t.Errorf("Enter on Install: SelectedCmd = %q, expected 'install'", m2.SelectedCmd)
	}
}

func TestMenuEnterOnEmptyItem(t *testing.T) {
	m := NewMenuModel("")

	// Place cursor on a separator
	m.cursor = 3 // separator

	prevSelected := m.SelectedCmd
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(MenuModel)

	if m2.SelectedCmd != prevSelected {
		t.Errorf("Enter on separator should not change SelectedCmd, got %q", m2.SelectedCmd)
	}
}

func TestMenuQQuits(t *testing.T) {
	m := NewMenuModel("")

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	m2 := mod.(MenuModel)

	if m2.SelectedCmd != "quit" {
		t.Errorf("'q' key: SelectedCmd = %q, expected 'quit'", m2.SelectedCmd)
	}
}

func TestMenuWindowSize(t *testing.T) {
	m := NewMenuModel("")

	mod, _ := m.Update(tea.WindowSizeMsg{Width: 100, Height: 40})
	m2 := mod.(MenuModel)

	if m2.width != 100 || m2.height != 40 {
		t.Errorf("WindowSize: got %dx%d, expected 100x40", m2.width, m2.height)
	}
}

func TestMenuViewContainsSections(t *testing.T) {
	m := NewMenuModel("")
	view := m.View()

	sections := []string{"CLI version ->", "Setup", "Monitor", "Hardware", "Manage", "Tools", "↑/↓ navigate"}
	for _, s := range sections {
		if !strings.Contains(view, s) {
			t.Errorf("Menu.View() missing section/help text: %q", s)
		}
	}
}

func TestMenuViewHasCursor(t *testing.T) {
	m := NewMenuModel("")
	m.cursor = 4 // "Status"

	view := m.View()
	if !strings.Contains(view, "▸") {
		t.Errorf("Menu.View() should show cursor, got:\n%s", view)
	}
}

func TestMenuViewDestructiveStyle(t *testing.T) {
	m := NewMenuModel("")
	m.cursor = 0 // "Install" is destructive
	view := m.View()

	// "Install" should appear in the view
	if !strings.Contains(view, "Install") {
		t.Errorf("Menu.View() should contain 'Install', got:\n%s", view)
	}
}

func TestSkipEmpty(t *testing.T) {
	m := NewMenuModel("")

	// Test moving forward from a separator lands on a valid item
	// Index 3 is a separator, moving forward should land on index 4 ("Status")
	cursor := m.skipEmpty(3, 1)
	if m.items[cursor].Command == "" {
		t.Errorf("skipEmpty(3, 1) landed on empty at index %d", cursor)
	}
	if cursor != 4 {
		t.Errorf("skipEmpty(3, 1): got %d, expected 4 (Status)", cursor)
	}

	// Test moving backward from a separator lands on a valid item
	// Index 3 is a separator, moving backward should land on index 2 ("Uninstall")
	cursor = m.skipEmpty(3, -1)
	if m.items[cursor].Command == "" {
		t.Errorf("skipEmpty(3, -1) landed on empty at index %d", cursor)
	}
	if cursor != 2 {
		t.Errorf("skipEmpty(3, -1): got %d, expected 2 (Uninstall)", cursor)
	}

	// Starting on a valid item stays put
	cursor = m.skipEmpty(0, -1)
	if cursor != 0 {
		t.Errorf("skipEmpty(0, -1): got %d, expected 0 (already valid)", cursor)
	}

	// Moving from a valid item to another valid item
	cursor = m.skipEmpty(0, 1)
	if cursor != 0 {
		t.Errorf("skipEmpty(0, 1): got %d, expected 0 (valid, no move needed)", cursor)
	}
}

func TestMenuItemsFollowSchema(t *testing.T) {
	m := NewMenuModel("")

	for i, item := range m.items {
		if item.Command == "" {
			continue // separator
		}
		if item.Label == "" {
			t.Errorf("items[%d]: command %q has empty Label", i, item.Command)
		}
		if item.Command == "quit" {
			if item.Destructive {
				t.Errorf("items[%d]: Quit should not be destructive", i)
			}
		}
		// Descriptions should be non-empty for action items
		if item.Description == "" {
			t.Errorf("items[%d]: command %q has empty Description", i, item.Command)
		}
	}
}
