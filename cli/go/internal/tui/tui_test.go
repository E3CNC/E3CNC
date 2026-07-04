// Package tuitester provides tmux-based integration tests for the BubbleTea TUI.
//
// These tests SSH into the CNC host via a pre-existing tmux session (main:1.0)
// and verify that every menu option is reachable, the install wizard opens,
// and the instance manager loads correctly.
//
// Usage:
//   go test -run TestTUIIntegration ./internal/tui/ -v -count=1
//
// Requirements:
//   - tmux session "main:1.0" must exist with an SSH connection to the CNC
//   - e3cnc-tui binary must be at ~/e3cnc/current/bin/e3cnc-tui on the CNC
package tui

import (
	"fmt"
	"os/exec"
	"strings"
	"testing"
	"time"
)

// tmuxPane is the target tmux pane for sending commands and capturing output.
const tmuxPane = "main:1.0"

// tuiBinary is the path to the TUI binary on the CNC.
const tuiBinary = "~/e3cnc/current/bin/e3cnc-tui"

// sendKeys sends a keystroke to the tmux pane.
func sendKeys(key string) {
	exec.Command("tmux", "send-keys", "-t", tmuxPane, key).Run()
}

// sendText types literal text into the tmux pane.
func sendText(text string) {
	exec.Command("tmux", "send-keys", "-t", tmuxPane, "-l", text).Run()
}

// sendEnter presses Enter in the tmux pane.
func sendEnter() {
	exec.Command("tmux", "send-keys", "-t", tmuxPane, "Enter").Run()
}

// sendCtrlC sends Ctrl+C.
func sendCtrlC() {
	exec.Command("tmux", "send-keys", "-t", tmuxPane, "C-c").Run()
}

// capture returns the last N lines of the tmux pane output.
func capture(lines int) string {
	cmd := exec.Command("tmux", "capture-pane", "-p", "-J", "-t", tmuxPane, "-S", fmt.Sprintf("-%d", lines))
	out, _ := cmd.Output()
	return string(out)
}

// waitFor pauses for the given duration.
func waitFor(d time.Duration) {
	time.Sleep(d)
}

// launchTUI starts the TUI in the tmux pane.
func launchTUI(t *testing.T) {
	t.Helper()
	sendCtrlC()
	waitFor(500 * time.Millisecond)
	sendCtrlC()
	waitFor(500 * time.Millisecond)
	// Quit any running TUI
	sendKeys("q")
	waitFor(500 * time.Millisecond)
	sendKeys("q")
	waitFor(500 * time.Millisecond)
	// Clear prompt
	sendCtrlC()
	waitFor(500 * time.Millisecond)
	// Launch fresh TUI
	sendText(tuiBinary)
	sendEnter()
	waitFor(4 * time.Second)
}

// quitTUI sends q until we see the shell prompt.
func quitTUI(t *testing.T) {
	t.Helper()
	for i := 0; i < 5; i++ {
		out := capture(3)
		if strings.Contains(out, "biqu@BTT-CB1") {
			return
		}
		sendKeys("q")
		waitFor(800 * time.Millisecond)
	}
	sendCtrlC()
	waitFor(500 * time.Millisecond)
}

// navigateTo presses Down the given number of times.
func navigateTo(steps int) {
	for i := 0; i < steps; i++ {
		sendKeys("Down")
		waitFor(600 * time.Millisecond)
	}
}

// assertCursorOn fails the test if the cursor (▸) is not on the expected item.
func assertCursorOn(t *testing.T, expected string) {
	t.Helper()
	out := capture(45)
	if strings.Contains(out, "▸ "+expected) {
		t.Logf("  ✅ Cursor on '%s'", expected)
	} else {
		t.Errorf("  ❌ Expected cursor on '%s', got:\n%s", expected, extractCursorLine(out))
	}
}

// extractCursorLine finds the line with ▸ in the captured output.
func extractCursorLine(out string) string {
	for _, line := range strings.Split(out, "\n") {
		if strings.Contains(line, "▸") {
			return line
		}
	}
	return "(no cursor found)"
}

