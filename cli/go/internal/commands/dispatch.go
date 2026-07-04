// Package commands provides Go-native implementations of E3CNC CLI commands.
// These replace Python subprocess calls with in-process Go execution.
//
// Each command is a function that takes the parsed command name and optional
// flags/instance name, performs the operation, and prints output to stdout/stderr.
package commands

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
)

// RunDispatch runs a command natively in Go when possible.
// Returns true if the command was handled, false if it should fall through to Python.
func RunDispatch(cmd string) bool {
	switch cmd {
	case "status":
		return cmdStatus(false, "")
	case "instances":
		return cmdInstances(false, "")
	case "releases":
		return cmdReleases(false, "")
	case "check", "check-deps":
		return cmdCheck(false, "")
	case "clilog":
		return cmdCliLog(false, "")
	}
	return false
}

// RunDispatchJSON is the JSON-output variant for commands that support --json.
func RunDispatchJSON(cmd string) bool {
	switch cmd {
	case "status":
		return cmdStatus(true, "")
	case "instances":
		return cmdInstances(true, "")
	case "releases":
		return cmdReleases(true, "")
	case "check", "check-deps":
		return cmdCheck(true, "")
	}
	return false
}

// e3cncHome returns ~/e3cnc.
func e3cncHome() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "e3cnc")
}

// readJSONFile reads and unmarshals a JSON file.
func readJSONFile(path string, v interface{}) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// ── status ────────────────────────────────────────────────────────

// cmdStatus prints installation status (health checks, version info).
func cmdStatus(jsonOut bool, instanceName string) bool {
	base := e3cncHome()

	// Current release
	currentLink := filepath.Join(base, "current")
	currentTarget, err := os.Readlink(currentLink)
	if err != nil {
		if jsonOut {
			printJSONStatusError("no release deployed")
		} else {
			fmt.Println("  No release deployed")
		}
		// Still show basic info even without a release
		currentTarget = "none"
	}
	version := filepath.Base(currentTarget)

	if jsonOut {
		result := map[string]interface{}{
			"version":        version,
			"deployed_path":  currentTarget,
			"e3cnc_home":     base,
			"all_ok":         false,
			"ok_count":       0,
			"total_checks":   7,
			"checks":         []string{},
		}
		json.NewEncoder(os.Stdout).Encode(result)
	} else {
		fmt.Printf("  E3CNC v%s\n", version)
		fmt.Printf("  Path:  %s\n", currentTarget)
		fmt.Printf("  Home:  %s\n", base)
	}
	return true
}

func printJSONStatusError(msg string) {
	result := map[string]interface{}{
		"version":      msg,
		"all_ok":       false,
		"ok_count":     0,
		"total_checks": 0,
		"checks":       []string{},
	}
	json.NewEncoder(os.Stdout).Encode(result)
}

// ── instances ─────────────────────────────────────────────────────

type instanceInfo struct {
	Name             string `json:"name"`
	IsRunning        bool   `json:"is_running"`
	MoonrakerPort    int    `json:"moonraker_port"`
	WebPort          int    `json:"web_port"`
	ConfigDir        string `json:"config_dir"`
	MoonrakerService string `json:"moonraker_service"`
	KlipperService   string `json:"klipper_service"`
	PrinterDataDir   string `json:"printer_data_dir"`
	WebRoot          string `json:"web_root"`
}

func cmdInstances(jsonOut bool, _ string) bool {
	base := e3cncHome()
	instancesDir := filepath.Join(base, "instances")

	entries, err := os.ReadDir(instancesDir)
	if err != nil {
		if jsonOut {
			printJSONInstancesError("cannot read instances directory")
		} else {
			fmt.Printf("  No instances found (error reading %s: %v)\n", instancesDir, err)
		}
		return true
	}

	var instances []instanceInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		cfg, err := readInstanceConfig(name, base)
		if err != nil {
			continue
		}
		instances = append(instances, cfg)
	}

	// Get local IP from network interface
	localIP := getLocalIP()

	if jsonOut {
		result := map[string]interface{}{
			"local_ip":     localIP,
			"instances":    instances,
		}
		json.NewEncoder(os.Stdout).Encode(result)
	} else {
		if len(instances) == 0 {
			fmt.Println("  No instances found")
			return true
		}
		fmt.Println("  Instances:")
		for _, inst := range instances {
			running := "✓"
			if !inst.IsRunning {
				running = "✗"
			}
			fmt.Printf("    %s %s", running, inst.Name)
			if inst.MoonrakerPort > 0 {
				fmt.Printf(" (port %d)", inst.MoonrakerPort)
			}
			fmt.Println()
		}
	}
	return true
}

func printJSONInstancesError(msg string) {
	result := map[string]interface{}{
		"error":     msg,
		"instances": []instanceInfo{},
	}
	json.NewEncoder(os.Stdout).Encode(result)
}

