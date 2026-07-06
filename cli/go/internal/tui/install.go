package tui

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal"
	"github.com/E3CNC/e3cnc/cli/go/internal/bootstrap"
	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// InstallStep represents one phase of the installation process.
type InstallStep struct {
	Number      int
	Label       string
	Status      StepStatus
	StartedAt   time.Time
	Duration    time.Duration
	Output      []string
	ErrorCode   string
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

	// Progress streaming — channel for goroutine-backed install
	progressCh chan tea.Msg

	// Error recovery
	failedStep    int
	recoveryAction string // "retry", "skip", "abort"

	// Health check results
	healthChecks []deploy.HealthCheck

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
	{Number: 1, Label: "Install system packages"},
	{Number: 2, Label: "Configure sudoers"},
	{Number: 3, Label: "Create directories"},
	{Number: 4, Label: "Vendor Moonraker and Klipper"},
	{Number: 5, Label: "Create virtualenvs"},
	{Number: 6, Label: "Generate config files"},
	{Number: 7, Label: "Install systemd services"},
	{Number: 8, Label: "Configure nginx and mDNS"},
	{Number: 9, Label: "Start services"},
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
		screen:          ScreenPreFlight,
		steps:           make([]InstallStep, len(installSteps)),
		preFlightChecks: make([]PreFlightCheck, len(defaultPreFlightLabels)),
		instanceName:    "default",
		moonrakerPort:   7125,
		webPort:         80,
		mDNSHostname:    "e3cnc",
		startServices:   true,
		mcuPath:         mcuPath,
		mcuDevices:      mcuDevices,
		spinner:         s,
		completedSteps:  make(map[string]bool),
	}
}

// defaultPreFlightLabels defines what we check before install.
var defaultPreFlightLabels = []struct {
	label string
	fn    func() (string, string) // returns (status, detail)
}{
	{"System is Linux", checkOS},
	{"Python 3.8+", checkPython},
	{"git installed", checkBinary("git")},
	{"curl installed", checkBinary("curl")},
	{"unzip installed", checkBinary("unzip")},
	{"zstd installed", checkBinary("zstd")},
	{"Disk space (>0.5 GB)", checkDiskSpace},
	{"Sudo access (NOPASSWD)", checkSudo},
	{"GitHub API reachable", checkGitHubAPI},
}

func (m InstallModel) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		m.runPreFlightChecks(),
	)
}

// ── Messages ─────────────────────────────────────────────────────

// preFlightCompleteMsg carries the results of all pre-flight checks.
type preFlightCompleteMsg struct {
	allPassed bool
	results   []PreFlightCheck
}

// backToMenuMsg signals the root model to return to the main menu.
type backToMenuMsg struct{}

// stepUpdateMsg is sent by the install goroutine for real-time step progress.
type stepUpdateMsg struct {
	step      int
	status    StepStatus
	output    string
	errCode   string
	errDetail string
}

