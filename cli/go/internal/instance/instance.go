// Package instance provides the E3CNC instance model and filesystem helpers.
//
// An Instance represents a single Klipper/Moonraker deployment. Each instance
// has its own directory under ~/e3cnc/instances/{name}/ with data, config,
// and frontend directories.
//
// This is the foundation for the entire CLI — every command operates on an
// instance or needs instance information.
package instance

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Instance represents a detected Klipper/Moonraker instance.
type Instance struct {
	Name             string
	PrinterDataDir   string
	ConfigDir        string
	MoonrakerConf    string
	MoonrakerLog     string
	ScriptsDir       string
	MacrosDir        string
	E3CNCDir         string
	PrinterCfg       string
	WebRoot          string
	MoonrakerDir     string
	KlipperDir       string
	MoonrakerService string
	KlipperService   string
	MoonrakerPort    int
	WebPort          int
	IsRunning        bool
}

// E3CNCHome returns ~/e3cnc.
func E3CNCHome() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "e3cnc")
}

// InstancesDir returns ~/e3cnc/instances.
func InstancesDir() string {
	return filepath.Join(E3CNCHome(), "instances")
}

// ReleasesDir returns ~/e3cnc/releases.
func ReleasesDir() string {
	return filepath.Join(E3CNCHome(), "releases")
}

// CurrentLink returns ~/e3cnc/current.
func CurrentLink() string {
	return filepath.Join(E3CNCHome(), "current")
}

// StateDir returns ~/.e3cnc-tui.
func StateDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".e3cnc-tui")
}

// FromName creates an Instance from a name using the new directory layout.
//
// Paths are deterministic:
//
//	~/e3cnc/instances/{name}/data/config/
//	~/e3cnc/instances/{name}/data/logs/
//	~/e3cnc/instances/{name}/frontend/
func FromName(name string) (*Instance, error) {
	base := filepath.Join(InstancesDir(), name)
	data := filepath.Join(base, "data")
	config := filepath.Join(data, "config")

	if _, err := os.Stat(base); os.IsNotExist(err) {
		return nil, fmt.Errorf("instance %q not found at %s", name, base)
	}

	// Resolve moonraker/klipper dirs from current release (if any)
	moonrakerDir := filepath.Join(E3CNCHome(), "moonraker")
	klipperDir := filepath.Join(E3CNCHome(), "klipper")

	if currentTarget, err := os.Readlink(CurrentLink()); err == nil {
		mdir := filepath.Join(currentTarget, "vendor", "moonraker")
		if fi, err := os.Stat(mdir); err == nil && fi.IsDir() {
			moonrakerDir = mdir
		}
		kdir := filepath.Join(currentTarget, "vendor", "klipper")
		if fi, err := os.Stat(kdir); err == nil && fi.IsDir() {
			klipperDir = kdir
		}
	}

	// Read port from moonraker.conf or use default
	port := 7125
	confFile := filepath.Join(config, "moonraker.conf")
	if data, err := os.ReadFile(confFile); err == nil {
		re := regexp.MustCompile(`(?m)^port:\s*(\d+)\s*$`)
		if m := re.FindSubmatch(data); len(m) > 1 {
			fmt.Sscanf(string(m[1]), "%d", &port)
		}
	}

	webPort := ComputeWebPort(name)

	return &Instance{
		Name:             name,
		PrinterDataDir:   data,
		ConfigDir:        config,
		MoonrakerConf:    confFile,
		MoonrakerLog:     filepath.Join(data, "logs", "moonraker.log"),
		ScriptsDir:       filepath.Join(data, "scripts"),
		MacrosDir:        filepath.Join(config, "E3CNC", "macros"),
		E3CNCDir:         filepath.Join(config, "E3CNC"),
		PrinterCfg:       filepath.Join(config, "printer.cfg"),
		WebRoot:          filepath.Join(base, "frontend"),
		MoonrakerDir:     moonrakerDir,
		KlipperDir:       klipperDir,
		MoonrakerService: fmt.Sprintf("e3cnc-%s-moonraker", name),
		KlipperService:   fmt.Sprintf("e3cnc-%s-klipper", name),
		MoonrakerPort:    port,
		WebPort:          webPort,
		IsRunning:        fileExists(filepath.Join(data, "moonraker.pid")),
	}, nil
}

// DetectInstances scans for instances — new layout (~/e3cnc/instances/*) first.
func DetectInstances() ([]*Instance, error) {
	var instances []*Instance

	entries, err := os.ReadDir(InstancesDir())
	if err != nil {
		// No new layout — try legacy KIAUH layout
		return scanKIAUHInstances()
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		inst, err := FromName(name)
		if err != nil {
			continue
		}
		instances = append(instances, inst)
	}

	return instances, nil
}

