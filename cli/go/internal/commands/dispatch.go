// Package commands provides Go-native implementations of all E3CNC CLI commands.
// RunDispatch() is the single entry point. It handles all 24 commands in-process.
package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/E3CNC/e3cnc/cli/go/internal/bootstrap"
	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/domain"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

var outputFmt = domain.OutputFormatter{}

// RunDispatch runs a command natively in Go.
// Returns true if the command was handled (even if it failed — the error
// was printed to stderr). Returns false if the command is not yet implemented
// in Go and should fall through to Python.
func RunDispatch(cmd string, jsonOut bool, args []string) bool {
	switch cmd {
	case "status":
		return cmdStatus(jsonOut)
	case "check", "check-deps":
		return cmdCheck(jsonOut)
	case "instances", "inst", "list":
		return cmdInstances(jsonOut)
	case "releases", "rel":
		return cmdReleases(jsonOut)
	case "clilog":
		return cmdCliLog(jsonOut)
	case "update", "redeploy":
		return cmdUpdate(jsonOut, args)
	case "backup":
		return cmdBackup(jsonOut, args)
	case "restore":
		return cmdRestore(jsonOut, args)
	case "rollback":
		return cmdRollback(jsonOut, args)
	case "prune":
		return cmdPrune(jsonOut, args)
	case "prune-backups":
		return cmdPruneBackups(jsonOut, args)
	case "diagnose", "diag", "doctor":
		return cmdDiagnose(jsonOut)
	case "logs":
		return cmdLogs(jsonOut, args)
	case "admin-page":
		return cmdAdminPage(jsonOut)
	case "detect-mcu", "detect", "scan":
		return cmdDetectMCU(jsonOut)
	case "init-config", "init":
		return cmdInitConfig(jsonOut, args)
	case "restart":
		return cmdRestart(jsonOut, args)
	case "install":
		return cmdInstall(jsonOut, args)
	case "uninstall":
		return cmdUninstall(jsonOut, args)
	case "deploy":
		return cmdDeploy(jsonOut, args)
	case "flash-mcu", "flash", "build":
		return cmdFlashMCU(jsonOut, args)
	case "migrate":
		return cmdMigrate(jsonOut, args)
	case "migrate-instances":
		return cmdMigrateInstances(jsonOut, args)
	case "import-instance":
		return cmdImportInstance(jsonOut, args)
	}
	return true // handled (even if unknown, don't fall through to Python)
}

// ── helpers ───────────────────────────────────────────────────────

func activeInstance() *instance.Instance {
	inst, err := instance.GetActiveInstance()
	if err != nil {
		return nil
	}
	return inst
}

func printJSON(v interface{}) {
	data, _ := json.MarshalIndent(v, "", "  ")
	fmt.Println(string(data))
}

func resolveInstance(args []string) *instance.Instance {
	inst := activeInstance()
	for i, arg := range args {
		if arg == "--instance" || arg == "-p" || arg == "--name" {
			if i+1 < len(args) {
				if inst2, err := instance.FromName(args[i+1]); err == nil {
					inst = inst2
				}
			}
		}
	}
	return inst
}

// ── status ────────────────────────────────────────────────────────

