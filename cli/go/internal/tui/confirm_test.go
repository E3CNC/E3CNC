package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewConfirmModel(t *testing.T) {
	m := NewConfirmModel(ConfirmScreen{
		Prompt:      "Are you sure?",
		Warning:     "This will do something",
		Destructive: true,
	})

	if m.focusedYes {
		t.Errorf("NewConfirmModel(): focusedYes should be false (default No)")
	}
	if m.screen.Prompt != "Are you sure?" {
		t.Errorf("NewConfirmModel(): prompt = %q, expected 'Are you sure?'", m.screen.Prompt)
	}
}

func TestConfirmInit(t *testing.T) {
	m := NewConfirmModel(ConfirmScreen{Prompt: "Test"})
	cmd := m.Init()
	if cmd != nil {
		t.Errorf("Init() should return nil, got non-nil")
	}
}

func TestConfirmToggleFocus(t *testing.T) {
	m := NewConfirmModel(ConfirmScreen{Prompt: "Test"})

	// Start with No focused
	if m.focusedYes {
		t.Fatal("expected focusedYes=false initially")
	}

	// Tab to toggle
	m2, _ := m.Update(tea.KeyMsg{Type: tea.KeyTab})
	if !m2.focusedYes {
		t.Errorf("After Tab: focusedYes should be true")
	}

	// Left key toggles back
	m3, _ := m2.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'l'}})
	if m3.focusedYes {
		t.Errorf("After 'l': focusedYes should be false")
	}
}

func TestConfirmEnterNo(t *testing.T) {
	m := NewConfirmModel(ConfirmScreen{Prompt: "Test", Command: "test-cmd"})
	// Default: No focused, pressing Enter should cancel
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("Update(Enter) returned nil cmd")
	}
	msg := cmd()
	cr, ok := msg.(confirmResultMsg)
	if !ok {
		t.Fatalf("expected confirmResultMsg, got %T", msg)
	}
	if cr.Confirmed {
		t.Errorf("Enter with No focused: Confirmed should be false")
	}
}

func TestConfirmEnterYes(t *testing.T) {
	m := NewConfirmModel(ConfirmScreen{Prompt: "Test", Command: "test-cmd"})
	// Toggle to Yes
	m2, _ := m.Update(tea.KeyMsg{Type: tea.KeyTab})
	// Press Enter
	_, cmd := m2.Update(tea.KeyMsg{Type: tea.KeyEnter})
	if cmd == nil {
		t.Fatal("Update(Enter) returned nil cmd")
	}
	msg := cmd()
	cr, ok := msg.(confirmResultMsg)
	if !ok {
		t.Fatalf("expected confirmResultMsg, got %T", msg)
	}
	if !cr.Confirmed {
		t.Errorf("Enter with Yes focused: Confirmed should be true")
	}
	if cr.Command != "test-cmd" {
		t.Errorf("Command = %q, expected 'test-cmd'", cr.Command)
	}
}

func TestConfirmQuickKeys(t *testing.T) {
	m := NewConfirmModel(ConfirmScreen{Prompt: "Test", Command: "test-cmd"})

	// 'y' confirms
	m2, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'y'}})
	_ = m2
	msg := cmd()
	cr := msg.(confirmResultMsg)
	if !cr.Confirmed {
		t.Errorf("'y' should confirm")
	}

	// 'n' cancels
	m3, cmd2 := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'n'}})
	_ = m3
	msg2 := cmd2()
	cr2 := msg2.(confirmResultMsg)
	if cr2.Confirmed {
		t.Errorf("'n' should cancel")
	}

	// 'q' cancels
	m4, cmd3 := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	_ = m4
	msg3 := cmd3()
	cr3 := msg3.(confirmResultMsg)
	if cr3.Confirmed {
		t.Errorf("'q' should cancel")
	}
}

func TestConfirmView(t *testing.T) {
	m := NewConfirmModel(ConfirmScreen{
		Prompt:      "Are you sure?",
		Warning:     "This will do something bad",
		Destructive: true,
	})
	view := m.View()
	if view == "" {
		t.Fatal("View() returned empty string")
	}
	if !contains(view, "Are you sure?") {
		t.Errorf("View() missing prompt, got: %s", view)
	}
	if !contains(view, "This will do something bad") {
		t.Errorf("View() missing warning, got: %s", view)
	}
	if !contains(view, "Yes") || !contains(view, "No") {
		t.Errorf("View() missing Yes/No buttons, got: %s", view)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && containsStr(s, substr)
}

func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
