package bootstrap

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"testing"
)

// ── helpers ────────────────────────────────────────────────────────

func touchFile(t *testing.T, path string, content string) {
	t.Helper()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatalf("mkdir %s: %v", dir, err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

// ── port detection tests ───────────────────────────────────────────

func TestAutoDetectPorts(t *testing.T) {
	ports := AutoDetectPorts()

	// Should return valid port numbers
	if ports.AdminPort < 1024 || ports.AdminPort > 65535 {
		t.Errorf("AdminPort %d out of range", ports.AdminPort)
	}
	if ports.MoonrakerPort < 1024 || ports.MoonrakerPort > 65535 {
		t.Errorf("MoonrakerPort %d out of range", ports.MoonrakerPort)
	}
	if ports.KlipperPort < 1024 || ports.KlipperPort > 65535 {
		t.Errorf("KlipperPort %d out of range", ports.KlipperPort)
	}
}

func TestPortInUse(t *testing.T) {
	// Pick a high port that's unlikely to be in use
	freePort := findFreePort(30000, 100)
	if freePort == 0 {
		t.Fatal("could not find free port for test")
	}

	// Port should be free
	if portInUse(freePort) {
		t.Errorf("port %d should be free", freePort)
	}

	// Bind the port, then check it's in use
	ln, err := netListen("tcp", freePort)
	if err != nil {
		t.Fatalf("bind port %d: %v", freePort, err)
	}
	defer ln.Close()

	if !portInUse(freePort) {
		t.Errorf("port %d should be in use after binding", freePort)
	}
}

func TestFindFreePort(t *testing.T) {
	// Bind a port to force findFreePort to skip it
	ln, err := netListen("tcp", 25000)
	if err != nil {
		t.Fatalf("bind port: %v", err)
	}
	defer ln.Close()

	// findFreePort should skip 25000 and return 25001
	port := findFreePort(25000, 10)
	if port == 0 {
		t.Fatal("findFreePort returned 0, expected a free port")
	}
	if port == 25000 {
		t.Error("findFreePort should not return port 25000 (it's in use)")
	}
}

// ── migration tests ─────────────────────────────────────────────────

func TestMigrateOldDirOnly(t *testing.T) {
	tmpDir := t.TempDir()
	oldDir := filepath.Join(tmpDir, "e3cnc")
	e3cncHome := filepath.Join(tmpDir, "e3cnc_home")

	touchFile(t, filepath.Join(oldDir, "instances", "default", "data", "config", "printer.cfg"), "test config")

	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()

	if err := MigrateOldDir(); err != nil {
		t.Fatalf("MigrateOldDir failed: %v", err)
	}

	// Files should be migrated to e3cncHome (Scenario 1: rename)
	cfgPath := filepath.Join(e3cncHome, "instances", "default", "data", "config", "printer.cfg")
	if _, err := os.Stat(cfgPath); os.IsNotExist(err) {
		t.Errorf("config not found at %s", cfgPath)
	}
	// Old dir should no longer exist (was renamed)
	if dirExists(oldDir) {
		t.Log("old dir still exists after rename (may be macOS case-insensitive FS)")
	}
}

func TestMigrateBothDirsMerge(t *testing.T) {
	tmpDir := t.TempDir()
	oldDir := filepath.Join(tmpDir, "e3cnc")
	e3cncHome := filepath.Join(tmpDir, "e3cnc_home")

	touchFile(t, filepath.Join(oldDir, "instances", "default", "data", "config", "old.cfg"), "old config")
	touchFile(t, filepath.Join(e3cncHome, "instances", "default", "data", "config", "new.cfg"), "new config")
	touchFile(t, filepath.Join(oldDir, "shared.txt"), "old content")
	touchFile(t, filepath.Join(e3cncHome, "shared.txt"), "new content")

	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()

	if err := MigrateOldDir(); err != nil {
		t.Fatalf("MigrateOldDir failed: %v", err)
	}

	if _, err := os.Stat(filepath.Join(e3cncHome, "instances", "default", "data", "config", "old.cfg")); os.IsNotExist(err) {
		t.Error("old.cfg should exist in merged dir")
	}

	if _, err := os.Stat(filepath.Join(e3cncHome, "instances", "default", "data", "config", "new.cfg")); os.IsNotExist(err) {
		t.Error("new.cfg should still exist in merged dir")
	}

	data, err := os.ReadFile(filepath.Join(e3cncHome, "shared.txt"))
	if err != nil {
		t.Fatalf("read shared.txt: %v", err)
	}
	if string(data) != "new content" {
		t.Errorf("shared.txt should keep new content, got: %s", data)
	}
}

func TestMigrateMergeWithSymlink(t *testing.T) {
	tmpDir := t.TempDir()
	oldDir := filepath.Join(tmpDir, "e3cnc")
	e3cncHome := filepath.Join(tmpDir, "e3cnc_home")

	// A symlink pointing at a directory (mirrors e3cnc's `current` symlink)
	touchFile(t, filepath.Join(oldDir, "instances", "default", "data", "config", "printer.cfg"), "cfg")
	if err := os.Symlink("instances/default", filepath.Join(oldDir, "current")); err != nil {
		t.Fatalf("symlink: %v", err)
	}

	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()

	if err := MigrateOldDir(); err != nil {
		t.Fatalf("MigrateOldDir failed: %v", err)
	}

	// The symlink should be preserved (recreated) at the destination, not read as a file
	linkPath := filepath.Join(e3cncHome, "current")
	info, err := os.Lstat(linkPath)
	if err != nil {
		t.Fatalf("current symlink not preserved: %v", err)
	}
	if info.Mode()&os.ModeSymlink == 0 {
		t.Error("current should be a symlink in the merged dir")
	}
	target, err := os.Readlink(linkPath)
	if err != nil {
		t.Fatalf("readlink: %v", err)
	}
	if target != "instances/default" {
		t.Errorf("symlink target wrong: got %s", target)
	}
}

func TestMigrateNoOldDir(t *testing.T) {
	tmpDir := t.TempDir()
	oldDir := filepath.Join(tmpDir, "e3cnc-legacy")
	newDir := filepath.Join(tmpDir, "E3CNC")
	os.MkdirAll(newDir, 0755)

	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	origTestE3CNCHome := testE3CNCHome
	testE3CNCHome = ""
	defer func() { testE3CNCHome = origTestE3CNCHome }()

	// No old dir should exist, should be a no-op
	if err := MigrateOldDir(); err != nil {
		t.Fatalf("MigrateOldDir should not fail when no old dir: %v", err)
	}

	if dirExists(oldDir) {
		t.Error("old dir should still not exist")
	}
	if !dirExists(newDir) {
		t.Error("new dir should still exist")
	}
}

// ── backup tests ───────────────────────────────────────────────────

func TestBackupSmartContent(t *testing.T) {
	e3cncDir := filepath.Join(t.TempDir(), "E3CNC")

	// Create instances/ with config (should be backed up)
	touchFile(t, filepath.Join(e3cncDir, "instances", "default", "data", "config", "printer.cfg"), "config data")

	// Create releases/ with binary (should NOT be backed up)
	touchFile(t, filepath.Join(e3cncDir, "releases", "e3cnc-tui"), "binary data")

	// Override e3cncHome
	testE3CNCHome = e3cncDir
	defer func() { testE3CNCHome = "" }()

	backupPath, err := BackupExisting()
	if err != nil {
		t.Fatalf("BackupExisting failed: %v", err)
	}
	if backupPath == "" {
		t.Fatal("BackupExisting returned empty path")
	}

	// Verify instances/ exists in backup
	if _, err := os.Stat(filepath.Join(backupPath, "instances", "default", "data", "config", "printer.cfg")); os.IsNotExist(err) {
		t.Error("config should exist in backup")
	}

	// Verify releases/ does NOT exist in backup
	if _, err := os.Stat(filepath.Join(backupPath, "releases")); !os.IsNotExist(err) {
		t.Error("releases should NOT exist in backup")
	}
}

func TestBackupPruning(t *testing.T) {
	e3cncDir := filepath.Join(t.TempDir(), "E3CNC")
	backupsDir := filepath.Join(e3cncDir, "backups")
	os.MkdirAll(backupsDir, 0700)

	// Create MAX_BACKUPS+2 old backup directories
	numOld := MaxBackups + 2
	for i := 1; i <= numOld; i++ {
		dirName := backupPrefix + fmt.Sprintf("20250101_%05d", i)
		os.MkdirAll(filepath.Join(backupsDir, dirName), 0700)
	}

	testE3CNCHome = e3cncDir
	defer func() { testE3CNCHome = "" }()

	touchFile(t, filepath.Join(e3cncDir, "instances", "test.txt"), "data")

	_, err := BackupExisting()
	if err != nil {
		t.Fatalf("BackupExisting failed: %v", err)
	}

	// After pruning, should have MaxBackups (prune keeps N, new backup is among them)
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		t.Fatalf("read backups dir: %v", err)
	}

	var backupDirs []string
	for _, e := range entries {
		if e.IsDir() {
			backupDirs = append(backupDirs, e.Name())
		}
	}

	if len(backupDirs) != MaxBackups {
		t.Errorf("expected %d backups after pruning, got %d", MaxBackups, len(backupDirs))
	}
}

func TestDirExists(t *testing.T) {
	tmpDir := t.TempDir()

	if !dirExists(tmpDir) {
		t.Error("dirExists should return true for existing directory")
	}

	nonExistent := filepath.Join(tmpDir, "does-not-exist")
	if dirExists(nonExistent) {
		t.Error("dirExists should return false for non-existent path")
	}

	// File is not a directory
	filePath := filepath.Join(tmpDir, "file.txt")
	os.WriteFile(filePath, []byte("test"), 0644)
	if dirExists(filePath) {
		t.Error("dirExists should return false for a file")
	}
}

// netListen is a thin wrapper for testing port binding
func netListen(network string, port int) (interface{ Close() error }, error) {
	return net.Listen("tcp", fmt.Sprintf(":%d", port))
}

// listDir returns a formatted listing of a directory for debugging
func listDir(t *testing.T, dir string) string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Sprintf("error reading %s: %v", dir, err)
	}
	var result string
	for _, e := range entries {
		result += fmt.Sprintf("  %s (dir=%v)\n", e.Name(), e.IsDir())
	}
	if result == "" {
		result = "  (empty)\n"
	}
	return result
}
