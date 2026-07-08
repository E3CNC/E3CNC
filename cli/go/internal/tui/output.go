package tui

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/E3CNC/e3cnc/cli/go/internal/commands"
)

// OutputViewModel displays command output inside a scrollable viewport and
// returns to the main menu when the user presses 'b'.
type OutputViewModel struct {
	output  string
	title   string
	ready   bool
	err     error
	vp      viewport.Model
	height  int
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
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	errVal := captureCommandOutput(cmd, jsonOut, args)

	w.Close()
	os.Stdout = oldStdout

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
		vpHeight := msg.Height - 4
		if vpHeight < 3 {
			vpHeight = 3
		}
		m.vp = viewport.New(msg.Width-4, vpHeight)

	case outputResultMsg:
		m.output = msg.output
		m.err = msg.err
		m.ready = true
		m.vp.SetContent(m.formatContent())
		m.vp.GotoTop()
	}

	if m.ready {
		switch msg := msg.(type) {
		case tea.KeyMsg:
			s := msg.String()
			if s == "b" || s == "esc" {
				return m, func() tea.Msg { return backToMenuMsg{} }
			}
		}
		var cmd tea.Cmd
		m.vp, cmd = m.vp.Update(msg)
		return m, cmd
	}

	return m, nil
}

// formatContent builds the styled content string for the viewport.
func (m OutputViewModel) formatContent() string {
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
	return b.String()
}

func (m OutputViewModel) View() string {
	if !m.ready {
		return ""
	}

	// Ensure viewport has minimum dimensions for rendering
	if m.vp.Width == 0 || m.vp.Height == 0 {
		m.vp.Width = 76
		m.vp.Height = 20
		// Re-set content since we changed dimensions
		m.vp.SetContent(m.formatContent())
		m.vp.GotoTop()
	}

	return lipgloss.JoinVertical(
		lipgloss.Top,
		m.vp.View(),
		HelpStyle.Render("  ↑/↓ scroll · PgUp/PgDn page · g/G top/bottom · b: back · q: quit"),
	)
}

func captureCommandOutput(cmd string, jsonOut bool, args []string) error {
	handled := commands.RunDispatch(cmd, jsonOut, args)
	if !handled {
		return fmt.Errorf("unknown command: %s", cmd)
	}
	return nil
}
