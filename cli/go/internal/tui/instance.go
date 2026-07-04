package tui

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/E3CNC/e3cnc/cli/go/internal"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
	tea "github.com/charmbracelet/bubbletea"
)

// InstanceScreen represents which sub-screen the instance manager is showing.
type InstanceScreen int

const (
	InstList InstanceScreen = iota
	InstCreate
	InstDelete
)

// InstanceInfo mirrors a single instance from `e3cnc-cli instances --json`.
type InstanceInfo struct {
	Name             string `json:"name"`
	IsRunning        bool   `json:"is_running"`
	ConfigDir        string `json:"config_dir"`
	MoonrakerService string `json:"moonraker_service"`
	KlipperService   string `json:"klipper_service"`
	MoonrakerPort    int    `json:"moonraker_port"`
	WebPort          int    `json:"web_port"`
	WebRoot          string `json:"web_root"`
	PrinterDataDir   string `json:"printer_data_dir"`
}

// InstancesJSON is the root structure returned by `e3cnc-cli instances --json`.
type InstancesJSON struct {
	LocalIP        string         `json:"local_ip"`
	ReleaseVersion *string        `json:"release_version"`
	Instances      []InstanceInfo `json:"instances"`
}

// instanceListMsg is sent when the instances list finishes loading.
type instanceListMsg struct {
	instances []InstanceInfo
	localIP   string
	err       error
}

// instanceCreatedMsg is sent when a create-instance command finishes.
type instanceCreatedMsg struct {
	err error
}

// instanceDeletedMsg is sent when a delete-instance command finishes.
type instanceDeletedMsg struct {
	err error
}

// InstanceModel is the BubbleTea model for the instance management screen.
type InstanceModel struct {
	screen InstanceScreen

	// Active instance from state
	activeInstance string

	// List view state
	instances    []InstanceInfo
	localIP      string
	cursor       int
	loading      bool
	loadErr      string

	// Create form state
	createName       string
	createPort       string
	createFocusedIdx int // 0=name, 1=port

	// Delete confirm state
	deleteTarget string
	deleteIdx    int

	// Running command state
	running  bool
	runLabel string

	// Done signal — set true when user returns to main menu
	done bool

	width  int
	height int
}

// NewInstanceModel creates a new instance management model.
func NewInstanceModel() InstanceModel {
	state := internal.LoadState()
	return InstanceModel{
		screen:         InstList,
		activeInstance: state.ActiveInstance,
		loading:        true,
	}
}

func (m InstanceModel) Init() tea.Cmd {
	return m.fetchInstances()
}

// fetchInstances returns a tea.Cmd that lists instances using Go-native code.
func (m InstanceModel) fetchInstances() tea.Cmd {
	return func() tea.Msg {
		instances, err := instance.DetectInstances()
		if err != nil {
			return instanceListMsg{err: fmt.Errorf("detect instances: %w", err)}
		}

		var instList []InstanceInfo
		for _, inst := range instances {
			instList = append(instList, InstanceInfo{
				Name:             inst.Name,
				IsRunning:        inst.IsRunning,
				ConfigDir:        inst.ConfigDir,
				MoonrakerService: inst.MoonrakerService,
				KlipperService:   inst.KlipperService,
				MoonrakerPort:    inst.MoonrakerPort,
				WebPort:          inst.WebPort,
				WebRoot:          inst.WebRoot,
				PrinterDataDir:   inst.PrinterDataDir,
			})
		}

		localIP := instance.GetLocalIP()
		return instanceListMsg{instances: instList, localIP: localIP}
	}
}

// createInstanceCmd returns a tea.Cmd that creates a new instance.
func (m InstanceModel) createInstanceCmd() tea.Cmd {
	return func() tea.Msg {
		cliDir, pythonExe, err := internal.FindPythonCLI()
		if err != nil {
			return instanceCreatedMsg{err: fmt.Errorf("cannot find Python CLI: %w", err)}
		}

		// Run from the parent of cliDir (release root or repo root)
		workDir := filepath.Dir(cliDir)
		args := []string{"-m", "cli", "install", "--name", m.createName, "--check"}
		if m.createPort != "" {
			args = append(args, "--port", m.createPort)
		}

		result, err := internal.RunPythonSimple(pythonExe, args, workDir)
		if err != nil {
			return instanceCreatedMsg{err: fmt.Errorf("create instance: %w", err)}
		}
		if result.ExitCode != 0 {
			return instanceCreatedMsg{err: fmt.Errorf("create failed (exit %d): %s", result.ExitCode, result.Stderr)}
		}
		return instanceCreatedMsg{}
	}
}

