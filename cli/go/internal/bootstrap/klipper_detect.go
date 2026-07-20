package bootstrap

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// DetectedKlipper holds information about an existing Klipper installation found on the system.
type DetectedKlipper struct {
	KlipperDir    string // path to klipper directory (e.g. ~/klipper, /home/pi/klipper)
	KlippyPy      string // path to klippy/klippy.py if found
	ConfigDir     string // path to config directory containing printer.cfg
	PrinterCfg    string // path to printer.cfg
	MCUPath       string // serial path from [mcu] section of printer.cfg
	ViaSystemd    bool   // whether Klipper is running as a systemd service
	ServiceName   string // systemd service name if applicable
	MoonrakerInstalled bool // whether Moonraker is also installed
	MoonrakerDir  string // path to moonraker directory if found
}

// commonKlipperPaths returns likely locations for Klipper installations,
// ordered by probability (most common first).
func commonKlipperPaths() []string {
	home, _ := os.UserHomeDir()
	paths := []string{
		filepath.Join(home, "klipper"),
		filepath.Join(home, "printer_data"),
		filepath.Join("/home", "pi", "klipper"),
		filepath.Join("/home", "pi", "printer_data"),
		filepath.Join(home, "klipper3d"),
		"/usr/local/klipper",
		"/opt/klipper",
	}
	// Deduplicate while preserving order
	seen := make(map[string]bool)
	uniq := make([]string, 0, len(paths))
	for _, p := range paths {
		if seen[p] {
			continue
		}
		seen[p] = true
		uniq = append(uniq, p)
	}
	return uniq
}

// commonConfigPaths returns likely locations for printer.cfg relative to
// a Klipper installation directory or user home.
func commonConfigPaths(baseDir string) []string {
	home, _ := os.UserHomeDir()
	paths := []string{
		filepath.Join(baseDir, "printer.cfg"),
		filepath.Join(baseDir, "config", "printer.cfg"),
		filepath.Join(baseDir, "printer_data", "config", "printer.cfg"),
		filepath.Join(home, "printer.cfg"),
		filepath.Join(home, "printer_data", "config", "printer.cfg"),
		filepath.Join("/home", "pi", "printer.cfg"),
		filepath.Join("/home", "pi", "printer_data", "config", "printer.cfg"),
	}
	return paths
}

// DetectExistingKlipper performs a heuristic scan of the system to find
// any existing Klipper installations. It checks common paths, scans for
// systemd services, and parses printer.cfg for MCU configuration.
// Returns the first (most likely) installation found.
func DetectExistingKlipper() (*DetectedKlipper, error) {
	results, err := DetectAllKlipperInstalls()
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("no existing Klipper installation found")
	}
	return &results[0], nil
}

// DetectAllKlipperInstalls scans the system and returns ALL found Klipper installations.
// Unlike DetectExistingKlipper which returns the first hit, this returns every
// detected installation for use in a multi-picker UI.
func DetectAllKlipperInstalls() ([]DetectedKlipper, error) {
	var results []DetectedKlipper
	seenPaths := make(map[string]bool)

	// Phase 1: Check common Klipper directories
	for _, path := range commonKlipperPaths() {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			inst := probeKlipperDir(path, seenPaths)
			if inst != nil {
				results = append(results, *inst)
			}
		}
	}

	// Phase 2: Check for standalone printer.cfg files (not in a klipper dir)
	home, _ := os.UserHomeDir()
	standaloneCfgPaths := []string{
		filepath.Join(home, "printer.cfg"),
		filepath.Join(home, "printer_data", "config", "printer.cfg"),
		filepath.Join("/home", "pi", "printer.cfg"),
		filepath.Join("/home", "pi", "printer_data", "config", "printer.cfg"),
	}
	for _, cfgPath := range standaloneCfgPaths {
		if seenPaths[cfgPath] {
			continue
		}
		if info, err := os.Stat(cfgPath); err == nil && !info.IsDir() {
			// Found a standalone printer.cfg — create an entry for it
			mcuPath := parseMCUFromPrinterCfg(cfgPath)
			results = append(results, DetectedKlipper{
				ConfigDir:  filepath.Dir(cfgPath),
				PrinterCfg: cfgPath,
				MCUPath:    mcuPath,
			})
			seenPaths[cfgPath] = true
		}
	}

	// Phase 3: Check systemd for Klipper services
	serviceName := detectKlipperSystemdService()
	if serviceName != "" {
		// If we found a service but no directory, create a minimal entry
		hasServiceEntry := false
		for i := range results {
			if results[i].ServiceName == serviceName {
				results[i].ViaSystemd = true
				hasServiceEntry = true
				break
			}
		}
		if !hasServiceEntry {
			results = append(results, DetectedKlipper{
				ViaSystemd:  true,
				ServiceName: serviceName,
			})
		}
	}

	if len(results) > 0 {
		return results, nil
	}

	return nil, fmt.Errorf("no existing Klipper installation found")
}

