package commands

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/E3CNC/e3cnc/cli/go/internal/bootstrap"
	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
	"github.com/E3CNC/e3cnc/cli/go/internal/rootrun"
)

// ── update ────────────────────────────────────────────────────────

func cmdUpdate(jsonOut bool, args []string) bool {
	// Parse --artifact flag
	artifactPath := ""
	for i, arg := range args {
		if arg == "--artifact" && i+1 < len(args) {
			artifactPath = args[i+1]
		}
	}

	if jsonOut {
		fmt.Println(`{"status":"starting","step":"find_release"}`)
	}

	var assetPath string

	if artifactPath != "" {
		if _, err := os.Stat(artifactPath); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "  Artifact not found: %s\n", artifactPath)
			return true
		}
		assetPath = artifactPath
		fmt.Printf("  Using local artifact: %s\n", filepath.Base(artifactPath))
	} else {
		fmt.Println("  Finding latest release...")
		asset, err := deploy.FindStackArtifact()
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Error: %v\n", err)
			return true
		}
		fmt.Printf("  Found: %s\n", asset.Name)

		version := strings.TrimPrefix(asset.Name, "e3cnc-stack-")
		version = strings.TrimSuffix(version, ".tar.zst")
		_ = version

		assetPath, err = deploy.DownloadArtifact(asset, "/tmp/e3cnc-download")
		if err != nil {
			fmt.Fprintf(os.Stderr, "  Download failed: %v\n", err)
			return true
		}
		fmt.Println("  Downloaded")
	}

	// Extract version from filename
	version := filepath.Base(assetPath)
	version = strings.TrimPrefix(version, "e3cnc-stack-")
	version = strings.TrimSuffix(version, ".tar.zst")

	// Extract
	fmt.Printf("  Extracting v%s...\n", version)
	_, err := deploy.ExtractArtifact(assetPath, instance.ReleasesDir(), version)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Extract failed: %v\n", err)
		return true
	}

	// Activate
	fmt.Println("  Activating...")
	if err := deploy.ActivateRelease(version); err != nil {
		fmt.Fprintf(os.Stderr, "  Activation failed: %v\n", err)
		return true
	}

	// Re-vendor Moonraker and Klipper from the updated release into the
	// active runtime directories (~/moonraker, ~/klipper) so the running
	// services pick up the latest vendored code without a separate bootstrap.
	fmt.Println("  Updating vendored components...")
	cfg := bootstrap.BootstrapConfig{InstanceName: "default"}
	if err := bootstrap.CopyVendoredComponents(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "  Warning: vendor update failed: %v\n", err)
	} else {
		fmt.Println("  ✓ Vendored components updated")
	}

	fmt.Printf("  ✅ Updated to v%s\n", version)

	// Health checks
	fmt.Println("\n  Running health checks...")
	inst := activeInstance()
	if inst != nil {
		checks := deploy.RunHealthChecks(inst)
		for _, c := range checks {
			mark := "✓"
			if !c.Passed {
				mark = "✗"
			}
			fmt.Printf("  %s %s\n", mark, c.Name)
			if !c.Passed && c.Detail != "" {
				fmt.Printf("       %s\n", c.Detail)
			}
		}
	}

	return true
}

// ── install ───────────────────────────────────────────────────────

