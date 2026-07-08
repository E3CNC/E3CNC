package tui

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

func TestNewInstanceModel(t *testing.T) {
	m := NewInstanceModel()

	if m.screen != InstList {
		t.Errorf("NewInstanceModel(): screen = %d, expected InstList", m.screen)
	}
	if !m.loading {
		t.Errorf("NewInstanceModel(): loading should be true")
	}
	if m.done {
		t.Errorf("NewInstanceModel(): done should be false")
	}
}

func TestInstanceInit(t *testing.T) {
	m := NewInstanceModel()
	cmd := m.Init()

	if cmd == nil {
		t.Fatal("InstanceModel.Init() should return a command (fetchInstances)")
	}
}

func TestInstanceListMsg(t *testing.T) {
	m := NewInstanceModel()
	m.loading = true

	instances := []InstanceInfo{
		{Name: "default", IsRunning: true, MoonrakerPort: 7125, WebPort: 80, MoonrakerService: "moonraker"},
		{Name: "test-box", IsRunning: false, MoonrakerPort: 7126, WebPort: 8080, MoonrakerService: "moonraker-test-box"},
	}

	mod, _ := m.Update(instanceListMsg{
		instances: instances,
		localIP:   "192.168.1.100",
		err:       nil,
	})
	m2 := mod.(InstanceModel)

	if m2.loading {
		t.Errorf("loading should be false after instanceListMsg")
	}
	if m2.loadErr != "" {
		t.Errorf("loadErr should be empty, got %q", m2.loadErr)
	}
	if len(m2.instances) != 2 {
		t.Errorf("instances len = %d, expected 2", len(m2.instances))
	}
	if m2.localIP != "192.168.1.100" {
		t.Errorf("localIP = %q, expected '192.168.1.100'", m2.localIP)
	}
}

func TestInstanceListMsgError(t *testing.T) {
	m := NewInstanceModel()
	m.loading = true

	mod, _ := m.Update(instanceListMsg{
		err: errFake("connection refused"),
	})
	m2 := mod.(InstanceModel)

	if m2.loading {
		t.Errorf("loading should be false after error")
	}
	if m2.loadErr == "" {
		t.Errorf("loadErr should be set after error")
	}
}

type errFake string

func (e errFake) Error() string { return string(e) }

func TestInstanceNavigation(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.instances = []InstanceInfo{
		{Name: "default"},
		{Name: "test-box"},
		{Name: "dev-box"},
	}
	m.cursor = 0

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m2 := mod.(InstanceModel)
	if m2.cursor != 1 {
		t.Errorf("After Down: cursor = %d, expected 1", m2.cursor)
	}

	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyDown})
	m3 := mod.(InstanceModel)
	if m3.cursor != 2 {
		t.Errorf("After second Down: cursor = %d, expected 2", m3.cursor)
	}

	mod, _ = m3.Update(tea.KeyMsg{Type: tea.KeyDown})
	m4 := mod.(InstanceModel)
	if m4.cursor != 2 {
		t.Errorf("At end: cursor = %d, expected 2 (no wrap)", m4.cursor)
	}
}

func TestInstanceNavigationUp(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.instances = []InstanceInfo{
		{Name: "default"},
		{Name: "test-box"},
	}
	m.cursor = 1

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m2 := mod.(InstanceModel)
	if m2.cursor != 0 {
		t.Errorf("After Up: cursor = %d, expected 0", m2.cursor)
	}

	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyUp})
	m3 := mod.(InstanceModel)
	if m3.cursor != 0 {
		t.Errorf("At start: cursor = %d, expected 0 (no wrap)", m3.cursor)
	}
}

func TestInstanceNavigationEmpty(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.instances = []InstanceInfo{}
	m.cursor = 0

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m2 := mod.(InstanceModel)
	if m2.cursor != 0 {
		t.Errorf("Empty list: cursor should stay 0, got %d", m2.cursor)
	}
}

func TestInstanceEnterSwitchesActive(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.instances = []InstanceInfo{
		{Name: "default"},
		{Name: "test-box"},
	}
	m.cursor = 1

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(InstanceModel)

	if m2.activeInstance != "test-box" {
		t.Errorf("activeInstance = %q, expected 'test-box'", m2.activeInstance)
	}
}

func TestInstanceEnterOnEmptyList(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.instances = []InstanceInfo{}

	_, _ = m.Update(tea.KeyMsg{Type: tea.KeyEnter})
}

func TestInstanceDeleteScreenTransition(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.instances = []InstanceInfo{
		{Name: "test-box"},
	}
	m.cursor = 0

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'d'}})
	m2 := mod.(InstanceModel)

	if m2.screen != InstDelete {
		t.Errorf("After 'd': screen = %d, expected InstDelete", m2.screen)
	}
	if m2.deleteTarget != "test-box" {
		t.Errorf("deleteTarget = %q, expected 'test-box'", m2.deleteTarget)
	}
}

func TestInstanceDeleteNoInstances(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.instances = []InstanceInfo{}

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'d'}})
	m2 := mod.(InstanceModel)

	if m2.screen != InstList {
		t.Errorf("With empty list: screen should stay InstList, got %d", m2.screen)
	}
}

func TestInstanceRefresh(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.loading = false

	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'r'}})
	m2 := mod.(InstanceModel)

	if !m2.loading {
		t.Errorf("After 'r': loading should be true")
	}
	if cmd == nil {
		t.Errorf("After 'r': expected non-nil cmd")
	}
}

