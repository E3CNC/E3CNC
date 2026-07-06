package tui

import (
	"strings"
	"testing"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
)

func TestNewInstallModel(t *testing.T) {
	m := NewInstallModel()

	if m.screen != ScreenModeSelect {
		t.Errorf("NewInstallModel(): screen = %d, expected ScreenModeSelect", m.screen)
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
	if len(m.preFlightChecks) != len(defaultPreFlightLabels) {
		t.Errorf("NewInstallModel(): preFlightChecks len = %d, expected %d", len(m.preFlightChecks), len(defaultPreFlightLabels))
	}
	if len(m.steps) != len(installSteps) {
		t.Errorf("NewInstallModel(): steps len = %d, expected %d", len(m.steps), len(installSteps))
	}
	if m.completedSteps == nil {
		t.Errorf("NewInstallModel(): completedSteps map should be initialized")
	}
}

func TestInstallInit(t *testing.T) {
	m := NewInstallModel()
	cmd := m.Init()

	if cmd == nil {
		t.Fatal("InstallModel.Init() should return a batch command")
	}
}

func TestInstallPreFlightComplete(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenPreFlight

	// Send pre-flight complete message with real-looking results
	results := []PreFlightCheck{
		{Label: "Python 3.8+", Status: "passed", Detail: "3.11.2"},
		{Label: "git installed", Status: "passed", Detail: "found"},
		{Label: "Disk space", Status: "passed", Detail: "4.2 GB free"},
	}
	mod, _ := m.Update(preFlightCompleteMsg{allPassed: true, results: results})
	m2 := mod.(InstallModel)

	if m2.screen != ScreenMCUSelect {
		t.Errorf("After preFlightCompleteMsg: screen = %d, expected ScreenMCUSelect", m2.screen)
	}

	if len(m2.preFlightChecks) != 3 {
		t.Errorf("preFlightChecks should have 3 items, got %d", len(m2.preFlightChecks))
	}
	if m2.preFlightChecks[0].Status != "passed" {
		t.Errorf("preFlightChecks[0].Status = %q, expected 'passed'", m2.preFlightChecks[0].Status)
	}
}

func TestInstallScreenNavigation(t *testing.T) {
	tests := []struct {
		name           string
		startScreen    InstallScreen
		key            string
		expectedScreen InstallScreen
	}{
		{"ModeSelect Enter → PreFlight", ScreenModeSelect, "enter", ScreenPreFlight},
		{"PreFlight Enter → MCUSelect", ScreenPreFlight, "enter", ScreenMCUSelect},
		{"MCUSelect Enter → Config", ScreenMCUSelect, "enter", ScreenConfig},
		{"Config Enter → FirmwareCheck", ScreenConfig, "enter", ScreenFirmwareCheck},
		{"FirmwareCheck Enter → ExecDashboard", ScreenFirmwareCheck, "enter", ScreenExecDashboard},
		{"Verification Enter → NextSteps", ScreenVerification, "enter", ScreenNextSteps},
		{"NextSteps Enter → done", ScreenNextSteps, "enter", ScreenNextSteps},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := NewInstallModel()
			m.screen = tc.startScreen

			// For MCUSelect and Config, we need devices to proceed
			if tc.startScreen == ScreenMCUSelect || tc.startScreen == ScreenConfig {
				m.mcuDevices = []string{"usb-Klipper_stm32f446xx_12345-if00"}
				m.mcuPath = m.mcuDevices[0]
			}

			mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(tc.key)})
			m2 := mod.(InstallModel)

			if m2.screen != tc.expectedScreen {
				t.Errorf("screen = %d, expected %d", m2.screen, tc.expectedScreen)
			}

			if tc.name == "NextSteps Enter → done" {
				if !m2.done {
					t.Errorf("done should be true after Enter on NextSteps")
				}
			}
		})
	}
}

