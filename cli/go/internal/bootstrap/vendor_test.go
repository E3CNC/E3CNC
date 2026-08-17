package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── helpers ────────────────────────────────────────────────────────

// stageRelease creates a fake release in ~/E3CNC/releases/<version> with
// vendored moonraker + klipper, then activates it as `current`.
func stageRelease(t *testing.T, version string) {
	t.Helper()

	relDir := filepath.Join(instance.ReleasesDir(), version)

	// Vendored Moonraker: marker is release/vendor/moonraker/moonraker/moonraker.py
	mr := filepath.Join(relDir, "vendor", "moonraker", "moonraker", "moonraker.py")
	if err := os.MkdirAll(filepath.Dir(mr), 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(mr, []byte("print('moonraker')"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}

	// Vendored Klipper: marker is release/vendor/klipper/klippy/klippy.py
	kl := filepath.Join(relDir, "vendor", "klipper", "klippy", "klippy.py")
	if err := os.MkdirAll(filepath.Dir(kl), 0755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(kl, []byte("print('klippy')"), 0644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if err := deploy.ActivateRelease(version); err != nil {
		t.Fatalf("activate release: %v", err)
	}
}

func withTempHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	orig := os.Getenv("HOME")
	os.Setenv("HOME", home)
	t.Cleanup(func() { os.Setenv("HOME", orig) })
	return home
}

// ── reproduction (field failure) ───────────────────────────────────
//
// On a fresh install ~/E3CNC/current does not exist yet, so the vendoring
// step fails with "no current release". This reproduces the exact error from
// the user's install log (RPi, first install):
//
//	✗ step 4 (Vendor Moonraker and Klipper) FAILED:
//	  no current release: readlink /root/E3CNC/current: no such file or directory
func TestCopyVendoredComponentsNoCurrentRelease(t *testing.T) {
	withTempHome(t)

	err := copyVendoredComponents(BootstrapConfig{InstanceName: "default"})
	if err == nil {
		t.Fatalf("expected an error when %s does not exist", instance.CurrentLink())
	}
	got := err.Error()
	if !strings.Contains(got, "no current release") ||
		!strings.Contains(got, instance.CurrentLink()) {
		t.Fatalf("expected 'no current release' error mentioning %s, got: %v",
			instance.CurrentLink(), got)
	}
}

// ── ensureCurrentRelease ───────────────────────────────────────────

func TestEnsureCurrentReleaseSkipsWhenCurrentExists(t *testing.T) {
	withTempHome(t)
	stageRelease(t, "1.0.0-test")

	called := false
	origFetcher := releaseFetcher
	releaseFetcher = func() error { called = true; return nil }
	defer func() { releaseFetcher = origFetcher }()

	if err := ensureCurrentRelease(); err != nil {
		t.Fatalf("ensureCurrentRelease should be a no-op when current exists: %v", err)
	}
	if called {
		t.Error("releaseFetcher should NOT be called when a current release exists")
	}
}

func TestEnsureCurrentReleaseDownloadsWhenMissing(t *testing.T) {
	home := withTempHome(t)

	called := false
	origFetcher := releaseFetcher
	releaseFetcher = func() error {
		called = true
		stageRelease(t, "1.0.0-test")
		return nil
	}
	defer func() { releaseFetcher = origFetcher }()

	if err := ensureCurrentRelease(); err != nil {
		t.Fatalf("ensureCurrentRelease failed: %v", err)
	}
	if !called {
		t.Fatal("releaseFetcher should be called when no current release exists")
	}

	target, err := os.Readlink(instance.CurrentLink())
	if err != nil {
		t.Fatalf("current symlink should exist after fetch: %v", err)
	}
	if !strings.Contains(target, "1.0.0-test") {
		t.Errorf("current should point at the staged release, got %q", target)
	}
	// The vendoring step must now work (the user's failure is gone).
	if err := copyVendoredComponents(BootstrapConfig{InstanceName: "default"}); err != nil {
		t.Fatalf("vendoring must succeed with an active release: %v", err)
	}
	if _, err := os.Stat(filepath.Join(home, "moonraker", "moonraker", "moonraker.py")); err != nil {
		t.Errorf("moonraker was not vendored to %s: %v", home, err)
	}
}

func TestEnsureCurrentReleaseSurfacesFetchError(t *testing.T) {
	withTempHome(t)

	boom := "GITHUB_RATE_LIMIT: simulated outage"
	origFetcher := releaseFetcher
	releaseFetcher = func() error { return fmt.Errorf("%s", boom) }
	defer func() { releaseFetcher = origFetcher }()

	err := ensureCurrentRelease()
	if err == nil {
		t.Fatal("expected an error when fetching the release fails")
	}
	if strings.Contains(err.Error(), "no current release") {
		t.Errorf("fresh-install failure should no longer be the opaque 'no current release' error; got: %v", err)
	}
	if !strings.Contains(err.Error(), boom) {
		t.Errorf("error should surface the underlying fetch failure; got: %v", err)
	}
}

// ── copyVendoredComponents ─────────────────────────────────────────

func TestCopyVendoredComponentsCopiesBothMoonrakerAndKlipper(t *testing.T) {
	home := withTempHome(t)
	stageRelease(t, "1.0.0-test")

	if err := copyVendoredComponents(BootstrapConfig{InstanceName: "default"}); err != nil {
		t.Fatalf("copyVendoredComponents failed: %v", err)
	}

	for _, want := range []string{
		filepath.Join(home, "moonraker", "moonraker", "moonraker.py"),
		filepath.Join(home, "klipper", "klippy", "klippy.py"),
	} {
		if _, err := os.Stat(want); err != nil {
			t.Errorf("expected vendored file %s: %v", want, err)
		}
	}
}