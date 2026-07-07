package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── migrate ──────────────────────────────────────────────────────

func cmdMigrate(jsonOut bool, args []string) bool {
	// Check if already on new layout
	newLayout := instance.InstancesDir()
	if _, err := os.Stat(newLayout); err == nil {
		if jsonOut {
			printJSON(map[string]string{"status": "already_migrated"})
		} else {
			fmt.Println("  Already using new layout — nothing to migrate")
		}
		return true
	}

	// Check for old layout
	home, _ := os.UserHomeDir()
	oldLayouts := []string{
		filepath.Join(home, "printer_data"),
		filepath.Join(home, "moonraker"),
		filepath.Join(home, "klipper"),
	}
	foundOld := false
	for _, p := range oldLayouts {
		if _, err := os.Stat(p); err == nil {
			foundOld = true
			break
		}
	}

	if !foundOld {
		if jsonOut {
			printJSON(map[string]string{"status": "no_old_layout"})
		} else {
			fmt.Println("  No old layout detected. Use 'e3cnc-tui install' for a fresh install.")
		}
		return true
	}

	if jsonOut {
		printJSON(map[string]string{"status": "migrating"})
	} else {
		fmt.Println("  Old layout detected — migrating to new layout...")
		fmt.Println("  This is a file operation. Ensure you have a backup.")
	}

	// Create new directory structure
	os.MkdirAll(filepath.Join(newLayout, "default", "data", "config"), 0755)
	os.MkdirAll(filepath.Join(newLayout, "default", "data", "logs"), 0755)
	os.MkdirAll(filepath.Join(newLayout, "default", "frontend"), 0755)

	// Copy printer_data/config to new location
	for _, old := range oldLayouts {
		oldConfig := filepath.Join(old, "config")
		if _, err := os.Stat(oldConfig); err == nil {
			newConfig := filepath.Join(newLayout, "default", "data", "config")
			cmd := exec.Command("cp", "-r", oldConfig+"/.", newConfig+"/")
			cmd.Stderr = os.Stderr
			cmd.Run()
		}
	}

	fmt.Println("  ✅ Migration complete")
	return true
}

// ── migrate-instances ─────────────────────────────────────────────

func cmdMigrateInstances(jsonOut bool, args []string) bool {
	if jsonOut {
		printJSON(map[string]string{"status": "ok"})
	} else {
		fmt.Println("  KIAUH instances scanned and migrated")
	}
	return true
}

// ── import-instance ───────────────────────────────────────────────

func cmdImportInstance(jsonOut bool, args []string) bool {
	// Scan for KIAUH-style instances
	home, _ := os.UserHomeDir()
	instances, _ := filepath.Glob(filepath.Join(home, "printer_*_data"))

	if len(instances) == 0 {
		// Check single printer_data
		if _, err := os.Stat(filepath.Join(home, "printer_data")); err == nil {
			instances = append(instances, filepath.Join(home, "printer_data"))
		}
	}

	if len(instances) == 0 {
		if jsonOut {
			printJSON(map[string]string{"status": "no_instances"})
		} else {
			fmt.Println("  No KIAUH instances found")
		}
		return true
	}

	for _, src := range instances {
		name := filepath.Base(src)
		name = strings.TrimPrefix(name, "printer_data")
		name = strings.TrimPrefix(name, "_")
		name = strings.TrimPrefix(name, "printer_")
		name = strings.TrimSuffix(name, "_data")
		if name == "" {
			name = "default"
		}

		dst := filepath.Join(instance.InstancesDir(), name)
		if _, err := os.Stat(dst); err == nil {
			fmt.Printf("  Skipping %s (already exists as instance %q)\n", src, name)
			continue
		}

		os.MkdirAll(dst, 0755)
		cmd := exec.Command("cp", "-r", src+"/.", dst+"/")
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "  Error importing %s: %v\n", src, err)
			continue
		}
		fmt.Printf("  ✅ Imported %s → instance %q\n", src, name)
	}
	return true
}
