package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

const (
	// MaxBackups is the maximum number of pre-install backups to retain.
	MaxBackups = 5

	// backupPrefix is the prefix for backup directory names.
	backupPrefix = "pre-install-"
)

// BackupExisting creates a smart-content backup of the E3CNC installation.
// Only backs up instances/ and logs/ — skips releases/, admin/, and backups/.
// Returns the path to the created backup.
func BackupExisting() (string, error) {
	e3cncDir := e3cncHome()
	if !dirExists(e3cncDir) {
		return "", nil // nothing to back up
	}

	backupsDir := filepath.Join(e3cncDir, "backups")
	if err := os.MkdirAll(backupsDir, 0700); err != nil {
		return "", fmt.Errorf("create backups dir: %w", err)
	}

	timestamp := time.Now().Format("20060102_150405")
	backupPath := filepath.Join(backupsDir, backupPrefix+timestamp)

	if err := os.MkdirAll(backupPath, 0700); err != nil {
		return "", fmt.Errorf("create backup dir: %w", err)
	}

	// Backup instances/ directory (contains config, database, macros, gcodes)
	instancesSrc := filepath.Join(e3cncDir, "instances")
	if dirExists(instancesSrc) {
		dst := filepath.Join(backupPath, "instances")
		if err := copyDirPreserve(instancesSrc, dst); err != nil {
			return "", fmt.Errorf("backup instances: %w", err)
		}
	}

	// Backup logs/ directory (useful for troubleshooting)
	logsSrc := filepath.Join(e3cncDir, "logs")
	if dirExists(logsSrc) {
		dst := filepath.Join(backupPath, "logs")
		if err := copyDirPreserve(logsSrc, dst); err != nil {
			// Non-fatal: logs are not critical
			fmt.Fprintf(os.Stderr, "  Warning: could not backup logs: %v\n", err)
		}
	}

	// Prune old backups
	pruneOldBackups(backupsDir)

	return backupPath, nil
}

// pruneOldBackups removes the oldest backups when the count exceeds MaxBackups.
func pruneOldBackups(backupsDir string) {
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		return
	}

	var backupDirs []string
	for _, entry := range entries {
		if entry.IsDir() && len(entry.Name()) > len(backupPrefix) {
			backupDirs = append(backupDirs, entry.Name())
		}
	}

	if len(backupDirs) <= MaxBackups {
		return
	}

	// Sort by name (timestamp in name makes this chronological)
	sort.Strings(backupDirs)

	// Remove oldest backups beyond the limit
	toRemove := len(backupDirs) - MaxBackups
	for i := 0; i < toRemove; i++ {
		path := filepath.Join(backupsDir, backupDirs[i])
		if err := os.RemoveAll(path); err != nil {
			fmt.Fprintf(os.Stderr, "  Warning: could not remove old backup %s: %v\n", path, err)
		}
	}
}

// copyDirPreserve copies a directory recursively, preserving file permissions.
// Symlinks are recreated at the destination (not followed/read as files).
func copyDirPreserve(src, dst string) error {
	// Create the root destination directory first
	if err := os.MkdirAll(dst, 0755); err != nil {
		return fmt.Errorf("mkdir dst %s: %w", dst, err)
	}

	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}

		dstPath := filepath.Join(dst, rel)

		// Preserve symlinks (e.g. the `current` symlink pointing to an
		// active instance directory) rather than reading them as files.
		if info.Mode()&os.ModeSymlink != 0 {
			if _, serr := os.Lstat(dstPath); serr == nil {
				return nil
			}
			target, lerr := os.Readlink(path)
			if lerr != nil {
				return fmt.Errorf("readlink %s: %w", path, lerr)
			}
			if serr := os.Symlink(target, dstPath); serr != nil {
				return fmt.Errorf("symlink %s -> %s: %w", dstPath, target, serr)
			}
			return nil
		}

		if info.IsDir() {
			return os.MkdirAll(dstPath, info.Mode())
		}

		// Ensure parent directory exists
		if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			return fmt.Errorf("mkdir parent %s: %w", filepath.Dir(dstPath), err)
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}
		if err := os.WriteFile(dstPath, data, info.Mode()); err != nil {
			return fmt.Errorf("write %s: %w", dstPath, err)
		}

		return nil
	})
}

// E3CNCHome is the path to the E3CNC home directory.
// Override for testing by setting testE3CNCHome.
var E3CNCHome = defaultE3CNCHome

// testE3CNCHome overrides E3CNCHome when set. Used by tests.
var testE3CNCHome string

func defaultE3CNCHome() string {
	if testE3CNCHome != "" {
		return testE3CNCHome
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join("/home", os.Getenv("USER"), "E3CNC")
	}
	return filepath.Join(home, "E3CNC")
}

// e3cncHome returns the path to the E3CNC home directory.
func e3cncHome() string {
	return E3CNCHome()
}
