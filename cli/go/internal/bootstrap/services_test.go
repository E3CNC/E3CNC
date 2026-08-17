package bootstrap

import (
	"errors"
	"os"
	"strings"
	"testing"
)

// ── helpers ────────────────────────────────────────────────────────

// fakeRunner returns a runCommand override that executes the provided script
// against (name, args...) and returns the first matching (output, err).
type fakeRunner struct {
	script []fakeStep
	defOut []byte
	defErr error
}

type fakeStep struct {
	match func(name string, args []string) bool
	out   []byte
	err   error
}

func (f *fakeRunner) run(name string, args ...string) ([]byte, error) {
	for _, s := range f.script {
		if s.match(name, args) {
			return s.out, s.err
		}
	}
	return f.defOut, f.defErr
}

func argsEq(prefix string, rest ...string) func(string, []string) bool {
	return func(name string, args []string) bool {
		if name != "sudo" || len(args) < len(rest)+1 {
			return false
		}
		if args[0] != prefix {
			return false
		}
		for i, r := range rest {
			if args[i+1] != r {
				return false
			}
		}
		return true
	}
}

func withFakeRunner(t *testing.T, f *fakeRunner) {
	t.Helper()
	orig := runCommand
	runCommand = f.run
	t.Cleanup(func() { runCommand = orig })
}

func withFakeWriteFileSudo(t *testing.T, fn func(path, content string, mode os.FileMode) error) {
	t.Helper()
	orig := writeFileSudo
	writeFileSudo = fn
	t.Cleanup(func() { writeFileSudo = orig })
}

// withSystemd sets systemdRuntimeDir so systemdPresent() returns present (true)
// or absent (false) deterministically for the duration of the test.
func withSystemd(t *testing.T, present bool) {
	t.Helper()
	orig := systemdRuntimeDir
	if present {
		systemdRuntimeDir = t.TempDir()
	} else {
		systemdRuntimeDir = "/nonexistent-systemd-test"
	}
	t.Cleanup(func() { systemdRuntimeDir = orig })
}

// ── startBootstrapServices ─────────────────────────────────────────

func TestStartBootstrapServicesNoStartSkips(t *testing.T) {
	withFakeRunner(t, &fakeRunner{
		defErr: errors.New("should not be called"),
	})
	err := startBootstrapServices(BootstrapConfig{StartServices: false})
	if err != nil {
		t.Fatalf("expected nil for --no-start, got: %v", err)
	}
}

func TestStartBootstrapServicesSurfacesStartCommandError(t *testing.T) {
	withSystemd(t, true) // force systemctl start supervisor path
	f := &fakeRunner{
		defOut: []byte("failed to start supervisor unit"),
		defErr: errors.New("exit status 1"),
	}
	withFakeRunner(t, f)

	err := startBootstrapServices(BootstrapConfig{StartServices: true, InstanceName: "default"})
	if err == nil {
		t.Fatal("expected an error when systemctl start fails")
	}
	if !strings.Contains(err.Error(), "systemctl start supervisor") {
		t.Errorf("error should name the failing command, got: %v", err)
	}
	if !strings.Contains(err.Error(), "exit status 1") {
		t.Errorf("error should surface the underlying cause, got: %v", err)
	}
}

func TestStartBootstrapServicesSurfacesUpdateCommandError(t *testing.T) {
	withSystemd(t, true)
	f := &fakeRunner{
		script: []fakeStep{
			{
				match: argsEq("systemctl", "start", "supervisor"),
				out:   nil, err: nil,
			},
			{
				match: argsEq("supervisorctl", "reread"),
				out:   nil, err: nil,
			},
			{
				match: argsEq("supervisorctl", "update"),
				out:   []byte("config parse error"), err: errors.New("exit status 2"),
			},
		},
	}
	withFakeRunner(t, f)

	err := startBootstrapServices(BootstrapConfig{StartServices: true, InstanceName: "default"})
	if err == nil {
		t.Fatal("expected an error when supervisorctl update fails")
	}
	if !strings.Contains(err.Error(), "supervisorctl update") {
		t.Errorf("error should name supervisorctl update, got: %v", err)
	}
}

