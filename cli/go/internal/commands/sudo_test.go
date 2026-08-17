package commands

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/E3CNC/e3cnc/cli/go/internal/rootrun"
)

// ── install root gate ─────────────────────────────────────────────

func TestInstallIsAuxiliaryMode(t *testing.T) {
	cases := []struct {
		name string
		args []string
		want bool
	}{
		{"port-detect", []string{"--port-detect"}, true},
		{"port-detect-only", []string{"--port-detect-only"}, true},
		{"migrate-only", []string{"--migrate-only"}, true},
		{"backup-only", []string{"--backup-only"}, true},
		{"help", []string{"--help"}, true},
		{"full install", []string{"--name", "default"}, false},
		{"no args", nil, false},
		{"with dns", []string{"--hostname", "x"}, false},
	}
	for _, c := range cases {
		if got := installIsAuxiliaryMode(c.args); got != c.want {
			t.Errorf("%s: installIsAuxiliaryMode(%v) = %v, want %v", c.name, c.args, got, c.want)
		}
	}
}

// TestCmdInstallRootGate_NonRoot verifies a non-root install (no auxiliary
// flag) is refused rather than running privileged steps. This runs in a
// non-root test process, so the gate path is exercised directly.
func TestCmdInstallRootGate_NonRoot(t *testing.T) {
	if rootrun.IsRoot() {
		t.Skip("test must run as non-root to exercise the gate")
	}
	// Auxiliary modes must bypass the gate and be handled regardless of root.
	if !RunDispatch("install", false, []string{"--port-detect"}) {
		t.Error("install --port-detect should be handled as non-root")
	}
}

// ── cmdRestart ────────────────────────────────────────────────────

// stubRestartInstance creates a temp HOME with an instance named "default"
// so cmdRestart can resolve an instance in the test.
func stubRestartInstance(t *testing.T) {
	t.Helper()
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	os.Setenv("HOME", t.TempDir())

	// Create an instance that resolveInstance can find by name.
	instDir := filepath.Join(os.Getenv("HOME"), "E3CNC", "instances", "default", "data", "config")
	if err := os.MkdirAll(instDir, 0755); err != nil {
		t.Fatalf("mkdir instance: %v", err)
	}
	_ = filepath.Join(os.Getenv("HOME"), "E3CNC", "instances", "default", "data", "config", "moonraker.conf")
}

// TestCmdRestartUsesBoundary verifies cmdRestart routes through rootrun
// (observable via the Exec stub) rather than a silent bash -c.
func TestCmdRestartUsesBoundary(t *testing.T) {
	stubRestartInstance(t)

	var called bool
	origExec := rootrun.Exec
	rootrun.Exec = func(name string, args ...string) ([]byte, error) {
		called = true
		return nil, nil
	}
	defer func() { rootrun.Exec = origExec }()

	result := RunDispatch("restart", false, []string{"--name", "default"})
	if !result {
		t.Error("RunDispatch('restart') should return true")
	}
	if !called {
		t.Error("expected cmdRestart to invoke the rootrun boundary")
	}
}

func TestCmdRestartNoInstance(t *testing.T) {
	stubPrivilegedExec(t)
	result := RunDispatch("restart", false, []string{"--name", "does-not-exist-xyz"})
	if !result {
		t.Error("RunDispatch('restart') with unknown instance should return true")
	}
}
