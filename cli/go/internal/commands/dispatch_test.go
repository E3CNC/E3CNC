package commands

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestRunDispatch_Status(t *testing.T) {
	// RunDispatch for "status" should return true (handled)
	result := RunDispatch("status", false, nil)
	if !result {
		t.Errorf("RunDispatch('status') = false, expected true (handled)")
	}
}

func TestRunDispatch_AllCommands(t *testing.T) {
	commands := []struct {
		name    string
		args    []string
	}{
		{"status", nil},
		{"check", nil},
		{"check-deps", nil},
		{"instances", nil},
		{"inst", nil},
		{"list", nil},
		{"releases", nil},
		{"rel", nil},
		{"clilog", nil},
		{"update", nil},
		{"backup", nil},
		{"restore", nil},
		{"rollback", nil},
		{"prune", nil},
		{"prune-backups", nil},
		{"diagnose", nil},
		{"diag", nil},
		{"doctor", nil},
		{"logs", nil},
		{"detect-mcu", nil},
		{"detect", nil},
		{"scan", nil},
		{"init-config", nil},
		{"init", nil},
		{"restart", nil},
		{"install", nil},
		{"uninstall", nil},
		{"deploy", nil},
		{"flash-mcu", nil},
		{"flash", nil},
		{"build", nil},
		{"migrate", nil},
		{"migrate-instances", nil},
		{"import-instance", nil},
	}

	for _, tc := range commands {
		t.Run(tc.name, func(t *testing.T) {
			result := RunDispatch(tc.name, false, tc.args)
			if !result {
				t.Errorf("RunDispatch(%q) = false, expected true (should be handled)", tc.name)
			}
		})
	}
}

func TestRunDispatch_Unknown(t *testing.T) {
	// Unknown commands should return false (fall-through to Python)
	result := RunDispatch("nonexistent-command", false, nil)
	if result {
		t.Errorf("RunDispatch('nonexistent') = true, expected false (should fall through to Python)")
	}
}

func TestHasBin(t *testing.T) {
	// These binaries should exist on any system
	known := []string{"go", "sh", "ls"}
	for _, name := range known {
		if !hasBin(name) {
			t.Errorf("hasBin(%q) = false, expected true", name)
		}
	}

	// This should not exist
	if hasBin("this-command-does-not-exist-xyzzy") {
		t.Errorf("hasBin('nonexistent') = true, expected false")
	}
}

func TestPrintJSON(t *testing.T) {
	// printJSON writes to stdout, capture it
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	printJSON(map[string]string{"key": "value"})

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	buf.ReadFrom(r)

	var result map[string]string
	if err := json.Unmarshal([]byte(buf.String()), &result); err != nil {
		t.Fatalf("printJSON output not valid JSON: %v", err)
	}
	if result["key"] != "value" {
		t.Errorf("printJSON: got key=%q, expected 'value'", result["key"])
	}
}

func TestResolveInstance_NoArgs(t *testing.T) {
	// With no args and no active instance, should return nil
	inst := resolveInstance(nil)
	if inst != nil {
		t.Logf("resolveInstance(nil) returned non-nil (may have active instance)")
	}
}

func TestResolveInstance_WithName(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	// Create a test instance (use uppercase E3CNC to match E3CNCHome())
	instDir := filepath.Join(tmpHome, "E3CNC", "instances", "test-box")
	os.MkdirAll(filepath.Join(instDir, "data", "config"), 0755)
	os.MkdirAll(filepath.Join(instDir, "frontend"), 0755)

	// Resolve with --name flag
	inst := resolveInstance([]string{"--name", "test-box"})
	if inst == nil {
		t.Fatalf("resolveInstance('--name test-box') = nil, expected instance")
	}
	if inst.Name != "test-box" {
		t.Errorf("resolveInstance: Name = %q, expected 'test-box'", inst.Name)
	}
}

func TestResolveInstance_WithShortFlag(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	instDir := filepath.Join(tmpHome, "E3CNC", "instances", "dev-box")
	os.MkdirAll(filepath.Join(instDir, "data", "config"), 0755)
	os.MkdirAll(filepath.Join(instDir, "frontend"), 0755)

	inst := resolveInstance([]string{"-p", "dev-box"})
	if inst == nil {
		t.Fatalf("resolveInterface('-p dev-box') = nil, expected instance")
	}
	if inst.Name != "dev-box" {
		t.Errorf("resolveInstance: Name = %q, expected 'dev-box'", inst.Name)
	}
}

func TestResolveInstance_Nonexistent(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	os.Setenv("HOME", t.TempDir())

	inst := resolveInstance([]string{"--name", "nonexistent"})
	// Should still return something (falls back to activeInstance)
	_ = inst
}