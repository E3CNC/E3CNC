package bootstrap

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
	"github.com/E3CNC/e3cnc/cli/go/internal/rootrun"
)

// runCommand executes a command (typically via sudo) and returns its combined
// output and error. It is a package-private seam so tests can simulate
// supervisor/systemctl/nginx behaviour without a real system, mirroring the
// established `releaseFetcher` pattern in release.go.
//
// When the first argument is "sudo", the default implementation routes the
// remaining command through rootrun.RunAsRoot (non-interactive, fail-fast).
var runCommand = func(name string, args ...string) ([]byte, error) {
	if name == "sudo" {
		return rootrun.RunAsRoot(args...)
	}
	cmd := exec.Command(name, args...)
	return cmd.CombinedOutput()
}

// ── step implementations ──────────────────────────────────────────

// installSystemPackages detects the installed package manager, resolves
// generic package names to distro-specific equivalents, and installs them.
// The list of required packages comes from AllPackages() in pkgdb.go.
//
// Supported distributions and their package managers:
//   • Debian/Ubuntu     → apt-get (deb)
//   • Fedora/RHEL/Rocky → dnf    (fedora/rhel8+)
//   • Legacy RHEL/CentOS → yum   (rhel8+ fallback)
//   • Arch Linux        → pacman (arch)
//   • openSUSE/SLES     → zypper (opensuse)
//   • Alpine Linux      → apk    (alpine)
func installSystemPackages() error {
	// Early compatibility check before any system modifications.
	if err := CheckDistroCompatibility(); err != nil {
		return err
	}

	label, pm, err := DetectPackageManager()
	if err != nil {
		return fmt.Errorf("detect package manager: %w", err)
	}
	fmt.Printf("  Detected package manager: %s\n", label)

	packages := AllPackages()
	msgs, err := pm.Install(packages)
	if err != nil {
		return fmt.Errorf("install packages: %w", err)
	}
	for _, msg := range msgs {
		fmt.Println("  ", msg)
	}
	return nil
}

// detectTargetUser returns the non-root username that should own the E3CNC
// runtime files and services. It prefers SUDO_USER (the user who invoked sudo),
// then $USER, then scans /home for the first real user, falling back to "pi".
func detectTargetUser() string {
	if u := os.Getenv("SUDO_USER"); u != "" {
		return u
	}
	if u := os.Getenv("USER"); u != "" && u != "root" {
		return u
	}
	// Scan /home for the first non-root user directory
	if entries, err := os.ReadDir("/home"); err == nil {
		for _, e := range entries {
			if e.IsDir() && e.Name() != "root" {
				return e.Name()
			}
		}
	}
	return "pi"
}

func setupSudoers() error {
	user := detectTargetUser()
	content := fmt.Sprintf(`# E3CNC — passwordless sudo for process management
%s ALL=(root) NOPASSWD: /usr/bin/supervisorctl *
%s ALL=(root) NOPASSWD: /usr/bin/tee /etc/supervisor/conf.d/e3cnc-*.conf
%s ALL=(root) NOPASSWD: /bin/ln -sf /etc/nginx/sites-* /etc/nginx/sites-enabled/*
%s ALL=(root) NOPASSWD: /bin/rm /etc/supervisor/conf.d/e3cnc-*.conf
%s ALL=(root) NOPASSWD: /bin/systemctl start supervisor
%s ALL=(root) NOPASSWD: /usr/sbin/nginx -s reload
`, user, user, user, user, user, user)

	path := "/etc/sudoers.d/e3cnc"

	// Self-validate: the generated rules must cover the runtime operations the
	// TUI will issue as the normal user (Context B). This catches gaps during
	// install rather than mid-session when supervisorctl/nginx would prompt.
	if err := validateRuntimeSudoers(content); err != nil {
		return err
	}

	if _, err := os.Stat(path); err == nil {
		return nil // already exists
	}
	return writeFileSudo(path, content, 0440)
}

// validateRuntimeSudoers checks that the generated sudoers content includes
// the NOPASSWD rules required by the runtime (Context B) operations: the
// supervisorctl commands and the nginx reload. It is defensive hardening so a
// missing rule surfaces at install time instead of a mid-session sudo failure
// in the TUI.
func validateRuntimeSudoers(content string) error {
	required := []string{
		"/usr/bin/supervisorctl *",
		"/usr/sbin/nginx -s reload",
	}
	for _, rule := range required {
		if !strings.Contains(content, rule) {
			return fmt.Errorf("sudoers config missing required runtime rule: %q", rule)
		}
	}
	return nil
}