func TestInstallBackToMainMenu(t *testing.T) {
	screens := []InstallScreen{
		ScreenModeSelect,
		ScreenPreFlight,
		ScreenMCUSelect,
		ScreenConfig,
		ScreenFirmwareCheck,
		ScreenExecDashboard,
		ScreenErrorRecovery,
		ScreenVerification,
		ScreenNextSteps,
	}
	keys := []string{"b", "q", "esc"}

	for _, screen := range screens {
		for _, key := range keys {
			t.Run(screenName(screen)+"_"+key, func(t *testing.T) {
				m := NewInstallModel()
				m.screen = screen

				mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)})
				m2 := mod.(InstallModel)

				// Should not change screen (the root model handles backToMenuMsg)
				if m2.screen != screen {
					t.Errorf("screen should stay %d, got %d", screen, m2.screen)
				}
				// Should return a Cmd that produces backToMenuMsg
				if cmd == nil {
					t.Fatal("expected non-nil cmd (backToMenuMsg producer)")
				}
				msg := cmd()
				if _, ok := msg.(backToMenuMsg); !ok {
					t.Errorf("expected backToMenuMsg from cmd, got %T", msg)
				}
			})
		}
	}
}

func TestInstallMCUSelection(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenMCUSelect
	m.mcuDevices = []string{"device-a", "device-b", "device-c"}
	m.mcuPath = "device-a"
	m.mcuCursor = 0

	// Navigate down
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m2 := mod.(InstallModel)
	if m2.mcuCursor != 1 {
		t.Errorf("After Down: cursor = %d, expected 1", m2.mcuCursor)
	}

	// Navigate up wraps
	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyUp})
	m3 := mod.(InstallModel)
	if m3.mcuCursor != 0 {
		t.Errorf("After Up: cursor = %d, expected 0", m3.mcuCursor)
	}
}

func TestInstallMCUSelectionWrap(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenMCUSelect
	m.mcuDevices = []string{"device-a", "device-b"}
	m.mcuCursor = 0

	// Up from first wraps to last
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m2 := mod.(InstallModel)
	if m2.mcuCursor != len(m.mcuDevices)-1 {
		t.Errorf("Wrap up: cursor = %d, expected %d", m2.mcuCursor, len(m.mcuDevices)-1)
	}

	// Down from last wraps to first
	m2.mcuCursor = len(m.mcuDevices) - 1
	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyDown})
	m3 := mod.(InstallModel)
	if m3.mcuCursor != 0 {
		t.Errorf("Wrap down: cursor = %d, expected 0", m3.mcuCursor)
	}
}

func TestInstallMCUSelectEnterSavesPath(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenMCUSelect
	m.mcuDevices = []string{"device-a", "device-b"}
	m.mcuCursor = 1

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(InstallModel)

	if m2.mcuPath != "device-b" {
		t.Errorf("mcuPath = %q, expected 'device-b'", m2.mcuPath)
	}
	// Should advance to config screen
	if m2.screen != ScreenConfig {
		t.Errorf("screen = %d, expected ScreenConfig", m2.screen)
	}
}

func TestInstallMCUSelectRescan(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenMCUSelect
	m.mcuDevices = []string{"old-device"}
	m.mcuCursor = 0

	// 'r' key should trigger rescan (just calls scanMCUDevices which reads /dev)
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'r'}})
	m2 := mod.(InstallModel)

	if m2.screen != ScreenMCUSelect {
		t.Errorf("After 'r': screen should stay ScreenMCUSelect, got %d", m2.screen)
	}
}

func TestInstallNameValidation(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenMCUSelect
	m.mcuDevices = []string{"usb-Klipper_stm32f446xx_12345-if00"}
	m.mcuPath = m.mcuDevices[0]

	// Advance to config
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(InstallModel)

	// Enter in config advances to firmware check
	mod2, _ := m2.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m3 := mod2.(InstallModel)

	if m3.screen != ScreenFirmwareCheck {
		t.Errorf("After Enter in config: screen = %d, expected ScreenFirmwareCheck", m3.screen)
	}
}

