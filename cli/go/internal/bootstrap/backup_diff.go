package bootstrap

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// BackedUpFile tracks a single file that was backed up before modification.
type BackedUpFile struct {
	Name    string // logical name (e.g. "nginx/e3cnc-default.conf")
	Path    string // absolute path on disk
	Content string // original content before modification
}

// ImportBackup holds a snapshot of files backed up before an import operation.
// After the import runs, call Diff() to see what changed.
type ImportBackup struct {
	dir       string
	timestamp string
	files     []BackedUpFile
}

// BackupImportConfig creates a backup snapshot of the files that will be
// modified during import. It saves the current content of each file
// to a timestamped backup directory and returns a snapshot for diffing.
//
// files is a map of logical name -> absolute path for each file
// that will be modified (e.g., "nginx/e3cnc-default.conf" -> "/etc/nginx/sites-available/e3cnc-default").
func BackupImportConfig(files map[string]string) (*ImportBackup, error) {
	ts := time.Now().Format("20060102_150405")

	backupDir := filepath.Join(e3cncHome(), "backups", "import-"+ts)
	if err := os.MkdirAll(backupDir, 0700); err != nil {
		return nil, fmt.Errorf("create import backup dir: %w", err)
	}

	snapshot := &ImportBackup{
		dir:       backupDir,
		timestamp: ts,
	}

	// Sort logical names for deterministic ordering
	var names []string
	for name := range files {
		names = append(names, name)
	}
	sortStrings(names)

	for _, name := range names {
		path := files[name]
		data, err := os.ReadFile(path)
		if err != nil {
			if os.IsNotExist(err) {
				// File doesn't exist yet — that's fine, backup is empty
				snapshot.files = append(snapshot.files, BackedUpFile{
					Name:    name,
					Path:    path,
					Content: "",
				})
				continue
			}
			return nil, fmt.Errorf("read %s (%s): %w", name, path, err)
		}
		content := string(data)
		snapshot.files = append(snapshot.files, BackedUpFile{
			Name:    name,
			Path:    path,
			Content: content,
		})

		// Save a copy to the backup directory
		backupFilePath := filepath.Join(backupDir, name)
		if err := os.MkdirAll(filepath.Dir(backupFilePath), 0700); err != nil {
			return nil, fmt.Errorf("create backup subdir for %s: %w", name, err)
		}
		if err := os.WriteFile(backupFilePath, data, 0644); err != nil {
			return nil, fmt.Errorf("write backup %s: %w", backupFilePath, err)
		}
	}

	return snapshot, nil
}

// Diff reads the current content of each backed-up file and returns
// a human-readable diff showing what changed. Returns an empty string
// if no files changed.
func (b *ImportBackup) Diff() string {
	if b == nil || len(b.files) == 0 {
		return ""
	}

	var parts []string
	for _, f := range b.files {
		current, err := os.ReadFile(f.Path)
		if err != nil {
			parts = append(parts, fmt.Sprintf("  [%s] error: %v", f.Name, err))
			continue
		}

		currentStr := string(current)
		if currentStr == f.Content {
			continue
		}

		diff := lineDiff(f.Content, currentStr)
		parts = append(parts, fmt.Sprintf("  [%s]:\n%s", f.Name, indentLines(diff, "    ")))
	}

	return strings.Join(parts, "\n")
}

// ImportRollback cleans up partial state when an import operation fails.
// Unlike the full Rollback, this only removes E3CNC-created artifacts:
// - Stops E3CNC services (supervisor)
// - Removes supervisor configs for the instance
// - Removes nginx site configs
// - Removes the instance directory
// - Restores any files from the import backup snapshot
// It does NOT touch the existing Klipper or Moonraker installations.
func ImportRollback(cfg BootstrapConfig, backup *ImportBackup) {
	inst := filepath.Join(instance.InstancesDir(), cfg.InstanceName)

	// Stop E3CNC services via supervisor
	exec.Command("sudo", "supervisorctl", "stop", fmt.Sprintf("e3cnc-%s-*", cfg.InstanceName)).Run()

	// Remove supervisor configs
	exec.Command("sudo", "rm", "-f", fmt.Sprintf("/etc/supervisor/conf.d/e3cnc-%s-*.conf", cfg.InstanceName)).Run()
	exec.Command("sudo", "supervisorctl", "reread").Run()
	exec.Command("sudo", "supervisorctl", "update").Run()

	// Remove nginx site
	exec.Command("rm", "-f", fmt.Sprintf("/etc/nginx/sites-enabled/e3cnc-%s", cfg.InstanceName)).Run()
	exec.Command("rm", "-f", fmt.Sprintf("/etc/nginx/sites-available/e3cnc-%s", cfg.InstanceName)).Run()

	// Restore backup files (e.g., original nginx or Moonraker configs that were modified)
	if backup != nil {
		for _, f := range backup.Files() {
			if f.Content != "" {
				// Restore original content
				if err := os.WriteFile(f.Path, []byte(f.Content), 0644); err != nil {
					fmt.Fprintf(os.Stderr, "  Warning: could not restore %s: %v\n", f.Name, err)
				}
			}
		}
	}

	// Remove instance directory (E3CNC-created only)
	// This does NOT remove the user's Klipper, Moonraker, or printer.cfg
	os.RemoveAll(inst)
}
func (b *ImportBackup) BackupDir() string {
	if b == nil {
		return ""
	}
	return b.dir
}

// Files returns the backed-up file entries.
func (b *ImportBackup) Files() []BackedUpFile {
	if b == nil {
		return nil
	}
	result := make([]BackedUpFile, len(b.files))
	copy(result, b.files)
	return result
}

// lineDiff produces a minimal +/- diff between old and new text.
func lineDiff(oldText, newText string) string {
	oldLines := strings.Split(strings.TrimRight(oldText, "\n"), "\n")
	newLines := strings.Split(strings.TrimRight(newText, "\n"), "\n")

	maxLen := len(oldLines)
	if len(newLines) > maxLen {
		maxLen = len(newLines)
	}

	var result []string
	for i := 0; i < maxLen; i++ {
		switch {
		case i >= len(oldLines):
			// Line was added
			if trimmed := strings.TrimSpace(newLines[i]); trimmed != "" {
				result = append(result, fmt.Sprintf("+%s", trimmed))
			}
		case i >= len(newLines):
			// Line was removed
			if trimmed := strings.TrimSpace(oldLines[i]); trimmed != "" {
				result = append(result, fmt.Sprintf("-%s", trimmed))
			}
		case oldLines[i] != newLines[i]:
			// Line content changed
			oldTrimmed := strings.TrimSpace(oldLines[i])
			newTrimmed := strings.TrimSpace(newLines[i])
			if oldTrimmed != "" {
				result = append(result, fmt.Sprintf("-%s", oldTrimmed))
			}
			if newTrimmed != "" {
				result = append(result, fmt.Sprintf("+%s", newTrimmed))
			}
		}
	}

	if len(result) == 0 {
		return "  (no meaningful changes)"
	}
	return strings.Join(result, "\n")
}

func indentLines(s, prefix string) string {
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		lines[i] = prefix + line
	}
	return strings.Join(lines, "\n")
}

func sortStrings(s []string) {
	for i := 0; i < len(s); i++ {
		for j := i + 1; j < len(s); j++ {
			if s[i] > s[j] {
				s[i], s[j] = s[j], s[i]
			}
		}
	}
}