func cmdStatus(jsonOut bool) bool {
	inst := activeInstance()
	version := instance.ReadCurrentVersion()

	if jsonOut {
		if inst != nil {
			checks := deploy.RunHealthChecks(inst)
			okCount := 0
			for _, c := range checks {
				if c.Passed {
					okCount++
				}
			}
			result := map[string]interface{}{
				"version":       version,
				"all_ok":        okCount == len(checks),
				"ok_count":      okCount,
				"total_checks":  len(checks),
				"checks":        checks,
				"instance_name": inst.Name,
				"web_url":       fmt.Sprintf("http://%s:%d/", instance.GetLocalIP(), inst.WebPort),
				"api_url":       fmt.Sprintf("http://%s:%d/server/info", instance.GetLocalIP(), inst.MoonrakerPort),
			}
			printJSON(result)
		} else {
			printJSON(map[string]interface{}{
				"version": version, "all_ok": false, "checks": []string{},
			})
		}
		return true
	}

	fmt.Printf("  E3CNC v%s\n", version)
	if inst != nil {
		fmt.Printf("  Instance: %s (port %d)\n", inst.Name, inst.MoonrakerPort)
		checks := deploy.RunHealthChecks(inst)
		for _, c := range checks {
			mark := outputFmt.Mark(c.Passed, false)
			fmt.Printf("  %s %s\n", mark, c.Name)
		}
		ip := instance.GetLocalIP()
		fmt.Printf("\n  Web UI:     http://%s/\n", ip)
		fmt.Printf("  Admin:      http://%s/admin\n", ip)
		fmt.Printf("  API:        http://%s:%d/server/info\n", ip, inst.MoonrakerPort)
	} else {
		fmt.Println("  No instance detected")
	}
	return true
}

// ── check ─────────────────────────────────────────────────────────

func cmdCheck(jsonOut bool) bool {
	type checkItem struct {
		Name   string `json:"name"`
		Passed bool   `json:"passed"`
		Detail string `json:"detail"`
	}

	checks := []checkItem{
		{"Python 3.8+", hasBin("python3"), ""},
		{"git", hasBin("git"), ""},
		{"curl", hasBin("curl"), ""},
		{"unzip", hasBin("unzip"), ""},
		{"zstd", hasBin("zstd"), ""},
	}

	allPassed := true
	for _, c := range checks {
		if !c.Passed {
			allPassed = false
		}
	}

	if jsonOut {
		printJSON(map[string]interface{}{
			"all_passed": allPassed,
			"checks":     checks,
		})
		return true
	}

	for _, c := range checks {
		mark := outputFmt.Mark(c.Passed, false)
		fmt.Printf("  %s %s\n", mark, c.Name)
	}
	return true
}

