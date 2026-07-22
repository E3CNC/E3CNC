package tui

import (
	"testing"

	"github.com/E3CNC/e3cnc/cli/go/internal/bootstrap"
	tea "github.com/charmbracelet/bubbletea"
)

func TestNewInstallModelDefaults(t *testing.T) {
	m := NewInstallModel()

	if m.screen != ScreenDetection {
		t.Errorf("NewInstallModel(): screen = %d, expected ScreenDetection", m.screen)
	}
	if m.instanceName != "default" {
		t.Errorf("NewInstallModel(): instanceName = %q, expected 'default'", m.instanceName)
	}
	if m.moonrakerPort != 7125 {
		t.Errorf("NewInstallModel(): moonrakerPort = %d, expected 7125", m.moonrakerPort)
	}
	if m.webPort != 80 {
		t.Errorf("NewInstallModel(): webPort = %d, expected 80", m.webPort)
	}
	if m.mDNSHostname != "e3cnc" {
		t.Errorf("NewInstallModel(): mDNSHostname = %q, expected 'e3cnc'", m.mDNSHostname)
	}
	if !m.startServices {
		t.Errorf("NewInstallModel(): startServices should be true")
	}
	if m.done {
		t.Errorf("NewInstallModel(): done should be false")
	}
	if len(m.steps) != len(freshInstallSteps) {
		t.Errorf("NewInstallModel(): steps len = %d, expected %d", len(m.steps), len(freshInstallSteps))
	}
}

func TestInstallInit(t *testing.T) {
	m := NewInstallModel()
	cmds := m.Init()
	if cmds == nil {
		t.Fatalf("InstallModel.Init() should return a batch command")
	}
}

func TestInstallDecisionAdvanceNewInstance(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenDecision
	m.modeCursor = 1

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(InstallModel)
	if m2.screen != ScreenExecDashboard {
		t.Errorf("ScreenDecision Enter should advance for new instance, got %d", m2.screen)
	}
}

func TestInstallDecisionImportNoDetectedKlipperStaysOnDecision(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenDecision
	m.modeCursor = 0
	m.klipperInstalls = nil

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(InstallModel)
	if m2.screen != ScreenDecision {
		t.Errorf("ScreenDecision Enter with no Klipper should stay on Decision, got %d", m2.screen)
	}
	if m2.installMode != 1 {
		t.Errorf("installMode = %d, expected 1", m2.installMode)
	}
}

func TestInstallDecisionCancel(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenDecision

	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	m2 := mod.(InstallModel)
	if cmd == nil {
		t.Fatalf("Decision cancel should return a non-nil command")
	}
	if m2.screen != ScreenDetection {
		t.Errorf("ScreenDecision q should return to Detection, got %d", m2.screen)
	}
	_ = cmd
}

func TestInstallKlipperPickerNavigation(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenKlipperPicker
	m.klipperInstalls = []bootstrap.DetectedKlipper{
		{KlipperDir: "a"},
		{KlipperDir: "b"},
		{KlipperDir: "c"},
	}
	m.klipperCursor = 0

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m2 := mod.(InstallModel)
	if m2.klipperCursor != 1 {
		t.Errorf("Down: cursor=%d, expected 1", m2.klipperCursor)
	}

	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m3 := mod.(InstallModel)
	if m3.selectedKlipper == nil || m3.selectedKlipper.KlipperDir != "b" {
		t.Errorf("Enter: selectedKlipper.KlipperDir = %v, expected b", m3.selectedKlipper)
	}
}

func TestInstallKlipperPickerBack(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenKlipperPicker
	m.klipperInstalls = []bootstrap.DetectedKlipper{
		{KlipperDir: "a"},
		{KlipperDir: "b"},
	}
	m.klipperCursor = 0

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("b")})
	m2 := mod.(InstallModel)
	if m2.screen != ScreenDecision {
		t.Errorf("KlipperPicker back should return to Decision, got %d", m2.screen)
	}
}

func TestInstallExecDashboardDoneBlocksAdvance(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenExecDashboard
	m.done = true

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(InstallModel)
	if m2.screen != ScreenExecDashboard {
		t.Errorf("Enter on done screen should stay on ExecDashboard, got %d", m2.screen)
	}
}

func TestInstallViewRendersExecDashboard(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenExecDashboard
	for i, s := range freshInstallSteps {
		m.steps[i] = s
		if i < 2 {
			m.steps[i].Status = StepCompleted
		} else {
			m.steps[i].Status = StepPending
		}
		m.completedSteps[s.Label] = i < 3
	}

	view := m.View()
	if view == "" {
		t.Fatalf("ExecDashboard View() returned empty")
	}
}