func TestInstallFirmwareCheckKlipperDetected(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenFirmwareCheck
	m.mcuPath = "usb-Klipper_stm32f446xx_12345-if00"

	view := m.viewFirmwareCheck()
	if !strings.Contains(view, "Klipper firmware detected") {
		t.Errorf("viewFirmwareCheck() should detect Klipper, got:\n%s", view)
	}
}

func TestInstallFirmwareCheckNoKlipper(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenFirmwareCheck
	m.mcuPath = "usb-STM32_GigaDevice_12345-if00"

	view := m.viewFirmwareCheck()
	if !strings.Contains(view, "No Klipper firmware detected") {
		t.Errorf("viewFirmwareCheck() should warn about missing Klipper, got:\n%s", view)
	}
}

func TestInstallStepUpdateMsg(t *testing.T) {
	m := NewInstallModel()

	// Initialize steps
	for i, s := range installSteps {
		m.steps[i] = s
		m.steps[i].Status = StepPending
	}

	// Send stepUpdateMsg for step 0 completing
	mod, cmd := m.Update(stepUpdateMsg{
		step:   0,
		status: StepCompleted,
	})
	m2 := mod.(InstallModel)

	if m2.steps[0].Status != StepCompleted {
		t.Errorf("step[0].Status = %d, expected StepCompleted", m2.steps[0].Status)
	}

	if cmd != nil {
		// With no progressCh, cmd should be nil
		t.Errorf("Expected nil cmd when progressCh is nil, got non-nil")
	}
}

func TestInstallStepUpdateRunning(t *testing.T) {
	m := NewInstallModel()

	for i, s := range installSteps {
		m.steps[i] = s
		m.steps[i].Status = StepPending
	}

	// Send running update for step 2
	mod, _ := m.Update(stepUpdateMsg{
		step:   2,
		status: StepRunning,
	})
	m2 := mod.(InstallModel)

	if m2.steps[2].Status != StepRunning {
		t.Errorf("step[2].Status = %d, expected StepRunning", m2.steps[2].Status)
	}
	if m2.steps[2].StartedAt.IsZero() {
		t.Errorf("step[2].StartedAt should be set when running")
	}
}

func TestInstallCompleteMsgWithoutChannel(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenExecDashboard
	m.current = 3

	// Send installCompleteMsg with error
	mod, _ := m.Update(installCompleteMsg{err: errFake("network timeout")})
	m2 := mod.(InstallModel)

	if m2.screen != ScreenErrorRecovery {
		t.Errorf("After install error: screen = %d, expected ScreenErrorRecovery", m2.screen)
	}
	if m2.failedStep != 3 {
		t.Errorf("failedStep = %d, expected 3", m2.failedStep)
	}
}

func TestInstallCompleteMsgSuccess(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenExecDashboard

	// Send installCompleteMsg with health checks
	mod, _ := m.Update(installCompleteMsg{
		healthChecks: nil, // test with nil — real checks come from deploy package
	})
	m2 := mod.(InstallModel)

	if m2.screen != ScreenVerification {
		t.Errorf("After install success: screen = %d, expected ScreenVerification", m2.screen)
	}
}

func TestInstallErrorRecoverySkip(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenErrorRecovery
	m.current = 2
	m.failedStep = 2
	m.steps[2] = InstallStep{Number: 3, Label: "Download release", Status: StepFailed}
	m.steps[3] = installSteps[3] // "Verify checksum"

	// Press 's' to skip
	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'s'}})
	m2 := mod.(InstallModel)

	if m2.screen != ScreenExecDashboard {
		t.Errorf("After skip: screen = %d, expected ScreenExecDashboard", m2.screen)
	}
	if m2.steps[2].Status != StepSkipped {
		t.Errorf("After skip: step[2].Status = %d, expected StepSkipped", m2.steps[2].Status)
	}
	if m2.current != 3 {
		t.Errorf("After skip: current = %d, expected 3", m2.current)
	}
	if cmd != nil {
		t.Errorf("After skip: expected nil cmd (no channel polling)")
	}
}

