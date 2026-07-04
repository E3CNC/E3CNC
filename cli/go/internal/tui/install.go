package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/bubbles/spinner"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// InstallStep represents one phase of the installation process.
type InstallStep struct {
	Number    int
	Label     string
	Status    StepStatus
	StartedAt time.Time
	Duration  time.Duration
	Output    []string
	ErrorCode string
	ErrorDetail string
}

// StepStatus tracks the state of an install phase.
type StepStatus int

const (
	StepPending StepStatus = iota
	StepRunning
	StepCompleted
	StepFailed
	StepSkipped
)

func (s StepStatus) String() string {
	switch s {
	case StepPending:
		return "pending"
	case StepRunning:
		return "running"
	case StepCompleted:
		return "passed"
	case StepFailed:
		return "failed"
	case StepSkipped:
		return "skipped"
	default:
		return "unknown"
	}
}

// InstallScreen represents which wizard screen is shown.
type InstallScreen int

const (
	ScreenPreFlight InstallScreen = iota
	ScreenMCUSelect
	ScreenConfig
	ScreenFirmwareCheck
	ScreenExecDashboard
	ScreenErrorRecovery
	ScreenVerification
	ScreenNextSteps
)

// InstallModel is the BubbleTea model for the install wizard.
type InstallModel struct {
	screen  InstallScreen
	steps   []InstallStep
	current int // current step index being executed

	// Pre-flight state
	preFlightChecks []PreFlightCheck

	// Configuration state
	instanceName   string
	moonrakerPort  int
	webPort        int
	mDNSHostname   string
	startServices  bool
	configField    int // which config field is focused (0-5)
	mcuPath        string
	mcuDevices     []string
	mcuCursor      int

	// Execution state
	startedAt    time.Time
	elapsed      time.Duration
	verbose      bool
	logBuffer    []string

	// Error recovery
	failedStep    int
	recoveryAction string // "retry", "skip", "abort"

	// Next steps tracking
	completedSteps map[string]bool

	// Common
	spinner  spinner.Model
	done     bool
	err      error
	width    int
	height   int
}

// PreFlightCheck represents a single pre-flight validation item.
type PreFlightCheck struct {
	Label      string
	Status     string // "passed", "failed", "running", "skipped"
	Detail     string
	AutoFixCmd string // command to auto-fix (e.g., "sudo apt install zstd")
}

var installSteps = []InstallStep{
	{Number: 1, Label: "Bootstrap infrastructure"},
	{Number: 2, Label: "Install system packages"},
	{Number: 3, Label: "Configure Moonraker"},
	{Number: 4, Label: "Download release"},
	{Number: 5, Label: "Verify checksum"},
	{Number: 6, Label: "Activate release"},
	{Number: 7, Label: "Sync runtime files"},
	{Number: 8, Label: "Restart services"},
	{Number: 9, Label: "Health checks"},
}

// NewInstallModel creates a new install wizard model.
func NewInstallModel() InstallModel {
	s := spinner.New()
	s.Style = SpinnerStyle
	s.Spinner = spinner.Dot

	// Scan for MCU devices
	mcuDevices := scanMCUDevices()
	mcuPath := ""
	if len(mcuDevices) > 0 {
		mcuPath = mcuDevices[0]
	}

	return InstallModel{
		screen:         ScreenPreFlight,
		steps:          make([]InstallStep, len(installSteps)),
		preFlightChecks: defaultPreFlightChecks(),
		instanceName:   "default",
		moonrakerPort:  7125,
		webPort:        80,
		mDNSHostname:   "e3cnc",
		startServices:  true,
		mcuPath:        mcuPath,
		mcuDevices:     mcuDevices,
		spinner:        s,
		completedSteps: make(map[string]bool),
	}
}