func createDirectories(cfg BootstrapConfig) error {
	home := effectiveHome()
	inst := filepath.Join(instance.InstancesDir(), cfg.InstanceName)
	dirs := []string{
		filepath.Join(inst, "data", "config"),
		filepath.Join(inst, "data", "scripts"),
		filepath.Join(inst, "data", "logs"),
		filepath.Join(inst, "data", "comms"),
		filepath.Join(inst, "data", "database"),
		filepath.Join(inst, "data", "gcodes"),
		filepath.Join(inst, "frontend"),
		filepath.Join(inst, "data", "config", "E3CNC", "macros"),
		home + "/moonraker",
		home + "/klipper",
		instance.E3CNCHome() + "/admin",
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0755); err != nil {
			return fmt.Errorf("mkdir %s: %w", d, err)
		}
	}
	return nil
}

func CopyVendoredComponents(cfg BootstrapConfig) error {
	home := effectiveHome()
	currentTarget, err := os.Readlink(instance.CurrentLink())
	if err != nil {
		return fmt.Errorf("no current release: %w", err)
	}

	moonrakerSrc := filepath.Join(currentTarget, "vendor", "moonraker")
	klipperSrc := filepath.Join(currentTarget, "vendor", "klipper")

	// Each source dir is identified by a component-specific marker file so
	// both Moonraker and Klipper are vendored. (Previously the klipper pair
	// reused the moonraker marker, so klipper was silently never copied.)
	pairs := []struct {
		src    string
		marker string
		dst    string
	}{
		{moonrakerSrc, filepath.Join("moonraker", "moonraker.py"), home + "/moonraker"},
		{klipperSrc, filepath.Join("klippy", "klippy.py"), home + "/klipper"},
	}
	for _, pair := range pairs {
		if _, err := os.Stat(filepath.Join(pair.src, pair.marker)); err != nil {
			continue
		}
		cmd := exec.Command("cp", "-r", pair.src+"/.", pair.dst+"/")
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("copy %s: %w", pair.src, err)
		}
	}
	return nil
}

func createVirtualenvs(cfg BootstrapConfig) error {
	home := effectiveHome()
	type component struct {
		dir       string   // source directory
		reqs      []string // arguments to pip install (requirements file, package dir)
	}
	components := []component{
		{home + "/moonraker", []string{"-r", "scripts/moonraker-requirements.txt"}},
		{home + "/klipper", []string{"-r", "scripts/klippy-requirements.txt"}},
	}

	// Offline wheels are now the default: if the current release bundles
	// wheels/ with .whl files, use --no-index --find-links for a fully
	// offline pip install (no network, no compile fallback).
	wheelsDir := ""
	if target, err := os.Readlink(instance.CurrentLink()); err == nil {
		candidate := filepath.Join(target, "wheels")
		if fi, err := os.Stat(candidate); err == nil && fi.IsDir() && hasWheels(candidate) {
			wheelsDir = candidate
			fmt.Printf("  Using offline wheels: %s\n", wheelsDir)
			InstallLogf("Using offline wheels: %s", wheelsDir)
		}
	}

	for _, c := range components {
		venvDir := filepath.Join(c.dir, "venv")
		venvPip := filepath.Join(venvDir, "bin", "pip")
		venvPython := filepath.Join(venvDir, "bin", "python")

		// Create the virtualenv if it doesn't exist yet.
		if _, err := os.Stat(venvPython); err != nil {
			cmd := exec.Command("python3", "-m", "venv", venvDir)
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("venv %s: %w", c.dir, err)
			}
		}

		// Install from requirements files (avoids pdm-backend SCM .git detection).
		var args []string
		if wheelsDir != "" {
			args = append([]string{"install", "--disable-pip-version-check", "--no-index", "--find-links", wheelsDir}, c.reqs...)
		} else {
			args = append([]string{"install", "--disable-pip-version-check"}, c.reqs...)
		}
		cmd := exec.Command(venvPip, args...)
		cmd.Dir = c.dir
		cmd.Stderr = os.Stderr
		cmd.Stdout = os.Stdout
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("pip install deps in %s: %w", c.dir, err)
		}
	}
	return nil
}