// probeKlipperDir examines a single directory for Klipper installation artifacts
// and returns a DetectedKlipper if found, or nil if the dir doesn't look like Klipper.
func probeKlipperDir(path string, seenPaths map[string]bool) *DetectedKlipper {
	inst := &DetectedKlipper{KlipperDir: path}

	// Check for klippy.py
	klippyPath := filepath.Join(path, "klippy", "klippy.py")
	if _, err := os.Stat(klippyPath); err == nil {
		inst.KlippyPy = klippyPath
	}

	// Check for moonraker in the same prefix
	moonrakerCandidates := []string{
		strings.Replace(path, "klipper", "moonraker", 1),
		filepath.Join(filepath.Dir(path), "moonraker"),
		filepath.Join(path, "moonraker"),
	}
	home, _ := os.UserHomeDir()
	moonrakerCandidates = append(moonrakerCandidates,
		filepath.Join(home, "moonraker"),
		filepath.Join(home, "printer_data", "moonraker"),
	)
	for _, mp := range moonrakerCandidates {
		if mp != "" && mp != path {
			if info, err := os.Stat(mp); err == nil && info.IsDir() {
				inst.MoonrakerDir = mp
				inst.MoonrakerInstalled = true
				seenPaths[mp] = true
				break
			}
		}
	}

	// Find printer.cfg
	for _, cfgPath := range commonConfigPaths(path) {
		if info, err := os.Stat(cfgPath); err == nil && !info.IsDir() {
			inst.PrinterCfg = cfgPath
			inst.ConfigDir = filepath.Dir(cfgPath)
			seenPaths[cfgPath] = true

			mcuPath := parseMCUFromPrinterCfg(cfgPath)
			if mcuPath != "" {
				inst.MCUPath = mcuPath
			}
			break
		}
	}

	// Mark the klipper dir as seen
	seenPaths[path] = true

	// Only return if we found something meaningful
	if inst.KlippyPy != "" || inst.PrinterCfg != "" {
		return inst
	}
	return nil
}

// parseMCUFromPrinterCfg reads a printer.cfg file and extracts the MCU serial path
// from the [mcu] section. It handles both `serial:` and `canbus_uuid:` entries.
func parseMCUFromPrinterCfg(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}

	lines := strings.Split(string(data), "\n")
	inMCUSection := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Skip comments and empty lines
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// Track section boundaries
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			inMCUSection = strings.EqualFold(trimmed, "[mcu]")
			continue
		}

		if inMCUSection {
			// Look for serial: or canbus_uuid: entries
			if strings.HasPrefix(trimmed, "serial:") {
				val := strings.TrimSpace(strings.TrimPrefix(trimmed, "serial:"))
				if val != "" {
					return val
				}
			}
			if strings.HasPrefix(trimmed, "canbus_uuid:") {
				val := strings.TrimSpace(strings.TrimPrefix(trimmed, "canbus_uuid:"))
				if val != "" {
					return fmt.Sprintf("canbus_uuid:%s", val)
				}
			}
		}
	}

	return ""
}

// detectKlipperSystemdService checks for Klipper systemd services.
// It looks for common service names and returns the first one found.
func detectKlipperSystemdService() string {
	serviceNames := []string{
		"klipper",
		"klipper.service",
		"Klipper",
		"Klipper.service",
	}

	for _, name := range serviceNames {
		// Check if the service file exists on disk
		unitPath := filepath.Join("/etc", "systemd", "system", name)
		if _, err := os.Stat(unitPath); err == nil {
			return name
		}
		// Also check user service directory
		home, _ := os.UserHomeDir()
		userUnitPath := filepath.Join(home, ".config", "systemd", "user", name)
		if _, err := os.Stat(userUnitPath); err == nil {
			return name
		}
	}

	// Fallback: try running systemctl list-units (non-fatal if it fails)
	cmd := exec.Command("systemctl", "list-units", "--type=service", "--all", "--no-legend", "--no-pager")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(output), "\n") {
		lower := strings.ToLower(line)
		if strings.Contains(lower, "klipper.service") {
			fields := strings.Fields(line)
			if len(fields) > 0 {
				return fields[0]
			}
		}
	}

	return ""
}