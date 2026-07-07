package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── releases ──────────────────────────────────────────────────────

func cmdReleases(jsonOut bool) bool {
	releases := deploy.GetReleases()
	current := deploy.GetCurrentRelease()
	currentVersion := ""
	if current != nil {
		currentVersion = current.Version
	}

	if jsonOut {
		printJSON(map[string]interface{}{
			"current_version": currentVersion,
			"releases":        releases,
		})
		return true
	}

	if len(releases) == 0 {
		fmt.Println("  No releases installed")
		fmt.Println("  Run 'e3cnc-tui update' to install the latest release")
		return true
	}
	for _, r := range releases {
		mark := " "
		if r.IsActive() {
			mark = "▶"
		}
		fmt.Printf("  %s %s\n", mark, r.Version)
	}
	return true
}

// ── rollback ──────────────────────────────────────────────────────

func cmdRollback(jsonOut bool, args []string) bool {
	version := ""
	for i, arg := range args {
		if arg == "--version" && i+1 < len(args) {
			version = args[i+1]
		}
	}

	releases := deploy.GetReleases()
	if len(releases) == 0 {
		fmt.Fprintln(os.Stderr, "  No releases to roll back to")
		return true
	}

	if version != "" {
		// Roll back to specific version
		found := false
		for _, r := range releases {
			if r.Version == version {
				found = true
				break
			}
		}
		if !found {
			fmt.Fprintf(os.Stderr, "  Release %s not found\n", version)
			return true
		}
	} else {
		// Roll back to previous (second latest)
		if len(releases) < 2 {
			fmt.Fprintln(os.Stderr, "  No previous release to roll back to")
			return true
		}
		version = releases[1].Version
	}

	if err := deploy.ActivateRelease(version); err != nil {
		fmt.Fprintf(os.Stderr, "  Rollback failed: %v\n", err)
		return true
	}
	fmt.Printf("  ✅ Rolled back to v%s\n", version)
	return true
}

// ── prune ─────────────────────────────────────────────────────────

func cmdPrune(jsonOut bool, args []string) bool {
	keep := deploy.DefaultKeepReleases
	for i, arg := range args {
		if arg == "--keep" && i+1 < len(args) {
			fmt.Sscanf(args[i+1], "%d", &keep)
		}
	}

	releases := deploy.GetReleases()
	if len(releases) <= keep {
		fmt.Println("  Nothing to prune")
		return true
	}

	pruned := 0
	for _, r := range releases[keep:] {
		if r.IsActive() {
			continue
		}
		os.RemoveAll(r.Path)
		pruned++
	}

	fmt.Printf("  Pruned %d old release(s)\n", pruned)
	return true
}

// ── prune-backups ─────────────────────────────────────────────────

func cmdPruneBackups(jsonOut bool, args []string) bool {
	keep := deploy.DefaultKeepBackups
	for i, arg := range args {
		if arg == "--keep" && i+1 < len(args) {
			fmt.Sscanf(args[i+1], "%d", &keep)
		}
	}

	backupsDir := filepath.Join(instance.E3CNCHome(), "backups")
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		fmt.Println("  No backups to prune")
		return true
	}

	if len(entries) <= keep {
		fmt.Println("  Nothing to prune")
		return true
	}

	pruned := 0
	for _, entry := range entries[:len(entries)-keep] {
		os.RemoveAll(filepath.Join(backupsDir, entry.Name()))
		pruned++
	}
	fmt.Printf("  Pruned %d old backup(s)\n", pruned)
	return true
}