// hasWheels reports whether dir contains at least one .whl or .tar.gz.
func hasWheels(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if !e.IsDir() && (strings.HasSuffix(e.Name(), ".whl") || strings.HasSuffix(e.Name(), ".tar.gz")) {
			return true
		}
	}
	return false
}

func generateConfigs(cfg BootstrapConfig) error {
	inst := filepath.Join(instance.InstancesDir(), cfg.InstanceName)
	configDir := filepath.Join(inst, "data", "config")

	moonrakerConf := filepath.Join(configDir, "moonraker.conf")
	if _, err := os.Stat(moonrakerConf); os.IsNotExist(err) {
		content := fmt.Sprintf(`[server]
host: 0.0.0.0
port: %d
klippy_uds_address: %s/data/comms/klippy.sock

[file_manager]
config_path: %s/data/config

[database]
database_path: %s/data/database

[authorization]
cors_domains:
    *
trusted_clients:
    127.0.0.1
    ::1

[cnc_agent]
[cnc_metadata]
extractor_path: %s/data/scripts/cnc_metadata_extractor.py
`, cfg.MoonrakerPort, inst, inst, inst, inst)
		if err := os.WriteFile(moonrakerConf, []byte(content), 0644); err != nil {
			return err
		}
	}

	printerCfg := filepath.Join(configDir, "printer.cfg")
	if _, err := os.Stat(printerCfg); os.IsNotExist(err) {
		// Auto-detect MCU serial path — prefer /dev/serial/by-id/ for
		// persistent naming that survives USB port changes.
		mcuPath := detectMCUPath()
		serialLine := "serial: " + mcuPath
		if mcuPath == "" {
			serialLine = "# serial: /dev/serial/by-id/<your-mcu>  # <-- ADJUST THIS"
		}

		content := fmt.Sprintf(`# E3CNC bootstrap placeholder printer.cfg
# Replace this file with your real machine configuration.

[printer]
kinematics: none
max_velocity: 100
max_accel: 100

[mcu]
%s

[force_move]
enable_force_move: True
`, serialLine)
		if err := os.WriteFile(printerCfg, []byte(content), 0644); err != nil {
			return err
		}
	}

	return nil
}

func installServices(cfg BootstrapConfig) error {
	home := effectiveHome()
	inst := filepath.Join(instance.InstancesDir(), cfg.InstanceName)
	printerCfg := filepath.Join(inst, "data", "config", "printer.cfg")

	user := detectTargetUser()
	moonrakerName := fmt.Sprintf("e3cnc-%s-moonraker", cfg.InstanceName)
	klipperName := fmt.Sprintf("e3cnc-%s-klipper", cfg.InstanceName)

	// Supervisor program config for Moonraker
	moonrakerCfg := fmt.Sprintf(`[program:%[1]s]
command=%[2]s/moonraker/venv/bin/python %[2]s/moonraker/moonraker/moonraker.py -d %[3]s/data
directory=%[2]s/moonraker
user=%[4]s
autostart=true
autorestart=true
startretries=3
startsecs=10
stderr_logfile=/var/log/supervisor/%%(program_name)s.err.log
stdout_logfile=/var/log/supervisor/%%(program_name)s.out.log
`, moonrakerName, home, inst, user)

	if err := writeFileSudo(fmt.Sprintf("/etc/supervisor/conf.d/%s.conf", moonrakerName), moonrakerCfg, 0644); err != nil {
		return fmt.Errorf("write supervisor config %s: %w", moonrakerName, err)
	}

	// Supervisor program config for Klipper
	klipperCfg := fmt.Sprintf(`[program:%[1]s]
command=%[2]s/klipper/venv/bin/python %[2]s/klipper/klippy/klippy.py %[3]s -I %[4]s/data/comms/klippy.serial -l %[4]s/data/logs/klipper.log -a %[4]s/data/comms/klippy.sock
directory=%[2]s/klipper
user=%[5]s
autostart=true
autorestart=true
startretries=3
startsecs=10
stderr_logfile=/var/log/supervisor/%%(program_name)s.err.log
stdout_logfile=/var/log/supervisor/%%(program_name)s.out.log
`, klipperName, home, printerCfg, inst, user)

	if err := writeFileSudo(fmt.Sprintf("/etc/supervisor/conf.d/%s.conf", klipperName), klipperCfg, 0644); err != nil {
		return fmt.Errorf("write supervisor config %s: %w", klipperName, err)
	}

	return nil
}

