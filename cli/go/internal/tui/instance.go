package tui

import (
	"fmt"
	"runtime"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal"
	"github.com/E3CNC/e3cnc/cli/go/internal/bootstrap"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// InstanceScreen represents which sub-screen the instance manager is showing.
type InstanceScreen int

const (
	InstList InstanceScreen = iota
	InstDelete
)

// InstanceInfo mirrors a single instance from the Go instance manager.
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

// InstancesJSON is the root structure returned by the instance manager.
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

	// Scrollable viewport for instance list
	listViewport viewport.Model
}

// NewInstanceModel creates a new instance management model.
func NewInstanceModel() InstanceModel {
	state := internal.LoadState()
	return InstanceModel{
		screen:         InstList,
		activeInstance: state.ActiveInstance,
		loading:        true,
		listViewport:   viewport.New(70, 10),
	}
}

func (m InstanceModel) Init() tea.Cmd {
	return m.fetchInstances()
}

// fetchInstances returns a tea.Cmd that lists instances.
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

// deleteInstanceCmd returns a tea.Cmd that deletes an instance.
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
		m.listViewport.Width = msg.Width - 6
		m.listViewport.Height = msg.Height - 14

	case instanceListMsg:
		m.loading = false
		if msg.err != nil {
			m.loadErr = msg.err.Error()
		} else {
			m.instances = msg.instances
			m.localIP = msg.localIP
			m.loadErr = ""
			if m.cursor >= len(m.instances) {
				m.cursor = max(0, len(m.instances)-1)
			}
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
	case InstList:
		return m.handleListKey(msg)
	case InstDelete:
		return m.handleDeleteKey(msg)
	}

	return m, nil
}

func (m InstanceModel) handleListKey(msg tea.Msg) (InstanceModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
				m.listViewport.LineUp(1)
			}
		case "down", "j":
			if m.cursor < len(m.instances)-1 {
				m.cursor++
				m.listViewport.LineDown(1)
			}
		case "pgup":
			m.listViewport, _ = m.listViewport.Update(msg)
			m.cursor = max(0, m.cursor-m.listViewport.Height)
		case "pgdn":
			m.listViewport, _ = m.listViewport.Update(msg)
			m.cursor = min(len(m.instances)-1, m.cursor+m.listViewport.Height)
		case "enter", " ":
			if len(m.instances) == 0 {
				return m, nil
			}
			inst := m.instances[m.cursor]
			m.activeInstance = inst.Name
			internal.SaveState(internal.State{ActiveInstance: inst.Name})
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
		case "y", "Y", "enter":
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
	case InstDelete:
		return m.viewDelete()
	default:
		return "Unknown instance screen"
	}
}