func cmdInstall(jsonOut bool, args []string) bool {
	// Only auxiliary sub-modes (port detect / migrate / backup) may run as
	// non-root. A real install must be run as root so bootstrap steps can
	// provision services without interactive sudo prompts.
	if !rootrun.IsRoot() && !installIsAuxiliaryMode(args) {
		fmt.Fprintln(os.Stderr, "  Installation must be run as root.")
		fmt.Fprintln(os.Stderr, "  Run via: sudo ./install.sh   (or: sudo e3cnc-tui install)")
		return true
	}

	cfg := bootstrap.BootstrapConfig{
		StartServices: true,
		Arch:          runtime.GOARCH,
	}

	portDetectOnly := false
	migrateOnly := false
	backupOnly := false
	artifactPath := ""

	for i, arg := range args {
		switch arg {
		case "--name":
			if i+1 < len(args) {
				cfg.InstanceName = args[i+1]
			}
		case "--port":
			if i+1 < len(args) {
				fmt.Sscanf(args[i+1], "%d", &cfg.MoonrakerPort)
			}
		case "--web-port":
			if i+1 < len(args) {
				fmt.Sscanf(args[i+1], "%d", &cfg.WebPort)
			}
		case "--hostname":
			if i+1 < len(args) {
				cfg.Hostname = args[i+1]
			}
		case "--no-start":
			cfg.StartServices = false
		case "--artifact":
			if i+1 < len(args) {
				artifactPath = args[i+1]
			}
		case "--port-detect", "--port-detect-only":
			portDetectOnly = true
		case "--migrate-only":
			migrateOnly = true
		case "--backup-only":
			backupOnly = true
		}
	}

	// Standalone port detection mode
	if portDetectOnly {
		ports := bootstrap.AutoDetectPorts()
		if jsonOut {
			printJSON(ports)
		} else {
			fmt.Println(bootstrap.PortSummary(ports))
		}
		return true
	}

	// Run pre-install steps: migration, backup, port detection
	if migrateOnly {
		if err := bootstrap.MigrateOldDir(); err != nil {
			fmt.Fprintf(os.Stderr, "  ❌ Migration failed: %v\n", err)
			return true
		}
		fmt.Println("  ✅ Migration complete")
		return true
	}

	if backupOnly {
		backupPath, err := bootstrap.BackupExisting()
		if err != nil {
			fmt.Fprintf(os.Stderr, "  ❌ Backup failed: %v\n", err)
			return true
		}
		if jsonOut {
			printJSON(map[string]string{"backup_path": backupPath})
		} else {
			fmt.Printf("  ✅ Backup created at: %s\n", backupPath)
		}
		return true
	}

	// Full install flow
	if jsonOut {
		fmt.Println(`{"status":"starting","phase":"bootstrap"}`)
	}

	// If a local artifact path was provided, extract and activate it now.
	// Bootstrap's ensureCurrentRelease will see the existing current symlink
	// and skip the GitHub download, enabling fully air-gapped installs.
	if artifactPath != "" {
		if _, err := os.Stat(artifactPath); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "  ❌ Artifact not found: %s\n", artifactPath)
			bootstrap.CloseInstallLog()
			return true
		}
		version := filepath.Base(artifactPath)
		version = strings.TrimPrefix(version, "e3cnc-stack-")
		version = strings.TrimSuffix(version, ".tar.zst")
		fmt.Printf("  Using local artifact: %s (v%s)\n", filepath.Base(artifactPath), version)
		if _, err := deploy.ExtractArtifact(artifactPath, instance.ReleasesDir(), version); err != nil {
			fmt.Fprintf(os.Stderr, "  ❌ Failed to extract artifact: %v\n", err)
			bootstrap.CloseInstallLog()
			return true
		}
		if err := deploy.ActivateRelease(version); err != nil {
			fmt.Fprintf(os.Stderr, "  ❌ Failed to activate release: %v\n", err)
			bootstrap.CloseInstallLog()
			return true
		}
		fmt.Println("  ✓ Local artifact activated")
	}

	// Consolidated install log — captures the CLI install output too.
	// Bootstrap() and the package managers write to it directly.
	if err := bootstrap.OpenInstallLog(); err != nil {
		fmt.Fprintf(os.Stderr, "  Warning: cannot open install log: %v\n", err)
	}

	if err := bootstrap.Bootstrap(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "  ❌ Install failed: %v\n", err)
		fmt.Fprintf(os.Stderr, "\n  📋 Share this file for support:\n  %s\n", bootstrap.InstallLogPath())
		bootstrap.InstallLogf("=== INSTALL FAILED: %v ===", err)
		bootstrap.InstallLogf("Full install log: %s", bootstrap.InstallLogPath())
		bootstrap.CloseInstallLog()
		return true
	}

	bootstrap.InstallLogf("=== INSTALL COMPLETED ===")
	bootstrap.CloseInstallLog()

	fmt.Println("\n  ✅ Installation complete!")

	// Verify
	inst, _ := instance.FromName(cfg.InstanceName)
	if inst != nil {
		checks := deploy.RunHealthChecks(inst)
		for _, c := range checks {
			mark := "✓"
			if !c.Passed {
				mark = "✗"
			}
			fmt.Printf("  %s %s\n", mark, c.Name)
		}
	}
	return true
}

// installIsAuxiliaryMode reports whether the install command was invoked with
// a read-only helper flag (port detect / migrate / backup only) that doesn't
// require root privileges.
func installIsAuxiliaryMode(args []string) bool {
	for _, a := range args {
		switch a {
		case "--port-detect", "--port-detect-only", "--migrate-only", "--backup-only", "--help", "-h":
			return true
		}
	}
	return false
}

// ── deploy ───────────────────────────────────────────────────────

func cmdDeploy(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	// Copy frontend from current release to instance web root
	currentTarget, err := os.Readlink(instance.CurrentLink())
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Error: no current release: %v\n", err)
		return true
	}

	frontendSrc := filepath.Join(currentTarget, "frontend")
	if _, err := os.Stat(frontendSrc); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "  Error: frontend not found in release: %s\n", frontendSrc)
		return true
	}

	os.RemoveAll(inst.WebRoot)
	cmd := exec.Command("cp", "-r", frontendSrc+"/.", inst.WebRoot+"/")
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "  Deploy failed: %v\n", err)
		return true
	}

	// Deploy scripts from release to instance scripts directory
	scriptsSrc := filepath.Join(currentTarget, "scripts")
	if _, err := os.Stat(scriptsSrc); err == nil {
		os.MkdirAll(inst.ScriptsDir, 0755)
		cpScripts := exec.Command("cp", "-r", scriptsSrc+"/.", inst.ScriptsDir+"/")
		cpScripts.Stderr = os.Stderr
		if err := cpScripts.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "  Warning: scripts deploy failed: %v\n", err)
		}
	}

	// Deploy macros from release to instance macros directory
	macrosSrc := filepath.Join(currentTarget, "config", "macros")
	if _, err := os.Stat(macrosSrc); err == nil {
		os.MkdirAll(inst.MacrosDir, 0755)
		cpMacros := exec.Command("cp", "-r", macrosSrc+"/.", inst.MacrosDir+"/")
		cpMacros.Stderr = os.Stderr
		if err := cpMacros.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "  Warning: macros deploy failed: %v\n", err)
		}
	}

	if jsonOut {
		printJSON(map[string]string{"status": "deployed", "web_root": inst.WebRoot})
	} else {
		fmt.Printf("  ✅ Frontend deployed to %s\n", inst.WebRoot)
	}
	return true
}