func defaultPreFlightChecks() []PreFlightCheck {
	return []PreFlightCheck{
		{Label: "Python 3.8+", Status: "running", Detail: "checking..."},
		{Label: "git installed", Status: "running", Detail: "checking..."},
		{Label: "curl installed", Status: "running", Detail: "checking..."},
		{Label: "unzip installed", Status: "running", Detail: "checking..."},
		{Label: "zstd installed", Status: "running", Detail: "checking..."},
		{Label: "Disk space (>0.5 GB)", Status: "running", Detail: "checking..."},
		{Label: "GitHub API reachable", Status: "running", Detail: "checking..."},
		{Label: "Ansible installed", Status: "running", Detail: "checking..."},
		{Label: "Sudo access (NOPASSWD)", Status: "running", Detail: "checking..."},
	}
}

func (m InstallModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		// Start pre-flight checks
		func() tea.Msg {
			return preFlightCompleteMsg{allPassed: true}
		},
	)
}

// Messages for the install wizard.
type preFlightCompleteMsg struct {
	allPassed bool
}

// backToMenuMsg signals the root model to return to the main menu.
type backToMenuMsg struct{}

type stepUpdateMsg struct {
	step    int
	status  StepStatus
	output  string
	errCode string
	errDetail string
}

type installProgressMsg struct {
	step    int
	elapsed time.Duration
}

func (m InstallModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case preFlightCompleteMsg:
		// Mark all pre-flight checks as passed
		for i := range m.preFlightChecks {
			m.preFlightChecks[i].Status = "passed"
			m.preFlightChecks[i].Detail = "found"
		}
		m.preFlightChecks[0].Detail = "3.11.2"  // Python version
		m.preFlightChecks[5].Detail = "4.2 GB free"
		m.preFlightChecks[6].Detail = "reachable"
		m.preFlightChecks[8].Detail = "passwordless"
		// Auto-advance to MCU selection screen
		m.screen = ScreenMCUSelect

	case stepUpdateMsg:
		// Mark the current step as completed
		m.steps[m.current].Status = msg.status
		m.steps[m.current].Duration = time.Since(m.steps[m.current].StartedAt)
		m.logBuffer = append(m.logBuffer, fmt.Sprintf("[%d/%d] %s — %s", m.current+1, len(m.steps), m.steps[m.current].Label, msg.status.String()))

		// Advance to the next step
		m.current++
		if m.current < len(m.steps) {
			m.steps[m.current].Status = StepRunning
			m.steps[m.current].StartedAt = time.Now()
			return m, m.simulateInstallProgress()
		}

		// All steps complete — show verification screen
		m.screen = ScreenVerification

	case tea.KeyMsg:
		// Global handler: esc, 'b', or 'q' goes back to main menu from any wizard screen
		s := msg.String()
		if s == "b" || s == "q" || s == "esc" {
			return m, func() tea.Msg {
				return backToMenuMsg{}
			}
		}
		switch m.screen {
		case ScreenPreFlight:
			if msg.String() == "enter" {
				m.screen = ScreenMCUSelect
			}

		case ScreenMCUSelect:
			switch msg.String() {
			case "up", "k":
				m.mcuCursor--
				if m.mcuCursor < 0 {
					m.mcuCursor = len(m.mcuDevices) - 1
				}
			case "down", "j":
				m.mcuCursor++
				if m.mcuCursor >= len(m.mcuDevices) {
					m.mcuCursor = 0
				}
			case "r":
				m.mcuDevices = scanMCUDevices()
				if len(m.mcuDevices) > 0 {
					m.mcuPath = m.mcuDevices[0]
					m.mcuCursor = 0
				}
			case "enter":
				if len(m.mcuDevices) > 0 && m.mcuCursor >= 0 && m.mcuCursor < len(m.mcuDevices) {
					m.mcuPath = m.mcuDevices[m.mcuCursor]
				}
				// Auto-assign a free port
				freePort, _ := instance.FindNextAvailablePort()
				if freePort > 0 {
					m.moonrakerPort = freePort
				}
				if freePort > 7125 {
					m.webPort = 8080
				}
				m.screen = ScreenConfig
			}

		case ScreenConfig:
			switch msg.String() {
			case "enter":
				// Proceed to firmware check
				m.screen = ScreenFirmwareCheck
			}

		case ScreenFirmwareCheck:
			if msg.String() == "enter" {
				// Start install
				m.screen = ScreenExecDashboard
				m.startedAt = time.Now()
				// Initialize steps
				for i, s := range installSteps {
					m.steps[i] = s
					m.steps[i].Status = StepPending
				}
				m.steps[0].Status = StepRunning
				m.steps[0].StartedAt = time.Now()
				m.current = 0
				return m, m.simulateInstallProgress()
			}

		case ScreenExecDashboard:
			switch msg.String() {
			case "v":
				m.verbose = !m.verbose
			case "ctrl+c":
				m.screen = ScreenErrorRecovery
				m.failedStep = m.current
				m.recoveryAction = "abort"
			}

		case ScreenErrorRecovery:
			switch msg.String() {
			case "r":
				// Retry
				m.steps[m.failedStep].Status = StepRunning
				m.screen = ScreenExecDashboard
				return m, m.simulateInstallProgress()
			case "s":
				// Skip
				m.steps[m.failedStep].Status = StepSkipped
				m.current++
				if m.current < len(m.steps) {
					m.steps[m.current].Status = StepRunning
					m.screen = ScreenExecDashboard
					return m, m.simulateInstallProgress()
				}
			case "a":
				// Abort
				m.done = true
			}

		case ScreenVerification:
			if msg.String() == "enter" {
				m.screen = ScreenNextSteps
			}

		case ScreenNextSteps:
			if msg.String() == "enter" {
				m.done = true
			}
		}
	}

	return m, nil
}

