package tui

import (
	"fmt"
	"runtime"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal"
	"github.com/E3CNC/e3cnc/cli/go/internal/bootstrap"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
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

	// Create form state — using textinput for proper editing
	createNameInput textinput.Model
	createPortInput textinput.Model

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

	nameInput := textinput.New()
	nameInput.Placeholder = "my-instance"
	nameInput.CharLimit = 32
	nameInput.Width = 30
	nameInput.Prompt = "▸ "
	nameInput.Focus()

	portInput := textinput.New()
	portInput.Placeholder = "auto-assign"
	portInput.CharLimit = 5
	portInput.Width = 30
	portInput.Prompt = "  "
	portInput.Blur()

	return InstanceModel{
		screen:          InstList,
		activeInstance:  state.ActiveInstance,
		loading:         true,
		createNameInput: nameInput,
		createPortInput: portInput,
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

// createInstanceCmd returns a tea.Cmd that creates a new instance
// using the Go-native bootstrap instead of the Python CLI.
func (m InstanceModel) createInstanceCmd() tea.Cmd {
	return func() tea.Msg {
		if runtime.GOOS != "linux" {
			return instanceCreatedMsg{err: fmt.Errorf("instance management requires Linux (running on %s)", runtime.GOOS)}
		}
		cfg := bootstrap.BootstrapConfig{
			InstanceName:  m.createNameInput.Value(),
			StartServices: false,
		}
		if port := m.createPortInput.Value(); port != "" {
			fmt.Sscanf(port, "%d", &cfg.MoonrakerPort)
		}
		if err := bootstrap.Bootstrap(cfg); err != nil {
			return instanceCreatedMsg{err: fmt.Errorf("create instance: %w", err)}
		}
		return instanceCreatedMsg{}
	}
}

// deleteInstanceCmd returns a tea.Cmd that deletes an instance
// using the Go-native uninstall instead of the Python CLI.
func (m InstanceModel) deleteInstanceCmd() tea.Cmd {
	return func() tea.Msg {
		if runtime.GOOS != "linux" {
			return instanceDeletedMsg{err: fmt.Errorf("instance management requires Linux (running on %s)", runtime.GOOS)}
		}
		inst, err := instance.FromName(m.deleteTarget)
		if err != nil {
			return instanceDeletedMsg{err: fmt.Errorf("find instance %s: %w", m.deleteTarget, err)}
		}
		if err := bootstrap.Uninstall(inst); err != nil {
			return instanceDeletedMsg{err: fmt.Errorf("delete instance: %w", err)}
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
			m.screen = InstList
			return m, m.fetchInstances()
		}

	case instanceDeletedMsg:
		m.running = false
		if msg.err != nil {
			m.loadErr = msg.err.Error()
		} else {
			m.screen = InstList
			return m, m.fetchInstances()
		}
	}

	// Route messages to sub-components based on screen
	switch m.screen {
	case InstCreate:
		return m.handleCreateUpdate(msg)
	case InstList:
		return m.handleListKey(msg)
	case InstDelete:
		return m.handleDeleteKey(msg)
	}

	return m, nil
}

// handleCreateUpdate handles all messages in the create-instance form.
func (m InstanceModel) handleCreateUpdate(msg tea.Msg) (InstanceModel, tea.Cmd) {
	// Handle key messages for form navigation
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "tab":
			// Switch focus between fields
			if m.createNameInput.Focused() {
				m.createNameInput.Blur()
				m.createPortInput.Focus()
				m.createPortInput.Prompt = "▸ "
				m.createNameInput.Prompt = "  "
			} else {
				m.createPortInput.Blur()
				m.createNameInput.Focus()
				m.createNameInput.Prompt = "▸ "
				m.createPortInput.Prompt = "  "
			}
			return m, nil

		case "enter":
			m.loadErr = ""
			name := m.createNameInput.Value()
			if name == "" {
				m.loadErr = "Instance name is required"
				return m, nil
			}
			// Validate name: lowercase, numbers, hyphens
			for _, r := range name {
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
			return m, nil
		}
	}

	// Route to focused text input
	var cmd tea.Cmd
	m.createNameInput, cmd = m.createNameInput.Update(msg)
	m.createPortInput, _ = m.createPortInput.Update(msg)
	return m, cmd
}

func (m InstanceModel) handleListKey(msg tea.Msg) (InstanceModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
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
			inst := m.instances[m.cursor]
			m.activeInstance = inst.Name
			internal.SaveState(internal.State{ActiveInstance: inst.Name})
		case "n", "+":
			// Create new instance — reset text inputs
			m.screen = InstCreate
			m.loadErr = ""
			m.createNameInput.SetValue("")
			m.createPortInput.SetValue("")
			m.createNameInput.Focus()
			m.createNameInput.Prompt = "▸ "
			m.createPortInput.Blur()
			m.createPortInput.Prompt = "  "
			return m, textinput.Blink
		case "d":
			if len(m.instances) > 0 {
				m.deleteTarget = m.instances[m.cursor].Name
				m.deleteIdx = m.cursor
				m.screen = InstDelete
			}
		case "r":
			m.loading = true
			m.loadErr = ""
			return m, m.fetchInstances()
		case "b", "q", "esc":
			m.done = true
			return m, nil
		}
	}
	return m, nil
}

func (m InstanceModel) handleDeleteKey(msg tea.Msg) (InstanceModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "y", "Y":
			m.running = true
			m.runLabel = "Deleting instance..."
			return m, m.deleteInstanceCmd()
		case "n", "N", "esc":
			m.screen = InstList
		}
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

