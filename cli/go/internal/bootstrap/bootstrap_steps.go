package bootstrap

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── step implementations ──────────────────────────────────────────

func installSystemPackages() error {
	// Run apt-get update first to refresh package lists
	updateCmd := exec.Command("sudo", "apt-get", "update")
	updateCmd.Stdout = os.Stdout
	updateCmd.Stderr = os.Stderr
	if err := updateCmd.Run(); err != nil {
		return fmt.Errorf("apt-get update: %w", err)
	}

	packages := []string{
		"git", "curl", "unzip", "zstd", "nginx", "supervisor",
		"python3", "python3-pip", "python3-venv", "python3-dev",
		"build-essential", "libffi-dev", "libssl-dev", "avahi-utils",
	}
	args := append([]string{"-y"}, packages...)
	aptCmd := append([]string{"apt-get", "install"}, args...)
	cmd := exec.Command("sudo", aptCmd...)
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
%s ALL=(root) NOPASSWD: /usr/bin/supervisorctl *
%s ALL=(root) NOPASSWD: /usr/bin/tee /etc/supervisor/conf.d/e3cnc-*.conf
%s ALL=(root) NOPASSWD: /bin/ln -sf /etc/nginx/sites-* /etc/nginx/sites-enabled/*
%s ALL=(root) NOPASSWD: /bin/rm /etc/supervisor/conf.d/e3cnc-*.conf
%s ALL=(root) NOPASSWD: /bin/systemctl start supervisor
%s ALL=(root) NOPASSWD: /usr/sbin/nginx -s reload
`, user, user, user, user, user, user)

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
			continue
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

	writeFileSudo(fmt.Sprintf("/etc/supervisor/conf.d/%s.conf", moonrakerName), moonrakerCfg, 0644)

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

	writeFileSudo(fmt.Sprintf("/etc/supervisor/conf.d/%s.conf", klipperName), klipperCfg, 0644)

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

	writeFileSudo(avail, config, 0644)
	exec.Command("sudo", "rm", "-f", enabled).Run()
	exec.Command("sudo", "ln", "-sf", avail, enabled).Run()

	exec.Command("sudo", "nginx", "-t").Run()
	exec.Command("sudo", "nginx", "-s", "reload").Run()
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
		fmt.Println("  [9/9] Skipping service start (--no-start)")
		return nil
	}

	// Start supervisor first, then load all E3CNC supervisor configs
	exec.Command("sudo", "systemctl", "start", "supervisor").Run()
	exec.Command("sudo", "supervisorctl", "reread").Run()
	exec.Command("sudo", "supervisorctl", "update").Run()

	return nil
}

// writeFileSudo writes content to a file, using sudo if needed.
// Used for /etc/ files that require root.
func writeFileSudo(path, content string, mode os.FileMode) error {
	if err := os.WriteFile(path, []byte(content), mode); err == nil {
		return nil
	}
	cmd := exec.Command("sudo", "tee", path)
	cmd.Stdin = strings.NewReader(content)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