func TestInstallErrorRecoveryAbortSetsDone(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenErrorRecovery
	m.current = 2
	m.failedStep = 2

	// Press 'a' to abort — sets done = true (rollback happens inside)
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'a'}})
	m2 := mod.(InstallModel)

	if !m2.done {
		t.Errorf("After abort: done should be true")
	}
}

func TestInstallVerboseToggle(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenExecDashboard

	if !m.verbose {
		t.Fatal("verbose should start true by default")
	}

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'v'}})
	m2 := mod.(InstallModel)

	if m2.verbose {
		t.Errorf("After 'v': verbose should be false")
	}

	// Toggle back
	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'v'}})
	m3 := mod.(InstallModel)

	if !m3.verbose {
		t.Errorf("After second 'v': verbose should be true")
	}
}

func TestInstallWindowSize(t *testing.T) {
	m := NewInstallModel()

	mod, _ := m.Update(tea.WindowSizeMsg{Width: 100, Height: 40})
	m2 := mod.(InstallModel)

	if m2.width != 100 || m2.height != 40 {
		t.Errorf("WindowSize: got %dx%d, expected 100x40", m2.width, m2.height)
	}
}

func TestInstallSpinnerTick(t *testing.T) {
	m := NewInstallModel()

	_, cmd := m.Update(spinner.TickMsg{})

	if cmd == nil {
		t.Errorf("spinner TickMsg should return a cmd for the next tick")
	}
}

func TestShortenMCUPath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"short", "short"},
		{"", ""},
		{"usb-Klipper_stm32f446xx_12345-if00", "usb-Klipper_stm32f446xx_12345-if00"},
	}

	for _, tc := range tests {
		result := shortenMCUPath(tc.input)
		if result != tc.expected {
			t.Errorf("shortenMCUPath(%q) = %q, expected %q", tc.input, result, tc.expected)
		}
	}
}

func TestShortenMCUPathTruncates(t *testing.T) {
	long := "usb-Klipper_stm32f446xx_12345-if00-with-extra-long-suffix-for-testing"
	result := shortenMCUPath(long)
	if len(result) > 53 { // 50 + "..."
		t.Errorf("shortenMCUPath(%q) = %q (len=%d), should be truncated", long, result, len(result))
	}
	if !strings.HasSuffix(result, "...") {
		t.Errorf("shortenMCUPath(%q) should end with '...', got %q", long, result)
	}
}

func TestPreFlightLabels(t *testing.T) {
	if len(defaultPreFlightLabels) == 0 {
		t.Fatal("defaultPreFlightLabels is empty")
	}
	for i, check := range defaultPreFlightLabels {
		if check.label == "" {
			t.Errorf("defaultPreFlightLabels[%d]: empty label", i)
		}
		if check.fn == nil {
			t.Errorf("defaultPreFlightLabels[%d]: nil check function", i)
		}
	}
	// Verify common checks are present
	labels := map[string]bool{}
	for _, c := range defaultPreFlightLabels {
		labels[c.label] = true
	}
	for _, required := range []string{"Python 3.8+", "git installed", "Disk space (>0.5 GB)"} {
		if !labels[required] {
			t.Errorf("Missing required pre-flight check: %s", required)
		}
	}
}

func TestStepStatusString(t *testing.T) {
	tests := []struct {
		status   StepStatus
		expected string
	}{
		{StepPending, "pending"},
		{StepRunning, "running"},
		{StepCompleted, "passed"},
		{StepFailed, "failed"},
		{StepSkipped, "skipped"},
		{StepStatus(99), "unknown"},
	}

	for _, tc := range tests {
		result := tc.status.String()
		if result != tc.expected {
			t.Errorf("StepStatus(%d).String() = %q, expected %q", tc.status, result, tc.expected)
		}
	}
}

func TestInstallStepsSchema(t *testing.T) {
	for i, step := range installSteps {
		if step.Number != i+1 {
			t.Errorf("installSteps[%d].Number = %d, expected %d", i, step.Number, i+1)
		}
		if step.Label == "" {
			t.Errorf("installSteps[%d]: empty Label", i)
		}
	}
}

