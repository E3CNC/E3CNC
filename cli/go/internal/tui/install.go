package tui

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal"
	"github.com/E3CNC/e3cnc/cli/go/internal/bootstrap"
	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// detectionTimeout is the maximum time to wait for a single detection check
// before it is marked as timed out and the detection phase continues.
const detectionTimeout = 10 * time.Second

// InstallStep represents one phase of the installation process.
type InstallStep struct {
	Number      int
	Label       string
	Status      StepStatus
	StartedAt   time.Time
	Duration    time.Duration
	Output      []string
	ErrorDetail string
}

// getEnvPort reads a port from an environment variable, falling back to default.
func getEnvPort(envVar string, defaultPort int) int {
	if v := os.Getenv(envVar); v != "" {
		var port int
		if _, err := fmt.Sscanf(v, "%d", &port); err == nil && port > 0 && port <= 65535 {
			return port
		}
	}
	return defaultPort
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
	ScreenDetection     InstallScreen = iota
	ScreenMCUPicker
	ScreenKlipperPicker
	ScreenDecision
	ScreenExecDashboard
	ScreenErrorRecovery
	ScreenVerification
)

// InstallModel is the BubbleTea model for the install wizard.
type InstallModel struct {
	screen  InstallScreen
	steps   []InstallStep
	current int // current step index being executed

	// Installation mode
	installMode int // 1 = import existing, 2 = new instance
	modeCursor  int

	// Detection results
	detectionResults []DetectionResult
	detectionCh      chan tea.Msg

	// Configuration state
	instanceName   string
	nameInput      textinput.Model
	moonrakerPort  int
	webPort        int
	mDNSHostname   string
	startServices  bool
	mcuPath        string
	mcuDevices     []string
	mcuCursor      int

	// Klipper install picker (import mode)
	klipperInstalls []bootstrap.DetectedKlipper
	klipperCursor   int
	selectedKlipper *bootstrap.DetectedKlipper

	// Execution state
	startedAt    time.Time
	elapsed      time.Duration
	verbose      bool
	logBuffer    []string

	// Progress streaming — channel for goroutine-backed install
	progressCh chan tea.Msg

	// Error recovery
	failedStep     int
	recoveryAction string // "retry", "skip", "abort"

	// Health check results
	healthChecks []deploy.HealthCheck

	// Next steps tracking
	completedSteps map[string]bool

	// Common
	spinner     spinner.Model
	progBar     progress.Model
	logViewport viewport.Model
	progressPct float64 // 0.0 to 1.0 for the progress bar
	done        bool
	err         error
	width       int
	height      int
}

// DetectionResult represents a single system detection check result.
type DetectionResult struct {
	Label  string
	Status string // "pending", "running", "passed", "failed", "skipped"
	Detail string
}

// PreFlightCheck represents a single pre-flight validation item.
type PreFlightCheck struct {
	Label      string
	Status     string // "passed", "failed", "running", "skipped"
	Detail     string
	AutoFixCmd string // command to auto-fix (e.g., "sudo apt install zstd")
}

var freshInstallSteps = []InstallStep{
	{Number: 1, Label: "Install system packages"},
	{Number: 2, Label: "Configure sudoers"},
	{Number: 3, Label: "Create directories"},
	{Number: 4, Label: "Vendor Moonraker and Klipper"},
	{Number: 5, Label: "Create virtualenvs"},
	{Number: 6, Label: "Generate config files"},
	{Number: 7, Label: "Install system services"},
	{Number: 8, Label: "Configure nginx and mDNS"},
	{Number: 9, Label: "Start services"},
}

