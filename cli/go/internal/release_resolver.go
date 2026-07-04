// Package internal provides shared utilities for the e3cnc-tui Go binary.
package internal

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// FindPythonCLI resolves the path to the Python CLI entry point.
// Search order:
//  1. E3CNC_PYTHON env var (explicit Python interpreter path)
//  2. ~/e3cnc/current/cli/ (deployed release path)
//  3. Repo checkout relative to this binary's location
//
// Returns the absolute path to the cli package directory and the Python interpreter.
func FindPythonCLI() (cliDir string, pythonExe string, err error) {
	// 1. Resolve Python interpreter
	pythonExe = resolvePython()
	if pythonExe == "" {
		return "", "", fmt.Errorf("python3 not found in PATH and E3CNC_PYTHON not set")
	}

	// 2. Check deployed release first
	home, _ := os.UserHomeDir()
	releaseCLI := filepath.Join(home, "e3cnc", "current", "cli")
	if info, err := os.Stat(releaseCLI); err == nil && info.IsDir() {
		initPy := filepath.Join(releaseCLI, "__init__.py")
		if _, err := os.Stat(initPy); err == nil {
			return releaseCLI, pythonExe, nil
		}
	}

	// 3. Fall back to repo checkout (relative to this binary)
	// The binary lives at cli/go/bin/e3cnc-tui or cli/go/cmd/e3cnc-tui/e3cnc-tui.
	exe, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exe)
		// From cli/go/bin/ -> ../../cli/
		candidate := filepath.Clean(filepath.Join(exeDir, "..", ".."))
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			initPy := filepath.Join(candidate, "__init__.py")
			if _, err := os.Stat(initPy); err == nil {
				return candidate, pythonExe, nil
			}
		}
		// From cli/go/cmd/e3cnc-tui/ -> ../../../
		candidate = filepath.Clean(filepath.Join(exeDir, "..", "..", "..", ".."))
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			initPy := filepath.Join(candidate, "__init__.py")
			if _, err := os.Stat(initPy); err == nil {
				return candidate, pythonExe, nil
			}
		}
	}

	return "", pythonExe, fmt.Errorf("CLI module not found: checked ~/e3cnc/current/cli/ and repo paths")
}

// resolvePython returns the path to the Python 3 interpreter.
// Checks E3CNC_PYTHON env var, then python3 in PATH, then python in PATH.
func resolvePython() string {
	if p := os.Getenv("E3CNC_PYTHON"); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if p, err := exec.LookPath("python3"); err == nil {
		return p
	}
	if p, err := exec.LookPath("python"); err == nil {
		return p
	}
	return ""
}
