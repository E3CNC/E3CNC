package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewModel(t *testing.T) {
	m := New("")

	if m.state != StateMainMenu {
		t.Errorf("New(): state = %d, expected StateMainMenu", m.state)
	}
	if m.err != nil {
		t.Errorf("New(): err should be nil, got %v", m.err)
	}
	if m.width != 0 || m.height != 0 {
		t.Errorf("New(): dimensions should be 0, got %dx%d", m.width, m.height)
	}
}

func TestModelInit(t *testing.T) {
	m := New("")
	cmd := m.Init()

	if cmd == nil {
		t.Fatal("Model.Init() should return a batch command")
	}
}

func TestModelWindowSize(t *testing.T) {
	m := New("")

	mod, _ := m.Update(tea.WindowSizeMsg{Width: 120, Height: 40})
	m2 := mod.(Model)

	if m2.width != 120 || m2.height != 40 {
		t.Errorf("WindowSize: got %dx%d, expected 120x40", m2.width, m2.height)
	}
}

func TestModelCtrlCQuits(t *testing.T) {
	m := New("")

	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})
	m2 := mod.(Model)

	if m2.state != StateMainMenu {
		t.Errorf("state = %d, expected StateMainMenu", m2.state)
	}
	if cmd == nil {
		t.Fatal("Ctrl+C should return tea.Quit command")
	}
}

func TestModelQQuitsFromMainMenu(t *testing.T) {
	m := New("")

	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	m2 := mod.(Model)

	if cmd == nil {
		t.Fatal("'q' should return a command")
	}
	if m2.state != StateMainMenu {
		t.Errorf("state = %d, expected StateMainMenu", m2.state)
	}
}

func TestModelBFromOutputView(t *testing.T) {
	m := New("")
	m.state = StateOutputView
	m.output.ready = true

	// 'b' from output view goes back via backToMenuMsg command
	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'b'}})
	m2 := mod.(Model)

	// Output view handled it — cmd is a backToMenuMsg closure, root stays in OutputView
	if m2.state != StateOutputView {
		t.Errorf("After 'b': state = %d, expected StateOutputView (backToMenuMsg is deferred)", m2.state)
	}
	if cmd == nil {
		t.Errorf("After 'b': expected non-nil cmd (backToMenuMsg)")
	}

	// Now execute the cmd to get a backToMenuMsg
	msg := cmd()
	if _, ok := msg.(backToMenuMsg); !ok {
		t.Errorf("cmd() should produce backToMenuMsg, got %T", msg)
	}

	// Route the backToMenuMsg
	mod2, _ := m2.Update(msg)
	m3 := mod2.(Model)
	if m3.state != StateMainMenu {
		t.Errorf("After backToMenuMsg: state = %d, expected StateMainMenu", m3.state)
	}
}

func TestModelEscFromOutputView(t *testing.T) {
	m := New("")
	m.state = StateOutputView
	m.output.ready = true

	// esc from output view goes back via backToMenuMsg command
	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEscape})
	m2 := mod.(Model)

	if m2.state != StateOutputView {
		t.Errorf("After esc: state = %d, expected StateOutputView (backToMenuMsg is deferred)", m2.state)
	}
	if cmd == nil {
		t.Errorf("After esc: expected non-nil cmd (backToMenuMsg)")
	}

	// Execute the cmd to produce backToMenuMsg
	msg := cmd()
	if _, ok := msg.(backToMenuMsg); !ok {
		t.Errorf("cmd() should produce backToMenuMsg, got %T", msg)
	}

	mod2, _ := m2.Update(msg)
	m3 := mod2.(Model)
	if m3.state != StateMainMenu {
		t.Errorf("After backToMenuMsg: state = %d, expected StateMainMenu", m3.state)
	}
}

func TestModelBackToMenuMsg(t *testing.T) {
	m := New("")
	m.state = StateInstallWizard

	mod, cmd := m.Update(backToMenuMsg{})
	m2 := mod.(Model)

	if m2.state != StateMainMenu {
		t.Errorf("After backToMenuMsg: state = %d, expected StateMainMenu", m2.state)
	}
	if m2.menu.SelectedCmd != "" {
		t.Errorf("SelectedCmd should be cleared after backToMenuMsg, got %q", m2.menu.SelectedCmd)
	}
	if cmd != nil {
		t.Errorf("backToMenuMsg should return nil cmd, got non-nil")
	}
}

func TestModelMainMenuSelectInstall(t *testing.T) {
	m := New("")

	// Navigate menu to Install (index 0) via menu model directly, then press Enter
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}}) // uncaptured — sets SelectedCmd, but we reset
	// Set cursor to Install and simulate the full flow
	m.menu.cursor = 0
	mod, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(Model)

	if m2.state != StateInstallWizard {
		t.Errorf("After Install select: state = %d, expected StateInstallWizard", m2.state)
	}
}

func TestModelMainMenuSelectInstances(t *testing.T) {
	m := New("")

	// Instances is at index 6 in the menu items
	m.menu.cursor = 6
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(Model)

	if m2.state != StateInstanceMgr {
		t.Errorf("After instances select: state = %d, expected StateInstanceMgr", m2.state)
	}
}

func TestModelMainMenuSelectQuit(t *testing.T) {
	m := New("")

	m.menu.cursor = len(m.menu.items) - 1 // Quit is the last item
	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	_ = mod.(Model)

	if cmd == nil {
		t.Fatal("After 'quit' select: should return a command")
	}
}

func TestModelMainMenuSelectOther(t *testing.T) {
	m := New("")

	// "Status" is at index 4
	m.menu.cursor = 4
	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(Model)

	if m2.state != StateOutputView {
		t.Errorf("After status select: state = %d, expected StateOutputView", m2.state)
	}
	if cmd == nil {
		t.Errorf("Expected RunCommand cmd for status")
	}
}

func TestModelInstallWizardDone(t *testing.T) {
	m := New("")
	m.state = StateInstallWizard
	m.install.done = true

	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(Model)

	// Done flag in install model should reset state to main menu
	if m2.state != StateMainMenu {
		t.Errorf("After install.done: state = %d, expected StateMainMenu", m2.state)
	}
	if cmd != nil {
		t.Errorf("Should return nil cmd when install.done, got non-nil")
	}
}

func TestModelInstanceMgrDone(t *testing.T) {
	m := New("")
	m.state = StateInstanceMgr
	m.instance.done = true

	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(Model)

	if m2.state != StateMainMenu {
		t.Errorf("After instance.done: state = %d, expected StateMainMenu", m2.state)
	}
	if cmd != nil {
		t.Errorf("Should return nil cmd when instance.done, got non-nil")
	}
}

func TestModelViewDelegation(t *testing.T) {
	tests := []struct {
		name     string
		state    AppState
		setup    func(m *Model)
	}{
		{"MainMenu", StateMainMenu, nil},
		{"InstallWizard", StateInstallWizard, nil},
		{"InstanceMgr", StateInstanceMgr, nil},
		{"OutputView", StateOutputView, func(m *Model) {
			m.output.ready = true
			m.output.output = "done"
		}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := New("")
			m.state = tc.state
			if tc.setup != nil {
				tc.setup(&m)
			}

			view := m.View()
			if view == "" {
				t.Errorf("View() for state %d returned empty string", tc.state)
			}
		})
	}
}

func TestModelDefaultView(t *testing.T) {
	m := New("")
	m.state = AppState(99) // unknown state

	view := m.View()
	if view == "" {
		t.Errorf("View() for unknown state should fall back to menu view")
	}
}
