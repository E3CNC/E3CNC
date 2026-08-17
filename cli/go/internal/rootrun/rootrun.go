// Package rootrun provides a single, shared, non-interactive boundary for
// executing commands as root (used by install, runtime service management,
// and health checks). It centralizes the "run as root without prompting"
// policy and exposes an overridable Exec seam so tests can stub execution.
package rootrun

import (
	"io"
	"os"
	"os/exec"
)

// Exec is the injectable command executor (captures combined output). Tests
// may replace it with a stub. It mirrors the runCommand/writeFileSudo seams.
var Exec = func(name string, args ...string) ([]byte, error) {
	cmd := exec.Command(name, args...)
	return cmd.CombinedOutput()
}

// ExecStreaming is the injectable streaming executor (writes to the given
// writers). Tests may replace it with a stub.
var ExecStreaming = func(stdout, stderr io.Writer, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout, cmd.Stderr = stdout, stderr
	return cmd.Run()
}

// rootCheck is the root-detection function, overridable in tests.
var rootCheck = func() bool { return os.Geteuid() == 0 }

// IsRoot reports whether the process runs with effective UID 0.
func IsRoot() bool { return rootCheck() }

// RunAsRoot executes a command as root, non-interactively, and returns its
// combined output. When the process is already root it runs the command
// directly; otherwise it prefixes `sudo -n` (fail fast, never prompts).
func RunAsRoot(args ...string) ([]byte, error) {
	name, rest := args[0], args[1:]
	if rootCheck() {
		return Exec(name, rest...)
	}
	return Exec("sudo", append([]string{"-n", name}, rest...)...)
}

// RunAsRootStream executes a command as root, non-interactively, streaming
// output to the given writers (e.g. an install log). It never prompts.
func RunAsRootStream(stdout, stderr io.Writer, args ...string) error {
	name, rest := args[0], args[1:]
	if rootCheck() {
		return ExecStreaming(stdout, stderr, name, rest...)
	}
	return ExecStreaming(stdout, stderr, "sudo", append([]string{"-n", name}, rest...)...)
}