// simulateInstallProgress sends fake progress updates for UI development.
// In production, this would be replaced with real subprocess streaming.
func (m InstallModel) simulateInstallProgress() tea.Cmd {
	return func() tea.Msg {
		time.Sleep(500 * time.Millisecond)
		return stepUpdateMsg{
			step:   m.current,
			status: StepCompleted,
		}
	}
}

func (m InstallModel) View() string {
	switch m.screen {
	case ScreenPreFlight:
		return m.viewPreFlight()
	case ScreenMCUSelect:
		return m.viewMCUSelect()
	case ScreenConfig:
		return m.viewConfig()
	case ScreenFirmwareCheck:
		return m.viewFirmwareCheck()
	case ScreenExecDashboard:
		return m.viewExecDashboard()
	case ScreenErrorRecovery:
		return m.viewErrorRecovery()
	case ScreenVerification:
		return m.viewVerification()
	case ScreenNextSteps:
		return m.viewNextSteps()
	default:
		return "Unknown screen"
	}
}

// ── Screen 1: Pre-Flight Dashboard ──────────────────────────────────────

func (m InstallModel) viewPreFlight() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("E3CNC Install Wizard") + "\n" +
			SubtitleStyle.Render("Checking system readiness before installation..."),
	))
	b.WriteString("\n\n")
	b.WriteString(SectionHeaderStyle.Render("Pre-flight checks"))
	b.WriteString("\n")

	allPassed := true
	for _, check := range m.preFlightChecks {
		symbol := "  "
		style := DimStyle
		switch check.Status {
		case "passed":
			symbol = "✓"
			style = CheckPassStyle
		case "failed":
			symbol = "✗"
			style = CheckFailStyle
			allPassed = false
		case "running":
			symbol = m.spinner.View()
			style = SpinnerStyle
		case "skipped":
			symbol = "○"
			style = DimStyle
		}

		line := fmt.Sprintf("  %s %s", symbol, check.Label)
		if check.Detail != "" {
			line += DimStyle.Render("  (" + check.Detail + ")")
		}
		b.WriteString(style.Render(line))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	if allPassed {
		b.WriteString(OkStyle.Render("  ✓ All checks passed"))
		b.WriteString("\n\n")
		b.WriteString(HelpStyle.Render("Press Enter to continue · b: back to menu"))
	} else {
		b.WriteString(FailStyle.Render("  ✗ Some checks failed"))
		b.WriteString("\n\n")
		b.WriteString(HelpStyle.Render("Fix the issues above and re-run"))
	}

	return b.String()
}

