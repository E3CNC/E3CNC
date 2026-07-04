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
	StateInstallWizard
	StateErrorRecovery
	StateOutputView
	StateConfirmQuit
	StateInstanceMgr
)

// Model is the root BubbleTea model for the e3cnc-tui application.
type Model struct {
	state       AppState
	menu        MenuModel
	install     InstallModel
	instance    InstanceModel
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
	Quit:   key.NewBinding(key.WithKeys("q", "ctrl+c"), key.WithHelp("q", "quit")),
	Enter:  key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "select")),
	Back:   key.NewBinding(key.WithKeys("esc"), key.WithHelp("esc", "back")),
	Help:   key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
	Up:     key.NewBinding(key.WithKeys("up", "k"), key.WithHelp("↑/k", "up")),
	Down:   key.NewBinding(key.WithKeys("down", "j"), key.WithHelp("↓/j", "down")),
	Cancel: key.NewBinding(key.WithKeys("ctrl+c"), key.WithHelp("ctrl+c", "cancel")),
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

	case tea.KeyMsg:
		switch {
		case key.Matches(msg, m.keys.Quit):
			if m.state == StateMainMenu {
				return m, tea.Quit
			}
			// In sub-screens, Quit goes back to menu
			m.state = StateMainMenu
			return m, nil
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
				// Other commands will be dispatched to Python CLI
				m.menu.SelectedCmd = ""
			}
		}
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
	}

	return m, nil
}

func (m Model) View() string {
	switch m.state {
	case StateMainMenu:
		return m.menu.View()
	case StateInstallWizard:
		return m.install.View()
	case StateInstanceMgr:
		return m.instance.View()
	default:
		return m.menu.View()
	}
}