func TestStartBootstrapServicesSurfacesStatusQueryFailure(t *testing.T) {
	withSystemd(t, true)
	f := &fakeRunner{
		script: []fakeStep{
			{match: argsEq("systemctl", "start", "supervisor"), out: nil, err: nil},
			{match: argsEq("supervisorctl", "reread"), out: nil, err: nil},
			{match: argsEq("supervisorctl", "update"), out: nil, err: nil},
			{
				match: argsEq("supervisorctl", "status"),
				out:   []byte("supervisor not running"), err: errors.New("exit status 3"),
			},
		},
	}
	withFakeRunner(t, f)

	err := startBootstrapServices(BootstrapConfig{StartServices: true, InstanceName: "default"})
	if err == nil {
		t.Fatal("expected an error when supervisorctl status fails")
	}
	if !strings.Contains(err.Error(), "query supervisor status") {
		t.Errorf("error should mention the status query, got: %v", err)
	}
}

func TestStartBootstrapServicesReportsNotRunningServices(t *testing.T) {
	withSystemd(t, true)
	f := &fakeRunner{
		script: []fakeStep{
			{match: argsEq("systemctl", "start", "supervisor"), out: nil, err: nil},
			{match: argsEq("supervisorctl", "reread"), out: nil, err: nil},
			{match: argsEq("supervisorctl", "update"), out: nil, err: nil},
			{
				match: argsEq("supervisorctl", "status"),
				out: []byte(`e3cnc-default-moonraker             RUNNING   pid 1234, uptime 0:00:10
e3cnc-default-klipper               FATAL     Exited too quickly
`),
				err: nil,
			},
		},
	}
	withFakeRunner(t, f)

	err := startBootstrapServices(BootstrapConfig{StartServices: true, InstanceName: "default"})
	if err == nil {
		t.Fatal("expected an error when klipper is not running")
	}
	if !strings.Contains(err.Error(), "e3cnc-default-klipper") {
		t.Errorf("error should name the failed program, got: %v", err)
	}
	if strings.Contains(err.Error(), "e3cnc-default-moonraker") {
		t.Errorf("error should not list the running program, got: %v", err)
	}
}

func TestStartBootstrapServicesSucceedsWhenAllRunning(t *testing.T) {
	withSystemd(t, true)
	f := &fakeRunner{
		script: []fakeStep{
			{match: argsEq("systemctl", "start", "supervisor"), out: nil, err: nil},
			{match: argsEq("supervisorctl", "reread"), out: nil, err: nil},
			{match: argsEq("supervisorctl", "update"), out: nil, err: nil},
			{
				match: argsEq("supervisorctl", "status"),
				out: []byte(`e3cnc-default-moonraker             RUNNING   pid 1234, uptime 0:00:10
e3cnc-default-klipper               RUNNING   pid 2345, uptime 0:00:08
supervisorctl: process group is not managed
`),
				err: nil,
			},
		},
	}
	withFakeRunner(t, f)

	if err := startBootstrapServices(BootstrapConfig{StartServices: true, InstanceName: "default"}); err != nil {
		t.Fatalf("expected success when both services run, got: %v", err)
	}
}

// ── supervisorRunning ──────────────────────────────────────────────

func TestSupervisorRunning(t *testing.T) {
	status := `e3cnc-a-moonraker               RUNNING   pid 10, uptime 0:00:10
e3cnc-a-klipper                 FATAL     Exited too quickly
e3cnc-b-moonraker               STOPPED   Not started
`
	cases := []struct {
		prog string
		want bool
	}{
		{"e3cnc-a-moonraker", true},
		{"e3cnc-a-klipper", false},
		{"e3cnc-b-moonraker", false},
		{"e3cnc-c-moonraker", false}, // absent
	}
	for _, c := range cases {
		if got := supervisorRunning(status, c.prog); got != c.want {
			t.Errorf("supervisorRunning(%q) = %v, want %v", c.prog, got, c.want)
		}
	}
}

