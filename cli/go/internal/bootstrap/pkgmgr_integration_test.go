package bootstrap

// Integration tests for real package manager detection and resolution.
// These run inside Docker containers for each target distro. They are
// gated behind the E3CNC_INTEGRATION_TEST env var so normal `go test`
// runs (macOS/CI without the PMs) are unaffected.
//
// Usage (from repo root):
//
//	# build a static linux/amd64 test binary
//	cd cli/go && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
//	    go test -c -o /tmp/pkgmgr-bootstrap.test ./internal/bootstrap/
//
//	# run inside a distro container, passing the expected PM label
//	docker run --rm -v /tmp/pkgmgr-bootstrap.test:/pkgmgr.test \
//	    <image> bash -c 'E3CNC_INTEGRATION_TEST=1 E3CNC_EXPECT_PM=deb \
//	    /pkgmgr.test -test.run TestIntegration -test.v'

import (
	"os"
	"strings"
	"testing"
)

func integrationEnabled() bool {
	return os.Getenv("E3CNC_INTEGRATION_TEST") == "1"
}

func expectPM() string {
	return os.Getenv("E3CNC_EXPECT_PM")
}

// TestIntegrationDetect verifies DetectPackageManager returns the PM
// matching the distro the container is running (E3CNC_EXPECT_PM).
func TestIntegrationDetect(t *testing.T) {
	if !integrationEnabled() {
		t.Skip("integration test: set E3CNC_INTEGRATION_TEST=1")
	}
	want := expectPM()
	if want == "" {
		t.Fatal("E3CNC_EXPECT_PM must be set for integration test")
	}

	label, pm, err := DetectPackageManager()
	if err != nil {
		t.Fatalf("DetectPackageManager: %v", err)
	}
	if label != want {
		t.Errorf("detected PM label = %q, want %q", label, want)
	}
	if pm == nil {
		t.Error("DetectPackageManager returned nil implementation")
	}
	t.Logf("Detected package manager: %s", label)
}

// TestIntegrationInstall verifies the real Install() command path works on
// the running distro by installing a small, widely-available package
// (figlet) and confirming it's present afterwards. This exercises the
// per-distro command flags (apt-get -y, dnf --allowerasing, etc.) end-to-end.
func TestIntegrationInstall(t *testing.T) {
	if !integrationEnabled() {
		t.Skip("integration test: set E3CNC_INTEGRATION_TEST=1")
	}
	_, pm, err := DetectPackageManager()
	if err != nil {
		t.Fatalf("DetectPackageManager: %v", err)
	}

	// figlet exists in all supported distro repos; use it as the probe.
	const probe = "figlet"

	// If already installed, nothing to verify — pick a second probe.
	if pm.Find(probe) {
		t.Skipf("%s already installed; skipping install probe", probe)
	}

	msgs, err := pm.Install([]string{probe})
	if err != nil {
		t.Fatalf("Install(%q): %v", probe, err)
	}
	t.Logf("Install messages: %v", msgs)

	if !pm.Find(probe) {
		t.Errorf("Find(%q) = false after Install; package not actually installed", probe)
	} else {
		t.Logf("Find(%q) = true ✓ (installed)", probe)
	}
}

// TestIntegrationResolve verifies the key distro-specific renames are
// applied for the running distro. Expected resolutions are passed as
// E3CNC_EXPECT_RESOLVE in the form "generic=resolved;generic2=resolved2".
func TestIntegrationResolve(t *testing.T) {
	if !integrationEnabled() {
		t.Skip("integration test: set E3CNC_INTEGRATION_TEST=1")
	}
	_, pm, err := DetectPackageManager()
	if err != nil {
		t.Fatalf("DetectPackageManager: %v", err)
	}

	expected := os.Getenv("E3CNC_EXPECT_RESOLVE")
	if expected == "" {
		t.Fatal("E3CNC_EXPECT_RESOLVE must be set for integration test")
	}

	for _, pair := range strings.Split(expected, ";") {
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) != 2 {
			t.Fatalf("bad E3CNC_EXPECT_RESOLVE pair: %q", pair)
		}
		generic, want := parts[0], parts[1]

		resolved := pm.Resolve([]string{generic})
		got := resolved[generic]
		gotStr := strings.Join(got, ",")
		if gotStr != want {
			t.Errorf("Resolve(%q) = %q, want %q", generic, gotStr, want)
		} else {
			t.Logf("Resolve(%q) = %q ✓", generic, gotStr)
		}
	}
}
