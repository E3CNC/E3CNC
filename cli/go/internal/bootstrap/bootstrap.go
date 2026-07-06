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
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// BootstrapConfig holds all parameters for a fresh install bootstrap.
type BootstrapConfig struct {
	InstanceName  string
	MoonrakerPort int
	WebPort       int
	Hostname      string
	StartServices bool
	Arch          string // "arm64", "amd64"
	StartFrom     int    // step index to start from (0 = beginning)

	// OnProgress is called for each install step with the step index,
	// current status ("running", "completed", "failed"), and any error.
	// When nil, progress is written to stdout (original behaviour).
	OnProgress func(step int, status string, stepErr error)

	// OutputWriter receives all step stdout/stderr output in real-time.
	// When nil, output goes to os.Stdout (original behaviour).
	OutputWriter io.Writer
}

// Out returns the output writer for step stdout/stderr.
// Falls back to os.Stdout when OutputWriter is nil.
func (cfg BootstrapConfig) Out() io.Writer {
	if cfg.OutputWriter != nil {
		return cfg.OutputWriter
	}
	return os.Stdout
}

// step names matching installSteps in the TUI
var stepNames = []string{
	"Install system packages",
	"Configure sudoers",
	"Create directories",
	"Vendor Moonraker and Klipper",
	"Create virtualenvs",
	"Generate config files",
	"Install system services",
	"Configure nginx and mDNS",
	"Start services",
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

	report := cfg.OnProgress
	if report == nil {
		report = func(int, string, error) {} // no-op fallback
	}

	// Run each step
	// StepFn defines a bootstrap step with its name, function, and whether
	// failure blocks the rest of the installation.
	type StepFn struct {
		name     string
		blocking bool
		fn       func(BootstrapConfig) error
	}

	stepFns := []StepFn{
		{"Install system packages", false, func(cfg BootstrapConfig) error { return installSystemPackages() }},
		{"Configure sudoers", false, func(cfg BootstrapConfig) error { return setupSudoers() }},
		{"Create directories", true, func(cfg BootstrapConfig) error { return createDirectories(cfg) }},
		{"Vendor Moonraker and Klipper", true, func(cfg BootstrapConfig) error { return copyVendoredComponents(cfg) }},
		{"Create virtualenvs", true, func(cfg BootstrapConfig) error { return createVirtualenvs(cfg) }},
		{"Generate config files", true, func(cfg BootstrapConfig) error { return generateConfigs(cfg) }},
		{"Install system services", true, func(cfg BootstrapConfig) error { return installServices(cfg) }},
		{"Configure nginx and mDNS", false, func(cfg BootstrapConfig) error {
			if err := setupNginx(cfg); err != nil {
				return err
			}
			return setupAvahi(cfg)
		}},
		{"Start services", true, func(cfg BootstrapConfig) error { return startBootstrapServices(cfg) }},
	}

	var stepErrors []error
	for i, step := range stepFns {
		if i < cfg.StartFrom {
			continue
		}
		fmt.Fprintf(cfg.Out(), "  [%d/%d] %s...\n", i+1, len(stepFns), step.name)
		report(i, "running", nil)
		if err := step.fn(cfg); err != nil {
			report(i, "failed", err)
			errMsg := fmt.Errorf("step %d (%s): %w", i+1, step.name, err)
			if step.blocking {
				return errMsg
			}
			stepErrors = append(stepErrors, errMsg)
			continue
		}
		report(i, "completed", nil)
		fmt.Printf("  ✓ %s\n", step.name)
	}

	if len(stepErrors) > 0 {
		return fmt.Errorf("%d step(s) failed: %v", len(stepErrors), stepErrors[0])
	}

	return nil
}

// Uninstall removes all E3CNC components.
// This is the Go equivalent of the Ansible uninstall playbook.
func Uninstall(inst *instance.Instance) error {
	fmt.Println("  Uninstalling E3CNC...")

	// Stop E3CNC services via supervisor
	exec.Command("sudo", "supervisorctl", "stop", fmt.Sprintf("e3cnc-%s-*", inst.Name)).Run()
	exec.Command("sudo", "rm", "-f", fmt.Sprintf("/etc/supervisor/conf.d/e3cnc-%s-*.conf", inst.Name)).Run()
	exec.Command("sudo", "supervisorctl", "reread").Run()
	exec.Command("sudo", "supervisorctl", "update").Run()

	// Remove instance directory
	instPath := filepath.Join(instance.InstancesDir(), inst.Name)
	os.RemoveAll(instPath)

	// Remove frontend
	os.RemoveAll(inst.WebRoot)

	// Remove nginx site
	nginxName := fmt.Sprintf("e3cnc-%s", inst.Name)
	exec.Command("rm", "-f", fmt.Sprintf("/etc/nginx/sites-enabled/%s", nginxName)).Run()
	exec.Command("rm", "-f", fmt.Sprintf("/etc/nginx/sites-available/%s", nginxName)).Run()

	fmt.Println("  ✅ Uninstall complete")
	return nil
}

// Rollback cleans up partial state when Bootstrap fails mid-install.
// This is a best-effort cleanup — it removes instance directories, configs,
// and services that may have been created, but does not halt on errors.
func Rollback(cfg BootstrapConfig) {
	inst := filepath.Join(instance.InstancesDir(), cfg.InstanceName)

	// Stop E3CNC services via supervisor
	exec.Command("sudo", "supervisorctl", "stop", fmt.Sprintf("e3cnc-%s-*", cfg.InstanceName)).Run()

	// Remove supervisor configs
	exec.Command("sudo", "rm", "-f", fmt.Sprintf("/etc/supervisor/conf.d/e3cnc-%s-*.conf", cfg.InstanceName)).Run()
	exec.Command("sudo", "supervisorctl", "reread").Run()
	exec.Command("sudo", "supervisorctl", "update").Run()

	// Remove nginx site
	exec.Command("rm", "-f", fmt.Sprintf("/etc/nginx/sites-enabled/e3cnc-%s", cfg.InstanceName)).Run()
	exec.Command("rm", "-f", fmt.Sprintf("/etc/nginx/sites-available/e3cnc-%s", cfg.InstanceName)).Run()

	// Remove instance directory
	os.RemoveAll(inst)
}
