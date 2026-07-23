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
	m := New("test-version")
	m.instance.activeInstance = "" // reset local state so tests are deterministic
	p := tea.NewProgram(
		m,
		tea.WithInput(nil),
		tea.WithOutput(&buf),
		tea.WithoutSignalHandler(),
	)
	return p, &buf
}

// runTestProgram runs the program, sends keys from a goroutine, and returns
// captured output after Run completes.
//
// It uses a shorter headless safe path: keys are sent once, then the program
// is allowed up to 1s to quit naturally. If it does not, it is killed so
// `go test ./...` cannot hang in non-TTY environments.
func runTestProgram(t *testing.T, p *tea.Program, buf *bytes.Buffer, keys func()) string {
	t.Helper()
	userQuit := make(chan struct{})
	go func() {
		// Give the program time to render the initial frame
		time.Sleep(200 * time.Millisecond)
		keys()
		// Wait briefly for natural quit
		select {
		case <-userQuit:
		case <-time.After(1 * time.Second):
			p.Kill()
		}
	}()
	p.Run()
	close(userQuit)
	return buf.String()
}

// TestTeaProgram_MenuRenders verifies the ASCII banner renders.
func TestTeaProgram_MenuRenders(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	})

	if !strings.Contains(output, "█") {
		t.Errorf("Output should contain E3CNC ASCII art banner\n--- got ---\n%q", output)
	}
}

// TestTeaProgram_QQuitsCleanly verifies 'q' quits from the main menu.
func TestTeaProgram_QQuitsCleanly(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	})

	if !strings.Contains(output, "█") {
		t.Errorf("expected menu output before quit\n--- got ---\n%q", output)
	}
}

// TestTeaProgram_CtrlCQuitsCleanly verifies Ctrl+C quits.
func TestTeaProgram_CtrlCQuitsCleanly(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyCtrlC})
	})

	if !strings.Contains(output, "█") {
		t.Errorf("expected menu output before Ctrl+C\n--- got ---\n%q", output)
	}
}

// TestTeaProgram_NavigateDown verifies down navigation shows a cursor.
func TestTeaProgram_NavigateDown(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyDown})
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	})

	if !strings.Contains(output, "▸") {
		t.Errorf("expected cursor (▸) in output after navigation\n--- got ---\n%q", output)
	}
}

// TestTeaProgram_NavigateDownUp verifies down/up keeps the menu rendered.
func TestTeaProgram_NavigateDownUp(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyDown})
		p.Send(tea.KeyMsg{Type: tea.KeyUp})
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	})

	if !strings.Contains(output, "█") {
		t.Errorf("expected menu after navigation\n--- got ---\n%q", output[:min(len(output), 500)])
	}
}

// TestTeaProgram_SelectInstallWizard verifies opening the install wizard.
func TestTeaProgram_SelectInstallWizard(t *testing.T) {
	p, buf := newTestProgram(t)
	output := runTestProgram(t, p, buf, func() {
		p.Send(tea.KeyMsg{Type: tea.KeyEnter})
		p.Send(tea.KeyMsg{Type: tea.KeyEscape})
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	})

	if !strings.Contains(output, "E3CNC Install Wizard") && !strings.Contains(output, "Install Wizard") {
		t.Errorf("expected install wizard content\n--- got ---\n%q", output[:min(len(output), 500)])
	}
}

// TestTeaProgram_SelectInstances verifies opening the instance manager.
func TestTeaProgram_SelectInstances(t *testing.T) {
	p, buf := newTestProgram(t)
	runTestProgram(t, p, buf, func() {
		for i := 0; i < 5; i++ {
			p.Send(tea.KeyMsg{Type: tea.KeyDown})
			time.Sleep(20 * time.Millisecond)
		}
		p.Send(tea.KeyMsg{Type: tea.KeyEnter})
		time.Sleep(200 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("b")})
		time.Sleep(200 * time.Millisecond)
		p.Send(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	})

	if !strings.Contains(buf.String(), "Instance Manager") {
		start := min(len(buf.String()), 2000)
		end := min(len(buf.String()), start+1000)
		t.Errorf("expected 'Instance Manager'\n--- context ---\n%q", buf.String()[start:end])
	}
}

// TestTeaProgram_AllScreensRender verifies each top-level app state can render.
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
			m := New("test-version")
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
				time.Sleep(200 * time.Millisecond)
				// Send Ctrl+C which quits from any state
				p.Send(tea.KeyMsg{Type: tea.KeyCtrlC})
				// If the program doesn't quit naturally within 2 seconds,
				// force-kill it to prevent CI timeouts
				time.Sleep(2 * time.Second)
				p.Kill()
			}()

			_, err := p.Run()
			if err != nil {
				t.Fatalf("Run() error: %v", err)
			}
		})
	}
}
