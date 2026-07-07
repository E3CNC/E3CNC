package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── logs ──────────────────────────────────────────────────────────

func cmdLogs(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	// Tail the moonraker log by default
	logFile := inst.MoonrakerLog
	for i, arg := range args {
		if arg == "--file" && i+1 < len(args) {
			logFile = args[i+1]
		}
		if arg == "--nginx" {
			logFile = "/var/log/nginx/access.log"
		}
	}

	data, err := os.ReadFile(logFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  Cannot read log: %v\n", err)
		return true
	}
	fmt.Print(string(data))
	return true
}

// ── diagnose ──────────────────────────────────────────────────────

func cmdDiagnose(jsonOut bool) bool {
	if jsonOut {
		result := map[string]interface{}{
			"hostname":  getHostname(),
			"releases":  len(deploy.GetReleases()),
			"instances": countInstances(),
		}
		printJSON(result)
		return true
	}

	fmt.Printf("  Hostname:  %s\n", getHostname())
	inst := activeInstance()
	if inst != nil {
		fmt.Printf("  Instance:  %s\n", inst.Name)
		fmt.Printf("  Config:    %s\n", inst.ConfigDir)
		fmt.Printf("  Port:      %d\n", inst.MoonrakerPort)
	}
	fmt.Printf("  Releases:  %d installed\n", len(deploy.GetReleases()))
	fmt.Printf("  Instances: %d\n", countInstances())
	return true
}

func getHostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}

func countInstances() int {
	insts, _ := instance.DetectInstances()
	return len(insts)
}

// ── clilog ────────────────────────────────────────────────────────

func cmdCliLog(jsonOut bool) bool {
	logPath := filepath.Join(instance.E3CNCHome(), "cli.log")
	data, err := os.ReadFile(logPath)
	if err != nil {
		fmt.Printf("  CLI log not found: %v\n", err)
		return true
	}
	fmt.Print(string(data))
	return true
}