func setupNginx(cfg BootstrapConfig) error {
	nginxName := fmt.Sprintf("e3cnc-%s", cfg.InstanceName)
	inst := filepath.Join(instance.InstancesDir(), cfg.InstanceName)
	webRoot := filepath.Join(inst, "frontend")

	config := fmt.Sprintf(`server {
	listen %d;
	listen [::]:%d;
	server_name %s.local;
	root %s;
	index index.html;

	location / {
		try_files $uri $uri/ /index.html;
	}

	location /websocket {
		proxy_pass http://127.0.0.1:%d/websocket;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_read_timeout 86400;
	}

	location /printer/ { proxy_pass http://127.0.0.1:%d/printer/; proxy_set_header Host $host; }
	location /api/     { proxy_pass http://127.0.0.1:%d/api/;     proxy_set_header Host $host; }
	location /server/  { proxy_pass http://127.0.0.1:%d/server/;  proxy_set_header Host $host; }
	location /machine/ { proxy_pass http://127.0.0.1:%d/machine/; proxy_set_header Host $host; }
	location /access/  { proxy_pass http://127.0.0.1:%d/access/;  proxy_set_header Host $host; }

	location /admin {
		alias %s/admin;
		index index.html;
	}
}
`, cfg.WebPort, cfg.WebPort, nginxName, webRoot,
		cfg.MoonrakerPort, cfg.MoonrakerPort, cfg.MoonrakerPort,
		cfg.MoonrakerPort, cfg.MoonrakerPort, cfg.MoonrakerPort, instance.E3CNCHome())

	avail := fmt.Sprintf("/etc/nginx/sites-available/%s", nginxName)
	enabled := fmt.Sprintf("/etc/nginx/sites-enabled/%s", nginxName)

	if err := writeFileSudo(avail, config, 0644); err != nil {
		return fmt.Errorf("write nginx config %s: %w", avail, err)
	}
	runCommand("sudo", "rm", "-f", enabled)
	runCommand("sudo", "ln", "-sf", avail, enabled)

	if out, err := runCommand("sudo", "nginx", "-t"); err != nil {
		return fmt.Errorf("nginx config test: %w (output: %s)",
			err, strings.TrimSpace(string(out)))
	}

	// Start nginx if not already running, then reload to pick up new config.
	if _, err := runCommand("sudo", "pgrep", "-x", "nginx"); err != nil {
		// nginx not running — start it.
		if out, err := runCommand("sudo", "nginx"); err != nil {
			return fmt.Errorf("nginx start: %w (output: %s)",
				err, strings.TrimSpace(string(out)))
		}
	} else {
		// nginx is running — reload to pick up new site.
		if out, err := runCommand("sudo", "nginx", "-s", "reload"); err != nil {
			return fmt.Errorf("nginx reload: %w (output: %s)",
				err, strings.TrimSpace(string(out)))
		}
	}
	return nil
}

func setupAvahi(cfg BootstrapConfig) error {
	avahiName := fmt.Sprintf("e3cnc-%s-avahi", cfg.InstanceName)
	unit := fmt.Sprintf(`[program:%[1]s]
command=/usr/bin/avahi-publish -a %[2]s.local
user=nobody
autostart=true
autorestart=true
startretries=2
stderr_logfile=/var/log/supervisor/%%(program_name)s.err.log
stdout_logfile=/var/log/supervisor/%%(program_name)s.out.log
`, avahiName, cfg.Hostname)

	writeFileSudo(fmt.Sprintf("/etc/supervisor/conf.d/%s.conf", avahiName), unit, 0644)
	return nil
}