// importSteps defines the step list when importing an existing Klipper installation.
// It has 7 steps that detect, configure, and integrate rather than provisioning from scratch.
var importSteps = []InstallStep{
	{Number: 1, Label: "Install system packages"},
	{Number: 2, Label: "Configure sudoers"},
	{Number: 3, Label: "Detect existing Klipper install"},
	{Number: 4, Label: "Create directories"},
	{Number: 5, Label: "Configure Moonraker"},
	{Number: 6, Label: "Configure nginx and mDNS"},
	{Number: 7, Label: "Start services and integrate"},
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

	ni := textinput.New()
	ni.Placeholder = "default"
	ni.CharLimit = 32
	ni.Width = 30
	ni.Prompt = "▸ "

	vp := viewport.New(70, 8)

	return InstallModel{
		screen:          ScreenDetection,
		installMode:     0,
		modeCursor:      0,
		steps:           make([]InstallStep, len(freshInstallSteps)),
		detectionCh:     make(chan tea.Msg, 50),
		instanceName:    "default",
		nameInput:       ni,
		moonrakerPort:   getEnvPort("E3CNC_MOONRAKER_PORT", 7125),
		webPort:         getEnvPort("E3CNC_WEB_PORT", 80),
		mDNSHostname:    "e3cnc",
		startServices:   true,
		verbose:         true,
		mcuPath:         mcuPath,
		mcuDevices:      mcuDevices,
		spinner:         s,
		progBar:         newProgressBar(),
		logViewport:     vp,
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
		m.runDetection(),
	)
}

// ── Messages ─────────────────────────────────────────────────────

// detectionUpdateMsg carries a single detection result as it completes.
type detectionUpdateMsg struct {
	index  int
	result DetectionResult
}

// detectionCompleteMsg signals the detection phase is done.
type detectionCompleteMsg struct {
	results []DetectionResult
}

// detectionTimeoutMsg is sent when a single detection check times out.
type detectionTimeoutMsg struct {
	index int
}

// preFlightCompleteMsg carries the results of all pre-flight checks.
type preFlightCompleteMsg struct {
	allPassed bool
	results   []PreFlightCheck
}

