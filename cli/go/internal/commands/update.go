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
	cfg := bootstrap.BootstrapConfig{
		StartServices: true,
		Arch:          runtime.GOARCH,
	}

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
		}
	}

	if jsonOut {
		fmt.Println(`{"status":"starting","phase":"bootstrap"}`)
	}

	if err := bootstrap.Bootstrap(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "  ❌ Install failed: %v\n", err)
		return true
	}

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

	if jsonOut {
		printJSON(map[string]string{"status": "deployed", "web_root": inst.WebRoot})
	} else {
		fmt.Printf("  ✅ Frontend deployed to %s\n", inst.WebRoot)
	}
	return true
}