func TestInstanceBackToMenu(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.done = false

	keys := []string{"b", "q", "esc"}
	for _, key := range keys {
		t.Run("key_"+key, func(t *testing.T) {
			m2 := m
			mod, _ := m2.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)})
			m3 := mod.(InstanceModel)
			if !m3.done {
				t.Errorf("After %q: done should be true", key)
			}
		})
	}
}

func TestInstanceDeleteConfirm(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstDelete
	m.deleteTarget = "test-box"

	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'y'}})
	m2 := mod.(InstanceModel)

	if !m2.running {
		t.Errorf("running should be true after 'y'")
	}
	if m2.runLabel != "Deleting instance..." {
		t.Errorf("runLabel = %q, expected 'Deleting instance...'", m2.runLabel)
	}
	if cmd == nil {
		t.Errorf("Expected non-nil cmd (deleteInstanceCmd)")
	}
}

func TestInstanceDeleteCancel(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstDelete

	cancelKeys := []string{"n", "esc"}
	for _, key := range cancelKeys {
		t.Run("key_"+key, func(t *testing.T) {
			m2 := m
			mod, _ := m2.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)})
			m3 := mod.(InstanceModel)
			if m3.screen != InstList {
				t.Errorf("After %q: screen = %d, expected InstList", key, m3.screen)
			}
		})
	}
}

func TestInstanceDeletedMsg(t *testing.T) {
	m := NewInstanceModel()
	m.running = true

	mod, cmd := m.Update(instanceDeletedMsg{err: nil})
	m2 := mod.(InstanceModel)

	if m2.running {
		t.Errorf("running should be false after instanceDeletedMsg")
	}
	if cmd == nil {
		t.Errorf("Expected fetchInstances cmd after deletion")
	}
}

func TestInstanceWindowSize(t *testing.T) {
	m := NewInstanceModel()

	mod, _ := m.Update(tea.WindowSizeMsg{Width: 100, Height: 40})
	m2 := mod.(InstanceModel)

	if m2.width != 100 || m2.height != 40 {
		t.Errorf("WindowSize: got %dx%d, expected 100x40", m2.width, m2.height)
	}
}

func TestInstanceViewRenderings(t *testing.T) {
	m := NewInstanceModel()

	screens := []struct {
		name  string
		setup func(m *InstanceModel)
	}{
		{"ListLoading", func(m *InstanceModel) {
			m.screen = InstList
			m.loading = true
			m.activeInstance = "default"
		}},
		{"ListEmpty", func(m *InstanceModel) {
			m.screen = InstList
			m.loading = false
			m.instances = []InstanceInfo{}
			m.localIP = "192.168.1.100"
			m.activeInstance = "default"
		}},
		{"ListWithInstances", func(m *InstanceModel) {
			m.screen = InstList
			m.loading = false
			m.localIP = "192.168.1.100"
			m.activeInstance = "default"
			m.instances = []InstanceInfo{
				{Name: "default", IsRunning: true, MoonrakerPort: 7125, WebPort: 80, MoonrakerService: "moonraker"},
				{Name: "test-box", IsRunning: false, MoonrakerPort: 7126, WebPort: 8080, MoonrakerService: "moonraker-test-box"},
			}
		}},
		{"ListError", func(m *InstanceModel) {
			m.screen = InstList
			m.loading = false
			m.loadErr = "connection refused"
		}},
		{"Delete", func(m *InstanceModel) {
			m.screen = InstDelete
			m.deleteTarget = "test-box"
		}},
		{"DeleteRunning", func(m *InstanceModel) {
			m.screen = InstDelete
			m.running = true
			m.runLabel = "Deleting instance..."
		}},
	}

	for _, tc := range screens {
		t.Run(tc.name, func(t *testing.T) {
			if tc.setup != nil {
				tc.setup(&m)
			}
			view := m.View()

			if view == "" {
				t.Errorf("View() for %s returned empty string", tc.name)
			}
		})
	}
}

func TestInstanceViewListShowsInstances(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstList
	m.loading = false
	m.localIP = "192.168.1.100"
	m.instances = []InstanceInfo{
		{Name: "default", IsRunning: true, MoonrakerPort: 7125, WebPort: 80},
	}

	view := m.View()
	if !strings.Contains(view, "default") {
		t.Errorf("List view should show instance names, got:\n%s", view)
	}
	if !strings.Contains(view, "Instance Manager") {
		t.Errorf("List view should show title, got:\n%s", view)
	}
}

func TestInstanceViewDeleteConfirmation(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstDelete
	m.deleteTarget = "test-box"

	view := m.View()
	if !strings.Contains(view, "Delete Instance") {
		t.Errorf("Delete view should show title, got:\n%s", view)
	}
	if !strings.Contains(view, "test-box") {
		t.Errorf("Delete view should show target name, got:\n%s", view)
	}
	if !strings.Contains(view, "Enter: confirm") {
		t.Errorf("Delete view should show help text, got:\n%s", view)
	}
}

func TestInstanceViewUnknownScreen(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstanceScreen(99)

	view := m.View()
	if view != "Unknown instance screen" {
		t.Errorf("Unknown screen: got %q, expected 'Unknown instance screen'", view)
	}
}

func TestInstanceDeleteCmdSendsMsg(t *testing.T) {
	m := NewInstanceModel()
	m.screen = InstDelete
	m.deleteTarget = "test-box"

	cmd := m.deleteInstanceCmd()
	if cmd == nil {
		t.Fatal("deleteInstanceCmd() returned nil")
	}
}
