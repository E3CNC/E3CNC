package tui

import (
	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
)

// AppState represents which screen the TUI is currently showing.
type AppState int

const (
	StateMainMenu AppState = iota
	StateConfirm
	StateInstallWizard
	StateErrorRecovery
	StateInstanceMgr
	StateOutputView
)

// Model is the root BubbleTea model for the e3cnc-tui application.
type Model struct {
	state       AppState
	menu        MenuModel
	confirm     ConfirmModel
	install     InstallModel
	instance    InstanceModel
	output      OutputViewModel
	help        help.Model
	keys        keyMap
	width       int
	height      int
	err         error
}

type keyMap struct {
	Quit    key.Binding
	Enter   key.Binding
	Back    key.Binding
	Help    key.Binding
	Up      key.Binding
	Down    key.Binding
	Cancel  key.Binding
}

func (k keyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Quit, k.Help, k.Enter}
}

func (k keyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Enter},
		{k.Quit, k.Back, k.Help},
	}
}

var defaultKeys = keyMap{
	Quit:   key.NewBinding(key.WithKeys("ctrl+c"), key.WithHelp("ctrl+c", "quit")),
	Enter:  key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "select")),
	Back:   key.NewBinding(key.WithKeys("esc"), key.WithHelp("esc", "back")),
	Help:   key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
	Up:     key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "up")),
	Down:   key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "down")),
	Cancel: key.NewBinding(key.WithKeys("ctrl+c"), key.WithHelp("ctrl+c", "cancel")),
}

// confirmPromptMsg carries info to show a confirmation dialog for a destructive command.
type confirmPromptMsg struct {
	prompt      string
	warning     string
	destructive bool
	command     string // the command to run if confirmed
}

// New creates a new root Model and initializes all sub-models.
func New() Model {
	return Model{
		state:    StateMainMenu,
		menu:     NewMenuModel(),
		install:  NewInstallModel(),
		instance: NewInstanceModel(),
		help:     help.New(),
		keys:     defaultKeys,
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.menu.Init(),
		m.install.Init(),
		m.instance.Init(),
	)
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.help.Width = msg.Width

	case backToMenuMsg:
		m.state = StateMainMenu
		m.install = NewInstallModel()
		m.menu.SelectedCmd = ""
		return m, nil

	case confirmPromptMsg:
		// Show confirmation dialog for a destructive command
		m.confirm = NewConfirmModel(ConfirmScreen{
			Prompt:      msg.prompt,
			Warning:     msg.warning,
			Destructive: msg.destructive,
			Command:     msg.command,
		})
		m.state = StateConfirm
		return m, m.confirm.Init()

	case confirmResultMsg:
		if msg.Confirmed {
			// Set up output view and run the command
			m.output = NewOutputViewModel()
			m.state = StateOutputView
			return m, RunCommand(msg.Command, false, nil)
		} else {
			// User cancelled — back to menu
			m.state = StateMainMenu
			m.menu.SelectedCmd = ""
		}
		return m, nil

	case tea.KeyMsg:
		// Ctrl+C from any state quits the program
		if msg.String() == "ctrl+c" {
			return m, tea.Quit
		}
		// 'q' from main menu quits
		if m.state == StateMainMenu && msg.String() == "q" {
			return m, tea.Quit
		}
	}

	// Dispatch to sub-models based on state
	switch m.state {
	case StateMainMenu:
		newMenu, cmd := m.menu.Update(msg)
		m.menu = newMenu.(MenuModel)

		// Check if menu selected a command
		if m.menu.SelectedCmd != "" {
			switch m.menu.SelectedCmd {
			case "install":
				m.state = StateInstallWizard
				m.install = NewInstallModel()
				return m, m.install.Init()
			case "instances":
				m.state = StateInstanceMgr
				m.instance = NewInstanceModel()
				return m, m.instance.Init()
			case "quit":
				return m, tea.Quit
			default:
				// Check if this is a destructive command that needs confirmation
				if needsConfirm(m.menu.SelectedCmd) {
					return m.handleDestructiveCmd(m.menu.SelectedCmd)
				}
				// Run command directly
				m.output = NewOutputViewModel()
				m.state = StateOutputView
				return m, RunCommand(m.menu.SelectedCmd, false, nil)
			}
		}
		return m, cmd

	case StateConfirm:
		newConfirm, cmd := m.confirm.Update(msg)
		m.confirm = newConfirm
		return m, cmd

	case StateInstallWizard:
		newInstall, cmd := m.install.Update(msg)
		m.install = newInstall.(InstallModel)
		if m.install.done {
			m.state = StateMainMenu
			m.install = NewInstallModel()
		}
		return m, cmd

	case StateInstanceMgr:
		newInstance, cmd := m.instance.Update(msg)
		m.instance = newInstance.(InstanceModel)
		if m.instance.done {
			m.state = StateMainMenu
			m.menu.SelectedCmd = ""
			m.instance = NewInstanceModel()
		}
		return m, cmd

	case StateOutputView:
		newOutput, cmd := m.output.Update(msg)
		m.output = newOutput
		return m, cmd
	}

	return m, nil
}

// needsConfirm returns true if the command should show a confirmation dialog
// before executing.
func needsConfirm(cmd string) bool {
	switch cmd {
	case "uninstall", "rollback", "flash-mcu", "init-config":
		return true
	}
	return false
}

// handleDestructiveCmd returns a confirmPromptMsg for the given command.
func (m Model) handleDestructiveCmd(cmd string) (Model, tea.Cmd) {
	var prompt, warning string
	destructive := true

	switch cmd {
	case "uninstall":
		prompt = "Are you sure you want to uninstall E3CNC?"
		warning = "This will remove all E3CNC components, configs, and data."
	case "rollback":
		prompt = "Roll back to a previous release?"
		warning = "The current release will be replaced. Services will restart."
	case "flash-mcu":
		prompt = "Flash firmware to your MCU?"
		warning = "This will build and flash Klipper firmware. Your MCU will reset."
	case "init-config":
		prompt = "Generate a new printer.cfg?"
		warning = "This will overwrite any existing printer.cfg for the active instance."
	}

	return m, func() tea.Msg {
		return confirmPromptMsg{
			prompt:      prompt,
			warning:     warning,
			destructive: destructive,
			command:     cmd,
		}
	}
}

func (m Model) View() string {
	switch m.state {
	case StateConfirm:
		return m.confirm.View()
	case StateMainMenu:
		return m.menu.View()
	case StateInstallWizard:
		return m.install.View()
	case StateInstanceMgr:
		return m.instance.View()
	case StateOutputView:
		return m.output.View()
	default:
		return m.menu.View()
	}
}
