package bootstrap

import (
	"os"
	"testing"
)

// ── Test: DetectPackageManager ────────────────────────────────────

func TestDetectPackageManager_aptGet(t *testing.T) {
	origLookPath := lookPath
	lookPath = func(name string) (string, error) {
		if name == "apt-get" { return "/usr/bin/apt-get", nil }
		return "", os.ErrNotExist
	}
	defer func() { lookPath = origLookPath }()

	label, pm, err := DetectPackageManager()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if label != "deb" {
		t.Errorf("expected label 'deb', got '%s'", label)
	}
	if _, ok := pm.(*AptManager); !ok {
		t.Error("expected AptManager, got wrong type")
	}
}

func TestDetectPackageManager_dnf(t *testing.T) {
	origLookPath := lookPath
	lookPath = func(name string) (string, error) {
		if name == "dnf" { return "/usr/bin/dnf", nil }
		return "", os.ErrNotExist
	}
	defer func() { lookPath = origLookPath }()

	label, pm, err := DetectPackageManager()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if label != "fedora" {
		t.Errorf("expected label 'fedora', got '%s'", label)
	}
	if _, ok := pm.(*DnfManager); !ok {
		t.Error("expected DnfManager, got wrong type")
	}
}

func TestDetectPackageManager_pacman(t *testing.T) {
	origLookPath := lookPath
	lookPath = func(name string) (string, error) {
		if name == "pacman" { return "/usr/bin/pacman", nil }
		return "", os.ErrNotExist
	}
	defer func() { lookPath = origLookPath }()

	label, pm, err := DetectPackageManager()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if label != "arch" {
		t.Errorf("expected label 'arch', got '%s'", label)
	}
	if _, ok := pm.(*PacmanManager); !ok {
		t.Error("expected PacmanManager, got wrong type")
	}
}

func TestDetectPackageManager_zypper(t *testing.T) {
	origLookPath := lookPath
	lookPath = func(name string) (string, error) {
		if name == "zypper" { return "/usr/bin/zypper", nil }
		return "", os.ErrNotExist
	}
	defer func() { lookPath = origLookPath }()

	label, pm, err := DetectPackageManager()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if label != "opensuse" {
		t.Errorf("expected label 'opensuse', got '%s'", label)
	}
	if _, ok := pm.(*ZypperManager); !ok {
		t.Error("expected ZypperManager, got wrong type")
	}
}

func TestDetectPackageManager_apk(t *testing.T) {
	origLookPath := lookPath
	lookPath = func(name string) (string, error) {
		if name == "apk" { return "/usr/bin/apk", nil }
		return "", os.ErrNotExist
	}
	defer func() { lookPath = origLookPath }()

	label, pm, err := DetectPackageManager()
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if label != "alpine" {
		t.Errorf("expected label 'alpine', got '%s'", label)
	}
	if _, ok := pm.(*ApkManager); !ok {
		t.Error("expected ApkManager, got wrong type")
	}
}

func TestDetectPackageManager_unsupported(t *testing.T) {
	origLookPath := lookPath
	lookPath = func(name string) (string, error) {
		return "", os.ErrNotExist
	}
	defer func() { lookPath = origLookPath }()

	_, _, err := DetectPackageManager()
	if err == nil {
		t.Fatal("expected error for unsupported PM, got nil")
	}
}

// ── Test: Resolution ──────────────────────────────────────────────

func TestAptResolve_python3Venv(t *testing.T) {
	pm := &AptManager{}
	resolved := pm.Resolve([]string{"python3-venv"})
	got := resolved["python3-venv"]
	want := []string{"python3-venv"}
	assertEqualStrings(t, "AptManager python3-venv", want, got)
}

func TestDnfResolve_python3Venv(t *testing.T) {
	pm := &DnfManager{}
	resolved := pm.Resolve([]string{"python3-venv"})
	got := resolved["python3-venv"]
	want := []string{"python3-virtualenv"} // Fedora uses virtualenv
	assertEqualStrings(t, "DnfManager python3-venv", want, got)
}

func TestDnfResolve_libsslDev(t *testing.T) {
	pm := &DnfManager{}
	resolved := pm.Resolve([]string{"libssl-dev"})
	got := resolved["libssl-dev"]
	want := []string{"openssl-devel"} // NOT libssl-devel!
	assertEqualStrings(t, "DnfManager libssl-dev", want, got)
}

func TestPacmanResolve_buildEssential(t *testing.T) {
	pm := &PacmanManager{}
	resolved := pm.Resolve([]string{"build-essential"})
	got := resolved["build-essential"]
	want := []string{"base-devel"} // meta-group
	assertEqualStrings(t, "PacmanManager build-essential", want, got)
}

func TestPacmanResolve_python3Dev(t *testing.T) {
	pm := &PacmanManager{}
	resolved := pm.Resolve([]string{"python3-dev"})
	got := resolved["python3-dev"]
	want := []string{} // Arch bundles dev headers in base python
	assertEqualStrings(t, "PacmanManager python3-dev", want, got)
}

func TestZypperResolve_libsslDev(t *testing.T) {
	pm := &ZypperManager{}
	resolved := pm.Resolve([]string{"libssl-dev"})
	got := resolved["libssl-dev"]
	want := []string{"openssl-devel"}
	assertEqualStrings(t, "ZypperManager libssl-dev", want, got)
}

func TestApkResolve_libsslDev(t *testing.T) {
	pm := &ApkManager{}
	resolved := pm.Resolve([]string{"libssl-dev"})
	got := resolved["libssl-dev"]
	want := []string{"openssl-dev"}
	assertEqualStrings(t, "ApkManager libssl-dev", want, got)
}

func TestGenericResolve_universal_passthrough(t *testing.T) {
	pm := &AptManager{}
	resolved := pm.Resolve([]string{"git", "curl", "nginx"})
	for _, pkg := range []string{"git", "curl", "nginx"} {
		got := resolved[pkg]
		want := []string{pkg}
		assertEqualStrings(t, pkg+" passthrough", want, got)
	}
}

func TestYumResolve_python3Venv(t *testing.T) {
	pm := &YumManager{}
	resolved := pm.Resolve([]string{"python3-venv"})
	got := resolved["python3-venv"]
	want := []string{"python3-virtualenv"} // RHEL family uses virtualenv
	assertEqualStrings(t, "YumManager python3-venv", want, got)
}

// ── Test: AllPackages consistency ─────────────────────────────────

func TestAllPackages_notEmpty(t *testing.T) {
	pkgs := AllPackages()
	if len(pkgs) == 0 {
		t.Fatal("AllPackages returned empty list")
	}
	if len(pkgs) < 10 {
		t.Errorf("expected >=10 packages, got %d", len(pkgs))
	}
	// Verify known-included packages are present
	expected := map[string]bool{
		"git": true, "curl": true, "nginx": true, "supervisor": true,
		"python3": true, "build-essential": true, "libssl-dev": true,
	}
	for _, pkg := range pkgs {
		delete(expected, pkg)
	}
	if len(expected) > 0 {
		t.Errorf("missing expected packages: %v", expected)
	}
}

// ── Helper ────────────────────────────────────────────────────────

func assertEqualStrings(t *testing.T, label string, want, got []string) {
	t.Helper()
	if len(want) != len(got) {
		t.Errorf("%s: expected %v, got %v (length mismatch)", label, want, got)
		return
	}
	for i := range want {
		if want[i] != got[i] {
			t.Errorf("%s[%d]: expected %q, got %q", label, i, want[i], got[i])
		}
	}
}
