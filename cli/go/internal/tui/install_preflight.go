package tui

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"
)

// ── Pre-flight checks ───────────────────────────────────────────

func (m InstallModel) runPreFlightChecks() tea.Cmd {
	return func() tea.Msg {
		var results []PreFlightCheck
		for _, check := range defaultPreFlightLabels {
			status, detail := check.fn()
			results = append(results, PreFlightCheck{
				Label:  check.label,
				Status: status,
				Detail: detail,
			})
		}
		allPassed := true
		for _, r := range results {
			if r.Status == "failed" {
				allPassed = false
			}
		}
		return preFlightCompleteMsg{allPassed: allPassed, results: results}
	}
}

func checkOS() (string, string) {
	if runtime.GOOS == "linux" {
		return "passed", runtime.GOARCH
	}
	return "failed", fmt.Sprintf("expected linux, got %s", runtime.GOOS)
}

func checkPython() (string, string) {
	out, err := exec.Command("python3", "--version").Output()
	if err != nil {
		return "failed", "python3 not found"
	}
	version := strings.TrimSpace(string(out))
	return "passed", version
}

func checkBinary(name string) func() (string, string) {
	return func() (string, string) {
		_, err := exec.LookPath(name)
		if err != nil {
			return "failed", "not found in PATH"
		}
		return "passed", fmt.Sprintf("found at %s", name)
	}
}

func checkDiskSpace() (string, string) {
	var stat syscall.Statfs_t
	home, _ := os.UserHomeDir()
	err := syscall.Statfs(home, &stat)
	if err != nil {
		return "failed", "cannot check disk space"
	}
	available := stat.Bavail * uint64(stat.Bsize)
	availableGB := float64(available) / (1024 * 1024 * 1024)
	if availableGB > 0.5 {
		return "passed", fmt.Sprintf("%.1f GB free", availableGB)
	}
	return "failed", fmt.Sprintf("only %.1f GB free, need >0.5 GB", availableGB)
}

func checkSudo() (string, string) {
	cmd := exec.Command("sudo", "-n", "true")
	if err := cmd.Run(); err != nil {
		return "failed", "NOPASSWD sudo not available"
	}
	return "passed", "passwordless"
}

func checkGitHubAPI() (string, string) {
	cmd := exec.Command("curl", "-s", "--connect-timeout", "5",
		"https://api.github.com/repos/E3CNC/e3cnc")
	if err := cmd.Run(); err != nil {
		return "failed", "GitHub API unreachable"
	}
	return "passed", "reachable"
}