// installCompleteMsg is sent when bootstrap and health checks finish.
type installCompleteMsg struct {
	err          error
	healthChecks []deploy.HealthCheck
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
		m.preFlightChecks = msg.results
		// Auto-advance to MCU selection
		m.screen = ScreenMCUSelect

	case stepUpdateMsg:
		return m.handleStepUpdate(msg)

	case installCompleteMsg:
		return m.handleInstallComplete(msg)

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
				return m.startInstall()
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
				// Retry: restart the install
				return m.startInstall()
			case "s":
				// Skip: mark current step as skipped and advance
				if m.failedStep < len(m.steps) {
					m.steps[m.failedStep].Status = StepSkipped
				}
				m.current++
				if m.current < len(m.steps) {
					m.steps[m.current].Status = StepRunning
					m.steps[m.current].StartedAt = time.Now()
				}
				m.screen = ScreenExecDashboard
			case "a":
				// Abort: rollback and return to main menu
				cfg := bootstrap.BootstrapConfig{
					InstanceName: m.instanceName,
					Arch:         runtime.GOARCH,
				}
				bootstrap.Rollback(cfg)
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

// ── Step update handlers ─────────────────────────────────────────

func (m InstallModel) handleStepUpdate(msg stepUpdateMsg) (InstallModel, tea.Cmd) {
	if msg.step >= 0 && msg.step < len(m.steps) {
		m.steps[msg.step].Status = msg.status
		if msg.status == StepRunning {
			m.steps[msg.step].StartedAt = time.Now()
		} else if msg.status == StepCompleted && !m.steps[msg.step].StartedAt.IsZero() {
			m.steps[msg.step].Duration = time.Since(m.steps[msg.step].StartedAt)
		}
		if msg.errDetail != "" {
			m.steps[msg.step].ErrorDetail = msg.errDetail
		}
	}

	// Log the update
	label := ""
	if msg.step >= 0 && msg.step < len(m.steps) {
		label = m.steps[msg.step].Label
	}
	m.logBuffer = append(m.logBuffer, fmt.Sprintf("[%d/%d] %s — %s",
		msg.step+1, len(m.steps), label, msg.status.String()))

	// Chain to read the next progress message
	if m.progressCh != nil {
		return m, m.pollProgressCh(m.progressCh)
	}
	return m, nil
}

func (m InstallModel) handleInstallComplete(msg installCompleteMsg) (InstallModel, tea.Cmd) {
	m.progressCh = nil

	if msg.err != nil {
		m.screen = ScreenErrorRecovery
		m.failedStep = m.current
		m.err = msg.err
		return m, nil
	}

	// Store health check results
	m.healthChecks = msg.healthChecks
	m.screen = ScreenVerification
	return m, nil
}

// ── Pre-flight checks ────────────────────────────────────────────

func (m InstallModel) runPreFlightChecks() tea.Cmd {
	return func() tea.Msg {
		var results []PreFlightCheck
		for _, check := range defaultPreFlightLabels {
			status, detail := check.fn()
			results = append(results, PreFlightCheck{
				Label:  check.label,
				Status: status,
				Detail: detail,
			})
		}
		allPassed := true
		for _, r := range results {
			if r.Status == "failed" {
				allPassed = false
			}
		}
		return preFlightCompleteMsg{allPassed: allPassed, results: results}
	}
}

func checkOS() (string, string) {
	if runtime.GOOS == "linux" {
		return "passed", runtime.GOARCH
	}
	return "failed", fmt.Sprintf("expected linux, got %s", runtime.GOOS)
}

func checkPython() (string, string) {
	out, err := exec.Command("python3", "--version").Output()
	if err != nil {
		return "failed", "python3 not found"
	}
	version := strings.TrimSpace(string(out))
	return "passed", version
}

func checkBinary(name string) func() (string, string) {
	return func() (string, string) {
		_, err := exec.LookPath(name)
		if err != nil {
			return "failed", "not found in PATH"
		}
		return "passed", fmt.Sprintf("found at %s", name)
	}
}

func checkDiskSpace() (string, string) {
	var stat syscall.Statfs_t
	home, _ := os.UserHomeDir()
	err := syscall.Statfs(home, &stat)
	if err != nil {
		return "failed", "cannot check disk space"
	}
	// Available blocks * block size = available bytes
	available := stat.Bavail * uint64(stat.Bsize)
	availableGB := float64(available) / (1024 * 1024 * 1024)
	if availableGB > 0.5 {
		return "passed", fmt.Sprintf("%.1f GB free", availableGB)
	}
	return "failed", fmt.Sprintf("only %.1f GB free, need >0.5 GB", availableGB)
}

func checkSudo() (string, string) {
	// Try sudo -n true (non-interactive, no password)
	cmd := exec.Command("sudo", "-n", "true")
	if err := cmd.Run(); err != nil {
		return "failed", "NOPASSWD sudo not available"
	}
	return "passed", "passwordless"
}

func checkGitHubAPI() (string, string) {
	cmd := exec.Command("curl", "-s", "--connect-timeout", "5",
		"https://api.github.com/repos/E3CNC/e3cnc")
	if err := cmd.Run(); err != nil {
		return "failed", "GitHub API unreachable"
	}
	return "passed", "reachable"
}

// ── Install execution ────────────────────────────────────────────

// startInstall kicks off the real install via bootstrap.Bootstrap with
// real-time progress streaming through a channel.
func (m InstallModel) startInstall() (InstallModel, tea.Cmd) {
	// Initialize steps
	for i, s := range installSteps {
		m.steps[i] = s
		m.steps[i].Status = StepPending
	}
	m.steps[0].Status = StepRunning
	m.steps[0].StartedAt = time.Now()
	m.current = 0
	m.screen = ScreenExecDashboard
	m.startedAt = time.Now()
	m.err = nil

	// Write install journal
	journal := internal.InstallJournal{
		InstallID:    fmt.Sprintf("%d", time.Now().UnixNano()),
		InstanceName: m.instanceName,
		StartedAt:    time.Now(),
		TotalSteps:   len(installSteps),
		Status:       "running",
	}
	internal.WriteInstallJournal(journal)

	// Create progress channel (buffered to avoid blocking the goroutine)
	ch := make(chan tea.Msg, 50)
	m.progressCh = ch

	// Start install in background goroutine
	go runInstallGoroutine(m, ch, journal.InstallID)

	// Return poll cmd to read the first progress message
	return m, m.pollProgressCh(ch)
}

// runInstallGoroutine runs in a background goroutine and sends progress
// messages through the channel as bootstrap executes each step.
func runInstallGoroutine(m InstallModel, ch chan<- tea.Msg, installID string) {
	defer close(ch)

	cfg := bootstrap.BootstrapConfig{
		InstanceName:  m.instanceName,
		MoonrakerPort: m.moonrakerPort,
		WebPort:       m.webPort,
		Hostname:      m.mDNSHostname,
		StartServices: m.startServices,
		Arch:          runtime.GOARCH,
		OnProgress: func(step int, status string, stepErr error) {
			stepStatus := StepPending
			switch status {
			case "running":
				stepStatus = StepRunning
			case "completed":
				stepStatus = StepCompleted
			case "failed":
				stepStatus = StepFailed
			}
			errDetail := ""
			if stepErr != nil {
				errDetail = stepErr.Error()
			}
			ch <- stepUpdateMsg{
				step:      step,
				status:    stepStatus,
				errDetail: errDetail,
			}
		},
	}

	err := bootstrap.Bootstrap(cfg)

	// Update journal
	journal := internal.InstallJournal{
		InstallID:    installID,
		InstanceName: m.instanceName,
		Status:       "completed",
		CompletedAt:  time.Now(),
	}

	if err != nil {
		journal.Status = "failed"
		journal.Error = err.Error()
		// Mark the failed step
		for i, step := range installSteps {
			if i < len(installSteps)-1 {
				_ = step // mark all before current as completed
			}
		}
	}

	internal.WriteInstallJournal(journal)

	if err != nil {
		ch <- installCompleteMsg{err: err}
		return
	}

	// Run health checks
	var checks []deploy.HealthCheck
	inst, lookupErr := instance.FromName(m.instanceName)
	if lookupErr == nil && inst != nil {
		checks = deploy.RunHealthChecks(inst)
	}

	ch <- installCompleteMsg{healthChecks: checks}
}

// pollProgressCh returns a tea.Cmd that reads one message from the progress channel.
func (m InstallModel) pollProgressCh(ch <-chan tea.Msg) tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-ch
		if !ok {
			return nil
		}
		return msg
	}
}

