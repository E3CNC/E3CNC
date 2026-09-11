package bootstrap

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/E3CNC/e3cnc/cli/go/internal/rootrun"
)

// ── hasWheels ────────────────────────────────────────────────────────

func TestHasWheels_EmptyReturnsFalse(t *testing.T) {
	dir := t.TempDir()
	if hasWheels(dir) {
		t.Error("empty dir should return false")
	}
}

func TestHasWheels_WithWhlReturnsTrue(t *testing.T) {
	dir := t.TempDir()
	touchFile(t, filepath.Join(dir, "greenlet-3.1.1-cp311-cp311-manylinux_x86_64.whl"), "")
	if !hasWheels(dir) {
		t.Error("dir with .whl should return true")
	}
}

func TestHasWheels_WithTarGzReturnsTrue(t *testing.T) {
	dir := t.TempDir()
	touchFile(t, filepath.Join(dir, "pillow-12.2.0.tar.gz"), "")
	if !hasWheels(dir) {
		t.Error("dir with .tar.gz should return true")
	}
}

func TestHasWheels_WithOnlyTxtReturnsFalse(t *testing.T) {
	dir := t.TempDir()
	touchFile(t, filepath.Join(dir, "README.txt"), "")
	if hasWheels(dir) {
		t.Error("dir with only .txt should return false")
	}
}

func TestHasWheels_NonDirReturnsFalse(t *testing.T) {
	if hasWheels("/nonexistent-xyz-123") {
		t.Error("nonexistent dir should return false")
	}
}

// ── klippy-requirements Jinja2 markers ─────────────────────────────

func TestKlippyRequirements_Jinja2MarkersPresent(t *testing.T) {
	repoRoot := filepath.Join("..", "..", "..", "..")
	if _, err := os.Stat(filepath.Join(repoRoot, "vendor", "klipper", "scripts", "klippy-requirements.txt")); os.IsNotExist(err) {
		repoRoot = "/Users/isaaceliape/repos/e3cnc"
	}
	path := filepath.Join(repoRoot, "vendor", "klipper", "scripts", "klippy-requirements.txt")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read klippy-requirements.txt: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "Jinja2==2.11.3 ; python_version < '3.11'") {
		t.Error("missing Jinja2==2.11.3 marker for python_version < '3.11'")
	}
	if !strings.Contains(content, "Jinja2==3.1.6 ; python_version >= '3.11'") {
		t.Error("missing Jinja2==3.1.6 marker for python_version >= '3.11'")
	}
	if !strings.Contains(content, "markupsafe==1.1.1 ; python_version < '3.11'") {
		t.Error("missing markupsafe==1.1.1 marker for python_version < '3.11'")
	}
	if !strings.Contains(content, "markupsafe==3.0.3 ; python_version >= '3.11'") {
		t.Error("missing markupsafe==3.0.3 marker for python_version >= '3.11'")
	}
}

// ── Bootstrap step blocking ────────────────────────────────────────

func TestBootstrap_StepBlocking_FixFilePermissionsIsNonBlocking(t *testing.T) {
	repoRoot := filepath.Join("..", "..", "..", "..")
	if _, err := os.Stat(filepath.Join(repoRoot, "cli", "go", "internal", "bootstrap", "bootstrap.go")); os.IsNotExist(err) {
		repoRoot = "/Users/isaaceliape/repos/e3cnc"
	}
	data, err := os.ReadFile(filepath.Join(repoRoot, "cli", "go", "internal", "bootstrap", "bootstrap.go"))
	if err != nil {
		t.Fatalf("read bootstrap.go: %v", err)
	}
	if !strings.Contains(string(data), `"Fix file permissions", false`) {
		t.Error("Fix file permissions should be non-blocking (false)")
	}
}

// ── removeSupervisorConfigs ────────────────────────────────────────

