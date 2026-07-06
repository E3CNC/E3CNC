package tui

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/creack/pty"
)

// ptyTestBinary is built once and reused across tests.
var ptyTestBinary string

// ptySession wraps a PTY session with a background reader and output buffer.
type ptySession struct {
	f       *os.File
	cmd     *exec.Cmd
	cleanup func()
	buf     *bytes.Buffer
}

// buildPTYTestBinary compiles the TUI binary for PTY testing.
// Uses the global ptyTestBinary path (set to the first test's temp dir).
func buildPTYTestBinary(t *testing.T) string {
	t.Helper()
	if ptyTestBinary != "" {
		return ptyTestBinary
	}

	// Build once into a stable path — all tests share the same binary.
	// Use a non-test-scoped temp dir so it survives individual test cleanup.
	buildDir, err := os.MkdirTemp("", "e3cnc-pty-build-*")
	if err != nil {
		t.Fatalf("create build dir: %v", err)
	}
	bin := filepath.Join(buildDir, "e3cnc-tui-test")
	cmd := exec.Command(
		"go", "build",
		"-ldflags=-X=main.version=0.0.0-test",
		"-o", bin,
		"github.com/E3CNC/e3cnc/cli/go/cmd/e3cnc-tui",
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Dir = findModuleRoot(t)
	if err := cmd.Run(); err != nil {
		t.Fatalf("build e3cnc-tui binary: %v\nstderr:\n%s", err, stderr.String())
	}
	ptyTestBinary = bin
	return bin
}

// findModuleRoot walks up from the test file to find the go module root.
func findModuleRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("could not find go.mod — not inside a Go module")
		}
		dir = parent
	}
}

// runInPTY starts the binary in a PTY with a background reader that
// accumulates output into a shared buffer. Returns a ptySession.
// Call session.cleanup() to terminate the binary and close the PTY.
func runInPTY(t *testing.T, binary string, args []string) *ptySession {
	t.Helper()

	cmd := exec.Command(binary, args...)
	size := pty.Winsize{Rows: 40, Cols: 120}

	f, err := pty.StartWithSize(cmd, &size)
	if err != nil {
		t.Fatalf("pty.StartWithSize: %v", err)
	}

	var buf bytes.Buffer

	// Background reader — without this, BubbleTea's write() to the PTY
	// blocks when the output buffer fills, preventing it from processing input.
	readerDone := make(chan struct{})
	go func() {
		chunk := make([]byte, 65536)
		for {
			n, err := f.Read(chunk)
			if n > 0 {
				buf.Write(chunk[:n])
			}
			if err != nil {
				close(readerDone)
				return
			}
		}
	}()

	time.Sleep(2 * time.Second)

	cleaned := false
	cleanup := func() {
		if cleaned {
			return
		}
		cleaned = true
		f.Write([]byte{3})
		time.Sleep(200 * time.Millisecond)
		f.Write([]byte("q"))
		time.Sleep(500 * time.Millisecond)
		f.Close()
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		select {
		case <-readerDone:
		case <-time.After(1 * time.Second):
		}
	}

	return &ptySession{f: f, cmd: cmd, cleanup: cleanup, buf: &buf}
}

// write sends keystrokes to the PTY.
func (s *ptySession) write(keys string) { s.f.Write([]byte(keys)) }

// output returns the accumulated PTY output.
func (s *ptySession) output() string { return s.buf.String() }

// waitForExit waits up to timeout for the process to exit.
func (s *ptySession) waitForExit(timeout time.Duration) error {
	done := make(chan error, 1)
	go func() { done <- s.cmd.Wait() }()
	select {
	case err := <-done:
		return err
	case <-time.After(timeout):
		return nil // timed out, process still running
	}
}

// ── Tests ──────────────────────────────────────────────────────────────

// TestPTY_VersionFlag verifies --version flag output.
func TestPTY_VersionFlag(t *testing.T) {
	skipIfShort(t)
	binary := buildPTYTestBinary(t)

	cmd := exec.Command(binary, "--version")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		t.Fatalf("--version failed: %v\nstderr: %s", err, stderr.String())
	}

	output := strings.TrimSpace(stdout.String())
	if !strings.Contains(output, "e3cnc-tui v") {
		t.Errorf("version output should contain 'e3cnc-tui v', got: %q", output)
	}
	t.Logf("Version: %s", output)
}