// stepOutputMsg carries a single line of stdout/stderr output from a step.
type stepOutputMsg struct {
	line string
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
		m.logViewport.Width = msg.Width - 4
		m.logViewport.Height = max(6, (msg.Height-8)/2)

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case progress.FrameMsg:
		p, cmd := m.progBar.Update(msg)
		m.progBar = p.(progress.Model)
		return m, cmd

	case tea.MouseMsg:
		if m.screen == ScreenExecDashboard || m.screen == ScreenVerification {
			var cmd tea.Cmd
			m.logViewport, cmd = m.logViewport.Update(msg)
			return m, cmd
		}

	case detectionUpdateMsg:
		if msg.index >= 0 && msg.index < len(m.detectionResults) {
			m.detectionResults[msg.index] = msg.result
		}
		if m.detectionCh != nil {
			return m, m.pollDetectionCh(m.detectionCh)
		}

	case detectionCompleteMsg:
		m.detectionResults = msg.results
		m.detectionCh = nil
		if len(m.mcuDevices) > 3 {
			m.screen = ScreenMCUPicker
			m.mcuCursor = 0
		} else {
			m.screen = ScreenDecision
		}

	case detectionTimeoutMsg:
		if msg.index >= 0 && msg.index < len(m.detectionResults) {
			m.detectionResults[msg.index].Status = "timedout"
			m.detectionResults[msg.index].Detail = "timeout exceeded"
		}

	case preFlightCompleteMsg:
		m.screen = ScreenDecision

	case stepUpdateMsg:
		return m.handleStepUpdate(msg)

	case stepOutputMsg:
		for _, line := range strings.Split(msg.line, "\n") {
			m.logBuffer = append(m.logBuffer, line)
		}
		m.logViewport.SetContent(strings.Join(m.logBuffer, "\n"))
		m.logViewport.GotoBottom()
		if m.progressCh != nil {
			return m, m.pollProgressCh(m.progressCh)
		}
		return m, nil

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
		case ScreenMCUPicker:
			switch msg.String() {
			case "up", "k":
				if m.mcuCursor > 0 {
					m.mcuCursor--
				}
			case "down", "j":
				if m.mcuCursor < len(m.mcuDevices)-1 {
					m.mcuCursor++
				}
			case "enter", " ":
				if m.mcuCursor >= 0 && m.mcuCursor < len(m.mcuDevices) {
					m.mcuPath = m.mcuDevices[m.mcuCursor]
				}
				m.screen = ScreenDecision
			case "r":
				m.screen = ScreenDetection
				m.detectionResults = nil
				m.detectionCh = make(chan tea.Msg, 50)
				m.mcuDevices = scanMCUDevices()
				m.mcuPath = ""
				if len(m.mcuDevices) > 0 {
					m.mcuPath = m.mcuDevices[0]
				}
				return m, m.runDetection()
			}

		case ScreenKlipperPicker:
			switch msg.String() {
			case "up", "k":
				if m.klipperCursor > 0 {
					m.klipperCursor--
				}
			case "down", "j":
				if m.klipperCursor < len(m.klipperInstalls)-1 {
					m.klipperCursor++
				}
			case "enter", " ":
				if m.klipperCursor >= 0 && m.klipperCursor < len(m.klipperInstalls) {
					m.selectedKlipper = &m.klipperInstalls[m.klipperCursor]
				}
				return m.startInstall(0)
			case "b", "esc":
				m.screen = ScreenDecision
				m.selectedKlipper = nil
			}

		case ScreenDecision:
			switch msg.String() {
			case "up", "k":
				if m.modeCursor > 0 {
					m.modeCursor--
				}
			case "down", "j":
				if m.modeCursor < 1 {
					m.modeCursor++
				}
			case "enter", " ":
				if m.modeCursor == 0 {
					m.installMode = 1 // import existing
					// Detect Klipper installations for the import flow
					installs, err := bootstrap.DetectAllKlipperInstalls()
					m.klipperInstalls = installs
					m.klipperCursor = 0
					if err != nil || len(installs) == 0 {
						// No Klipper found — stay on decision screen with warning
						// (the view will show the error)
						return m, nil
					}
					if len(installs) == 1 {
						// Auto-select the single install
						m.selectedKlipper = &installs[0]
						return m.startInstall(0)
					}
					// Multiple installs — show picker
					m.screen = ScreenKlipperPicker
					return m, nil
				} else {
					m.installMode = 2 // new instance
					return m.startInstall(0)
				}
			case "r":
				m.screen = ScreenDetection
				m.detectionResults = nil
				m.detectionCh = make(chan tea.Msg, 50)
				return m, m.runDetection()
			}

		case ScreenExecDashboard:
			switch msg.String() {
			case "v":
				m.verbose = !m.verbose
			case "ctrl+c":
				m.screen = ScreenErrorRecovery
				m.failedStep = m.current
				m.recoveryAction = "abort"
			case "pgup":
				m.logViewport, _ = m.logViewport.Update(msg)
			case "pgdn":
				m.logViewport, _ = m.logViewport.Update(msg)
			}

		case ScreenVerification:
			if msg.String() == "enter" {
				m.done = true
			}
			if key := msg.String(); key == "pgup" || key == "pgdn" {
				m.logViewport, _ = m.logViewport.Update(msg)
			}

		case ScreenErrorRecovery:
			switch msg.String() {
			case "r":
				// Retry: restart from the failed step
				return m.startInstall(m.failedStep)
			case "s":
				// Skip: mark current step as skipped and resume from next
				if m.failedStep < len(m.steps) {
					m.steps[m.failedStep].Status = StepSkipped
				}
				return m.startInstall(m.failedStep + 1)
			case "a":
				// Abort: rollback and return to main menu
				cfg := bootstrap.BootstrapConfig{
					InstanceName: m.instanceName,
					Arch:         runtime.GOARCH,
				}
				bootstrap.Rollback(cfg)
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
			m.current = msg.step
		} else if msg.status == StepCompleted && !m.steps[msg.step].StartedAt.IsZero() {
			m.steps[msg.step].Duration = time.Since(m.steps[msg.step].StartedAt)
		}
		if msg.errDetail != "" {
			m.steps[msg.step].ErrorDetail = msg.errDetail
		}
	}

	// Update progress bar
	if len(m.steps) > 0 {
		completed := 0
		for _, s := range m.steps {
			if s.Status == StepCompleted || s.Status == StepSkipped {
				completed++
			}
		}
		m.progressPct = float64(completed) / float64(len(m.steps))
		if m.progressPct > 1.0 {
			m.progressPct = 1.0
		}
	}

	// Update viewport display (log comes from stepOutputMsg now)
	m.logViewport.SetContent(strings.Join(m.logBuffer, "\n"))
	m.logViewport.GotoBottom()

	// Chain to read the next progress message
	if m.progressCh != nil {
		return m, m.pollProgressCh(m.progressCh)
	}
	return m, nil
}

