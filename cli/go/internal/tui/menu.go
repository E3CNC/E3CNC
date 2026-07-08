package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal"
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
// It is initialized in init() by loading commands.json and mapping to menu items.
// If loading fails, it falls back to a hardcoded menu (preserving original order and categories).
var menuItems []MenuItem

// Category order as they appear in the original menu.
var categoryOrder = []string{
	"Setup",
	"Monitor",
	"Hardware",
	"Manage",
	"Tools",
	"", // empty category for Quit (handled specially)
}

// CommandsInCategory maps category to list of command names.
var commandsInCategory = map[string][]string{
	"Setup":     {"install", "update", "uninstall"},
	"Monitor":   {"status", "check", "instances"},
	"Hardware":  {"detect-mcu", "flash-mcu", "init-config"},
	"Manage":    {"releases", "rollback", "backup", "restore"},
	"Tools":     {"clilog", "diagnose", "logs", "admin-page"},
}

// Label overrides for each command (to match original menu wording).
var commandToLabel = map[string]string{
	"install":        "Install",
	"update":         "Update",
	"uninstall":      "Uninstall",
	"status":         "Status",
	"check":          "Check Deps",
	"instances":      "Instances",
	"detect-mcu":     "Detect MCU",
	"flash-mcu":      "Flash MCU",
	"init-config":    "Init Config",
	"releases":       "Releases",
	"rollback":       "Rollback",
	"backup":         "Backup",
	"restore":        "Restore",
	"clilog":         "CLI Log",
	"diagnose":       "Diagnose",
	"logs":           "Logs",
	"admin-page":     "Admin Dashboard",
}

// Description overrides for each command (to match original menu wording).
var commandToDescription = map[string]string{
	"install":        "Bootstrap + download release",
	"update":         "Full-stack update and verify",
	"uninstall":      "Remove all E3CNC components",
	"status":         "Check installation status",
	"check":          "Verify system dependencies",
	"instances":      "List all instances with URLs",
	"detect-mcu":     "Scan for connected MCU devices",
	"flash-mcu":      "Build and flash Klipper firmware",
	"init-config":    "Generate CNC printer.cfg",
	"releases":       "List installed releases",
	"rollback":       "Roll back to a previous release",
	"backup":         "Create timestamped backup",
	"restore":        "Restore from a backup",
	"clilog":         "View CLI operation logs",
	"diagnose":       "Run system diagnostics",
	"logs":           "Tail Moonraker and nginx logs",
	"admin-page":     "Show admin dashboard URL (port 8081)",
}

func init() {
	// Load commands.json to get command definitions (for destructive flag, etc.)
	manifest, err := internal.LoadCommands()
	if err != nil {
		// Fallback to hardcoded menu if we cannot load commands.json.
		setHardcodedMenu()
		return
	}

	// Build a map from command name to its definition for quick lookup.
	cmdMap := make(map[string]*internal.CommandDef)
	for _, cmd := range manifest.Commands {
		cmdMap[cmd.Name] = &cmd
	}

	// Build menu items according to category order.
	var items []MenuItem
	for _, cat := range categoryOrder {
		if cat == "" {
			// Special case: empty category is for the Quit item (handled separately).
			continue
		}
		// Add separator before category (except before the first category).
		if len(items) > 0 {
			items = append(items, MenuItem{Label: "", Command: "", Category: ""})
		}
		// Add commands in this category.
		for _, cmdName := range commandsInCategory[cat] {
			if def, ok := cmdMap[cmdName]; ok {
				label := commandToLabel[cmdName]
				if label == "" {
					// Fallback: format the command name nicely.
					label = strings.Title(strings.ReplaceAll(cmdName, "-", " "))
				}
				description := commandToDescription[cmdName]
				if description == "" {
					// Fallback to first flag help if available, otherwise empty.
					if len(def.Flags) > 0 {
						description = def.Flags[0].Help
					}
				}
				items = append(items, MenuItem{
					Label:       label,
					Command:     cmdName,
					Destructive: def.Destructive,
					Description: description,
					Category:    cat,
				})
			} else {
				// Command not found in JSON (should not happen if JSON is correct).
				// Fallback to hardcoded label/description.
				items = append(items, MenuItem{
					Label:       commandToLabel[cmdName],
					Command:     cmdName,
					Destructive: false, // unknown, assume safe
					Description: commandToDescription[cmdName],
					Category:    cat,
				})
			}
		}
	}

	// After all categories, add a separator before Quit.
	items = append(items, MenuItem{Label: "", Command: "", Category: ""})
	// Add Quit item (always last).
	items = append(items, MenuItem{
		Label:       "Quit",
		Command:     "quit",
		Destructive: false,
		Description: "Exit the CLI",
		Category:    "",
	})

	menuItems = items
}

// setHardcodedMenu populates menuItems with the original hardcoded menu.
// Used as a fallback if commands.json cannot be loaded.
func setHardcodedMenu() {
	menuItems = []MenuItem{
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
		{Label: "Admin Dashboard", Command: "admin-page", Category: "Tools", Description: "Show admin dashboard URL (port 8081)"},
		{Label: "", Command: "", Category: ""},
		{Label: "Quit", Command: "quit", Category: "", Description: "Exit the CLI"},
	}
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
			return m, tea.Quit
		case "enter", " ":
			if m.cursor >= 0 && m.cursor < len(m.items) {
				cmd := m.items[m.cursor].Command
				if cmd != "" {
					m.SelectedCmd = cmd
					return m, tea.Quit
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

	// ASCII art banner
	banner := `   ___________ _______   ________
  / ____/__  // ____/ | / / ____/
 / __/   /_ </ /   /  |/ / /     \
/ /___ ___/ / /___/ /|  / /___   \
/_____//____/\\____/_/ |_/\\____/`
	b.WriteString(BannerStyle.Render(banner))
	b.WriteString("\n\n")

	b.WriteString(TitleStyle.Render("E3CNC CLI"))
	b.WriteString("\n\n")

	// Calculate the widest label for alignment.
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

		// Pad label to align descriptions.
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