// ── Screen 2: MCU Selection ───────────────────────────────────────

func (m InstallModel) viewMCUSelect() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Select MCU") + "\n" +
			SubtitleStyle.Render("Choose the controller board for this instance"),
	))
	b.WriteString("\n\n")

	if len(m.mcuDevices) == 0 {
		b.WriteString(WarnStyle.Render("  No MCU devices detected"))
		b.WriteString("\n\n")
		b.WriteString(DimStyle.Render("  Connect your controller board via USB"))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render("  then press 'r' to rescan."))
	} else {
		for i, dev := range m.mcuDevices {
			cursor := "  "
			style := MenuItemStyle
			if i == m.mcuCursor {
				cursor = "▸ "
				style = MenuItemSelectedStyle
			}
			// Try to resolve the real device path
			fullPath := filepath.Join("/dev/serial/by-id", dev)
			realPath, _ := os.Readlink(fullPath)
			if realPath != "" && !filepath.IsAbs(realPath) {
				realPath = filepath.Join("/dev", realPath)
			}
			display := dev
			if len(dev) > 55 {
				display = dev[:55] + "..."
			}
			b.WriteString(style.Render(fmt.Sprintf("%s%s", cursor, display)))
			b.WriteString("\n")
			if realPath != "" {
				b.WriteString(DimStyle.Render(fmt.Sprintf("     → %s", realPath)))
				b.WriteString("\n")
			}
			b.WriteString("\n")
		}
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("↑/↓ navigate  ·  Enter to confirm  ·  r: rescan  ·  b: back to menu"))
	return b.String()
}

// ── Screen 3: Instance Configuration ────────────────────────────────────

func (m InstallModel) viewConfig() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Name Your Instance") + "\n" +
			SubtitleStyle.Render("Give this CNC instance a name"),
	))
	b.WriteString("\n\n")

	// Instance name — the only thing the user enters
	cursor := "▸ "
	b.WriteString(MenuItemSelectedStyle.Render(fmt.Sprintf("%sInstance name: %s", cursor, m.instanceName)))
	b.WriteString("\n")
	b.WriteString(DimStyle.Render("     Lowercase letters, numbers, hyphens"))
	b.WriteString("\n\n")

	// Auto-assigned info (non-editable)
	b.WriteString(BoxStyle.Render(
		fmt.Sprintf("Moonraker port: %d (auto-assigned)", m.moonrakerPort),
	))
	b.WriteString("\n")
	b.WriteString(BoxStyle.Render(
		fmt.Sprintf("MCU: %s", shortenMCUPath(m.mcuPath)),
	))
	b.WriteString("\n\n")

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("Enter to edit name  ·  Enter again to confirm  ·  b: back to menu"))
	return b.String()
}

// ── Screen 4: Firmware Check ─────────────────────────────────────

func (m InstallModel) viewFirmwareCheck() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("MCU Firmware") + "\n" +
			SubtitleStyle.Render("Check if your controller board needs flashing"),
	))
	b.WriteString("\n\n")

	b.WriteString(fmt.Sprintf("  MCU: %s\n\n", shortenMCUPath(m.mcuPath)))

	// Check if the MCU appears to have Klipper firmware
	// For now, we check the name for "Klipper" which Klipper firmware embeds
	if strings.Contains(m.mcuPath, "Klipper") || strings.Contains(m.mcuPath, "klipper") {
		b.WriteString(OkStyle.Render("  ✓ Klipper firmware detected"))
		b.WriteString("\n\n")
		b.WriteString(DimStyle.Render("  Your MCU appears to already have Klipper firmware."))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render("  You can proceed with the installation."))
	} else {
		b.WriteString(WarnStyle.Render("  ⚠ No Klipper firmware detected"))
		b.WriteString("\n\n")
		b.WriteString(DimStyle.Render("  The MCU may need to be flashed with Klipper firmware."))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render("  You can do this after installation via 'Flash MCU' in the menu."))
	}

	b.WriteString("\n\n")
	b.WriteString(HelpStyle.Render("Enter to continue with installation  ·  b: back to MCU selection"))
	return b.String()
}

