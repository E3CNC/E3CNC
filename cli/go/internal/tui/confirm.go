package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

// ConfirmScreen represents a simple yes/no confirmation dialog.
type ConfirmScreen struct {
	Prompt      string
	Warning     string // shown below prompt (e.g. "This cannot be undone")
	Destructive bool   // if true, "yes" is highlighted in red
	Command     string // command to run if confirmed
}

// confirmResultMsg is sent when the user confirms or cancels.
type confirmResultMsg struct {
	Confirmed bool
	Command   string // command to run (empty if cancelled)
}

// ConfirmModel is a BubbleTea model for a confirmation dialog.
type ConfirmModel struct {
	screen      ConfirmScreen
	focusedYes  bool // true = "Yes" selected, false = "No" selected
}

// NewConfirmModel creates a new confirmation dialog.
func NewConfirmModel(screen ConfirmScreen) ConfirmModel {
	// Default to "No" focused (safer default)
	return ConfirmModel{
		screen:     screen,
		focusedYes: false,
	}
}

func (m ConfirmModel) Init() tea.Cmd {
	return nil
}

func (m ConfirmModel) Update(msg tea.Msg) (ConfirmModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "left", "right", "tab", "h", "l":
			// Toggle focus between Yes and No
			m.focusedYes = !m.focusedYes
			return m, nil

		case "enter", " ":
			if m.focusedYes {
				// Confirm — root model handles running the command
				return m, func() tea.Msg {
					return confirmResultMsg{Confirmed: true, Command: m.screen.Command}
				}
			}
			// "No" selected — cancel
			return m, func() tea.Msg {
				return confirmResultMsg{Confirmed: false}
			}

		case "y", "Y":
			// Quick confirm with 'y'
			return m, func() tea.Msg {
				return confirmResultMsg{Confirmed: true, Command: m.screen.Command}
			}

		case "n", "N", "esc", "q":
			// Cancel
			return m, func() tea.Msg {
				return confirmResultMsg{Confirmed: false}
			}
		}
	}

	return m, nil
}

func (m ConfirmModel) View() string {
	var b strings.Builder

	if m.screen.Destructive {
		b.WriteString(ConfirmDestructiveStyle.Render("⚠  Confirm Action"))
	} else {
		b.WriteString(ConfirmTitleStyle.Render("Confirm"))
	}
	b.WriteString("\n\n")

	b.WriteString("  ")
	b.WriteString(m.screen.Prompt)
	b.WriteString("\n")

	if m.screen.Warning != "" {
		b.WriteString("\n  ")
		b.WriteString(WarnStyle.Render(m.screen.Warning))
		b.WriteString("\n")
	}

	b.WriteString("\n")

	// Yes/No buttons
	yesBtn := "  [ Yes ]  "
	noBtn := "  [ No ]  "
	if m.focusedYes {
		if m.screen.Destructive {
			yesBtn = ConfirmDestructiveStyle.Render("  [ Yes ]  ")
		} else {
			yesBtn = OkStyle.Render("  [ Yes ]  ")
		}
	} else {
		noBtn = DimStyle.Render("  [ No ]  ")
	}

	b.WriteString(yesBtn)
	b.WriteString(noBtn)
	b.WriteString("\n\n")

	b.WriteString(HelpStyle.Render("  ←/→ or Tab: switch  ·  Enter: confirm  ·  y/n: quick  ·  esc: cancel"))

	return b.String()
}