func TestInstallViewRenderings(t *testing.T) {
	m := NewInstallModel()

	// Test that each screen renders without panic
	screens := []struct {
		name   string
		screen InstallScreen
		setup  func(m *InstallModel)
	}{
		{"PreFlight", ScreenPreFlight, func(m *InstallModel) {
			m.preFlightChecks = []PreFlightCheck{
				{Label: "Python 3.8+", Status: "passed", Detail: "3.11.2"},
			}
		}},
		{"MCUSelect", ScreenMCUSelect, func(m *InstallModel) {
			m.mcuDevices = []string{"usb-Klipper_stm32f446xx_12345-if00"}
		}},
		{"MCUSelectEmpty", ScreenMCUSelect, func(m *InstallModel) {
			m.mcuDevices = nil
		}},
		{"Config", ScreenConfig, func(m *InstallModel) {
			m.mcuPath = "usb-Klipper_stm32f446xx_12345-if00"
		}},
		{"FirmwareCheck", ScreenFirmwareCheck, func(m *InstallModel) {
			m.mcuPath = "usb-Klipper_stm32f446xx_12345-if00"
		}},
		{"FirmwareCheckNoKlipper", ScreenFirmwareCheck, func(m *InstallModel) {
			m.mcuPath = "usb-STM32_GigaDevice_12345-if00"
		}},
		{"ExecDashboard", ScreenExecDashboard, func(m *InstallModel) {
			m.startedAt = m.startedAt.Add(-100)
			for i, s := range installSteps {
				m.steps[i] = s
				m.steps[i].Status = StepPending
			}
		}},
		{"ErrorRecovery", ScreenErrorRecovery, func(m *InstallModel) {
			m.failedStep = 2
			m.steps[2] = InstallStep{Number: 3, Label: "Download release", Status: StepFailed}
		}},
		{"Verification", ScreenVerification, nil},
		{"NextSteps", ScreenNextSteps, nil},
	}

	for _, tc := range screens {
		t.Run(tc.name, func(t *testing.T) {
			m.screen = tc.screen
			if tc.setup != nil {
				tc.setup(&m)
			}
			view := m.View()

			if view == "" {
				t.Errorf("View() for %s returned empty string", tc.name)
			}
			if strings.Contains(view, "Unknown") && !strings.Contains(tc.name, "Unknown") {
				t.Errorf("View() for %s returned 'Unknown': %s", tc.name, view)
			}
		})
	}
}

func TestInstallExecDashboardView(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenExecDashboard
	m.startedAt = time.Now().Add(-30 * time.Second) // 30s ago

	// Setup steps with a mix of statuses
	for i, s := range installSteps {
		m.steps[i] = s
		switch {
		case i < 2:
			m.steps[i].Status = StepCompleted
		case i == 2:
			m.steps[i].Status = StepRunning
			m.current = i
			m.steps[i].StartedAt = time.Now()
		default:
			m.steps[i].Status = StepPending
		}
	}

	view := m.View()
	if !strings.Contains(view, "Install") {
		t.Errorf("ExecDashboard view should contain 'Install', got:\n%s", view)
	}
	if !strings.Contains(view, "Install system packages") {
		t.Errorf("ExecDashboard view should contain step label, got:\n%s", view)
	}
	if !strings.Contains(view, "30s") {
		t.Errorf("ExecDashboard view should show elapsed time, got:\n%s", view)
	}
}

func TestInstallViewWithError(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenPreFlight
	m.preFlightChecks = []PreFlightCheck{
		{Label: "Python 3.8+", Status: "failed", Detail: "not found"},
	}

	view := m.View()
	if !strings.Contains(view, "Some checks failed") {
		t.Errorf("PreFlight view should show failure, got:\n%s", view)
	}
}

