// Consolidated install log — one file that captures everything that happens
// during an install so the user can share a single file for diagnosis:
//
//	~/E3CNC/logs/install.log
//
// Captured streams:
//   - TUI wizard stdout/stderr (tee'd by the caller)
//   - CLI install stdout/stderr (tee'd by the caller)
//   - package manager command output (written via InstallLogWriter)
//   - final error / status (appended by the caller)
//
// The file is append-mode with per-attempt headers so history survives
// across retries.
package bootstrap

import (
	"fmt"
	"io"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"time"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// installLog is the open consolidated install log file, or nil when closed.
var installLog *os.File

// InstallLogPath returns the consolidated install log location.
func InstallLogPath() string {
	return filepath.Join(instance.E3CNCHome(), "logs", "install.log")
}

// OpenInstallLog opens (or creates) the consolidated install log in append
// mode and writes a header for this attempt. Safe to call multiple times —
// subsequent calls are no-ops while the log is open.
func OpenInstallLog() error {
	if installLog != nil {
		return nil
	}
	path := InstallLogPath()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create install log dir: %w", err)
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open install log: %w", err)
	}
	installLog = f
	InstallLogf("=== E3CNC install attempt %s ===", time.Now().Format(time.RFC3339))
	return nil
}

// InstallLogf writes a timestamped line to the consolidated install log.
// No-op when the log is not open (so callers never need to check).
func InstallLogf(format string, args ...any) {
	if installLog == nil {
		return
	}
	fmt.Fprintf(installLog, "[%s] %s\n", time.Now().Format("15:04:05"), fmt.Sprintf(format, args...))
}

// InstallLogWriter returns an io.Writer that appends to the install log.
// Returns io.Discard when the log isn't open so callers can always use it
// as a safe stdout/stderr sink for subprocess output.
func InstallLogWriter() io.Writer {
	if installLog != nil {
		return installLog
	}
	return io.Discard
}

// CloseInstallLog flushes and closes the consolidated install log.
// After closing, it also fixes ownership of the log directory and file
// so the real user can read them without sudo.
func CloseInstallLog() {
	if installLog != nil {
		installLog.Close()
		installLog = nil
	}
	FixInstallLogOwnership()
}

// FixInstallLogOwnership chowns the install log directory and file to the
// original user (SUDO_USER) so they can read it without sudo after install.
// Best-effort — errors are silently ignored.
func FixInstallLogOwnership() {
	uid, gid := sudoUserUIDGID()
	if uid < 0 || gid < 0 {
		return
	}
	path := InstallLogPath()
	os.Chown(path, uid, gid)
	os.Chown(filepath.Dir(path), uid, gid)
}

// sudoUserUIDGID returns the UID and GID of the SUDO_USER, or (-1, -1)
// if SUDO_USER is not set or the lookup fails.
func sudoUserUIDGID() (int, int) {
	sudoUser := os.Getenv("SUDO_USER")
	if sudoUser == "" {
		return -1, -1
	}
	u, err := user.Lookup(sudoUser)
	if err != nil {
		return -1, -1
	}
	uid, _ := strconv.Atoi(u.Uid)
	gid, _ := strconv.Atoi(u.Gid)
	return uid, gid
}
