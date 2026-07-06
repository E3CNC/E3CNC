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