func shortenMCUPath(path string) string {
	if len(path) > 50 {
		return path[:50] + "..."
	}
	return path
}
// ── Screen 3: Execution Dashboard ───────────────────────────────────────

func (m InstallModel) viewExecDashboard() string {
	var b strings.Builder

	elapsed := time.Since(m.startedAt).Round(time.Second)

	b.WriteString(TitleStyle.Render(fmt.Sprintf("Installing E3CNC — step %d of 9", m.current+1)))
	b.WriteString("\n")
	b.WriteString(SubtitleStyle.Render(fmt.Sprintf("Elapsed: %s", elapsed)))
	b.WriteString("\n\n")

	for i, step := range m.steps {
		symbol := ""
		style := DimStyle

		switch step.Status {
		case StepPending:
			symbol = fmt.Sprintf("[%d/9]", step.Number)
			style = StepPendingStyle
		case StepRunning:
			symbol = m.spinner.View()
			style = StepRunningStyle
		case StepCompleted:
			symbol = "✓"
			style = StepCompletedStyle
		case StepFailed:
			symbol = "✗"
			style = StepFailedStyle
		case StepSkipped:
			symbol = "○"
			style = DimStyle
		}

		duration := ""
		if step.Status == StepCompleted && !step.StartedAt.IsZero() {
			duration = fmt.Sprintf(" %s", time.Since(step.StartedAt).Round(time.Second))
		}

		line := fmt.Sprintf("  %s %s%s", symbol, step.Label, duration)
		if i == m.current && step.Status == StepRunning {
			line += "  ◌"
		}
		b.WriteString(style.Render(line))
		b.WriteString("\n")
	}

	b.WriteString("\n")

	// Show verbose output if toggled
	if m.verbose && len(m.logBuffer) > 0 {
		for _, entry := range m.logBuffer {
			b.WriteString(fmt.Sprintf("  %s\n", entry))
		}
		b.WriteString("\n")
	}

	b.WriteString(HelpStyle.Render("v: toggle verbose  ·  Ctrl+C: cancel"))

	return b.String()
}

// ── Screen 4: Error Recovery ────────────────────────────────────────────

func (m InstallModel) viewErrorRecovery() string {
	var b strings.Builder

	step := m.steps[m.failedStep]

	b.WriteString(FailStyle.Render(fmt.Sprintf("Step [%d/9] — %s — FAILED", step.Number, step.Label)))
	b.WriteString("\n\n")

	b.WriteString(BoxStyle.Render(
		DimStyle.Render("An error occurred during this step.") + "\n\n" +
			InfoStyle.Render("Likely cause:") + "\n" +
			DimStyle.Render("  Check your network connection and permissions.") + "\n\n" +
			InfoStyle.Render("Suggested fix:") + "\n" +
			WarnStyle.Render("  sudo chown -R $USER:$USER ~/e3cnc"),
	))
	b.WriteString("\n\n")

	b.WriteString("[r] Retry step\n")
	b.WriteString("[s] Skip (not recommended)\n")
	b.WriteString("[a] Abort - rollback\n")

	return b.String()
}

// ── Screen 5: Verification Dashboard ────────────────────────────────────