// deleteInstanceCmd returns a tea.Cmd that deletes an instance.
func (m InstanceModel) deleteInstanceCmd() tea.Cmd {
	return func() tea.Msg {
		cliDir, pythonExe, err := internal.FindPythonCLI()
		if err != nil {
			return instanceDeletedMsg{err: fmt.Errorf("cannot find Python CLI: %w", err)}
		}

		workDir := filepath.Dir(cliDir)
		args := []string{"-m", "cli", "uninstall", "--name", m.deleteTarget, "--yes"}
		result, err := internal.RunPythonSimple(pythonExe, args, workDir)
		if err != nil {
			return instanceDeletedMsg{err: fmt.Errorf("delete instance: %w", err)}
		}
		if result.ExitCode != 0 {
			return instanceDeletedMsg{err: fmt.Errorf("delete failed (exit %d): %s", result.ExitCode, result.Stderr)}
		}
		return instanceDeletedMsg{}
	}
}

func (m InstanceModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case instanceListMsg:
		m.loading = false
		if msg.err != nil {
			m.loadErr = msg.err.Error()
		} else {
			m.instances = msg.instances
			m.localIP = msg.localIP
			m.loadErr = ""
		}

	case instanceCreatedMsg:
		m.running = false
		if msg.err != nil {
			m.loadErr = msg.err.Error()
		} else {
			// Refresh the list
			m.screen = InstList
			return m, m.fetchInstances()
		}

	case instanceDeletedMsg:
		m.running = false
		if msg.err != nil {
			m.loadErr = msg.err.Error()
		} else {
			// Refresh the list
			m.screen = InstList
			return m, m.fetchInstances()
		}

	case tea.KeyMsg:
		switch m.screen {
		case InstList:
			return m.handleListKey(msg)
		case InstCreate:
			return m.handleCreateKey(msg)
		case InstDelete:
			return m.handleDeleteKey(msg)
		}
	}

	return m, nil
}

func (m InstanceModel) handleListKey(msg tea.KeyMsg) (InstanceModel, tea.Cmd) {
	switch msg.String() {
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
	case "down", "j":
		if m.cursor < len(m.instances)-1 {
			m.cursor++
		}
	case "enter", " ":
		if len(m.instances) == 0 {
			return m, nil
		}
		// Switch active instance
		inst := m.instances[m.cursor]
		m.activeInstance = inst.Name
		internal.SaveState(internal.State{ActiveInstance: inst.Name})
	case "n", "+":
		// Create new instance
		m.screen = InstCreate
		m.createName = ""
		m.createPort = ""
		m.createFocusedIdx = 0
	case "d":
		// Delete instance
		if len(m.instances) > 0 {
			m.deleteTarget = m.instances[m.cursor].Name
			m.deleteIdx = m.cursor
			m.screen = InstDelete
		}
	case "r":
		// Refresh list
		m.loading = true
		m.loadErr = ""
		return m, m.fetchInstances()
	case "b", "q", "esc":
		// Return to main menu
		m.done = true
		return m, nil
	}
	return m, nil
}

func (m InstanceModel) handleCreateKey(msg tea.KeyMsg) (InstanceModel, tea.Cmd) {
	switch msg.String() {
	case "up", "k":
		m.createFocusedIdx = 0
	case "down", "j":
		m.createFocusedIdx = 1
	case "enter":
		if m.createName == "" {
			m.loadErr = "Instance name is required"
			return m, nil
		}
		// Validate name: lowercase, numbers, hyphens
		for _, r := range m.createName {
			if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-') {
				m.loadErr = "Name must be lowercase letters, numbers, and hyphens only"
				return m, nil
			}
		}
		m.running = true
		m.runLabel = "Creating instance..."
		return m, m.createInstanceCmd()
	case "esc":
		m.screen = InstList
	}
	return m, nil
}

func (m InstanceModel) handleDeleteKey(msg tea.KeyMsg) (InstanceModel, tea.Cmd) {
	switch msg.String() {
	case "y", "Y":
		m.running = true
		m.runLabel = "Deleting instance..."
		return m, m.deleteInstanceCmd()
	case "n", "N", "esc":
		m.screen = InstList
	}
	return m, nil
}

func (m InstanceModel) View() string {
	switch m.screen {
	case InstList:
		return m.viewList()
	case InstCreate:
		return m.viewCreate()
	case InstDelete:
		return m.viewDelete()
	default:
		return "Unknown instance screen"
	}
}

// ── List View ────────────────────────────────────────────────────────────