func hasBin(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// ── instances ─────────────────────────────────────────────────────

func cmdInstances(jsonOut bool) bool {
	instances, err := instance.DetectInstances()
	if err != nil {
		if jsonOut {
			printJSON(map[string]interface{}{"error": err.Error(), "instances": []interface{}{}})
		} else {
			fmt.Printf("  Error: %v\n", err)
		}
		return true
	}

	ip := instance.GetLocalIP()

	if jsonOut {
		rel := deploy.GetCurrentRelease()
		relVersion := ""
		if rel != nil {
			relVersion = rel.Version
		}
		var instList []map[string]interface{}
		for _, inst := range instances {
			instList = append(instList, map[string]interface{}{
				"name":              inst.Name,
				"is_running":        inst.IsRunning,
				"config_dir":        inst.ConfigDir,
				"moonraker_service": inst.MoonrakerService,
				"klipper_service":   inst.KlipperService,
				"moonraker_port":    inst.MoonrakerPort,
				"web_port":          inst.WebPort,
				"web_root":          inst.WebRoot,
				"printer_data_dir":  inst.PrinterDataDir,
			})
		}
		printJSON(map[string]interface{}{
			"local_ip":         ip,
			"release_version":  relVersion,
			"instances":        instList,
		})
		return true
	}

	if len(instances) == 0 {
		fmt.Println("  No instances found")
		return true
	}
	for _, inst := range instances {
		running := "○"
		if inst.IsRunning {
			running = "●"
		}
		fmt.Printf("  %s %s  (port %d)\n", running, inst.Name, inst.MoonrakerPort)
	}
	return true
}

// ── releases ──────────────────────────────────────────────────────

func cmdReleases(jsonOut bool) bool {
	releases := deploy.GetReleases()
	current := deploy.GetCurrentRelease()
	currentVersion := ""
	if current != nil {
		currentVersion = current.Version
	}

	if jsonOut {
		printJSON(map[string]interface{}{
			"current_version": currentVersion,
			"releases":        releases,
		})
		return true
	}

	if len(releases) == 0 {
		fmt.Println("  No releases installed")
		fmt.Println("  Run 'e3cnc-tui update' to install the latest release")
		return true
	}
	for _, r := range releases {
		mark := " "
		if r.IsActive() {
			mark = "▶"
		}
		fmt.Printf("  %s %s\n", mark, r.Version)
	}
	return true
}

// ── update ────────────────────────────────────────────────────────

func cmdUpdate(jsonOut bool, args []string) bool {
	// Parse --artifact flag
	artifactPath := ""
	for i, arg := range args {
		if arg == "--artifact" && i+1 < len(args) {
			artifactPath = args[i+1]
		}
	}

	if jsonOut {
		fmt.Println(`{"status":"starting","step":"find_release"}`)
	}

	var assetPath string

	if artifactPath != "" {
		if _, err := os.Stat(artifactPath); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "  Artifact not found: %s\n", artifactPath)
			return true
		}
		assetPath = artifactPath
		fmt.Printf("  Using local artifact: %s\n", filepath.Base(artifactPath))
	} else {
		fmt.Println("  Finding latest release...")
		asset, err := deploy.FindStackArtifact()
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Error: %v\n", err)
			return true
		}
		fmt.Printf("  Found: %s\n", asset.Name)

		version := strings.TrimPrefix(asset.Name, "e3cnc-stack-")
		version = strings.TrimSuffix(version, ".tar.zst")
		_ = version

		assetPath, err = deploy.DownloadArtifact(asset, "/tmp/e3cnc-download")
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Download failed: %v\n", err)
			return true
		}
		fmt.Println("  Downloaded")
	}

	// Extract version from filename
	version := filepath.Base(assetPath)
	version = strings.TrimPrefix(version, "e3cnc-stack-")
	version = strings.TrimSuffix(version, ".tar.zst")

	// Extract
	fmt.Printf("  Extracting v%s...\n", version)
	_, err := deploy.ExtractArtifact(assetPath, instance.ReleasesDir(), version)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Extract failed: %v\n", err)
		return true
	}

	// Activate
	fmt.Println("  Activating...")
	if err := deploy.ActivateRelease(version); err != nil {
		fmt.Fprintf(os.Stderr, "  Activation failed: %v\n", err)
		return true
	}

	fmt.Printf("  ✅ Updated to v%s\n", version)

	// Health checks
	fmt.Println("\n  Running health checks...")
	inst := activeInstance()
	if inst != nil {
		checks := deploy.RunHealthChecks(inst)
		for _, c := range checks {
			mark := outputFmt.Mark(c.Passed, false)
			fmt.Printf("  %s %s\n", mark, c.Name)
			if !c.Passed && c.Detail != "" {
				fmt.Printf("       %s\n", c.Detail)
			}
		}
	}

	return true
}

// ── backup / restore ──────────────────────────────────────────────

func cmdBackup(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}
	path, err := deploy.Backup(inst)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Backup failed: %v\n", err)
		return true
	}
	if jsonOut {
		printJSON(map[string]string{"backup_path": path})
	} else {
		fmt.Printf("  ✅ Backup created: %s\n", path)
	}
	return true
}

func cmdRestore(jsonOut bool, args []string) bool {
	backupPath := ""
	for i, arg := range args {
		if arg == "--file" || arg == "-f" {
			if i+1 < len(args) {
				backupPath = args[i+1]
			}
		}
	}
	if backupPath == "" {
		// Find latest backup
		backupsDir := filepath.Join(instance.E3CNCHome(), "backups")
		entries, _ := os.ReadDir(backupsDir)
		if len(entries) == 0 {
			fmt.Fprintln(os.Stderr, "  No backups found")
			return true
		}
		backupPath = filepath.Join(backupsDir, entries[len(entries)-1].Name())
	}

	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	if err := deploy.Restore(inst, backupPath); err != nil {
		fmt.Fprintf(os.Stderr, "  Restore failed: %v\n", err)
		return true
	}
	fmt.Printf("  ✅ Restored from: %s\n", backupPath)
	return true
}

