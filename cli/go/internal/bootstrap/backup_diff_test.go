package bootstrap

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBackupImportConfig_NewFiles(t *testing.T) {
	tmpDir := t.TempDir()
	e3cncHome := filepath.Join(tmpDir, "E3CNC")

	// Override home for this test
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)
	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()

	// Backup files that don't exist yet (new install)
	files := map[string]string{
		"nginx/e3cnc-default.conf": filepath.Join(tmpDir, "nginx", "e3cnc-default.conf"),
		"supervisor/e3cnc.conf":    filepath.Join(tmpDir, "supervisor", "e3cnc.conf"),
	}

	snapshot, err := BackupImportConfig(files)
	if err != nil {
		t.Fatalf("BackupImportConfig: %v", err)
	}
	if snapshot == nil {
		t.Fatal("BackupImportConfig returned nil snapshot")
	}
	if snapshot.BackupDir() == "" {
		t.Error("BackupDir should not be empty")
	}
	if len(snapshot.Files()) != 2 {
		t.Errorf("expected 2 files, got %d", len(snapshot.Files()))
	}
	// Content should be empty for non-existent files
	for _, f := range snapshot.Files() {
		if f.Content != "" {
			t.Errorf("file %s: expected empty content, got %q", f.Name, f.Content)
		}
	}
}

func TestBackupImportConfig_ExistingFiles(t *testing.T) {
	tmpDir := t.TempDir()
	e3cncHome := filepath.Join(tmpDir, "E3CNC")

	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)
	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()

	// Create an existing config file
	cfgDir := filepath.Join(tmpDir, "config")
	os.MkdirAll(cfgDir, 0755)
	cfgPath := filepath.Join(cfgDir, "moonraker.conf")
	origContent := "# Moonraker config\nport: 7125\n"
	os.WriteFile(cfgPath, []byte(origContent), 0644)

	files := map[string]string{
		"moonraker.conf": cfgPath,
	}

	snapshot, err := BackupImportConfig(files)
	if err != nil {
		t.Fatalf("BackupImportConfig: %v", err)
	}

	if len(snapshot.Files()) != 1 {
		t.Fatalf("expected 1 file, got %d", len(snapshot.Files()))
	}
	if snapshot.Files()[0].Content != origContent {
		t.Errorf("expected content %q, got %q", origContent, snapshot.Files()[0].Content)
	}
}

func TestImportBackupDiff_Unchanged(t *testing.T) {
	tmpDir := t.TempDir()
	e3cncHome := filepath.Join(tmpDir, "E3CNC")

	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)
	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()

	// Create a config file
	cfgPath := filepath.Join(tmpDir, "moonraker.conf")
	content := "# Moonraker config\nport: 7125\n"
	os.WriteFile(cfgPath, []byte(content), 0644)

	snapshot, err := BackupImportConfig(map[string]string{
		"moonraker.conf": cfgPath,
	})
	if err != nil {
		t.Fatalf("BackupImportConfig: %v", err)
	}

	// File unchanged — diff should be empty
	diff := snapshot.Diff()
	if diff != "" {
		t.Errorf("expected empty diff for unchanged file, got:\n%s", diff)
	}
}

func TestImportBackupDiff_Modified(t *testing.T) {
	tmpDir := t.TempDir()
	e3cncHome := filepath.Join(tmpDir, "E3CNC")

	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)
	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()

	// Create a config file
	cfgPath := filepath.Join(tmpDir, "moonraker.conf")
	content := "# Moonraker config\nport: 7125\n"
	os.WriteFile(cfgPath, []byte(content), 0644)

	snapshot, err := BackupImportConfig(map[string]string{
		"moonraker.conf": cfgPath,
	})
	if err != nil {
		t.Fatalf("BackupImportConfig: %v", err)
	}

	// Now modify the file
	newContent := "# Moonraker config (modified)\nport: 7125\nhost: 0.0.0.0\n"
	os.WriteFile(cfgPath, []byte(newContent), 0644)

	diff := snapshot.Diff()
	if diff == "" {
		t.Fatal("expected non-empty diff for modified file")
	}
	if !strings.Contains(diff, "Moonraker config (modified)") {
		t.Errorf("diff should contain new content, got:\n%s", diff)
	}
	if !strings.Contains(diff, "moonraker.conf") {
		t.Errorf("diff should mention file name, got:\n%s", diff)
	}
}

func TestImportBackupDiff_FileDeleted(t *testing.T) {
	tmpDir := t.TempDir()
	e3cncHome := filepath.Join(tmpDir, "E3CNC")

	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)
	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()

	cfgPath := filepath.Join(tmpDir, "moonraker.conf")
	content := "# Moonraker config\nport: 7125\n"
	os.WriteFile(cfgPath, []byte(content), 0644)

	snapshot, err := BackupImportConfig(map[string]string{
		"moonraker.conf": cfgPath,
	})
	if err != nil {
		t.Fatalf("BackupImportConfig: %v", err)
	}

	// Delete the file
	os.Remove(cfgPath)

	diff := snapshot.Diff()
	if diff == "" {
		t.Fatal("expected non-empty diff for deleted file")
	}
	if !strings.Contains(diff, "error") {
		t.Errorf("diff should indicate error for deleted file, got:\n%s", diff)
	}
}

func TestLineDiff(t *testing.T) {
	tests := []struct {
		name     string
		oldText  string
		newText  string
		contains string
	}{
		{"unchanged", "a\nb\nc", "a\nb\nc", "(no meaningful changes)"},
		{"added line", "a\nb", "a\nb\nc", "+c"},
		{"removed line", "a\nb\nc", "a\nb", "-c"},
		{"changed line", "port: 7125", "port: 8080", "-port: 7125\n+port: 8080"},
		{"empty to non-empty", "", "hello", "+hello"},
		{"non-empty to empty", "hello", "", "-hello"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := lineDiff(tc.oldText, tc.newText)
			if !strings.Contains(result, tc.contains) {
				t.Errorf("lineDiff(%q, %q) should contain %q, got:\n%s", tc.oldText, tc.newText, tc.contains, result)
			}
		})
	}
}

func TestSortStrings(t *testing.T) {
	s := []string{"z", "a", "m", "b"}
	sortStrings(s)
	expected := []string{"a", "b", "m", "z"}
	for i := range s {
		if s[i] != expected[i] {
			t.Errorf("sortStrings: index %d = %q, expected %q", i, s[i], expected[i])
		}
	}
}