// GetActiveInstance returns the currently active instance.
// First checks the persistent state file, then the "cnc" instance,
// then falls back to default, then the first detected instance.
func GetActiveInstance() (*Instance, error) {
	state := LoadState()
	if state.ActiveInstance != "" {
		inst, err := FromName(state.ActiveInstance)
		if err == nil {
			return inst, nil
		}
	}

	// Try "cnc" which is the default on most setups
	inst, err := FromName("cnc")
	if err == nil {
		return inst, nil
	}

	// Try "default" instance
	inst, err = FromName("default")
	if err == nil {
		return inst, nil
	}

	// Try first detected instance
	instances, err := DetectInstances()
	if err != nil || len(instances) == 0 {
		return nil, fmt.Errorf("no instances detected")
	}
	return instances[0], nil
}

// scanKIAUHInstances scans for legacy KIAUH layout instances.
func scanKIAUHInstances() ([]*Instance, error) {
	var instances []*Instance
	home, _ := os.UserHomeDir()
	seen := make(map[string]bool)

	patterns := []string{"printer_data", "printer_data_*", "printer_*_data"}
	for _, pattern := range patterns {
		matches, err := filepath.Glob(filepath.Join(home, pattern))
		if err != nil {
			continue
		}
		for _, candidate := range matches {
			if seen[candidate] {
				continue
			}
			fi, err := os.Stat(candidate)
			if err != nil || !fi.IsDir() {
				continue
			}
			seen[candidate] = true
			conf := filepath.Join(candidate, "config", "moonraker.conf")
			if _, err := os.Stat(conf); err == nil {
				inst, err := FromPrinterData(candidate, home)
				if err == nil {
					instances = append(instances, inst)
				}
			}
		}
	}
	return instances, nil
}

// FromPrinterData creates an Instance from a printer_data path (legacy KIAUH layout).
func FromPrinterData(base string, home string) (*Instance, error) {
	config := filepath.Join(base, "config")
	confPath := filepath.Join(config, "moonraker.conf")
	instanceName := instanceNameFromPrinterData(base)
	systemdDir := filepath.Join(base, "systemd")

	moonrakerDir := readPythonServiceDir(
		filepath.Join(systemdDir, "moonraker.env"),
		"MOONRAKER_ARGS",
		"moonraker.py",
		filepath.Join(home, "moonraker"),
	)
	klipperDir := readPythonServiceDir(
		filepath.Join(systemdDir, "klipper.env"),
		"KLIPPER_ARGS",
		"klippy.py",
		filepath.Join(home, "klipper"),
	)
	webRoot := defaultWebRoot(home, instanceName)
	port := 7125
	if data, err := os.ReadFile(confPath); err == nil {
		re := regexp.MustCompile(`(?m)^port:\s*(\d+)\s*$`)
		if m := re.FindSubmatch(data); len(m) > 1 {
			fmt.Sscanf(string(m[1]), "%d", &port)
		}
	}

	return &Instance{
		Name:             instanceName,
		PrinterDataDir:   base,
		ConfigDir:        config,
		MoonrakerConf:    confPath,
		MoonrakerLog:     filepath.Join(base, "logs", "moonraker.log"),
		ScriptsDir:       filepath.Join(base, "scripts"),
		MacrosDir:        filepath.Join(config, "macros"),
		E3CNCDir:         filepath.Join(config, "E3CNC"),
		PrinterCfg:       filepath.Join(config, "printer.cfg"),
		WebRoot:          webRoot,
		MoonrakerDir:     moonrakerDir,
		KlipperDir:       klipperDir,
		MoonrakerService: readServiceName(base, "moonraker", instanceName),
		KlipperService:   defaultServiceName("klipper", instanceName),
		MoonrakerPort:    port,
		IsRunning:        fileExists(confPath),
	}, nil
}

// ── helpers ───────────────────────────────────────────────────────

// ComputeWebPort derives the web port from the instance name.
// Port 7125 → web port 80, port 7126 → 8080, etc.
func ComputeWebPort(name string) int {
	if name == "default" || name == "" {
		return 80
	}
	// Check if this name has a port suffix
	// For now, return 80 for default instances and 8080 for others
	return 8080
}

func instanceNameFromPrinterData(path string) string {
	base := filepath.Base(path)
	if base == "printer_data" {
		return "default"
	}
	// printer_data_myname or printer_myname_data
	base = strings.TrimPrefix(base, "printer_data_")
	base = strings.TrimPrefix(base, "printer_")
	base = strings.TrimSuffix(base, "_data")
	return base
}

