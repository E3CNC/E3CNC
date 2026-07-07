package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── backup / restore ──────────────────────────────────────────────

func cmdBackup(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}
	path, err := deploy.Backup(inst)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Backup failed: %v\n", err)
		return true
	}
	if jsonOut {
		printJSON(map[string]string{"backup_path": path})
	} else {
		fmt.Printf("  ✅ Backup created: %s\n", path)
	}
	return true
}

func cmdRestore(jsonOut bool, args []string) bool {
	backupPath := ""
	for i, arg := range args {
		if arg == "--file" || arg == "-f" {
			if i+1 < len(args) {
				backupPath = args[i+1]
			}
		}
	}
	if backupPath == "" {
		// Find latest backup
		backupsDir := filepath.Join(instance.E3CNCHome(), "backups")
		entries, _ := os.ReadDir(backupsDir)
		if len(entries) == 0 {
			fmt.Fprintln(os.Stderr, "  No backups found")
			return true
		}
		backupPath = filepath.Join(backupsDir, entries[len(entries)-1].Name())
	}

	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	if err := deploy.Restore(inst, backupPath); err != nil {
		fmt.Fprintf(os.Stderr, "  Restore failed: %v\n", err)
		return true
	}
	fmt.Printf("  ✅ Restored from: %s\n", backupPath)
	return true
}