func (m InstanceModel) viewList() string {
	var b strings.Builder

	b.WriteString(TitleStyle.Render("Instance Manager"))
	b.WriteString("\n\n")

	if m.activeInstance != "" {
		b.WriteString(InfoStyle.Render(fmt.Sprintf("Active: %s", m.activeInstance)))
		b.WriteString("\n\n")
	}

	if m.loading {
		b.WriteString(SpinnerStyle.Render("  Loading instances..."))
		b.WriteString("\n")
		return b.String()
	}

	if m.loadErr != "" {
		b.WriteString(CheckFailStyle.Render(fmt.Sprintf("  ✗ %s", m.loadErr)))
		b.WriteString("\n\n")
		b.WriteString(HelpStyle.Render("Press 'r' to retry, 'q' to go back"))
		return b.String()
	}

	b.WriteString(SubtitleStyle.Render(fmt.Sprintf("Local IP: %s", m.localIP)))
	b.WriteString("\n\n")

	if len(m.instances) == 0 {
		b.WriteString(DimStyle.Render("  No instances found"))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render("  Press 'n' to create a new instance"))
		b.WriteString("\n")
		return b.String()
	}

	for i, inst := range m.instances {
		cursor := "  "
		style := MenuItemStyle
		nameStyle := MenuItemStyle
		if i == m.cursor {
			cursor = "▸ "
			style = MenuItemSelectedStyle
			nameStyle = MenuItemSelectedStyle
		}

		// Status indicator
		statusSymbol := "○"
		statusStyle := DimStyle
		if inst.IsRunning {
			statusSymbol = "●"
			statusStyle = OkStyle
		}

		// Active marker
		activeMarker := ""
		if inst.Name == m.activeInstance {
			activeMarker = OkStyle.Render("  ← active")
		}

		line := fmt.Sprintf("%s%s %s%s",
			cursor,
			statusStyle.Render(statusSymbol),
			nameStyle.Render(inst.Name),
			activeMarker,
		)
		b.WriteString(style.Render(line))
		b.WriteString("\n")

		// Sub-detail line when selected
		if i == m.cursor {
			web := ""
			if inst.WebPort != 80 {
				web = fmt.Sprintf(":%d", inst.WebPort)
			}
			b.WriteString(DimStyle.Render(fmt.Sprintf("      Port: %d  ·  Web: http://%s%s/  ·  Service: %s",
				inst.MoonrakerPort, m.localIP, web, inst.MoonrakerService)))
			b.WriteString("\n")
		}
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("↑/↓ navigate  ·  enter: switch active  ·  n: create  ·  d: delete  ·  r: refresh  ·  b: back"))
	b.WriteString("\n")

	return b.String()
}

// ── Create Form ──────────────────────────────────────────────────────────

func (m InstanceModel) viewCreate() string {
	var b strings.Builder

	b.WriteString(TitleStyle.Render("Create New Instance"))
	b.WriteString("\n\n")

	if m.running {
		b.WriteString(SpinnerStyle.Render(fmt.Sprintf("  %s", m.runLabel)))
		b.WriteString("\n")
		return b.String()
	}

	if m.loadErr != "" {
		b.WriteString(CheckFailStyle.Render(fmt.Sprintf("  ✗ %s", m.loadErr)))
		b.WriteString("\n\n")
	}

	fields := []struct {
		label     string
		value     string
		hint      string
		fieldIdx  int
	}{
		{"Instance name", m.createName, "Lowercase letters, numbers, hyphens", 0},
		{"Port (optional)", m.createPort, "Leave empty for auto-assign", 1},
	}

	for _, f := range fields {
		cursor := "  "
		style := MenuItemStyle
		if f.fieldIdx == m.createFocusedIdx {
			cursor = "▸ "
			style = MenuItemSelectedStyle
		}
		value := f.value
		if value == "" {
			value = dimText("(empty)")
		}
		b.WriteString(style.Render(fmt.Sprintf("%s%s: %s", cursor, f.label, value)))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render(fmt.Sprintf("     %s", f.hint)))
		b.WriteString("\n\n")
	}

	b.WriteString(HelpStyle.Render("↑/↓: switch field  ·  type to edit  ·  enter: create  ·  esc: cancel"))
	b.WriteString("\n")

	return b.String()
}

// ── Delete Confirmation ──────────────────────────────────────────────────

func (m InstanceModel) viewDelete() string {
	var b strings.Builder

	b.WriteString(ConfirmDestructiveStyle.Render("Delete Instance"))
	b.WriteString("\n\n")

	if m.running {
		b.WriteString(SpinnerStyle.Render(fmt.Sprintf("  %s", m.runLabel)))
		b.WriteString("\n")
		return b.String()
	}

	b.WriteString(FailStyle.Render(fmt.Sprintf("  Are you sure you want to delete '%s'?", m.deleteTarget)))
	b.WriteString("\n\n")
	b.WriteString(WarnStyle.Render("  This will remove the instance directory and all its data."))
	b.WriteString("\n")
	b.WriteString(WarnStyle.Render("  It will NOT touch Klipper, Moonraker, or printer configs."))
	b.WriteString("\n\n")

	b.WriteString(HelpStyle.Render("y: confirm delete  ·  n/esc: cancel"))
	b.WriteString("\n")

	return b.String()
}

// dimText returns a dim-style placeholder string.
func dimText(s string) string {
	return fmt.Sprintf("\x1b[2m%s\x1b[0m", s)
}