func readServiceName(base string, component string, instanceName string) string {
	envFile := filepath.Join(base, "systemd", fmt.Sprintf("%s.env", component))
	data, err := os.ReadFile(envFile)
	if err != nil {
		return defaultServiceName(component, instanceName)
	}
	re := regexp.MustCompile(fmt.Sprintf(`(?m)^%s_SERVICE_NAME\s*[:=]\s*(.+)$`, strings.ToUpper(component)))
	if m := re.FindSubmatch(data); len(m) > 1 {
		return strings.TrimSpace(string(m[1]))
	}
	return defaultServiceName(component, instanceName)
}

func defaultServiceName(component string, instanceName string) string {
	if instanceName == "default" || instanceName == "" {
		return component
	}
	return fmt.Sprintf("e3cnc-%s-%s", instanceName, component)
}

func defaultWebRoot(home string, instanceName string) string {
	if instanceName == "default" || instanceName == "" {
		return filepath.Join(home, "e3cnc-web")
	}
	return filepath.Join(home, "e3cnc-web", instanceName)
}

func readPythonServiceDir(envFile string, envKey string, pyFile string, defaultDir string) string {
	data, err := os.ReadFile(envFile)
	if err != nil {
		return defaultDir
	}
	re := regexp.MustCompile(fmt.Sprintf(`(?m)^%s\s*[:=]\s*(.+)$`, regexp.QuoteMeta(envKey)))
	if m := re.FindSubmatch(data); len(m) > 1 {
		// Parse the args to find the Python file path
		args := strings.Fields(string(m[1]))
		for _, arg := range args {
			if strings.Contains(arg, pyFile) {
				dir := filepath.Dir(filepath.Dir(arg))
				if fi, err := os.Stat(dir); err == nil && fi.IsDir() {
					return dir
				}
			}
		}
	}
	return defaultDir
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// ── State persistence ─────────────────────────────────────────────

// State represents persistent CLI state.
type State struct {
	ActiveInstance string `json:"active_instance,omitempty"`
	Theme          string `json:"theme,omitempty"`
	LastInstallID  string `json:"last_install_id,omitempty"`
}

// statePath returns the path to the state file.
func statePath() string {
	return filepath.Join(StateDir(), "state.json")
}

// LoadState reads persistent state from disk.
func LoadState() State {
	var s State
	data, err := os.ReadFile(statePath())
	if err != nil {
		return s
	}
	fmt.Sscanf(string(data), `{"active_instance":"%s`, &s.ActiveInstance)
	// Simpler: just try to find the active_instance field
	re := regexp.MustCompile(`"active_instance"\s*:\s*"([^"]+)"`)
	if m := re.FindStringSubmatch(string(data)); len(m) > 1 {
		s.ActiveInstance = m[1]
	}
	return s
}

// SaveState writes persistent state to disk.
func SaveState(s State) error {
	os.MkdirAll(StateDir(), 0755)
	data := fmt.Sprintf(`{"active_instance":"%s"}`, s.ActiveInstance)
	return os.WriteFile(statePath(), []byte(data), 0644)
}

// ── Network helpers ───────────────────────────────────────────────

// GetLocalIP returns the first non-loopback IPv4 address.
func GetLocalIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok {
				if ipnet.IP.To4() != nil && !ipnet.IP.IsLoopback() {
					return ipnet.IP.String()
				}
			}
		}
	}
	return "127.0.0.1"
}

// ── Version ───────────────────────────────────────────────────────

// ReadCurrentVersion reads the version string from the current release.
func ReadCurrentVersion() string {
	target, err := os.Readlink(CurrentLink())
	if err != nil {
		return "unknown"
	}
	return strings.TrimPrefix(filepath.Base(target), "v")
}

// ReadVersion reads all releases and returns info about each.
func ReadReleases() ([]string, string, error) {
	currentTarget, _ := os.Readlink(CurrentLink())
	currentVersion := filepath.Base(currentTarget)

	entries, err := os.ReadDir(ReleasesDir())
	if err != nil {
		return nil, "", err
	}

	var versions []string
	for _, entry := range entries {
		if entry.IsDir() {
			versions = append(versions, entry.Name())
		}
	}
	return versions, currentVersion, nil
}

// ── Port scanning ────────────────────────────────────────────────

// FindNextAvailablePort finds the next available Moonraker port starting from 7125.
func FindNextAvailablePort() (int, error) {
	instances, err := DetectInstances()
	if err != nil {
		return 7125, nil
	}
	used := make(map[int]bool)
	for _, inst := range instances {
		used[inst.MoonrakerPort] = true
	}
	for port := 7125; port < 7200; port++ {
		if !used[port] {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no available ports in range 7125-7199")
}

// ReadMachineProfile reads a machine_profile.yaml file.
// Returns a simple key-value map.
func ReadMachineProfile(inst *Instance) map[string]string {
	result := make(map[string]string)
	path := filepath.Join(InstancesDir(), inst.Name, "machine_profile.yaml")
	f, err := os.Open(path)
	if err != nil {
		return result
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) == 2 {
			result[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	return result
}
