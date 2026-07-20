package bootstrap

import (
	"fmt"
	"net"
	"sort"
)

// PortInfo holds the detected ports for all E3CNC services.
type PortInfo struct {
	AdminPort    int `json:"admin_port"`
	MoonrakerPort int `json:"moonraker_port"`
	KlipperPort  int `json:"klipper_port"`
}

// Default ports for each service.
const (
	DefaultAdminPort    = 8081
	DefaultMoonrakerPort = 7125
	DefaultKlipperPort  = 7126
)

// portInUse checks if a TCP port is already bound by any process.
// Uses net.Listen to actually attempt binding — more accurate than
// parsing ss/netstat output.
func portInUse(port int) bool {
	addr := fmt.Sprintf(":%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return true // port is in use
	}
	ln.Close()
	return false
}

// findFreePort finds the next available port starting from `start`,
// scanning upward up to `maxTries` ports. Returns 0 if none found.
func findFreePort(start, maxTries int) int {
	for i := 0; i < maxTries; i++ {
		port := start + i
		if !portInUse(port) {
			return port
		}
	}
	return 0
}

// AutoDetectPorts checks the default ports for admin UI, Moonraker, and
// Klipper services. If a default port is in use, it scans upward to find
// the next available port for that service.
func AutoDetectPorts() PortInfo {
	info := PortInfo{}

	// Admin UI port
	info.AdminPort = DefaultAdminPort
	if portInUse(DefaultAdminPort) {
		if p := findFreePort(DefaultAdminPort+1, 100); p > 0 {
			info.AdminPort = p
		}
	}

	// Moonraker API port
	info.MoonrakerPort = DefaultMoonrakerPort
	if portInUse(DefaultMoonrakerPort) {
		if p := findFreePort(DefaultMoonrakerPort+1, 100); p > 0 {
			info.MoonrakerPort = p
		}
	}

	// Klipper API port
	info.KlipperPort = DefaultKlipperPort
	if portInUse(DefaultKlipperPort) {
		if p := findFreePort(DefaultKlipperPort+1, 100); p > 0 {
			info.KlipperPort = p
		}
	}

	return info
}

// DetectPortsOnly runs AutoDetectPorts and returns a formatted summary.
// Used by the --port-detect flag for standalone port detection.
func DetectPortsOnly() PortInfo {
	return AutoDetectPorts()
}

// PortSummary returns a human-readable summary of detected ports.
func PortSummary(ports PortInfo) string {
	var busy []int
	for _, p := range []int{ports.AdminPort, ports.MoonrakerPort, ports.KlipperPort} {
		if portInUse(p) {
			busy = append(busy, p)
		}
	}

	summary := fmt.Sprintf(
		"Admin UI:   %d\nMoonraker:  %d\nKlipper:    %d",
		ports.AdminPort, ports.MoonrakerPort, ports.KlipperPort,
	)

	if len(busy) > 0 {
		sort.Ints(busy)
		summary += fmt.Sprintf("\n\n⚠️  Warning: %d port(s) reported as in use after detection: %v", len(busy), busy)
		summary += "\n   This may indicate a race condition or a service started between detection and use."
	}

	return summary
}