// ── View ─────────────────────────────────────────────────────────

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
		if check.Label == "" {
			continue
		}
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
	} else if len(m.preFlightChecks) > 0 {
		b.WriteString(FailStyle.Render("  ✗ Some checks failed"))
		b.WriteString("\n\n")
		b.WriteString(HelpStyle.Render("Fix the issues above. Press Enter to proceed anyway · b: back to menu"))
	} else {
		b.WriteString(SpinnerStyle.Render("  Running checks..."))
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
	b.WriteString(HelpStyle.Render("Enter to start installation  ·  b: back to MCU selection"))
	return b.String()
}

// ── Screen 5: Execution Dashboard ───────────────────────────────────────

func (m InstallModel) viewExecDashboard() string {
	var b strings.Builder

	elapsed := time.Since(m.startedAt).Round(time.Second)

	b.WriteString(TitleStyle.Render(fmt.Sprintf("Installing E3CNC — step %d of %d", m.current+1, len(m.steps))))
	b.WriteString("\n")
	b.WriteString(SubtitleStyle.Render(fmt.Sprintf("Elapsed: %s", elapsed)))
	b.WriteString("\n\n")

	for i, step := range m.steps {
		symbol := ""
		style := DimStyle

		switch step.Status {
		case StepPending:
			symbol = fmt.Sprintf("[%d/%d]", step.Number, len(m.steps))
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

// ── Screen 6: Error Recovery ────────────────────────────────────────────

func (m InstallModel) viewErrorRecovery() string {
	var b strings.Builder

	step := m.steps[m.failedStep]

	b.WriteString(FailStyle.Render(fmt.Sprintf("Step [%d/%d] — %s — FAILED", step.Number, len(m.steps), step.Label)))
	b.WriteString("\n\n")

	errDetail := step.ErrorDetail
	if errDetail == "" && m.err != nil {
		errDetail = m.err.Error()
	}
	if errDetail != "" {
		b.WriteString(BoxStyle.Render(
			DimStyle.Render("Error:") + "\n" +
				FailStyle.Render(fmt.Sprintf("  %s", errDetail)),
		))
	} else {
		b.WriteString(BoxStyle.Render(
			DimStyle.Render("An error occurred during this step.") + "\n\n" +
				InfoStyle.Render("Likely cause:") + "\n" +
				DimStyle.Render("  Check your network connection and permissions.") + "\n\n" +
				InfoStyle.Render("Suggested fix:") + "\n" +
				WarnStyle.Render("  Check logs with 'e3cnc-tui diagnose'"),
		))
	}
	b.WriteString("\n\n")

	b.WriteString("[r] Retry step\n")
	b.WriteString("[s] Skip (not recommended)\n")
	b.WriteString("[a] Abort and rollback\n")

	return b.String()
}

// ── Screen 7: Verification Dashboard ────────────────────────────────────

func (m InstallModel) viewVerification() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		OkStyle.Render("Installation Complete") + "\n" +
			DimStyle.Render(fmt.Sprintf("E3CNC deployed to instance '%s'", m.instanceName)),
	))
	b.WriteString("\n\n")

	if len(m.healthChecks) > 0 {
		b.WriteString(SectionHeaderStyle.Render("Health checks"))
		b.WriteString("\n")

		for _, c := range m.healthChecks {
			symbol := "✓"
			style := OkStyle
			if !c.Passed {
				if c.IsOptional {
					symbol = "○"
					style = WarnStyle
				} else {
					symbol = "✗"
					style = FailStyle
				}
			}

			line := fmt.Sprintf("  %s %s", symbol, c.Name)
			if c.Detail != "" {
				line += DimStyle.Render(fmt.Sprintf("  (%s)", c.Detail))
			}
			b.WriteString(style.Render(line))
			b.WriteString("\n")
		}
	} else {
		b.WriteString(DimStyle.Render("  Health checks skipped (not running on target)"))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("Press Enter to continue to next steps"))

	return b.String()
}

// ── Screen 8: Next Steps Wizard ─────────────────────────────────────────

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
		{1, "Detect MCU", "e3cnc-tui detect-mcu", "Scan USB for your controller board", false},
		{2, "Generate printer.cfg", "e3cnc-tui init-config", "Creates a CNC template with your MCU path", false},
		{3, "Flash firmware", "e3cnc-tui flash-mcu", "Build and flash Klipper to your MCU", false},
		{4, "Edit printer.cfg", "", "Search for '!!! ADJUST' in the config file", false},
		{5, "Restart Klipper", "e3cnc-tui restart", "Apply the new configuration", false},
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

// ── Utilities ────────────────────────────────────────────────────

// shortenMCUPath truncates a long MCU path for display.
func shortenMCUPath(path string) string {
	if len(path) > 50 {
		return path[:50] + "..."
	}
	return path
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