// ── installServices error propagation ─────────────────────────────

func TestInstallServicesPropagatesWriteError(t *testing.T) {
	boom := errors.New("permission denied")
	withFakeWriteFileSudo(t, func(path, content string, mode os.FileMode) error {
		if strings.Contains(path, "e3cnc-default-moonraker") {
			return boom
		}
		return nil
	})

	err := installServices(BootstrapConfig{InstanceName: "default"})
	if err == nil {
		t.Fatal("expected an error when writing the moonraker config fails")
	}
	if !strings.Contains(err.Error(), "e3cnc-default-moonraker") {
		t.Errorf("error should name the config that failed, got: %v", err)
	}
	if !errors.Is(err, boom) {
		t.Errorf("error should wrap the underlying cause, got: %v", err)
	}
}

func TestInstallServicesPropagatesKlipperWriteError(t *testing.T) {
	boom := errors.New("read-only filesystem")
	withFakeWriteFileSudo(t, func(path, content string, mode os.FileMode) error {
		if strings.Contains(path, "e3cnc-default-klipper") {
			return boom
		}
		return nil
	})

	err := installServices(BootstrapConfig{InstanceName: "default"})
	if err == nil {
		t.Fatal("expected an error when writing the klipper config fails")
	}
	if !strings.Contains(err.Error(), "e3cnc-default-klipper") {
		t.Errorf("error should name the config that failed, got: %v", err)
	}
}

func TestInstallServicesSucceedsWhenWritesSucceed(t *testing.T) {
	var paths []string
	withFakeWriteFileSudo(t, func(path, content string, mode os.FileMode) error {
		paths = append(paths, path)
		return nil
	})

	if err := installServices(BootstrapConfig{InstanceName: "default"}); err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if len(paths) != 2 {
		t.Errorf("expected 2 supervisor config writes, got %d: %v", len(paths), paths)
	}
}

// ── setupNginx error propagation ───────────────────────────────────

func nginxRunner(testErr error, reloadErr error) *fakeRunner {
	return &fakeRunner{
		script: []fakeStep{
			{match: argsEq("rm", "-f"), out: nil, err: nil},
			{match: argsEq("ln", "-sf"), out: nil, err: nil},
			{
				match: func(name string, args []string) bool {
					return name == "sudo" && len(args) == 2 && args[0] == "nginx" && args[1] == "-t"
				},
				out: []byte("nginx: [emerg] unknown directive"), err: testErr,
			},
			{
				match: func(name string, args []string) bool {
					return name == "sudo" && len(args) == 3 && args[0] == "nginx" && args[1] == "-s" && args[2] == "reload"
				},
				out: []byte("nginx: [error] reload failed"), err: reloadErr,
			},
		},
	}
}

func TestSetupNginxPropagatesConfigTestError(t *testing.T) {
	withFakeRunner(t, nginxRunner(errors.New("exit status 1"), nil))
	withFakeWriteFileSudo(t, func(path, content string, mode os.FileMode) error { return nil })

	err := setupNginx(BootstrapConfig{InstanceName: "default"})
	if err == nil {
		t.Fatal("expected an error when nginx -t fails")
	}
	if !strings.Contains(err.Error(), "nginx config test") {
		t.Errorf("error should mention the config test, got: %v", err)
	}
}

func TestSetupNginxPropagatesReloadError(t *testing.T) {
	withFakeRunner(t, nginxRunner(nil, errors.New("exit status 1")))
	withFakeWriteFileSudo(t, func(path, content string, mode os.FileMode) error { return nil })

	err := setupNginx(BootstrapConfig{InstanceName: "default"})
	if err == nil {
		t.Fatal("expected an error when nginx reload fails")
	}
	if !strings.Contains(err.Error(), "nginx reload") {
		t.Errorf("error should mention the reload, got: %v", err)
	}
}

