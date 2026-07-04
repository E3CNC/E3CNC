package internal

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefaultPaths(t *testing.T) {
	paths := DefaultPaths()

	required := []string{"e3cnc_root", "instances_dir", "current_link", "releases_dir", "cli_log"}
	for _, key := range required {
		if _, ok := paths[key]; !ok {
			t.Errorf("DefaultPaths() missing key: %s", key)
		}
	}

	// Check paths are absolute
	for key, path := range paths {
		if !filepath.IsAbs(path) {
			t.Errorf("DefaultPaths()[%q] = %q is not absolute", key, path)
		}
	}
}

func TestStateSaveAndLoad(t *testing.T) {
	// Save to a temp directory by overriding the home env
	origHome := os.Getenv("HOME")
	t.Cleanup(func() {
		os.Setenv("HOME", origHome)
	})

	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	// Save a state
	s := State{
		ActiveInstance: "test-box",
		Theme:          "dark",
		LastInstallID:  "20260704-123456-abc1",
	}

	if err := SaveState(s); err != nil {
		t.Fatalf("SaveState() error: %v", err)
	}

	// Verify file exists
	stateFile := filepath.Join(tmpHome, ".e3cnc-tui", "state.json")
	if _, err := os.Stat(stateFile); os.IsNotExist(err) {
		t.Fatalf("state.json not created at %s", stateFile)
	}

	// Load it back
	loaded := LoadState()
	if loaded.ActiveInstance != "test-box" {
		t.Errorf("LoadState().ActiveInstance = %q, expected %q", loaded.ActiveInstance, "test-box")
	}
	if loaded.Theme != "dark" {
		t.Errorf("LoadState().Theme = %q, expected %q", loaded.Theme, "dark")
	}
	if loaded.LastInstallID != "20260704-123456-abc1" {
		t.Errorf("LoadState().LastInstallID = %q, expected %q", loaded.LastInstallID, "20260704-123456-abc1")
	}
}

func TestLoadState_NoFile(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() {
		os.Setenv("HOME", origHome)
	})

	// Empty temp dir with no state file
	os.Setenv("HOME", t.TempDir())

	state := LoadState()
	if state.ActiveInstance != "" {
		t.Errorf("Expected empty state, got ActiveInstance=%q", state.ActiveInstance)
	}
}

func TestInstallJournalPath(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() {
		os.Setenv("HOME", origHome)
	})
	os.Setenv("HOME", t.TempDir())

	path := InstallJournalPath()
	if !filepath.IsAbs(path) {
		t.Errorf("InstallJournalPath() = %q is not absolute", path)
	}
	if !filepath.HasPrefix(path, os.Getenv("HOME")) {
		t.Errorf("InstallJournalPath() should be under HOME, got %q", path)
	}

	// Verify directory is created
	dir := filepath.Dir(path)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Errorf("~/.e3cnc-tui directory was not created by InstallJournalPath()")
	}
}
