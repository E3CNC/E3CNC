package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

// MenuItem represents a single entry in the main menu.
type MenuItem struct {
	Label       string
	Command     string
	Destructive bool
	Description string
	Category    string
}

// MenuModel is the BubbleTea model for the main menu.
type MenuModel struct {
	items        []MenuItem
	cursor       int
	width        int
	height       int
	SelectedCmd  string // set when a command is chosen
}

// menuItems defines all menu entries.
var menuItems = []MenuItem{
	{Label: "Install", Command: "install", Destructive: true, Category: "Setup", Description: "Bootstrap + download release"},
	{Label: "Update", Command: "update", Destructive: true, Category: "Setup", Description: "Full-stack update and verify"},
	{Label: "Uninstall", Command: "uninstall", Destructive: true, Category: "Setup", Description: "Remove all E3CNC components"},
	{Label: "", Command: "", Category: ""},
	{Label: "Status", Command: "status", Category: "Monitor", Description: "Check installation status"},
	{Label: "Check Deps", Command: "check", Category: "Monitor", Description: "Verify system dependencies"},
	{Label: "Instances", Command: "instances", Category: "Monitor", Description: "List all instances with URLs"},
	{Label: "", Command: "", Category: ""},
	{Label: "Detect MCU", Command: "detect-mcu", Category: "Hardware", Description: "Scan for connected MCU devices"},
	{Label: "Flash MCU", Command: "flash-mcu", Destructive: true, Category: "Hardware", Description: "Build and flash Klipper firmware"},
	{Label: "Init Config", Command: "init-config", Destructive: true, Category: "Hardware", Description: "Generate CNC printer.cfg"},
	{Label: "", Command: "", Category: ""},
	{Label: "Releases", Command: "releases", Category: "Manage", Description: "List installed releases"},
	{Label: "Rollback", Command: "rollback", Destructive: true, Category: "Manage", Description: "Roll back to a previous release"},
	{Label: "Backup", Command: "backup", Category: "Manage", Description: "Create timestamped backup"},
	{Label: "Restore", Command: "restore", Category: "Manage", Description: "Restore from a backup"},
	{Label: "", Command: "", Category: ""},
	{Label: "CLI Log", Command: "clilog", Category: "Tools", Description: "View CLI operation logs"},
	{Label: "Diagnose", Command: "diagnose", Category: "Tools", Description: "Run system diagnostics"},
	{Label: "Logs", Command: "logs", Category: "Tools", Description: "Tail Moonraker and nginx logs"},
	{Label: "Admin Page", Command: "admin-page", Category: "Tools", Description: "Generate admin overview page"},
	{Label: "", Command: "", Category: ""},
	{Label: "Quit", Command: "quit", Category: "", Description: "Exit the CLI"},
}

// NewMenuModel creates a new menu model.
func NewMenuModel() MenuModel {
	return MenuModel{
		items: menuItems,
	}
}

func (m MenuModel) Init() tea.Cmd {
	return nil
}

func (m MenuModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			m.cursor--
			if m.cursor < 0 {
				m.cursor = len(m.items) - 1
			}
			m.cursor = m.skipEmpty(m.cursor, -1)
		case "down", "j":
			m.cursor++
			if m.cursor >= len(m.items) {
				m.cursor = 0
			}
			m.cursor = m.skipEmpty(m.cursor, 1)
		case "q":
			m.SelectedCmd = "quit"
		case "enter", " ":
			if m.cursor >= 0 && m.cursor < len(m.items) {
				cmd := m.items[m.cursor].Command
				if cmd != "" {
					m.SelectedCmd = cmd
				}
			}
		}
	}

	return m, nil
}

// skipEmpty skips separator items when navigating.
func (m MenuModel) skipEmpty(current int, dir int) int {
	for current >= 0 && current < len(m.items) {
		if m.items[current].Command != "" {
			break
		}
		current += dir
	}
	if current < 0 {
		return len(m.items) - 1
	}
	if current >= len(m.items) {
		return 0
	}
	return current
}

func (m MenuModel) View() string {
	var b strings.Builder

	b.WriteString(TitleStyle.Render("E3CNC CLI"))
	b.WriteString("\n\n")

	// Calculate the widest label for alignment
	labelWidth := 0
	for _, item := range m.items {
		if len(item.Label) > labelWidth {
			labelWidth = len(item.Label)
		}
	}

	var lastCategory string
	for i, item := range m.items {
		if item.Command == "" {
			b.WriteString("\n")
			lastCategory = ""
			continue
		}

		if item.Category != "" && item.Category != lastCategory {
			b.WriteString(SectionHeaderStyle.Render(item.Category))
			b.WriteString("\n")
			lastCategory = item.Category
		}

		cursor := "  "
		style := MenuItemStyle
		if i == m.cursor {
			cursor = "▸ "
			if item.Destructive {
				style = DestructiveStyle
			} else {
				style = MenuItemSelectedStyle
			}
		}

		// Pad label to align descriptions
		paddedLabel := item.Label + strings.Repeat(" ", labelWidth-len(item.Label)+2)
		line := cursor + paddedLabel
		if item.Description != "" {
			line += DimStyle.Render(item.Description)
		}
		b.WriteString(style.Render(line))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("↑/↓ navigate · enter select · q quit · ? help"))

	return b.String()
}
