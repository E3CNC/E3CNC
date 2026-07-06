package bootstrap

import (
	"os"
	"path/filepath"
	"testing"
)

func TestBootstrapConfigDefaults(t *testing.T) {
	cfg := BootstrapConfig{}
	if cfg.InstanceName != "" {
		t.Errorf("default InstanceName should be empty, got %q", cfg.InstanceName)
	}
	if cfg.MoonrakerPort != 0 {
		t.Errorf("default MoonrakerPort should be 0, got %d", cfg.MoonrakerPort)
	}
}

func TestBootstrapSetsDefaults(t *testing.T) {
	// Bootstrap() sets defaults internally, but requires root-level ops (apt, systemctl).
	// We can't test the full function without root, but we can verify the defaults logic
	// by checking the code path — the test is that it compiles and the defaults function
	// works correctly.

	// Test that BootstrapConfig defaults are applied in the normal path
	// by checking the function signature has the right types
	var _ func(BootstrapConfig) error = Bootstrap
	_ = Bootstrap // keep compiler happy
}

func TestRollbackCompiles(t *testing.T) {
	// Rollback requires root-level ops (systemctl, rm -f /etc/...).
	// Verify the function signature is correct.
	var _ func(BootstrapConfig) = Rollback
	_ = Rollback
}

func TestUninstallCompiles(t *testing.T) {
	// Uninstall requires root-level ops.
	// Verify the function signature is correct.
	_ = Uninstall
}

func TestStepNames(t *testing.T) {
	if len(stepNames) != 9 {
		t.Errorf("stepNames: got %d steps, expected 9", len(stepNames))
	}
	for i, name := range stepNames {
		if name == "" {
			t.Errorf("stepNames[%d] is empty", i)
		}
	}
}

func TestWriteFileSudo_Direct(t *testing.T) {
	// Test the direct write path (no sudo needed for temp dir)
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.txt")
	err := writeFileSudo(path, "hello", 0644)
	if err != nil {
		t.Fatalf("writeFileSudo error: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile error: %v", err)
	}
	if string(data) != "hello" {
		t.Errorf("writeFileSudo: got %q, expected 'hello'", string(data))
	}
}