func startBootstrapServices(cfg BootstrapConfig) error {
	if !cfg.StartServices {
		fmt.Println("  Skipping service start (--no-start)")
		return nil
	}

	// Start the supervisor daemon. On real hardware systemd manages it; in
	// containers (no systemd) fall back to starting supervisord directly.
	startCmd, err := startSupervisorCmd()
	if err != nil {
		return err
	}
	args := append([]string{"sudo"}, startCmd...)
	if out, err := runCommand(args[0], args[1:]...); err != nil {
		return fmt.Errorf("start services: %s: %w (output: %s)",
			strings.Join(startCmd, " "), err, strings.TrimSpace(string(out)))
	}

	// Load all E3CNC supervisor configs.
	// Fail fast: surface the failing command instead of silently passing.
	loadCmds := [][]string{
		{"supervisorctl", "reread"},
		{"supervisorctl", "update"},
	}
	for _, c := range loadCmds {
		args := append([]string{"sudo"}, c...)
		if out, err := runCommand(args[0], args[1:]...); err != nil {
			return fmt.Errorf("start services: %s: %w (output: %s)",
				strings.Join(c, " "), err, strings.TrimSpace(string(out)))
		}
	}

	// Verify the instance's Moonraker and Klipper services actually started.
	// Programs may take a few seconds to transition from STARTING → RUNNING,
	// so poll up to 15 seconds with 2-second intervals.
	progName := "e3cnc-" + cfg.InstanceName
	progs := []string{progName + "-moonraker", progName + "-klipper"}

	const maxAttempts = 8 // 8 × 2s = 16s total
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if attempt > 1 {
			time.Sleep(2 * time.Second)
		}
		out, err := runCommand("sudo", "supervisorctl", "status")
		statusStr := string(out)

		// If supervisorctl itself failed and produced no recognizable program
		// lines, report it as a query failure rather than "not running".
		if err != nil && !strings.Contains(statusStr, "RUNNING") &&
			!strings.Contains(statusStr, "FATAL") && !strings.Contains(statusStr, "STARTING") &&
			!strings.Contains(statusStr, "STOPPED") {
			return fmt.Errorf("start services: query supervisor status: %w", err)
		}

		// Parse the output to check our specific programs.
		var notRunning []string
		for _, p := range progs {
			if !supervisorRunning(statusStr, p) {
				notRunning = append(notRunning, p)
			}
		}
		if len(notRunning) == 0 {
			return nil // All services RUNNING
		}
		if attempt < maxAttempts {
			continue // Retry
		}
		// Final attempt failed — report which services are still not RUNNING.
		return fmt.Errorf("start services: not running: %s", strings.Join(notRunning, ", "))
	}

	return nil
}

// systemdRuntimeDir is where systemd's runtime state lives when systemd is
// the active init. Exposed as a package var so tests can simulate both init
// regimes without a real systemd.
var systemdRuntimeDir = "/run/systemd/system"

// systemdPresent reports whether systemd is the active init (real hardware)
// versus a container lacking systemd. Used by startBootstrapServices to decide
// how to start the supervisor daemon.
func systemdPresent() bool {
	fi, err := os.Stat(systemdRuntimeDir)
	return err == nil && fi.IsDir()
}

// startSupervisorCmd returns the command used to start the supervisor daemon.
// On real hardware that is via systemd; in containers (no systemd) it falls
// back to starting supervisord directly.
func startSupervisorCmd() ([]string, error) {
	if systemdPresent() {
		return []string{"systemctl", "start", "supervisor"}, nil
	}
	// Debian's supervisor package ships this config; supervisord daemonizes
	// by default and returns.
	return []string{"supervisord", "-c", "/etc/supervisor/supervisord.conf"}, nil
}

// supervisorRunning reports whether the named program appears in a RUNNING
// state in the `supervisorctl status` output. The output format is:
//
//	e3cnc-default-moonraker   RUNNING   pid 1234, uptime 0:00:10
//	e3cnc-default-klipper     FATAL     Exited too quickly
func supervisorRunning(status, prog string) bool {
	for _, line := range strings.Split(status, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, prog) {
			continue
		}
		for _, f := range strings.Fields(line) {
			if f == "RUNNING" {
				return true
			}
		}
	}
	return false
}

// writeFileSudo writes content to a file, using sudo if needed.
// Used for /etc/ files that require root. It is a package-private seam so
// tests can simulate write failures without touching the real filesystem.
var writeFileSudo = writeFileSudoImpl