func TestSetupNginxSucceedsWhenNginxOk(t *testing.T) {
	withFakeRunner(t, nginxRunner(nil, nil))
	withFakeWriteFileSudo(t, func(path, content string, mode os.FileMode) error { return nil })

	if err := setupNginx(BootstrapConfig{InstanceName: "default"}); err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
}
// ── systemd detection + container fallback ─────────────────────────

func TestSystemdPresent(t *testing.T) {
	withSystemd(t, true)
	if !systemdPresent() {
		t.Error("systemdPresent should be true after withSystemd(t, true)")
	}

	withSystemd(t, false)
	if systemdPresent() {
		t.Error("systemdPresent should be false after withSystemd(t, false)")
	}
}

func TestStartSupervisorCmdSystemdPath(t *testing.T) {
	withSystemd(t, true)
	cmd, err := startSupervisorCmd()
	if err != nil {
		t.Fatalf("startSupervisorCmd: %v", err)
	}
	if len(cmd) != 3 || cmd[0] != "systemctl" || cmd[1] != "start" || cmd[2] != "supervisor" {
		t.Errorf("expected systemctl start supervisor, got: %v", cmd)
	}
}

func TestStartSupervisorCmdContainerFallback(t *testing.T) {
	withSystemd(t, false)
	cmd, err := startSupervisorCmd()
	if err != nil {
		t.Fatalf("startSupervisorCmd: %v", err)
	}
	if len(cmd) != 3 || cmd[0] != "supervisord" || cmd[2] != "/etc/supervisor/supervisord.conf" {
		t.Errorf("expected supervisord -c /etc/supervisor/supervisord.conf, got: %v", cmd)
	}
}

func TestStartBootstrapServicesContainerUsesSupervisord(t *testing.T) {
	withSystemd(t, false) // container: no systemd
	var supervisordCalled bool
	f := &fakeRunner{
		script: []fakeStep{
			{
				match: func(name string, args []string) bool {
					if name == "sudo" && len(args) == 3 && args[0] == "supervisord" &&
						args[1] == "-c" && args[2] == "/etc/supervisor/supervisord.conf" {
						supervisordCalled = true
						return true
					}
					return false
				},
				out: nil, err: nil,
			},
			{match: argsEq("supervisorctl", "reread"), out: nil, err: nil},
			{match: argsEq("supervisorctl", "update"), out: nil, err: nil},
			{
				match: argsEq("supervisorctl", "status"),
				out: []byte(`e3cnc-default-moonraker             RUNNING   pid 1234, uptime 0:00:10
e3cnc-default-klipper               RUNNING   pid 2345, uptime 0:00:08
`),
				err: nil,
			},
		},
	}
	withFakeRunner(t, f)

	if err := startBootstrapServices(BootstrapConfig{StartServices: true, InstanceName: "default"}); err != nil {
		t.Fatalf("expected success via supervisord fallback, got: %v", err)
	}
	if !supervisordCalled {
		t.Error("expected supervisord to be invoked when systemd is absent")
	}
}

// ── setupSudoers self-validation ───────────────────────────────────

func TestValidateRuntimeSudoers_Valid(t *testing.T) {
	content := `biqu ALL=(root) NOPASSWD: /usr/bin/supervisorctl *
biqu ALL=(root) NOPASSWD: /usr/sbin/nginx -s reload
`
	if err := validateRuntimeSudoers(content); err != nil {
		t.Fatalf("expected valid sudoers, got: %v", err)
	}
}

func TestValidateRuntimeSudoers_MissingRule(t *testing.T) {
	content := `biqu ALL=(root) NOPASSWD: /usr/bin/supervisorctl *
`
	if err := validateRuntimeSudoers(content); err == nil {
		t.Fatal("expected an error when nginx reload rule is missing")
	}
}
