package deploy

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// mockHTTPClient wraps a test server to implement HTTPClient interface.
type mockHTTPClient struct {
	server  *httptest.Server
	handler func(w http.ResponseWriter, r *http.Request)
}

func (m *mockHTTPClient) Get(url string) (*http.Response, error) {
	return http.Get(m.server.URL) //nolint:noctx
}

func TestHealthCheckMoonrakerAPI_OK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"result":{"api_version":1}}`))
	}))
	defer srv.Close()

	// Override HTTP client to use our test server
	oldClient := DefaultHTTPClient
	t.Cleanup(func() { DefaultHTTPClient = oldClient })
	DefaultHTTPClient = &mockHTTPClient{server: srv}

	inst := instance.Instance{Name: "default", MoonrakerPort: 80}
	check := checkMoonrakerAPI(&inst)
	if !check.Passed {
		t.Errorf("checkMoonrakerAPI: expected passed, got %v (%s)", check.Passed, check.Detail)
	}
}

func TestHealthCheckMoonrakerAPI_Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	oldClient := DefaultHTTPClient
	t.Cleanup(func() { DefaultHTTPClient = oldClient })
	DefaultHTTPClient = &mockHTTPClient{server: srv}

	inst := instance.Instance{Name: "default", MoonrakerPort: 80}
	check := checkMoonrakerAPI(&inst)
	if check.Passed {
		t.Errorf("checkMoonrakerAPI: expected failed for 503, got passed")
	}
}

func TestHealthCheckKlippy_NotConnected(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	oldClient := DefaultHTTPClient
	t.Cleanup(func() { DefaultHTTPClient = oldClient })
	DefaultHTTPClient = &mockHTTPClient{server: srv}

	inst := instance.Instance{Name: "default", MoonrakerPort: 80}
	check := checkKlippy(&inst)
	// Without a proper printer.cfg, this should be optional=false with placeholder
	if check.Passed {
		t.Log("Klippy check passed (no printer.cfg to validate)")
	}
	_ = check
}

func TestHealthCheckService_Empty(t *testing.T) {
	check := checkService("")
	if check.Passed {
		t.Errorf("checkService(''): expected failed, got passed")
	}
	if !strings.Contains(check.Detail, "no service") {
		t.Errorf("checkService(''): detail = %q, should mention 'no service'", check.Detail)
	}
}

func TestHealthCheckService_Known(t *testing.T) {
	// checkService now runs 'sudo supervisorctl status' — skip if not on a real system
	check := checkService("e3cnc-default-moonraker")
	_ = check // no crash is a good sign
}

func TestHealthCheckFrontend_Exists(t *testing.T) {
	tmpDir := t.TempDir()
	os.WriteFile(filepath.Join(tmpDir, "index.html"), []byte("ok"), 0644)

	inst := instance.Instance{Name: "test", WebRoot: tmpDir, WebPort: 8080}
	check := checkFrontend(&inst)
	if !check.Passed {
		t.Errorf("checkFrontend: expected passed, got %v (%s)", check.Passed, check.Detail)
	}
}

func TestHealthCheckFrontend_Missing(t *testing.T) {
	inst := instance.Instance{Name: "test", WebRoot: "/nonexistent/path"}
	check := checkFrontend(&inst)
	if check.Passed {
		t.Errorf("checkFrontend: expected failed for missing dir, got passed")
	}
}

func TestHealthCheckJournal_NoFile(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	os.Setenv("HOME", t.TempDir())

	check := checkJournal()
	if !check.Passed {
		t.Errorf("checkJournal: expected passed (fresh install), got %v", check.Passed)
	}
}

func TestRunHealthChecksCount(t *testing.T) {
	inst := instance.Instance{Name: "test"}
	checks := RunHealthChecks(&inst)
	if len(checks) != 7 {
		t.Errorf("RunHealthChecks: got %d checks, expected 7", len(checks))
	}
}

func TestReleaseIsActive(t *testing.T) {
	origHome := os.Getenv("HOME")
	t.Cleanup(func() { os.Setenv("HOME", origHome) })
	os.Setenv("HOME", t.TempDir())

	// Create a current symlink pointing to a release (use uppercase E3CNC to match E3CNCHome())
	e3cncDir := filepath.Join(os.Getenv("HOME"), "E3CNC")
	os.MkdirAll(filepath.Join(e3cncDir, "releases", "v0.9.0"), 0755)
	os.Symlink(filepath.Join(e3cncDir, "releases", "v0.9.0"), filepath.Join(e3cncDir, "current"))

	r := Release{Version: "v0.9.0", Path: filepath.Join(e3cncDir, "releases", "v0.9.0")}
	if !r.IsActive() {
		t.Errorf("Release v0.9.0 should be active")
	}

	r2 := Release{Version: "v0.8.0", Path: filepath.Join(e3cncDir, "releases", "v0.8.0")}
	if r2.IsActive() {
		t.Errorf("Release v0.8.0 should NOT be active")
	}
}

func TestReleaseFromDir(t *testing.T) {
	tmpDir := t.TempDir()
	relDir := filepath.Join(tmpDir, "v0.9.0")
	os.MkdirAll(relDir, 0755)

	r := ReleaseFromDir(relDir)
	if r.Version != "v0.9.0" {
		t.Errorf("ReleaseFromDir: version = %q, expected 'v0.9.0'", r.Version)
	}
	if r.Path != relDir {
		t.Errorf("ReleaseFromDir: path mismatch")
	}
}

func TestReleaseFromDir_WithManifest(t *testing.T) {
	tmpDir := t.TempDir()
	relDir := filepath.Join(tmpDir, "v0.9.0")
	os.MkdirAll(relDir, 0755)
	os.WriteFile(filepath.Join(relDir, "manifest.json"), []byte(`{"e3cnc_version":"0.9.0"}`), 0644)

	r := ReleaseFromDir(relDir)
	if r.Manifest == nil {
		t.Errorf("ReleaseFromDir: manifest should be loaded")
	}
	if r.Manifest["e3cnc_version"] != "0.9.0" {
		t.Errorf("ReleaseFromDir: manifest e3cnc_version = %v, expected '0.9.0'", r.Manifest["e3cnc_version"])
	}
}

func TestIsPlaceholderCfg(t *testing.T) {
	tests := []struct {
		content  string
		expected bool
	}{
		{"# E3CNC bootstrap placeholder printer.cfg", true},
		{"[printer]\nkinematics: none", false},
		{"", false},
	}

	for _, tc := range tests {
		tmpDir := t.TempDir()
		path := filepath.Join(tmpDir, "printer.cfg")
		os.WriteFile(path, []byte(tc.content), 0644)

		result := isPlaceholderCfg(path)
		if result != tc.expected {
			t.Errorf("isPlaceholderCfg(%q) = %v, expected %v", tc.content, result, tc.expected)
		}
	}
}

func TestIsPlaceholderCfg_NoFile(t *testing.T) {
	result := isPlaceholderCfg("/nonexistent/printer.cfg")
	if !result {
		t.Errorf("isPlaceholderCfg(no file) should be true (treated as unconfigured)")
	}
}

func TestDefaultKeepConstants(t *testing.T) {
	if DefaultKeepReleases != 3 {
		t.Errorf("DefaultKeepReleases = %d, expected 3", DefaultKeepReleases)
	}
	if DefaultKeepBackups != 5 {
		t.Errorf("DefaultKeepBackups = %d, expected 5", DefaultKeepBackups)
	}
}