func TestConfigViewShowsMCUPath(t *testing.T) {
	m := NewInstallModel()
	m.screen = ScreenConfig
	m.mcuPath = "usb-Klipper_stm32f446xx_12345-if00"
	m.moonrakerPort = 7126

	view := m.View()
	if !strings.Contains(view, "usb-Klipper") {
		t.Errorf("Config view should show MCU path, got:\n%s", view)
	}
	if !strings.Contains(view, "7126") {
		t.Errorf("Config view should show port 7126, got:\n%s", view)
	}
}

func TestInstallViewEmpty(t *testing.T) {
	m := NewInstallModel()
	m.screen = InstallScreen(99)

	view := m.View()
	if view != "Unknown screen" {
		t.Errorf("Unknown screen: got %q, expected 'Unknown screen'", view)
	}
}

func TestInstallCompleteMsgClearsChannel(t *testing.T) {
	m := NewInstallModel()
	m.progressCh = make(chan tea.Msg, 1)

	mod, _ := m.Update(installCompleteMsg{healthChecks: nil})
	m2 := mod.(InstallModel)

	if m2.progressCh != nil {
		t.Errorf("progressCh should be nil after installCompleteMsg")
	}
}

func TestHandleStepUpdateLogs(t *testing.T) {
	m := NewInstallModel()
	for i, s := range installSteps {
		m.steps[i] = s
		m.steps[i].Status = StepPending
	}

	// Send a step update and check the log buffer
	m2, _ := m.handleStepUpdate(stepUpdateMsg{
		step:   0,
		status: StepCompleted,
	})

	if len(m2.logBuffer) == 0 {
		t.Errorf("logBuffer should have entries after step update")
	}
	if !strings.Contains(m2.logBuffer[0], "passed") {
		t.Errorf("log entry should mention 'passed', got: %s", m2.logBuffer[0])
	}
}

func TestPollProgressChReturnsMessage(t *testing.T) {
	ch := make(chan tea.Msg, 1)
	expected := stepUpdateMsg{step: 0, status: StepCompleted}
	ch <- expected

	m := NewInstallModel()
	cmd := m.pollProgressCh(ch)

	msg := cmd()
	if msg == nil {
		t.Fatal("pollProgressCh returned nil message")
	}
	result, ok := msg.(stepUpdateMsg)
	if !ok {
		t.Fatalf("expected stepUpdateMsg, got %T", msg)
	}
	if result.step != 0 || result.status != StepCompleted {
		t.Errorf("got step=%d status=%d, expected step=0 status=completed", result.step, result.status)
	}
}

func TestPollProgressChClosedChannel(t *testing.T) {
	ch := make(chan tea.Msg)
	close(ch)

	m := NewInstallModel()
	cmd := m.pollProgressCh(ch)

	msg := cmd()
	if msg != nil {
		t.Errorf("closed channel should return nil, got %T", msg)
	}
}

func TestHandleStepUpdateWithChannel(t *testing.T) {
	m := NewInstallModel()
	for i, s := range installSteps {
		m.steps[i] = s
		m.steps[i].Status = StepPending
	}

	ch := make(chan tea.Msg, 1)
	defer close(ch)
	m.progressCh = ch

	m2, cmd := m.handleStepUpdate(stepUpdateMsg{
		step:   0,
		status: StepCompleted,
	})

	if cmd == nil {
		t.Errorf("expected non-nil cmd when progressCh is set")
	}
	_ = m2 // model updated
}

// screenName helper for test naming
func screenName(s InstallScreen) string {
	names := map[InstallScreen]string{
		ScreenModeSelect:    "ModeSelect",
		ScreenPreFlight:     "PreFlight",
		ScreenMCUSelect:     "MCUSelect",
		ScreenConfig:        "Config",
		ScreenFirmwareCheck: "FirmwareCheck",
		ScreenExecDashboard: "ExecDashboard",
		ScreenErrorRecovery: "ErrorRecovery",
		ScreenVerification:  "Verification",
		ScreenNextSteps:     "NextSteps",
	}
	if name, ok := names[s]; ok {
		return name
	}
	return "Unknown"
}