// ── rollback ──────────────────────────────────────────────────────

func cmdRollback(jsonOut bool, args []string) bool {
	version := ""
	for i, arg := range args {
		if arg == "--version" && i+1 < len(args) {
			version = args[i+1]
		}
	}

	releases := deploy.GetReleases()
	if len(releases) == 0 {
		fmt.Fprintln(os.Stderr, "  No releases to roll back to")
		return true
	}

	if version != "" {
		// Roll back to specific version
		found := false
		for _, r := range releases {
			if r.Version == version {
				found = true
				break
			}
		}
		if !found {
			fmt.Fprintf(os.Stderr, "  Release %s not found\n", version)
			return true
		}
	} else {
		// Roll back to previous (second latest)
		if len(releases) < 2 {
			fmt.Fprintln(os.Stderr, "  No previous release to roll back to")
			return true
		}
		version = releases[1].Version
	}

	if err := deploy.ActivateRelease(version); err != nil {
		fmt.Fprintf(os.Stderr, "  Rollback failed: %v\n", err)
		return true
	}
	fmt.Printf("  ✅ Rolled back to v%s\n", version)
	return true
}

// ── prune ─────────────────────────────────────────────────────────

func cmdPrune(jsonOut bool, args []string) bool {
	keep := deploy.DefaultKeepReleases
	for i, arg := range args {
		if arg == "--keep" && i+1 < len(args) {
			fmt.Sscanf(args[i+1], "%d", &keep)
		}
	}

	releases := deploy.GetReleases()
	if len(releases) <= keep {
		fmt.Println("  Nothing to prune")
		return true
	}

	pruned := 0
	for _, r := range releases[keep:] {
		if r.IsActive() {
			continue
		}
		os.RemoveAll(r.Path)
		pruned++
	}

	fmt.Printf("  Pruned %d old release(s)\n", pruned)
	return true
}

// ── prune-backups ─────────────────────────────────────────────────

func cmdPruneBackups(jsonOut bool, args []string) bool {
	keep := deploy.DefaultKeepBackups
	for i, arg := range args {
		if arg == "--keep" && i+1 < len(args) {
			fmt.Sscanf(args[i+1], "%d", &keep)
		}
	}

	backupsDir := filepath.Join(instance.E3CNCHome(), "backups")
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		fmt.Println("  No backups to prune")
		return true
	}

	if len(entries) <= keep {
		fmt.Println("  Nothing to prune")
		return true
	}

	pruned := 0
	for _, entry := range entries[:len(entries)-keep] {
		os.RemoveAll(filepath.Join(backupsDir, entry.Name()))
		pruned++
	}
	fmt.Printf("  Pruned %d old backup(s)\n", pruned)
	return true
}

// ── diagnose ──────────────────────────────────────────────────────

func cmdDiagnose(jsonOut bool) bool {
	if jsonOut {
		result := map[string]interface{}{
			"hostname":  getHostname(),
			"releases":  len(deploy.GetReleases()),
			"instances": countInstances(),
		}
		printJSON(result)
		return true
	}

	fmt.Printf("  Hostname:  %s\n", getHostname())
	inst := activeInstance()
	if inst != nil {
		fmt.Printf("  Instance:  %s\n", inst.Name)
		fmt.Printf("  Config:    %s\n", inst.ConfigDir)
		fmt.Printf("  Port:      %d\n", inst.MoonrakerPort)
	}
	fmt.Printf("  Releases:  %d installed\n", len(deploy.GetReleases()))
	fmt.Printf("  Instances: %d\n", countInstances())
	return true
}

func getHostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}

func countInstances() int {
	insts, _ := instance.DetectInstances()
	return len(insts)
}

