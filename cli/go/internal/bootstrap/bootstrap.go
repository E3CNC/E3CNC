// Package bootstrap handles fresh-install system provisioning.
//
// This replaces the Ansible bootstrap-stack role (488 lines YAML) and
// install playbook (97 lines) with ~400 lines of Go.
//
// Every Ansible task maps directly to Go stdlib + os/exec:
//
//	apt install        → exec.Command("apt-get", ...)
//	cp                 → os.WriteFile / os.Rename
//	mkdir              → os.MkdirAll
//	systemd            → exec.Command("systemctl", ...)
//	pip install        → exec.Command("pip3", ...)
//	file stat          → os.Stat
package bootstrap

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// BootstrapConfig holds all parameters for a fresh install bootstrap.
type BootstrapConfig struct {
	InstanceName string
	MoonrakerPort int
	WebPort       int
	Hostname      string
	StartServices bool
	Arch          string // "arm64", "amd64"
}

// Bootstrap lays down a complete fresh E3CNC installation.
// This is the Go equivalent of the Ansible bootstrap-stack + install playbooks.
func Bootstrap(cfg BootstrapConfig) error {
	if cfg.InstanceName == "" {
		cfg.InstanceName = "default"
	}
	if cfg.MoonrakerPort == 0 {
		cfg.MoonrakerPort = 7125
	}
	if cfg.WebPort == 0 {
		cfg.WebPort = 80
	}
	if cfg.Hostname == "" {
		cfg.Hostname = "e3cnc"
	}

	// Step 1: Install system packages
	fmt.Println("  [1/9] Installing system packages...")
	if err := installSystemPackages(); err != nil {
		return fmt.Errorf("system packages: %w", err)
	}

	// Step 2: Create sudoers drop-in for service management
	fmt.Println("  [2/9] Configuring sudoers...")
	if err := setupSudoers(); err != nil {
		return fmt.Errorf("sudoers: %w", err)
	}

	// Step 3: Create directory structure
	fmt.Println("  [3/9] Creating directories...")
	if err := createDirectories(cfg); err != nil {
		return fmt.Errorf("directories: %w", err)
	}

	// Step 4: Copy vendored Moonraker/Klipper
	fmt.Println("  [4/9] Vendoring Moonraker and Klipper...")
	if err := copyVendoredComponents(cfg); err != nil {
		return fmt.Errorf("vendor: %w", err)
	}

	// Step 5: Create Python virtualenvs
	fmt.Println("  [5/9] Creating virtualenvs...")
	if err := createVirtualenvs(cfg); err != nil {
		return fmt.Errorf("virtualenvs: %w", err)
	}

	// Step 6: Generate config files
	fmt.Println("  [6/9] Generating config files...")
	if err := generateConfigs(cfg); err != nil {
		return fmt.Errorf("configs: %w", err)
	}

	// Step 7: Install systemd services
	fmt.Println("  [7/9] Installing systemd services...")
	if err := installServices(cfg); err != nil {
		return fmt.Errorf("services: %w", err)
	}

	// Step 8: Configure nginx and Avahi
	fmt.Println("  [8/9] Configuring nginx and mDNS...")
	if err := setupNginx(cfg); err != nil {
		return fmt.Errorf("nginx: %w", err)
	}
	if err := setupAvahi(cfg); err != nil {
		return fmt.Errorf("avahi: %w", err)
	}

	// Step 9: Start services
	if cfg.StartServices {
		fmt.Println("  [9/9] Starting services...")
		if err := startServices(cfg); err != nil {
			return fmt.Errorf("start services: %w", err)
		}
	} else {
		fmt.Println("  [9/9] Skipping service start (--no-start)")
	}

	return nil
}

// Uninstall removes all E3CNC components.
// This is the Go equivalent of the Ansible uninstall playbook.
func Uninstall(inst *instance.Instance) error {
	fmt.Println("  Uninstalling E3CNC...")

	// Stop services
	exec.Command("systemctl", "stop", inst.MoonrakerService).Run()
	exec.Command("systemctl", "stop", inst.KlipperService).Run()

	// Remove instance directory
	instPath := filepath.Join(instance.InstancesDir(), inst.Name)
	os.RemoveAll(instPath)

	// Remove frontend
	os.RemoveAll(inst.WebRoot)

	// Remove nginx site
	nginxName := fmt.Sprintf("e3cnc-%s", inst.Name)
	exec.Command("rm", "-f", fmt.Sprintf("/etc/nginx/sites-enabled/%s", nginxName)).Run()
	exec.Command("rm", "-f", fmt.Sprintf("/etc/nginx/sites-available/%s", nginxName)).Run()

	// Remove Avahi publisher
	exec.Command("rm", "-f", "/etc/systemd/system/avahi-publish-e3cnc.service").Run()

	// Reload systemd + nginx
	exec.Command("systemctl", "daemon-reload").Run()
	exec.Command("nginx", "-s", "reload").Run()

	fmt.Println("  ✅ Uninstall complete")
	return nil
}

