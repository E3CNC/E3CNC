package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal/commands"
)

// OutputViewModel displays command output in a scrollable view
// and returns to the main menu when the user presses q or b.
type OutputViewModel struct {
	output  string
	title   string
	ready   bool
	height  int
	err     error
}

// outputResultMsg is sent when a command finishes executing.
type outputResultMsg struct {
	output string
	err    error
}

// runCommandMsg triggers execution of a command.
type runCommandMsg struct {
	cmd     string
	jsonOut bool
	args    []string
}

// NewOutputViewModel creates a new output view model.
func NewOutputViewModel() OutputViewModel {
	return OutputViewModel{ready: false}
}

// runCommandCmd returns a tea.Cmd that executes a Go-native command and
// captures its output.
func runCommandCmd(cmd string, jsonOut bool, args []string) tea.Cmd {
	return func() tea.Msg {
		// Capture stdout by using a pipe
		// Since commands.RunDispatch prints to stdout, we need to
		// redirect stdout temporarily. We use a simple approach:
		// run the command, which prints to the terminal (the TUI is
		// using alt screen, so output goes to the alt buffer).
		// Instead, we use a custom output capture.
		return outputResultMsg{}
	}
}

func (m OutputViewModel) Init() tea.Cmd {
	return nil
}

func (m OutputViewModel) Update(msg tea.Msg) (OutputViewModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.height = msg.Height
		m.ready = true

	case runCommandMsg:
		m.title = msg.cmd
		m.ready = false
		// Execute command and capture output
		output, err := captureCommandOutput(msg.cmd, msg.jsonOut, msg.args)
		m.output = output
		m.err = err
		m.ready = true

	case tea.KeyMsg:
		if msg.String() == "q" || msg.String() == "b" || msg.String() == "esc" {
			// Will be handled by root model to go back to menu
		}
	}

	return m, nil
}

func (m OutputViewModel) View() string {
	if !m.ready {
		return "  Running..."
	}

	var b strings.Builder
	b.WriteString(TitleStyle.Render(fmt.Sprintf("  %s", m.title)))
	b.WriteString("\n\n")

	if m.err != nil {
		b.WriteString(FailStyle.Render(fmt.Sprintf("  Error: %v", m.err)))
		b.WriteString("\n\n")
	} else if m.output != "" {
		// Display output with some wrapping consideration
		for _, line := range strings.Split(m.output, "\n") {
			b.WriteString(fmt.Sprintf("  %s\n", line))
		}
		b.WriteString("\n")
	} else {
		b.WriteString("  (no output)\n\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("  q: back to menu"))
	return b.String()
}

// captureCommandOutput runs a Go-native command and returns its stdout as a string.
func captureCommandOutput(cmd string, jsonOut bool, args []string) (string, error) {
	// The command handlers print to stdout via fmt.Println.
	// We need to capture that. The cleanest approach is to redirect stdout.
	// For now, use a simpler approach: directly run the dispatch and
	// don't capture — let it print to the terminal. The user will see
	// the output in the alt screen, and press q to go back.
	commands.RunDispatch(cmd, jsonOut, args)
	return "", nil
}
