package instance

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestE3CNCHome(t *testing.T) {
	home := E3CNCHome()
	if !strings.HasSuffix(home, "/e3cnc") && !strings.HasSuffix(home, "\\e3cnc") {
		t.Errorf("E3CNCHome() = %q, should end with 'e3cnc'", home)
	}
}

func TestInstancesDir(t *testing.T) {
	dir := InstancesDir()
	if !strings.HasSuffix(dir, "/instances") && !strings.HasSuffix(dir, "\\instances") {
		t.Errorf("InstancesDir() = %q, should end with 'instances'", dir)
	}
}

func TestReleasesDir(t *testing.T) {
	dir := ReleasesDir()
	if !strings.HasSuffix(dir, "/releases") && !strings.HasSuffix(dir, "\\releases") {
		t.Errorf("ReleasesDir() = %q, should end with 'releases'", dir)
	}
}

func TestCurrentLink(t *testing.T) {
	link := CurrentLink()
	if !strings.HasSuffix(link, "/current") && !strings.HasSuffix(link, "\\current") {
		t.Errorf("CurrentLink() = %q, should end with 'current'", link)
	}
}

func TestFromName(t *testing.T) {
	// Override HOME to a temp dir
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })

	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	// Create the instance directory structure (use uppercase E3CNC to match E3CNCHome())
	instDir := filepath.Join(tmpHome, "E3CNC", "instances", "test-box")
	os.MkdirAll(filepath.Join(instDir, "data", "config"), 0755)
	os.MkdirAll(filepath.Join(instDir, "frontend"), 0755)

	inst, err := FromName("test-box")
	if err != nil {
		t.Fatalf("FromName('test-box') error: %v", err)
	}
	if inst.Name != "test-box" {
		t.Errorf("Name = %q, expected 'test-box'", inst.Name)
	}
	if inst.ConfigDir == "" {
		t.Errorf("ConfigDir should not be empty")
	}
	if inst.WebRoot == "" {
		t.Errorf("WebRoot should not be empty")
	}
}

func TestFromName_NotFound(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	os.Setenv("HOME", t.TempDir())

	_, err := FromName("nonexistent")
	if err == nil {
		t.Error("FromName('nonexistent') should return error")
	}
}

func TestDetectInstances_Empty(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	os.Setenv("HOME", t.TempDir())

	// Create instances dir with no subdirectories
	os.MkdirAll(filepath.Join(t.TempDir(), "e3cnc", "instances"), 0755)
	// Actually DetectInstances reads from InstancesDir() which uses the REAL home
	// So we need to set HOME properly

	os.Setenv("HOME", t.TempDir())
	os.MkdirAll(InstancesDir(), 0755)

	instances, err := DetectInstances()
	if err != nil {
		t.Fatalf("DetectInstances() error: %v", err)
	}
	if len(instances) != 0 {
		t.Errorf("DetectInstances() = %d instances, expected 0", len(instances))
	}
}

func TestDetectInstances_WithInstances(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	// Create instances
	for _, name := range []string{"default", "test-box"} {
		instDir := filepath.Join(InstancesDir(), name)
		os.MkdirAll(filepath.Join(instDir, "data", "config"), 0755)
		os.MkdirAll(filepath.Join(instDir, "frontend"), 0755)
	}

	instances, err := DetectInstances()
	if err != nil {
		t.Fatalf("DetectInstances() error: %v", err)
	}
	if len(instances) != 2 {
		t.Fatalf("DetectInstances() = %d instances, expected 2", len(instances))
	}
	// Check names
	names := map[string]bool{}
	for _, inst := range instances {
		names[inst.Name] = true
	}
	if !names["default"] {
		t.Errorf("Expected 'default' instance")
	}
	if !names["test-box"] {
		t.Errorf("Expected 'test-box' instance")
	}
}

func TestFindNextAvailablePort(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	// Create an instance with port 7125
	instDir := filepath.Join(InstancesDir(), "default")
	os.MkdirAll(filepath.Join(instDir, "data", "config"), 0755)
	os.MkdirAll(filepath.Join(instDir, "frontend"), 0755)

	port, err := FindNextAvailablePort()
	if err != nil {
		t.Fatalf("FindNextAvailablePort() error: %v", err)
	}
	if port != 7126 {
		t.Errorf("FindNextAvailablePort() = %d, expected 7126 (next after 7125)", port)
	}
}

func TestGetLocalIP(t *testing.T) {
	ip := GetLocalIP()
	// Should return something that looks like an IP or "unknown"
	if ip == "" {
		t.Errorf("GetLocalIP() returned empty string")
	}
}

func TestStateDir(t *testing.T) {
	dir := StateDir()
	if !strings.HasSuffix(dir, ".e3cnc-tui") {
		t.Errorf("StateDir() = %q, should end with '.e3cnc-tui'", dir)
	}
}
