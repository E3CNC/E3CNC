package tui

import (
	"bytes"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// newTestProgram creates a BubbleTea program suitable for testing.
// It captures output into a buffer and disables signal handling.
func newTestProgram(t *testing.T) (*tea.Program, *bytes.Buffer) {
	t.Helper()
	var buf bytes.Buffer
	p := tea.NewProgram(
		New(),
		tea.WithInput(nil),
		tea.WithOutput(&buf),
		tea.WithoutSignalHandler(),
	)
	return p, &buf
}

// runTestProgram runs the program, sends keys from a goroutine, and returns
// captured output after Run completes.
func runTestProgram(t *testing.T, p *tea.Program, buf *bytes.Buffer, keys func()) string {
	t.Helper()
	go func() {
		// Give the program time to render the initial frame
		time.Sleep(200 * time.Millisecond)
		keys()
	}()
	if _, err := p.Run(); err != nil {
		t.Fatalf("Program.Run() returned error: %v", err)
	}
	return buf.String()
}

// ── Tests ──────────────────────────────────────────────────────────────

func TestTeaProgram_MenuRenders(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	})

	if !strings.Contains(output, "E3CNC CLI") {
		t.Errorf("Output should contain 'E3CNC CLI'\n--- got ---\n%q", output)
	}
}

func TestTeaProgram_QQuitsCleanly(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		time.Sleep(50 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	})

	if !strings.Contains(output, "E3CNC CLI") {
		t.Errorf("expected menu output before quit\n--- got ---\n%q", output)
	}
}

func TestTeaProgram_CtrlCQuitsCleanly(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		time.Sleep(50 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyCtrlC})
	})

	if !strings.Contains(output, "E3CNC CLI") {
		t.Errorf("expected menu output before Ctrl+C\n--- got ---\n%q", output)
	}
}

func TestTeaProgram_NavigateDown(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyDown})
		time.Sleep(30 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyDown})
		time.Sleep(30 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	})

	if !strings.Contains(output, "▸") {
		t.Errorf("expected cursor (▸) in output after navigation\n--- got ---\n%q", output)
	}
}

func TestTeaProgram_NavigateDownUp(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyDown})
		time.Sleep(30 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyDown})
		time.Sleep(30 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyUp})
		time.Sleep(30 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	})

	if !strings.Contains(output, "E3CNC CLI") {
		t.Errorf("expected menu after navigation\n--- got ---\n%q", output)
	}
}

func TestTeaProgram_SelectInstallWizard(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		// Cursor starts at 0 ("Install") — press Enter to select
		time.Sleep(50 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyEnter})
		time.Sleep(150 * time.Millisecond)
		// Go back to menu
		p.Send(tea.KeyMsg{Type: tea.KeyEscape})
		time.Sleep(50 * time.Millisecond)
		// Quit
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	})

	if !strings.Contains(output, "E3CNC Install Wizard") && !strings.Contains(output, "Install Wizard") {
		t.Errorf("expected install wizard content\n--- got ---\n%q", output[:min(len(output), 500)])
	}
}

func TestTeaProgram_SelectInstances(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		time.Sleep(50 * time.Millisecond)
		// Navigate to Instances (index 6 in items, 5 Downs from 0
		// because skipEmpty skips separator at index 3)
		for i := 0; i < 5; i++ {
			p.Send(tea.KeyMsg{Type: tea.KeyDown})
			time.Sleep(20 * time.Millisecond)
		}
		p.Send(tea.KeyMsg{Type: tea.KeyEnter})
		time.Sleep(200 * time.Millisecond)
		// Go back
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'b'}})
		time.Sleep(50 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'q'}})
	})

	// Check the full output for "Instance Manager" — ANSI frame sequences
	// push the relevant content deep into the buffer
	if !strings.Contains(output, "Instance Manager") {
		// Show context around where Instance Manager should be
		idx := len(output) / 2
		if idx > 2000 {
			idx = 2000
		}
		t.Errorf("expected 'Instance Manager'\n--- context (chars %d-%d) ---\n%q",
			idx, min(len(output), idx+1000), output[idx:min(len(output), idx+1000)])
	}
}

func TestTeaProgram_AllScreensRender(t *testing.T) {
	screens := []struct {
		name  string
		state AppState
		setup func(*Model)
	}{
		{"MainMenu", StateMainMenu, nil},
		{"InstallWizard", StateInstallWizard, nil},
		{"InstanceMgr", StateInstanceMgr, nil},
		{"OutputView", StateOutputView, func(m *Model) {
			m.output.ready = true
			m.output.output = "test output"
		}},
	}

	for _, sc := range screens {
		t.Run(sc.name, func(t *testing.T) {
			var buf bytes.Buffer
			m := New()
			m.state = sc.state
			if sc.setup != nil {
				sc.setup(&m)
			}

			p := tea.NewProgram(
				m,
				tea.WithInput(nil),
				tea.WithOutput(&buf),
				tea.WithoutSignalHandler(),
			)

			go func() {
				time.Sleep(50 * time.Millisecond)
				// Send Ctrl+C which quits from any state
				p.Send(tea.KeyMsg{Type: tea.KeyCtrlC})
			}()

			_, err := p.Run()
			if err != nil {
				t.Fatalf("Run() error: %v", err)
			}
		})
	}
}
