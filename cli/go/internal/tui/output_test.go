package tui

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewOutputViewModel(t *testing.T) {
	m := NewOutputViewModel()

	if m.ready {
		t.Errorf("NewOutputViewModel(): ready should be false")
	}
	if m.output != "" {
		t.Errorf("NewOutputViewModel(): output should be empty")
	}
	if m.err != nil {
		t.Errorf("NewOutputViewModel(): err should be nil")
	}
}

func TestOutputInit(t *testing.T) {
	m := NewOutputViewModel()
	cmd := m.Init()
	if cmd != nil {
		t.Errorf("OutputViewModel.Init() should return nil, got non-nil")
	}
}

func TestOutputResultMsgShowsOutput(t *testing.T) {
	m := NewOutputViewModel()
	m.title = "Status"

	m2, _ := m.Update(outputResultMsg{
		output: "All systems running\nKlipper: active\nMoonraker: active",
		err:    nil,
	})

	if !m2.ready {
		t.Errorf("ready should be true after outputResultMsg")
	}
	view := m2.View()
	if !strings.Contains(view, "All systems running") {
		t.Errorf("View should contain output, got:\n%s", view)
	}
}

func TestOutputResultMsgShowsError(t *testing.T) {
	m := NewOutputViewModel()

	m2, _ := m.Update(outputResultMsg{
		err: errFake("command failed: permission denied"),
	})

	view := m2.View()
	// Should show error in red style
	if !strings.Contains(view, "Error") {
		t.Errorf("View should show error, got:\n%s", view)
	}
	if !strings.Contains(view, "permission denied") {
		t.Errorf("View should contain error message, got:\n%s", view)
	}
}

func TestOutputViewNotReady(t *testing.T) {
	m := NewOutputViewModel()

	view := m.View()
	if view != "" {
		t.Errorf("Not ready: View() should be empty, got %q", view)
	}
}

func TestOutputViewWithTitle(t *testing.T) {
	m := NewOutputViewModel()
	m.title = "Status Check"
	m.ready = true
	m.output = "OK"

	view := m.View()
	if !strings.Contains(view, "Status Check") {
		t.Errorf("View should show title, got:\n%s", view)
	}
}

func TestOutputViewShowsHelp(t *testing.T) {
	m := NewOutputViewModel()
	m.ready = true
	m.output = "OK"

	view := m.View()
	if !strings.Contains(view, "b: back") {
		t.Errorf("View should show help text with 'b: back', got:\n%s", view)
	}
}

func TestOutputEmptyOutput(t *testing.T) {
	m := NewOutputViewModel()
	m.ready = true
	m.title = "Test"

	view := m.View()
	// Should still render something (title + help)
	if !strings.Contains(view, "Test") {
		t.Errorf("View with empty output should still show title, got:\n%s", view)
	}
}

func TestOutputWindowSize(t *testing.T) {
	m := NewOutputViewModel()

	m2, _ := m.Update(tea.WindowSizeMsg{Height: 30})

	if m2.height != 30 {
		t.Errorf("height = %d, expected 30", m2.height)
	}
	if !m2.ready {
		t.Errorf("ready should be true after WindowSizeMsg")
	}
}