// loadExistingInstance loads an existing instance's configuration into the install model.
// This allows the installer to update/reinstall to an existing instance.
func (m *InstallModel) loadExistingInstance(name string) {
	inst, err := instance.FromName(name)
	if err != nil {
		return
	}
	m.instanceName = inst.Name
	m.moonrakerPort = inst.MoonrakerPort
	m.webPort = inst.WebPort
	// Update the name input to reflect the loaded instance
	m.nameInput.SetValue(inst.Name)
}

func (m InstallModel) handleInstallComplete(msg installCompleteMsg) (InstallModel, tea.Cmd) {
	m.progressCh = nil

	if msg.err != nil {
		// Check if there are still pending steps — if so, error was blocking
		processed := 0
		for _, s := range m.steps {
			if s.Status != StepPending {
				processed++
			}
		}
		if processed < len(m.steps) {
			// Blocking error — show error recovery
			m.screen = ScreenErrorRecovery
			m.failedStep = m.current
			m.err = msg.err
			return m, nil
		}
		// Non-blocking — append summary to log and stay on dashboard
		m.err = msg.err
		return m.appendSummaryToLog(), nil
	}

	// Store health check results
	m.healthChecks = msg.healthChecks
	return m.appendSummaryToLog(), nil
}

// appendSummaryToLog adds the installation summary to the log viewport and
// updates the help text so the user knows to press Enter to return to menu.
func (m InstallModel) appendSummaryToLog() InstallModel {
	// Filter log to show only warnings and errors
	var filtered []string
	for _, line := range m.logBuffer {
		lower := strings.ToLower(line)
		if strings.Contains(lower, "fail") ||
			strings.Contains(lower, "error") ||
			strings.Contains(lower, "warn") ||
			strings.Contains(lower, "✗") ||
			strings.Contains(lower, "⚠") {
			filtered = append(filtered, line)
		}
	}
	// If no warnings/errors found, keep last few lines for context
	if len(filtered) == 0 && len(m.logBuffer) > 0 {
		start := max(0, len(m.logBuffer)-5)
		filtered = append(filtered, m.logBuffer[start:]...)
	}
	m.logBuffer = filtered

	m.logBuffer = append(m.logBuffer, "")
	m.logBuffer = append(m.logBuffer, "── Installation Complete ──────────────────────")
	m.logBuffer = append(m.logBuffer, fmt.Sprintf("  E3CNC deployed to instance '%s'", m.instanceName))
	m.logBuffer = append(m.logBuffer, "")

	if m.err != nil {
		m.logBuffer = append(m.logBuffer, fmt.Sprintf("  ⚠ %s", m.err))
		m.logBuffer = append(m.logBuffer, "")
	}

	if len(m.healthChecks) > 0 {
		m.logBuffer = append(m.logBuffer, "  Health checks:")
		for _, c := range m.healthChecks {
			symbol := "✓"
			detail := ""
			if !c.Passed {
				symbol = "✗"
			}
			if c.Detail != "" {
				detail = fmt.Sprintf("  (%s)", c.Detail)
			}
			m.logBuffer = append(m.logBuffer, fmt.Sprintf("    %s %s%s", symbol, c.Name, detail))
		}
	} else {
		m.logBuffer = append(m.logBuffer, "  Health checks skipped (not running on target)")
	}

	m.logViewport.SetContent(strings.Join(m.logBuffer, "\n"))
	m.logViewport.GotoBottom()
	m.screen = ScreenVerification
	return m
}

