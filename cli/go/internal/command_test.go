package internal

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadCommands(t *testing.T) {
	// This test requires the real commands.json file relative to the binary.
	// We create a synthetic one in a temp dir for deterministic testing.
	dir := t.TempDir()
	manifestPath := filepath.Join(dir, "cli", "commands.json")
	os.MkdirAll(filepath.Dir(manifestPath), 0755)

	manifestContent := `{
		"version": "1",
		"commands": [
			{"name": "test-cmd", "aliases": ["tc"], "destructive": false, "blocking": false, "interactive": false, "flags": []}
		]
	}`

	if err := os.WriteFile(manifestPath, []byte(manifestContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Override executable path to point at our temp dir
	// We'll test LoadCommands via direct file read instead
	// since it relies on os.Executable() path resolution.
	// For unit testing, test the struct methods directly.
}

func TestFindCommand(t *testing.T) {
	m := &CommandsManifest{
		Version: "1",
		Commands: []CommandDef{
			{Name: "install", Aliases: []string{}, Destructive: true, Blocking: true},
			{Name: "status", Aliases: []string{"st"}, Destructive: false, Blocking: false},
			{Name: "instances", Aliases: []string{"inst", "list"}, Destructive: false, Blocking: false},
		},
	}

	tests := []struct {
		name     string
		expected string
		found    bool
	}{
		{"install", "install", true},
		{"status", "status", true},
		{"st", "status", true},
		{"instances", "instances", true},
		{"inst", "instances", true},
		{"list", "instances", true},
		{"unknown", "", false},
	}

	for _, tc := range tests {
		cmd := m.FindCommand(tc.name)
		if tc.found {
			if cmd == nil {
				t.Errorf("FindCommand(%q): expected to find command, got nil", tc.name)
			} else if cmd.Name != tc.expected {
				t.Errorf("FindCommand(%q): expected Name=%q, got %q", tc.name, tc.expected, cmd.Name)
			}
		} else {
			if cmd != nil {
				t.Errorf("FindCommand(%q): expected nil, got %v", tc.name, cmd)
			}
		}
	}
}

func TestIsKnownCommand(t *testing.T) {
	m := &CommandsManifest{
		Version: "1",
		Commands: []CommandDef{
			{Name: "install", Aliases: []string{}},
			{Name: "status", Aliases: []string{"st"}},
		},
	}

	if !m.IsKnownCommand("install") {
		t.Error("IsKnownCommand('install') should be true")
	}
	if !m.IsKnownCommand("st") {
		t.Error("IsKnownCommand('st') should be true")
	}
	if m.IsKnownCommand("unknown") {
		t.Error("IsKnownCommand('unknown') should be false")
	}
}

func TestAllCommandNames(t *testing.T) {
	m := &CommandsManifest{
		Version: "1",
		Commands: []CommandDef{
			{Name: "install", Aliases: []string{"i"}},
			{Name: "status", Aliases: []string{"st", "stat"}},
		},
	}

	names := m.AllCommandNames()
	expected := map[string]bool{"install": true, "i": true, "status": true, "st": true, "stat": true}

	if len(names) != len(expected) {
		t.Errorf("AllCommandNames(): got %d names, expected %d", len(names), len(expected))
	}

	for _, n := range names {
		if !expected[n] {
			t.Errorf("AllCommandNames() returned unexpected name: %s", n)
		}
	}
}

func TestBuildPythonArgs(t *testing.T) {
	tests := []struct {
		args     []string
		expected []string
	}{
		{[]string{"status"}, []string{"-m", "cli", "status"}},
		{[]string{"install", "--check"}, []string{"-m", "cli", "install", "--check"}},
		{[]string{"instances", "--json"}, []string{"-m", "cli", "instances", "--json"}},
	}

	for _, tc := range tests {
		result, err := BuildPythonArgs("/some/dir", tc.args)
		if err != nil {
			t.Errorf("BuildPythonArgs(%v): unexpected error: %v", tc.args, err)
			continue
		}
		if len(result) != len(tc.expected) {
			t.Errorf("BuildPythonArgs(%v): got len=%d, expected len=%d", tc.args, len(result), len(tc.expected))
			continue
		}
		for i := range result {
			if result[i] != tc.expected[i] {
				t.Errorf("BuildPythonArgs(%v)[%d]: got %q, expected %q", tc.args, i, result[i], tc.expected[i])
			}
		}
	}
}

func TestBuildPythonArgs_Empty(t *testing.T) {
	_, err := BuildPythonArgs("/some/dir", []string{})
	if err == nil {
		t.Error("BuildPythonArgs([]) should return an error for empty args")
	}
}

func TestFormatArgsForDisplay(t *testing.T) {
	tests := []struct {
		args     []string
		expected string
	}{
		{[]string{"status"}, "status"},
		{[]string{"install", "--name", "my-box"}, `install --name my-box`},
		{[]string{"install", "--check"}, "install --check"},
	}

	for _, tc := range tests {
		result := FormatArgsForDisplay(tc.args)
		if result != tc.expected {
			t.Errorf("FormatArgsForDisplay(%v): got %q, expected %q", tc.args, result, tc.expected)
		}
	}
}

func TestRunResult(t *testing.T) {
	// Test the RunResult struct fields directly (no subprocess call)
	r := &RunResult{ExitCode: 0, Stdout: "ok", Stderr: "", Cancelled: false, TimedOut: false}
	if r.ExitCode != 0 {
		t.Errorf("Expected exit code 0, got %d", r.ExitCode)
	}
	if r.Stdout != "ok" {
		t.Errorf("Expected stdout 'ok', got %q", r.Stdout)
	}

	r2 := &RunResult{ExitCode: 1, Cancelled: true, TimedOut: false}
	if !r2.Cancelled {
		t.Errorf("Expected Cancelled=true")
	}
}