// ── step implementations ──────────────────────────────────────────

func installSystemPackages() error {
	packages := []string{
		"git", "curl", "unzip", "nginx", "supervisor",
		"python3", "python3-pip", "python3-venv", "python3-dev",
		"build-essential", "libffi-dev", "libssl-dev", "avahi-utils",
	}
	args := append([]string{"install", "-y"}, packages...)
	cmd := exec.Command("apt-get", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("apt-get install: %w", err)
	}
	return nil
}

func setupSudoers() error {
	user := os.Getenv("USER")
	if user == "" {
		user = "biqu"
	}
	content := fmt.Sprintf(`# E3CNC — passwordless sudo for process management
%s ALL=(root) NOPASSWD: /usr/bin/systemctl restart e3cnc-*
%s ALL=(root) NOPASSWD: /usr/bin/systemctl daemon-reload
%s ALL=(root) NOPASSWD: /usr/bin/systemctl reload nginx
%s ALL=(root) NOPASSWD: /usr/bin/supervisorctl *
%s ALL=(root) NOPASSWD: /usr/bin/tee /etc/supervisor/conf.d/e3cnc-*.conf
%s ALL=(root) NOPASSWD: /bin/ln -sf /etc/nginx/sites-* /etc/nginx/sites-enabled/*
%s ALL=(root) NOPASSWD: /bin/rm /etc/supervisor/conf.d/e3cnc-*.conf
`, user, user, user, user, user, user, user)

	path := "/etc/sudoers.d/e3cnc"
	if _, err := os.Stat(path); err == nil {
		return nil // already exists
	}
	return writeFileSudo(path, content, 0440)
}

func createDirectories(cfg BootstrapConfig) error {
	home, _ := os.UserHomeDir()
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

func copyVendoredComponents(cfg BootstrapConfig) error {
	home, _ := os.UserHomeDir()
	// Copy from current release's vendor dir
	currentTarget, err := os.Readlink(instance.CurrentLink())
	if err != nil {
		return fmt.Errorf("no current release: %w", err)
	}

	moonrakerSrc := filepath.Join(currentTarget, "vendor", "moonraker")
	klipperSrc := filepath.Join(currentTarget, "vendor", "klipper")

	for _, pair := range [][2]string{
		{moonrakerSrc, home + "/moonraker"},
		{klipperSrc, home + "/klipper"},
	} {
		src, dst := pair[0], pair[1]
		if _, err := os.Stat(filepath.Join(src, "moonraker", "moonraker.py")); err == nil {
			// Use rsync or cp -r
			cmd := exec.Command("cp", "-r", src+"/.", dst+"/")
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("copy %s: %w", src, err)
			}
		}
	}
	return nil
}

func createVirtualenvs(cfg BootstrapConfig) error {
	home, _ := os.UserHomeDir()
	for _, dir := range []string{home + "/moonraker", home + "/klipper"} {
		venvPython := filepath.Join(dir, "venv", "bin", "python")
		if _, err := os.Stat(venvPython); err == nil {
			continue // already exists
		}
		cmd := exec.Command("python3", "-m", "venv", filepath.Join(dir, "venv"))
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("venv %s: %w", dir, err)
		}
	}
	return nil
}

func generateConfigs(cfg BootstrapConfig) error {
	inst := filepath.Join(instance.InstancesDir(), cfg.InstanceName)
	configDir := filepath.Join(inst, "data", "config")

	// moonraker.conf
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

	// printer.cfg placeholder
	printerCfg := filepath.Join(configDir, "printer.cfg")
	if _, err := os.Stat(printerCfg); os.IsNotExist(err) {
		content := `# E3CNC bootstrap placeholder printer.cfg
# Replace this file with your real machine configuration.

[printer]
kinematics: none
max_velocity: 100
max_accel: 100

[mcu]
serial: /dev/ttyACM0

[force_move]
enable_force_move: True
`
		if err := os.WriteFile(printerCfg, []byte(content), 0644); err != nil {
			return err
		}
	}

	return nil
}