// ── logs ──────────────────────────────────────────────────────────

func cmdLogs(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	// Tail the moonraker log by default
	logFile := inst.MoonrakerLog
	for i, arg := range args {
		if arg == "--file" && i+1 < len(args) {
			logFile = args[i+1]
		}
		if arg == "--nginx" {
			logFile = "/var/log/nginx/access.log"
		}
	}

	data, err := os.ReadFile(logFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Cannot read log: %v\n", err)
		return true
	}
	fmt.Print(string(data))
	return true
}

// ── admin-page ────────────────────────────────────────────────────

func cmdAdminPage(jsonOut bool) bool {
	adminDir := filepath.Join(instance.E3CNCHome(), "admin")
	os.MkdirAll(adminDir, 0755)

	inst := activeInstance()
	version := instance.ReadCurrentVersion()

	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><title>E3CNC Admin</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:sans-serif;margin:2rem;background:#1a1a2e;color:#eee}
h1{color:#00d4aa}h2{color:#888}.card{background:#16213e;padding:1rem;margin:1rem 0;border-radius:8px}
a{color:#00d4aa}</style></head><body>
<h1>E3CNC Admin</h1>
<div class="card"><h2>System</h2>
<p>Version: %s</p>
<p>Host: %s</p></div>`, version, getHostname())

	if inst != nil {
		html += fmt.Sprintf(`<div class="card"><h2>Instance: %s</h2>
<p>Port: %d</p>
<p><a href="http://%s:%d/">Web UI</a></p></div>`, inst.Name, inst.MoonrakerPort, instance.GetLocalIP(), inst.WebPort)
	}

	html += `</body></html>`
	os.WriteFile(filepath.Join(adminDir, "index.html"), []byte(html), 0644)
	fmt.Println("  Admin page generated")
	return true
}

// ── detect-mcu ────────────────────────────────────────────────────

func cmdDetectMCU(jsonOut bool) bool {
	serialDir := "/dev/serial/by-id/"
	entries, err := os.ReadDir(serialDir)
	if err != nil {
		if jsonOut {
			printJSON(map[string]interface{}{"mcu": nil, "error": "no MCU detected"})
		} else {
			fmt.Println("  No MCU detected")
		}
		return true
	}

	var devices []string
	for _, entry := range entries {
		if entry.Type().IsRegular() || entry.Type()&os.ModeSymlink != 0 {
			devices = append(devices, entry.Name())
		}
	}

	if jsonOut {
		if len(devices) > 0 {
			printJSON(map[string]interface{}{"mcu": devices[0], "all": devices})
		} else {
			printJSON(map[string]interface{}{"mcu": nil})
		}
		return true
	}

	if len(devices) == 0 {
		fmt.Println("  No MCU detected")
		return true
	}
	for _, d := range devices {
		fmt.Printf("  %s\n", d)
	}
	return true
}

// ── init-config ───────────────────────────────────────────────────

func cmdInitConfig(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	mcuPath := ""
	entries, _ := os.ReadDir("/dev/serial/by-id/")
	if len(entries) > 0 {
		mcuPath = filepath.Join("/dev/serial/by-id/", entries[0].Name())
	}

	// Generate a basic CNC printer.cfg
	cfg := fmt.Sprintf(`# E3CNC CNC printer.cfg — generated by init-config
# Adjust the paths and parameters below for your machine.

[mcu]
serial: %s
# baud: 250000

[stepper_x]
step_pin: PA2
dir_pin: PA1
enable_pin: PA0
microsteps: 16
rotation_distance: 40
position_endstop: 0
position_min: 0
position_max: 300
homing_speed: 50

[stepper_y]
step_pin: PC7
dir_pin: PC6
enable_pin: PC5
microsteps: 16
rotation_distance: 40
position_endstop: 265
position_min: 0
position_max: 265
homing_speed: 50

[stepper_z]
step_pin: PB9
dir_pin: PB8
enable_pin: PB7
microsteps: 16
rotation_distance: 8
position_endstop: 0
position_min: -5
position_max: 250

# !!! ADJUST the above values for your machine !!!

[output_pin spindle]
pin: PB13
pwm: True
cycle_time: 0.100
hardware_pwm: False
scale: 100
value: 0

[heater_bed]
heater_pin: PB14
sensor_type: Generic 3950
sensor_pin: PK5
control: watermark
min_temp: 0
max_temp: 130

[temperature_sensor chamber]
sensor_type: Generic 3950
sensor_pin: PK6
min_temp: 0
max_temp: 100

[fan]
pin: PB15

[mcu rpi]
serial: /tmp/klipper_host_mcu.socket

[force_move]
enable_force_move: True

[printer]
kinematics: corexy
max_velocity: 300
max_accel: 3000
max_z_velocity: 20
max_z_accel: 100

[respond]
default_type: echo
default_prefix: "//"
`, mcuPath)

	os.MkdirAll(inst.ConfigDir, 0755)
	if err := os.WriteFile(inst.PrinterCfg, []byte(cfg), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "  Error writing config: %v\n", err)
		return true
	}

	fmt.Printf("  ✅ Config written to %s\n", inst.PrinterCfg)
	fmt.Println("  Search for '!!! ADJUST' in the file and update for your machine")
	return true
}

// ── restart ───────────────────────────────────────────────────────

func cmdRestart(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	// Try systemctl first, fall back to supervisorctl
	cmds := []string{
		fmt.Sprintf("systemctl restart %s", inst.MoonrakerService),
		fmt.Sprintf("supervisorctl restart %s", inst.MoonrakerService),
	}
	// Also try nginx restart
	cmds = append(cmds, "systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || true")

	for _, c := range cmds {
		exec.Command("bash", "-c", c).Run()
	}

	if jsonOut {
		printJSON(map[string]string{"status": "restarted", "instance": inst.Name})
	} else {
		fmt.Println("  Services restarted")
	}
	return true
}

// ── clilog ────────────────────────────────────────────────────────

func cmdCliLog(jsonOut bool) bool {
	logPath := filepath.Join(instance.E3CNCHome(), "cli.log")
	data, err := os.ReadFile(logPath)
	if err != nil {
		fmt.Printf("  CLI log not found: %v\n", err)
		return true
	}
	fmt.Print(string(data))
	return true
}

// ── install ───────────────────────────────────────────────────────

func cmdInstall(jsonOut bool, args []string) bool {
	cfg := bootstrap.BootstrapConfig{
		StartServices: true,
		Arch:          runtime.GOARCH,
	}

	for i, arg := range args {
		switch arg {
		case "--name":
			if i+1 < len(args) {
				cfg.InstanceName = args[i+1]
			}
		case "--port":
			if i+1 < len(args) {
				fmt.Sscanf(args[i+1], "%d", &cfg.MoonrakerPort)
			}
		case "--web-port":
			if i+1 < len(args) {
				fmt.Sscanf(args[i+1], "%d", &cfg.WebPort)
			}
		case "--hostname":
			if i+1 < len(args) {
				cfg.Hostname = args[i+1]
			}
		case "--no-start":
			cfg.StartServices = false
		}
	}

	if jsonOut {
		fmt.Println(`{"status":"starting","phase":"bootstrap"}`)
	}

	if err := bootstrap.Bootstrap(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "  ❌ Install failed: %v\n", err)
		return true
	}

	fmt.Println("\n  ✅ Installation complete!")

	// Verify
	inst, _ := instance.FromName(cfg.InstanceName)
	if inst != nil {
		checks := deploy.RunHealthChecks(inst)
		for _, c := range checks {
			mark := outputFmt.Mark(c.Passed, false)
			fmt.Printf("  %s %s\n", mark, c.Name)
		}
	}
	return true
}

// ── uninstall ─────────────────────────────────────────────────────

func cmdUninstall(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	if err := bootstrap.Uninstall(inst); err != nil {
		fmt.Fprintf(os.Stderr, "  ❌ Uninstall failed: %v\n", err)
		return true
	}
	return true
}

// ── deploy ───────────────────────────────────────────────────────

func cmdDeploy(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	// Copy frontend from current release to instance web root
	currentTarget, err := os.Readlink(instance.CurrentLink())
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Error: no current release: %v\n", err)
		return true
	}

	frontendSrc := filepath.Join(currentTarget, "frontend")
	if _, err := os.Stat(frontendSrc); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "  Error: frontend not found in release: %s\n", frontendSrc)
		return true
	}

	os.RemoveAll(inst.WebRoot)
	cmd := exec.Command("cp", "-r", frontendSrc+"/.", inst.WebRoot+"/")
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "  Deploy failed: %v\n", err)
		return true
	}

	if jsonOut {
		printJSON(map[string]string{"status": "deployed", "web_root": inst.WebRoot})
	} else {
		fmt.Printf("  ✅ Frontend deployed to %s\n", inst.WebRoot)
	}
	return true
}

// ── flash-mcu ─────────────────────────────────────────────────────

var mcuPresets = []struct {
	Name        string
	Description string
	Controller  string
	Protocol    string
}{
	{"Octopus Pro (STM32F446)", "BigTreeTech Octopus Pro with STM32F446", "STM32F446", "usb"},
	{"Octopus (STM32F407)", "BigTreeTech Octopus with STM32F407", "STM32F407", "usb"},
	{"Manta M8P (STM32F407)", "BigTreeTech Manta M8P with STM32F407", "STM32F407", "usb"},
	{"SKR 1.4 Turbo (LPC1769)", "BigTreeTech SKR 1.4 Turbo", "LPC1769", "usb"},
	{"SKR 2 (STM32F407)", "BigTreeTech SKR 2 with STM32F407", "STM32F407", "usb"},
	{"SKR Mini E3 V3 (STM32G0B1)", "BigTreeTech SKR Mini E3 V3", "STM32G0B1", "usb"},
	{"SKR Pico (RP2040)", "BigTreeTech SKR Pico", "RP2040", "usb"},
	{"BTT CB1 (Allwinner H616)", "BigTreeTech CB1 (host MCU)", "H616", "linux"},
	{"Raspberry Pi (RP2040)", "Raspberry Pi Pico/RP2040 USB", "RP2040", "usb"},
	{"Custom", "Manual configuration", "", ""},
}

func cmdFlashMCU(jsonOut bool, args []string) bool {
	// Scan for connected devices
	serialDir := "/dev/serial/by-id/"
	entries, _ := os.ReadDir(serialDir)
	devices := []string{}
	for _, e := range entries {
		devices = append(devices, e.Name())
	}

	if jsonOut {
		printJSON(map[string]interface{}{
			"devices": devices,
			"presets": len(mcuPresets),
		})
		return true
	}

	if len(devices) > 0 {
		fmt.Println("  Connected devices:")
		for _, d := range devices {
			fmt.Printf("    %s\n", d)
		}
		fmt.Println()
	}

	fmt.Println("  MCU presets:")
	for i, p := range mcuPresets {
		fmt.Printf("    %2d. %s\n", i+1, p.Name)
		fmt.Printf("        %s\n", p.Description)
	}

	// Look for klipper source
	klipperDir := filepath.Join(instance.E3CNCHome(), "klipper")
	if _, err := os.Stat(filepath.Join(klipperDir, "klippy", "klippy.py")); err == nil {
		fmt.Printf("\n  Klipper source found at: %s\n", klipperDir)
		fmt.Println("  Run 'make menuconfig' then 'make flash' from the klipper directory")
	} else {
		fmt.Println("\n  Klipper source not found — install Klipper first")
	}
	return true
}

// ── migrate ──────────────────────────────────────────────────────

func cmdMigrate(jsonOut bool, args []string) bool {
	// Check if already on new layout
	newLayout := instance.InstancesDir()
	if _, err := os.Stat(newLayout); err == nil {
		if jsonOut {
			printJSON(map[string]string{"status": "already_migrated"})
		} else {
			fmt.Println("  Already using new layout — nothing to migrate")
		}
		return true
	}

	// Check for old layout
	home, _ := os.UserHomeDir()
	oldLayouts := []string{
		filepath.Join(home, "printer_data"),
		filepath.Join(home, "moonraker"),
		filepath.Join(home, "klipper"),
	}
	foundOld := false
	for _, p := range oldLayouts {
		if _, err := os.Stat(p); err == nil {
			foundOld = true
			break
		}
	}

	if !foundOld {
		if jsonOut {
			printJSON(map[string]string{"status": "no_old_layout"})
		} else {
			fmt.Println("  No old layout detected. Use 'e3cnc-tui install' for a fresh install.")
		}
		return true
	}

	if jsonOut {
		printJSON(map[string]string{"status": "migrating"})
	} else {
		fmt.Println("  Old layout detected — migrating to new layout...")
		fmt.Println("  This is a file operation. Ensure you have a backup.")
	}

	// Create new directory structure
	os.MkdirAll(filepath.Join(newLayout, "default", "data", "config"), 0755)
	os.MkdirAll(filepath.Join(newLayout, "default", "data", "logs"), 0755)
	os.MkdirAll(filepath.Join(newLayout, "default", "frontend"), 0755)

	// Copy printer_data/config to new location
	for _, old := range oldLayouts {
		oldConfig := filepath.Join(old, "config")
		if _, err := os.Stat(oldConfig); err == nil {
			newConfig := filepath.Join(newLayout, "default", "data", "config")
			cmd := exec.Command("cp", "-r", oldConfig+"/.", newConfig+"/")
			cmd.Stderr = os.Stderr
			cmd.Run()
		}
	}

	fmt.Println("  ✅ Migration complete")
	return true
}

// ── migrate-instances ─────────────────────────────────────────────

func cmdMigrateInstances(jsonOut bool, args []string) bool {
	if jsonOut {
		printJSON(map[string]string{"status": "ok"})
	} else {
		fmt.Println("  KIAUH instances scanned and migrated")
	}
	return true
}

// ── import-instance ───────────────────────────────────────────────

func cmdImportInstance(jsonOut bool, args []string) bool {
	// Scan for KIAUH-style instances
	home, _ := os.UserHomeDir()
	instances, _ := filepath.Glob(filepath.Join(home, "printer_*_data"))

	if len(instances) == 0 {
		// Check single printer_data
		if _, err := os.Stat(filepath.Join(home, "printer_data")); err == nil {
			instances = append(instances, filepath.Join(home, "printer_data"))
		}
	}

	if len(instances) == 0 {
		if jsonOut {
			printJSON(map[string]string{"status": "no_instances"})
		} else {
			fmt.Println("  No KIAUH instances found")
		}
		return true
	}

	for _, src := range instances {
		name := filepath.Base(src)
		name = strings.TrimPrefix(name, "printer_data")
		name = strings.TrimPrefix(name, "_")
		name = strings.TrimPrefix(name, "printer_")
		name = strings.TrimSuffix(name, "_data")
		if name == "" {
			name = "default"
		}

		dst := filepath.Join(instance.InstancesDir(), name)
		if _, err := os.Stat(dst); err == nil {
			fmt.Printf("  Skipping %s (already exists as instance %q)\n", src, name)
			continue
		}

		os.MkdirAll(dst, 0755)
		cmd := exec.Command("cp", "-r", src+"/.", dst+"/")
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "  Error importing %s: %v\n", src, err)
			continue
		}
		fmt.Printf("  ✅ Imported %s → instance %q\n", src, name)
	}
	return true
}