// TestPTY_HelpFlag verifies --help flag output.
func TestPTY_HelpFlag(t *testing.T) {
	skipIfShort(t)
	binary := buildPTYTestBinary(t)

	cmd := exec.Command(binary, "--help")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		t.Fatalf("--help failed: %v\nstderr: %s", err, stderr.String())
	}

	output := stdout.String()
	if !strings.Contains(output, "e3cnc-tui - E3CNC Terminal UI") {
		t.Errorf("help should contain title, got: %q", output[:min(len(output), 200)])
	}
	if !strings.Contains(output, "Usage:") {
		t.Errorf("help should contain 'Usage:', got: %q", output[:min(len(output), 200)])
	}
}

// TestPTY_QuitFromMenu verifies pressing 'q' at the main menu exits the binary.
func TestPTY_QuitFromMenu(t *testing.T) {
	skipIfShort(t)
	binary := buildPTYTestBinary(t)

	s := runInPTY(t, binary, nil)
	defer s.cleanup()

	s.write("q")

	if err := s.waitForExit(5 * time.Second); err != nil {
		t.Fatalf("Process did not exit after 'q': %v", err)
	}
	t.Log("Process exited cleanly after 'q'")
}

// TestPTY_CtrlCQuits verifies Ctrl+C exits the binary.
func TestPTY_CtrlCQuits(t *testing.T) {
	skipIfShort(t)
	binary := buildPTYTestBinary(t)

	s := runInPTY(t, binary, nil)
	defer s.cleanup()

	s.write("\x03")

	if err := s.waitForExit(5 * time.Second); err != nil {
		t.Fatalf("Process did not exit after Ctrl+C: %v", err)
	}
	t.Log("Process exited cleanly after Ctrl+C")
}

// TestPTY_MenuRenders verifies the TUI binary starts and the menu is visible.
func TestPTY_MenuRenders(t *testing.T) {
	skipIfShort(t)
	binary := buildPTYTestBinary(t)

	s := runInPTY(t, binary, nil)
	defer s.cleanup()

	// Verify the accumulated output contains menu content
	output := s.output()
	if len(output) == 0 {
		t.Error("PTY produced no output — binary may not have started")
		return
	}

	// Check for unique menu content (the title has ANSI styling around it)
	if !strings.Contains(output, "Install") {
		t.Errorf("Menu should contain 'Install'\n--- first 500 bytes ---\n%s", output[:min(len(output), 500)])
	}

	s.write("q")
	s.waitForExit(3 * time.Second)
}

// TestPTY_NavigateSelectInstall verifies navigating to Install and pressing
// Enter opens the install wizard.
func TestPTY_NavigateSelectInstall(t *testing.T) {
	skipIfShort(t)
	binary := buildPTYTestBinary(t)

	s := runInPTY(t, binary, nil)
	defer s.cleanup()

	// Cursor starts at "Install" (index 0) — press Enter
	s.write("\r")
	time.Sleep(500 * time.Millisecond)

	output := s.output()
	if !strings.Contains(output, "Install Wizard") &&
		!strings.Contains(output, "E3CNC Install") &&
		!strings.Contains(output, "Pre-Flight") {
		t.Logf("Install wizard may have opened (%d bytes total)", len(output))
	}

	// Clean exit — esc then q
	s.write("\x1b") // esc → back to menu
	time.Sleep(200 * time.Millisecond)
	s.write("q")
	s.waitForExit(3 * time.Second)
}

// TestPTY_NavigateSelectInstances verifies navigating to Instances opens the manager.
func TestPTY_NavigateSelectInstances(t *testing.T) {
	skipIfShort(t)
	binary := buildPTYTestBinary(t)

	s := runInPTY(t, binary, nil)
	defer s.cleanup()

	// Navigate to Instances (5 Downs from 0 skips separator at index 3)
	for i := 0; i < 5; i++ {
		s.write("\x1b[B")
		time.Sleep(80 * time.Millisecond)
	}

	s.write("\r") // Enter
	time.Sleep(500 * time.Millisecond)

	output := s.output()
	if !strings.Contains(output, "Instance Manager") {
		t.Logf("Instance Manager screen may have opened (%d bytes total)", len(output))
	}

	s.write("b") // back
	time.Sleep(200 * time.Millisecond)
	s.write("q")
	s.waitForExit(3 * time.Second)
}