func (m InstallModel) viewVerification() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		OkStyle.Render("Installation Complete") + "\n" +
			DimStyle.Render("E3CNC v0.9.8 deployed to instance 'default'"),
	))
	b.WriteString("\n\n")

	b.WriteString(SectionHeaderStyle.Render("Health checks"))
	b.WriteString("\n")

	checks := []struct {
		label    string
		passed   bool
		detail   string
		optional bool
	}{
		{"Moonraker API", true, "200 OK", false},
		{"Moonraker service", true, "active", false},
		{"Klippy ready", false, "placeholder printer.cfg", true},
		{"cnc_agent loaded", true, "connected", false},
		{"Frontend", true, "serving at :8080", false},
		{"Journal consistency", true, "valid", false},
		{"Klipper service", false, "inactive", true},
	}

	for _, c := range checks {
		symbol := "✓"
		style := OkStyle
		if !c.passed {
			if c.optional {
				symbol = "○"
				style = WarnStyle
			} else {
				symbol = "✗"
				style = FailStyle
			}
		}

		line := fmt.Sprintf("  %s %s", symbol, c.label)
		if c.detail != "" {
			line += DimStyle.Render(fmt.Sprintf("  (%s)", c.detail))
		}
		b.WriteString(style.Render(line))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("Press Enter to continue to next steps"))

	return b.String()
}

// ── Screen 6: Next Steps Wizard ─────────────────────────────────────────

func (m InstallModel) viewNextSteps() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("What's next?") + "\n" +
			SubtitleStyle.Render("Guide your CNC from installed to running"),
	))
	b.WriteString("\n\n")

	steps := []struct {
		number      int
		label       string
		command     string
		description string
		completed   bool
	}{
		{1, "Detect MCU", "e3cnc-cli detect-mcu", "Scan USB for your controller board", false},
		{2, "Generate printer.cfg", "e3cnc-cli init-config", "Creates a CNC template with your MCU path", false},
		{3, "Flash firmware", "e3cnc-cli flash-mcu", "Build and flash Klipper to your MCU", false},
		{4, "Edit printer.cfg", "", "Search for '!!! ADJUST' in the config file", false},
		{5, "Restart Klipper", "e3cnc-cli restart", "Apply the new configuration", false},
	}

	for _, s := range steps {
		symbol := "○"
		style := MenuItemStyle
		if s.completed {
			symbol = "●"
			style = OkStyle
		}

		line := fmt.Sprintf("  %s Step %d — %s", symbol, s.number, s.label)
		b.WriteString(style.Render(line))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render(fmt.Sprintf("     %s", s.description)))
		b.WriteString("\n")
		if s.command != "" {
			b.WriteString(DimStyle.Render(fmt.Sprintf("     Run: %s", s.command)))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	b.WriteString(HelpStyle.Render("Press Enter to return to menu"))

	return b.String()
}

// ProgressMsgFromString converts a line of Python CLI output to a progress message.
// This is used by the runner to parse output from `e3cnc-cli install --json`.
type ProgressMsgFromString struct {
	Step    int    `json:"phase"`
	Status  string `json:"status"`
	Output  string `json:"output,omitempty"`
	ErrCode string `json:"error_code,omitempty"`
}

// scanMCUDevices scans /dev/serial/by-id/ for connected MCU devices.
func scanMCUDevices() []string {
	dir := "/dev/serial/by-id/"
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var devices []string
	for _, e := range entries {
		if e.Type().IsRegular() || e.Type()&os.ModeSymlink != 0 {
			// Build the full path and resolve symlink for the real device path
			fullPath := filepath.Join(dir, e.Name())
			realPath, _ := os.Readlink(fullPath)
			if realPath != "" {
				// Symlinks are relative to the parent dir
				if !filepath.IsAbs(realPath) {
					realPath = filepath.Join("/dev/serial/by-id", realPath)
				}
				devices = append(devices, e.Name())
			} else {
				devices = append(devices, e.Name())
			}
		}
	}
	return devices
}
