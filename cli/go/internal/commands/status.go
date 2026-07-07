package commands

import (
	"fmt"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── status ─────────────────────────────────────────────────

func cmdStatus(jsonOut bool) bool {
	inst := activeInstance()
	version := instance.ReadCurrentVersion()

	if jsonOut {
		if inst != nil {
			checks := deploy.RunHealthChecks(inst)
			okCount := 0
			for _, c := range checks {
				if c.Passed {
					okCount++
				}
			}
			result := map[string]interface{}{
				"version":       version,
				"all_ok":        okCount == len(checks),
				"ok_count":      okCount,
				"total_checks":  len(checks),
				"checks":        checks,
				"instance_name": inst.Name,
				"web_url":       fmt.Sprintf("http://%s:%d/", instance.GetLocalIP(), inst.WebPort),
				"api_url":       fmt.Sprintf("http://%s:%d/server/info", instance.GetLocalIP(), inst.MoonrakerPort),
			}
			printJSON(result)
		} else {
			printJSON(map[string]interface{}{
				"version": version, "all_ok": false, "checks": []string{},
			})
		}
		return true
	}

	// Human-readable output
	fmt.Printf("  E3CNC v%s\n", version)
	if inst != nil {
		fmt.Printf("  Instance: %s (port %d)\n", inst.Name, inst.MoonrakerPort)
		checks := deploy.RunHealthChecks(inst)
		for _, c := range checks {
			mark := "✓"
			if !c.Passed {
				mark = "✗"
			}
			fmt.Printf("  %s %s\n", mark, c.Name)
		}
		ip := instance.GetLocalIP()
		fmt.Printf("\n  Web UI:     http://%s/\n", ip)
		fmt.Printf("  Admin:      http://%s/admin\n", ip)
		fmt.Printf("  API:        http://%s:%d/server/info\n", ip, inst.MoonrakerPort)
	} else {
		fmt.Println("  No instance detected")
	}
	return true
}
