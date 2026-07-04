package tui

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal/commands"
)

// OutputViewModel displays command output inside the TUI and returns to the
// main menu when the user presses 'b'. This keeps the user entirely within
// the TUI — no alt-screen exit, no terminal clearing, no re-launch.
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

// NewOutputViewModel creates a new output view model.
func NewOutputViewModel() OutputViewModel {
	return OutputViewModel{ready: false}
}

// RunCommand returns a tea.Cmd that runs a Go-native command, captures
// its stdout, and sends the result back as a message.
func RunCommand(cmd string, jsonOut bool, args []string) tea.Cmd {
	return func() tea.Msg {
		output, err := captureOutput(cmd, jsonOut, args)
		return outputResultMsg{output: output, err: err}
	}
}

// captureOutput runs a command while capturing all stdout output.
func captureOutput(cmd string, jsonOut bool, args []string) (string, error) {
	// Save original stdout and create a pipe
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	// Run the command — output goes to the pipe
	errVal := captureCommandOutput(cmd, jsonOut, args)

	// Restore stdout and close the writer
	w.Close()
	os.Stdout = oldStdout

	// Read captured output
	var buf bytes.Buffer
	io.Copy(&buf, r)
	r.Close()

	return buf.String(), errVal
}

func (m OutputViewModel) Init() tea.Cmd {
	return nil
}

func (m OutputViewModel) Update(msg tea.Msg) (OutputViewModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.height = msg.Height
		m.ready = true

	case outputResultMsg:
		m.output = msg.output
		m.err = msg.err
		m.ready = true
	}

	return m, nil
}

func (m OutputViewModel) View() string {
	if !m.ready {
		return ""
	}

	var b strings.Builder
	if m.title != "" {
		b.WriteString(TitleStyle.Render(fmt.Sprintf("  %s", m.title)))
		b.WriteString("\n\n")
	}

	if m.err != nil {
		b.WriteString(FailStyle.Render(fmt.Sprintf("  Error: %v", m.err)))
		b.WriteString("\n\n")
	} else if m.output != "" {
		for _, line := range strings.Split(m.output, "\n") {
			b.WriteString(fmt.Sprintf("  %s\n", line))
		}
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("  b: back to menu  ·  q: quit"))
	return b.String()
}

func captureCommandOutput(cmd string, jsonOut bool, args []string) error {
	handled := commands.RunDispatch(cmd, jsonOut, args)
	if !handled {
		return fmt.Errorf("unknown command: %s", cmd)
	}
	return nil
}