func writeFileSudoImpl(path, content string, mode os.FileMode) error {
	if err := os.WriteFile(path, []byte(content), mode); err == nil {
		return nil
	}
	// Non-root fallback: stream via `sudo -n tee` (non-interactive, never prompts).
	cmd := exec.Command("sudo", "-n", "tee", path)
	cmd.Stdin = strings.NewReader(content)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// detectMCUPath scans common MCU device paths and returns the first one
// found. Prefers /dev/serial/by-id/ for persistent naming. Returns empty
// string if no MCU is detected.
func detectMCUPath() string {
	// Prefer persistent symlinks (survives USB port changes)
	byID := "/dev/serial/by-id"
	if entries, err := os.ReadDir(byID); err == nil && len(entries) > 0 {
		// Prefer USB devices over platform devices
		for _, e := range entries {
			if strings.Contains(e.Name(), "usb") || strings.Contains(e.Name(), "USB") {
				return filepath.Join(byID, e.Name())
			}
		}
		return filepath.Join(byID, entries[0].Name())
	}

	// Fallback: check common tty paths
	for _, path := range []string{
		"/dev/ttyACM0",
		"/dev/ttyUSB0",
		"/dev/ttyAMA0",
	} {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	return ""
}

// fixFilePermissions walks all user-space directories created by the bootstrap
// and chowns them to the target user (who invoked sudo). This fixes the root
// ownership problem described in E3CNC Issue #35: files under the user's home
// dir are created as root when the installer runs via sudo, but should be
// owned by the actual user.
//
// Directories covered:
//   - ~/E3CNC (E3CNCHome) — releases, instances, admin, backups
//   - ~/moonraker           — vendored Moonraker + virtualenv
//   - ~/klipper             — vendored Klipper + virtualenv
//
// System-level files (/etc/supervisor, /etc/nginx, /etc/sudoers.d) are
// intentionally left root-owned — only user-space paths are fixed.
// lchownFn is the function used by fixFilePermissions to change file ownership.
// Exposed as a package var so tests can replace it with a recording/test double.
// The default implementation calls os.Lchown (does not follow symlinks).
var lchownFn = os.Lchown

func fixFilePermissions(cfg BootstrapConfig) error {
	targetUser := detectTargetUser()
	if targetUser == "" {
		return fmt.Errorf("could not determine target user")
	}

	u, err := user.Lookup(targetUser)
	if err != nil {
		// Non-blocking: log warning and continue (e.g. no "pi" user on custom images)
		fmt.Fprintf(os.Stderr, "  Warning: lookup user %q: %v (skipping chown)\n", targetUser, err)
		InstallLogf("Warning: lookup user %q: %v", targetUser, err)
		return nil
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		return fmt.Errorf("parse uid %q: %w", u.Uid, err)
	}
	gid, err := strconv.Atoi(u.Gid)
	if err != nil {
		return fmt.Errorf("parse gid %q: %w", u.Gid, err)
	}

	home := effectiveHome()
	dirs := []string{
		instance.E3CNCHome(),           // ~/E3CNC
		filepath.Join(home, "moonraker"), // ~/moonraker
		filepath.Join(home, "klipper"),   // ~/klipper
	}

	for _, dir := range dirs {
		if _, statErr := os.Lstat(dir); os.IsNotExist(statErr) {
			continue
		}
		walkErr := filepath.WalkDir(dir, func(p string, d os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			// os.Lchown does not follow symlinks — important for the
			// ~/E3CNC/current symlink so we don't follow it into releases/
			// (which is already covered by walking E3CNCHome).
			if lchownErr := lchownFn(p, uid, gid); lchownErr != nil {
				// Log as a warning and continue the walk — one failed
				// lchown should not abort the entire permissions fix.
				fmt.Fprintf(os.Stderr, "  Warning: chown %s: %v\n", p, lchownErr)
				InstallLogf("Warning: chown %s: %v", p, lchownErr)
			}
			return nil
		})
		if walkErr != nil {
			fmt.Fprintf(os.Stderr, "  Warning: fix permissions for %s: %v\n", dir, walkErr)
			InstallLogf("Warning: fix permissions for %s: %v", dir, walkErr)
		}
	}

	InstallLogf("✓ Fixed file permissions for user %q (uid=%d gid=%d)", targetUser, uid, gid)
	return nil
}