// ── Pre-flight checks ────────────────────────────────────────────

// ── Install execution ────────────────────────────────────────────

// startInstall kicks off the real install via bootstrap.Bootstrap with
// real-time progress streaming through a channel.
// startStep is the step index to start from (0 = beginning).
func (m InstallModel) startInstall(startStep int) (InstallModel, tea.Cmd) {
	// Select the correct step list based on install mode
	steps := freshInstallSteps
	if m.installMode == 1 {
		steps = importSteps
	}

	// Re-initialize steps slice to match the selected pipeline length
	m.steps = make([]InstallStep, len(steps))

	// Initialize steps
	for i, s := range steps {
		if startStep > 0 && i < startStep {
			// For retry/skip: mark steps before startStep as skipped
			m.steps[i] = s
			m.steps[i].Status = StepSkipped
			continue
		}
		m.steps[i] = s
		m.steps[i].Status = StepPending
	}
	m.steps[startStep].Status = StepRunning
	m.steps[startStep].StartedAt = time.Now()
	m.current = startStep
	m.screen = ScreenExecDashboard
	m.startedAt = time.Now()
	m.err = nil
	m.logViewport = viewport.New(max(70, m.width-4), max(6, (max(m.height, 44)-8)/2))
	m.logViewport.KeyMap.PageUp.SetKeys("pgup")
	m.logViewport.KeyMap.PageDown.SetKeys("pgdn")
	m.logBuffer = nil

	// Write install journal
	journal := internal.InstallJournal{
		InstallID:    fmt.Sprintf("%d", time.Now().UnixNano()),
		InstanceName: m.instanceName,
		StartedAt:    time.Now(),
		TotalSteps:   len(steps),
		Status:       "running",
	}
	internal.WriteInstallJournal(journal)

	// Create progress channel (buffered to avoid blocking the goroutine)
	ch := make(chan tea.Msg, 2000)
	m.progressCh = ch

	// Start install in background goroutine
	go runInstallGoroutine(m, ch, journal.InstallID, startStep, steps)

	// Return poll cmd to read the first progress message
	return m, m.pollProgressCh(ch)
}