// assertScreenContains fails the test if the captured output doesn't contain the text.
func assertScreenContains(t *testing.T, out string, expected string) {
	t.Helper()
	if strings.Contains(out, expected) {
		t.Logf("  ✅ Screen contains '%s'", expected)
	} else {
		t.Errorf("  ❌ Screen should contain '%s', got:\n%s", expected, out[:min(len(out), 200)])
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Menu item positions (0-indexed, skipping empty separators)
// Install=0, Update=1, Uninstall=2, Status=3, Check Deps=4,
// Instances=5, Detect MCU=6, Flash MCU=7, Init Config=8,
// Releases=9, Rollback=10, Backup=11, Restore=12,
// CLI Log=13, Diagnose=14, Logs=15, Admin Page=16, Quit=17

type menuItem struct {
	name  string
	index int
	enter bool // whether pressing Enter should open a TUI screen
}

var allMenuItems = []menuItem{
	{"Install", 0, true},
	{"Update", 1, false},
	{"Uninstall", 2, false},
	{"Status", 3, false},
	{"Check Deps", 4, false},
	{"Instances", 5, true},
	{"Detect MCU", 6, false},
	{"Flash MCU", 7, false},
	{"Init Config", 8, false},
	{"Releases", 9, false},
	{"Rollback", 10, false},
	{"Backup", 11, false},
	{"Restore", 12, false},
	{"CLI Log", 13, false},
	{"Diagnose", 14, false},
	{"Logs", 15, false},
	{"Admin Page", 16, false},
	{"Quit", 17, true},
}

// ── Tests ──────────────────────────────────────────────────────────

// TestTUIMenuRenders verifies the main menu shows all sections.
func TestTUIMenuRenders(t *testing.T) {
	launchTUI(t)
	defer quitTUI(t)

	waitFor(1 * time.Second)
	out := capture(45)

	sections := []string{"E3CNC CLI", "Setup", "Monitor", "Hardware", "Manage", "Tools", "Quit", "↑/↓ navigate"}
	for _, s := range sections {
		if !strings.Contains(out, s) {
			t.Errorf("Menu missing section: %s", s)
		}
	}
	t.Log("✅ All menu sections present")
}

// TestTUINavigation verifies cursor reaches each menu item.
func TestTUINavigation(t *testing.T) {
	for _, item := range allMenuItems {
		t.Run(item.name, func(t *testing.T) {
			launchTUI(t)
			defer quitTUI(t)

			navigateTo(item.index)
			waitFor(1 * time.Second)
			assertCursorOn(t, item.name)
		})
	}
}

// TestTUIEnter verifies pressing Enter on wizard items opens the correct screen.
func TestTUIEnter(t *testing.T) {
	tests := []struct {
		name       string
		index      int
		expectText string
	}{
		{"Install", 0, "E3CNC Install Wizard"},
		{"Instances", 5, "Instance Manager"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			launchTUI(t)
			defer quitTUI(t)

			navigateTo(tc.index)
			waitFor(1 * time.Second)
			sendEnter()
			waitFor(6 * time.Second)

			out := capture(10)
			assertScreenContains(t, out, tc.expectText)
		})
	}
}

// TestTUIQuit verifies Quit returns to the shell.
func TestTUIQuit(t *testing.T) {
	launchTUI(t)

	navigateTo(17) // Quit
	waitFor(1 * time.Second)
	sendEnter()
	waitFor(3 * time.Second)

	out := capture(3)
	if strings.Contains(out, "biqu@BTT-CB1") {
		t.Log("✅ Quit returned to shell")
	} else {
		t.Errorf("❌ Quit did not return to shell, got: %s", out)
	}
}

// TestTUIInstanceManager verifies the instance manager loads and shows instances.
func TestTUIInstanceManager(t *testing.T) {
	launchTUI(t)
	defer quitTUI(t)

	navigateTo(5) // Instances
	waitFor(1 * time.Second)
	sendEnter()
	waitFor(8 * time.Second)

	out := capture(15)
	// Should show either instance list or an expected status message
	if strings.Contains(out, "Instance Manager") {
		t.Log("✅ Instance manager screen opened")
	} else {
		t.Errorf("❌ Instance manager did not open, got:\n%s", out)
	}
}

// TestTUIVersion verifies the binary reports the correct version.
func TestTUIVersion(t *testing.T) {
	// Exit any running TUI
	sendCtrlC()
	waitFor(500 * time.Millisecond)
	sendKeys("q")
	waitFor(500 * time.Millisecond)

	// Run version command
	sendText(tuiBinary + " --version")
	sendEnter()
	waitFor(2 * time.Second)

	out := capture(5)
	if strings.Contains(out, "e3cnc-tui v") {
		t.Logf("✅ Version reported: %s", strings.TrimSpace(out))
	} else {
		t.Errorf("❌ Version not found, got: %s", out)
	}
}

// TestTUIHelp verifies the help output.
func TestTUIHelp(t *testing.T) {
	sendCtrlC()
	waitFor(500 * time.Millisecond)
	sendKeys("q")
	waitFor(500 * time.Millisecond)

	sendText(tuiBinary + " --help")
	sendEnter()
	waitFor(2 * time.Second)

	out := capture(10)
	if strings.Contains(out, "e3cnc-tui - E3CNC Terminal UI") {
		t.Log("✅ Help displayed")
	} else {
		t.Errorf("❌ Help not found, got: %s", out)
	}
}