func readInstanceConfig(name, base string) (instanceInfo, error) {
	var info instanceInfo
	info.Name = name
	info.ConfigDir = filepath.Join(base, "instances", name, "data", "config")
	info.PrinterDataDir = filepath.Join(base, "instances", name, "data")

	// Read machine_profile.yaml to get ports
	profilePath := filepath.Join(base, "instances", name, "machine_profile.yaml")
	data, err := os.ReadFile(profilePath)
	if err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "moonraker_port:") {
				fmt.Sscanf(line, "moonraker_port: %d", &info.MoonrakerPort)
			}
			if strings.HasPrefix(line, "web_port:") {
				fmt.Sscanf(line, "web_port: %d", &info.WebPort)
			}
		}
	}

	// Check if service is running via pid file or systemd status
	pidPath := filepath.Join(base, "instances", name, "data", "moonraker.pid")
	if _, err := os.Stat(pidPath); err == nil {
		info.IsRunning = true
	}

	info.MoonrakerService = fmt.Sprintf("moonraker-%s", name)
	info.KlipperService = fmt.Sprintf("klipper-%s", name)
	info.WebRoot = filepath.Join(base, "instances", name, "frontend")

	return info, nil
}

// ── releases ──────────────────────────────────────────────────────

type releaseInfo struct {
	Version   string `json:"version"`
	IsActive  bool   `json:"is_active"`
	SizeBytes int64  `json:"size_bytes"`
	Path      string `json:"path"`
}

func cmdReleases(jsonOut bool, _ string) bool {
	releasesDir := filepath.Join(e3cncHome(), "releases")
	currentLink := filepath.Join(e3cncHome(), "current")
	currentTarget, _ := os.Readlink(currentLink)

	entries, err := os.ReadDir(releasesDir)
	if err != nil {
		if jsonOut {
			printJSONReleasesError("no releases directory")
		} else {
			fmt.Println("  No releases installed")
		}
		return true
	}

	var releases []releaseInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		v := entry.Name()
		relPath := filepath.Join(releasesDir, v)
		info := releaseInfo{
			Version: v,
			IsActive: strings.HasSuffix(currentTarget, v),
			SizeBytes: dirSize(relPath),
			Path: relPath,
		}
		releases = append(releases, info)
	}

	if jsonOut {
		result := map[string]interface{}{
			"current_version": filepath.Base(currentTarget),
			"releases":        releases,
		}
		json.NewEncoder(os.Stdout).Encode(result)
	} else {
		if len(releases) == 0 {
			fmt.Println("  No releases installed")
			fmt.Println("  Run 'e3cnc-cli update' to install the latest release")
			return true
		}
		for _, r := range releases {
			mark := " "
			if r.IsActive {
				mark = "▶"
			}
			fmt.Printf("  %s %s\n", mark, r.Version)
		}
	}
	return true
}

func printJSONReleasesError(msg string) {
	result := map[string]interface{}{
		"error":    msg,
		"releases": []releaseInfo{},
	}
	json.NewEncoder(os.Stdout).Encode(result)
}

// ── check ─────────────────────────────────────────────────────────

func cmdCheck(jsonOut bool, _ string) bool {
	checks := []struct {
		Name   string
		Passed bool
		Detail string
	}{
		{"Python 3.8+", false, ""},
		{"git", false, ""},
		{"curl", false, ""},
		{"unzip", false, ""},
		{"zstd", false, ""},
		{"Disk space", false, ""},
		{"Network", false, ""},
	}

	allPassed := true
	// Python version
	pythonOK := findPython()
	checks[0].Passed = pythonOK

	// Check tools
	for i, tool := range []string{"git", "curl", "unzip", "zstd"} {
			chk := checks[i+1]
		_, err := os.Stat("/usr/bin/" + tool)
		chk.Passed = err == nil
		checks[i+1] = chk
		if err != nil {
			allPassed = false
		}
	}

	if jsonOut {
		type checkResult struct {
			Name   string `json:"name"`
			Passed bool   `json:"passed"`
			Detail string `json:"detail"`
		}
		var results []checkResult
		for _, c := range checks {
			results = append(results, checkResult{c.Name, c.Passed, c.Detail})
		}
		result := map[string]interface{}{
			"all_passed": allPassed,
			"checks":     results,
		}
		json.NewEncoder(os.Stdout).Encode(result)
	} else {
		for _, c := range checks {
			mark := "✓"
			if !c.Passed {
				mark = "✗"
			}
			fmt.Printf("  %s %s\n", mark, c.Name)
		}
	}
	return true
}

func findPython() bool {
	for _, p := range []string{"/usr/bin/python3", "/usr/local/bin/python3"} {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	return false
}

// ── clilog ────────────────────────────────────────────────────────

func cmdCliLog(jsonOut bool, _ string) bool {
	logPath := filepath.Join(e3cncHome(), "cli.log")
	data, err := os.ReadFile(logPath)
	if err != nil {
		fmt.Printf("  CLI log not found: %v\n", err)
		return true
	}
	fmt.Print(string(data))
	return true
}

// ── helpers ───────────────────────────────────────────────────────

func dirSize(path string) int64 {
	var size int64
	filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size
}

func getLocalIP() string {
	// Try common interfaces to find a non-loopback IPv4 address
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return "127.0.0.1"
}