// runInstallGoroutine runs in a background goroutine and sends progress
// messages through the channel as bootstrap executes each step.
func runInstallGoroutine(m InstallModel, ch chan<- tea.Msg, installID string, startStep int, steps []InstallStep) {
	defer close(ch)

	cfg := bootstrap.BootstrapConfig{
		InstanceName:  m.instanceName,
		MoonrakerPort: m.moonrakerPort,
		WebPort:       m.webPort,
		Hostname:      m.mDNSHostname,
		StartServices: m.startServices,
		Arch:          runtime.GOARCH,
		StartFrom:     startStep,
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

	// Redirect stdout/stderr to capture real command output
	r, w, _ := os.Pipe()
	oldStdout := os.Stdout
	oldStderr := os.Stderr
	os.Stdout = w
	os.Stderr = w

	// Read captured output in background — batch lines to reduce message volume
	outputDone := make(chan struct{})
	go func() {
		defer close(outputDone)
		scanner := bufio.NewScanner(r)
		var batch []string
		flush := func() {
			if len(batch) > 0 {
				ch <- stepOutputMsg{line: strings.Join(batch, "\n")}
				batch = batch[:0]
			}
		}
		for scanner.Scan() {
			batch = append(batch, scanner.Text())
			if len(batch) >= 10 {
				flush()
			}
		}
		flush() // send remaining
	}()

	err := bootstrap.Bootstrap(cfg)

	// Restore stdout/stderr and close pipe
	w.Close()
	os.Stdout = oldStdout
	os.Stderr = oldStderr
	<-outputDone // wait for scanner to finish

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
		for i, step := range steps {
			if i < len(steps)-1 {
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

// runDetection starts the streaming detection phase with per-check timeout.
func (m InstallModel) runDetection() tea.Cmd {
	detectionLabels := []struct {
		label string
		fn    func() (string, string)
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
		{"MCU devices", checkMCU},
		{"Ports (8081, 7125, 7126)", checkPorts},
	}

	m.detectionResults = make([]DetectionResult, len(detectionLabels))
	for i, d := range detectionLabels {
		m.detectionResults[i] = DetectionResult{Label: d.label, Status: "pending"}
	}

	ch := m.detectionCh
	return func() tea.Msg {
		// Send "running" for all checks immediately
		for i, d := range detectionLabels {
			ch <- detectionUpdateMsg{
				index:  i,
				result: DetectionResult{Label: d.label, Status: "running"},
			}
		}

		// Shared final results array
		finalResults := make([]DetectionResult, len(detectionLabels))
		for i, d := range detectionLabels {
			finalResults[i] = DetectionResult{Label: d.label, Status: "pending"}
		}

		var mu sync.Mutex
		done := make(chan struct{}, len(detectionLabels))

		for i, d := range detectionLabels {
			go func(idx int, label string, fn func() (string, string)) {
				// Run the check in a goroutine so we can timeout
				resultCh := make(chan DetectionResult, 1)
				go func() {
					status, detail := fn()
					resultCh <- DetectionResult{Label: label, Status: status, Detail: detail}
				}()

				var result DetectionResult
				select {
				case result = <-resultCh:
				case <-time.After(detectionTimeout):
					result = DetectionResult{Label: label, Status: "timedout", Detail: "timeout exceeded"}
				}

				ch <- detectionUpdateMsg{
					index:  idx,
					result: result,
				}

				mu.Lock()
				finalResults[idx] = result
				mu.Unlock()
				done <- struct{}{}
			}(i, d.label, d.fn)
		}

		// Wait for all checks to complete or timeout
		for i := 0; i < len(detectionLabels); i++ {
			<-done
		}

		return detectionCompleteMsg{results: finalResults}
	}
}

// pollDetectionCh reads one detection message from the channel.
func (m InstallModel) pollDetectionCh(ch <-chan tea.Msg) tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-ch
		if !ok {
			return nil
		}
		return msg
	}
}

// checkMCU checks for connected MCU devices.
func checkMCU() (string, string) {
	devices := scanMCUDevices()
	if len(devices) == 0 {
		return "failed", "no devices found"
	}
	return "passed", fmt.Sprintf("%d device(s) found", len(devices))
}

// checkPorts checks if default ports are available.
func checkPorts() (string, string) {
	freePort, err := instance.FindNextAvailablePort()
	if err != nil {
		return "failed", "cannot check ports"
	}
	if freePort > 0 {
		return "passed", fmt.Sprintf("port %d available", freePort)
	}
	return "failed", "no free ports found"
}

// ── View ─────────────────────────────────────────────────────────

func (m InstallModel) View() string {
	switch m.screen {
	case ScreenDetection:
		return m.viewDetection()
	case ScreenMCUPicker:
		return m.viewMCUPicker()
	case ScreenKlipperPicker:
		return m.viewKlipperPicker()
	case ScreenDecision:
		return m.viewDecision()
	case ScreenExecDashboard:
		return m.viewExecDashboard()
	case ScreenErrorRecovery:
		return m.viewErrorRecovery()
	case ScreenVerification:
		return m.viewExecDashboard()
	default:
		return "Unknown screen"
	}
}