func TestRemoveSupervisorConfigs_GlobSafe(t *testing.T) {
	tmpDir := t.TempDir()
	conf1 := filepath.Join(tmpDir, "e3cnc-default-moonraker.conf")
	conf2 := filepath.Join(tmpDir, "e3cnc-default-klipper.conf")
	other := filepath.Join(tmpDir, "other.conf")
	touchFile(t, conf1, "moonraker")
	touchFile(t, conf2, "klipper")
	touchFile(t, other, "other")
	var rms []string
	origExec := rootrun.Exec
	rootrun.Exec = func(name string, args ...string) ([]byte, error) {
		// RunAsRoot may call "rm" directly (if root) or "sudo -n rm" (if not root)
		if name == "rm" {
			rms = append(rms, args...)
		} else if name == "sudo" {
			for _, a := range args {
				if a == "rm" {
					// args are "-n rm -f <file>", capture the file args after rm
					for i, v := range args {
						if v == "rm" && i+2 < len(args) {
							rms = append(rms, args[i+2:]...)
						}
					}
				}
			}
		}
		return nil, nil
	}
	defer func() { rootrun.Exec = origExec }()
	pattern := filepath.Join(tmpDir, "e3cnc-default-*.conf")
	removeSupervisorConfigs(pattern)
	if len(rms) < 2 {
		t.Errorf("expected at least 2 rm args, got %v", rms)
	}
	for _, want := range []string{conf1, conf2} {
		found := false
		for _, got := range rms {
			if got == want {
				found = true
			}
			if strings.Contains(got, "*") {
				t.Errorf("rm arg should not contain literal *, got %q", got)
			}
		}
		if !found {
			t.Errorf("expected rm for %q, got %v", want, rms)
		}
	}
	for _, got := range rms {
		if got == other {
			t.Errorf("should not rm non-matching file %q", other)
		}
	}
}

func TestRemoveSupervisorConfigs_GlobNoMatchIsNoop(t *testing.T) {
	tmpDir := t.TempDir()
	pattern := filepath.Join(tmpDir, "e3cnc-nonexistent-*.conf")
	var called bool
	origExec := rootrun.Exec
	rootrun.Exec = func(name string, args ...string) ([]byte, error) {
		called = true
		return nil, nil
	}
	defer func() { rootrun.Exec = origExec }()
	removeSupervisorConfigs(pattern)
	if called {
		t.Error("should not call rm when glob has no matches")
	}
}

// ── detectTargetUser ───────────────────────────────────────────────

func TestDetectTargetUser_FallbackPi(t *testing.T) {
	origSudo := os.Getenv("SUDO_USER")
	origUser := os.Getenv("USER")
	os.Unsetenv("SUDO_USER")
	os.Setenv("USER", "root")
	defer os.Setenv("SUDO_USER", origSudo)
	defer os.Setenv("USER", origUser)
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", t.TempDir())
	defer os.Setenv("HOME", origHome)
	origUsersHome := usersHomeDir
	usersHomeDir = t.TempDir()
	defer func() { usersHomeDir = origUsersHome }()
	got := detectTargetUser()
	if got != "pi" {
		t.Errorf("expected fallback pi, got %q", got)
	}
}

func TestFixFilePermissions_UserLookupFailureIsNonBlocking(t *testing.T) {
	tmpDir := t.TempDir()
	home := filepath.Join(tmpDir, "home")
	os.MkdirAll(home, 0755)
	e3cncHome := filepath.Join(home, "E3CNC")
	touchFile(t, filepath.Join(e3cncHome, "test.txt"), "test")
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", home)
	defer os.Setenv("HOME", origHome)
	origSudo := os.Getenv("SUDO_USER")
	os.Setenv("SUDO_USER", "nonexistent-user-xyz-123")
	defer os.Setenv("SUDO_USER", origSudo)
	origTestHome := testE3CNCHome
	testE3CNCHome = e3cncHome
	defer func() { testE3CNCHome = origTestHome }()
	if err := fixFilePermissions(BootstrapConfig{}); err != nil {
		t.Errorf("fixFilePermissions should not fail on unknown user, got: %v", err)
	}
}