func installServices(cfg BootstrapConfig) error {
	home, _ := os.UserHomeDir()
	inst := filepath.Join(instance.InstancesDir(), cfg.InstanceName)
	printerCfg := filepath.Join(inst, "data", "config", "printer.cfg")

	user := os.Getenv("USER")
	if user == "" {
		user = "biqu"
	}
	moonrakerName := fmt.Sprintf("e3cnc-%s-moonraker", cfg.InstanceName)
	klipperName := fmt.Sprintf("e3cnc-%s-klipper", cfg.InstanceName)

	// Moonraker service
	moonrakerUnit := fmt.Sprintf(`[Unit]
Description=Moonraker API Server
After=network.target

[Service]
Type=simple
User=%s
WorkingDirectory=%s/moonraker
ExecStart=%s/moonraker/venv/bin/python %s/moonraker/moonraker/moonraker.py -d %s/data
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
`, user, home, home, home, inst)

	writeFileSudo(fmt.Sprintf("/etc/systemd/system/%s.service", moonrakerName), moonrakerUnit, 0644)

	// Klipper service
	klipperUnit := fmt.Sprintf(`[Unit]
Description=Klipper Firmware Host
After=network.target

[Service]
Type=simple
User=%s
WorkingDirectory=%s/klipper
ExecStart=%s/klipper/venv/bin/python %s/klipper/klippy/klippy.py %s -I %s/data/comms/klippy.serial -l %s/data/logs/klipper.log -a %s/data/comms/klippy.sock
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
`, user, home, home, home, printerCfg, inst, inst, inst)

	writeFileSudo(fmt.Sprintf("/etc/systemd/system/%s.service", klipperName), klipperUnit, 0644)

	exec.Command("systemctl", "daemon-reload").Run()
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
`, cfg.WebPort, cfg.WebPort, cfg.Hostname, webRoot,
		cfg.MoonrakerPort, cfg.MoonrakerPort, cfg.MoonrakerPort,
		cfg.MoonrakerPort, cfg.MoonrakerPort, cfg.MoonrakerPort, instance.E3CNCHome())

	avail := fmt.Sprintf("/etc/nginx/sites-available/%s", nginxName)
	enabled := fmt.Sprintf("/etc/nginx/sites-enabled/%s", nginxName)

	writeFileSudo(avail, config, 0644)
	os.Remove(enabled) // remove stale link
	if err := os.Symlink(avail, enabled); err != nil {
		// Might need sudo for symlink in /etc
		exec.Command("ln", "-sf", avail, enabled).Run()
	}

	// Test nginx config
	exec.Command("nginx", "-t").Run()
	return nil
}

func setupAvahi(cfg BootstrapConfig) error {
	unit := fmt.Sprintf(`[Unit]
Description=Publish %s.local via mDNS/Avahi
After=avahi-daemon.service
Requires=avahi-daemon.service
PartOf=avahi-daemon.service

[Service]
Type=simple
ExecStart=/usr/bin/avahi-publish -a %s.local
ExecStop=/bin/sh -c '/usr/bin/avahi-publish -a %s.local --remove || true'
Restart=on-failure
RestartSec=3
User=nobody

[Install]
WantedBy=multi-user.target
`, cfg.Hostname, cfg.Hostname, cfg.Hostname)

	writeFileSudo("/etc/systemd/system/avahi-publish-e3cnc.service", unit, 0644)
	return nil
}

func startServices(cfg BootstrapConfig) error {
	// Start in dependency order
	services := []string{
		"avahi-daemon",
		"nginx",
		"supervisor",
		fmt.Sprintf("e3cnc-%s-moonraker", cfg.InstanceName),
	}

	for _, svc := range services {
		cmd := exec.Command("systemctl", "enable", "--now", svc)
		cmd.Stderr = os.Stderr
		cmd.Run()
	}

	return nil
}

// writeFileSudo writes content to a file, using sudo if needed.
// Used for /etc/ files that require root.
func writeFileSudo(path, content string, mode os.FileMode) error {
	// Try direct write first
	if err := os.WriteFile(path, []byte(content), mode); err == nil {
		return nil
	}
	// Fall back to sudo tee
	cmd := exec.Command("sudo", "tee", path)
	cmd.Stdin = strings.NewReader(content)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
