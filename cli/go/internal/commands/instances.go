package commands

import (
	"fmt"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── instances ─────────────────────────────────────────────────────

func cmdInstances(jsonOut bool) bool {
	instances, err := instance.DetectInstances()
	if err != nil {
		if jsonOut {
			printJSON(map[string]interface{}{"error": err.Error(), "instances": []interface{}{}})
		} else {
			fmt.Printf("  Error: %v\n", err)
		}
		return true
	}

	ip := instance.GetLocalIP()

	if jsonOut {
		rel := deploy.GetCurrentRelease()
		relVersion := ""
		if rel != nil {
			relVersion = rel.Version
		}
		var instList []map[string]interface{}
		for _, inst := range instances {
			instList = append(instList, map[string]interface{}{
				"name":              inst.Name,
				"is_running":        inst.IsRunning,
				"config_dir":        inst.ConfigDir,
				"moonraker_service": inst.MoonrakerService,
				"klipper_service":   inst.KlipperService,
				"moonraker_port":    inst.MoonrakerPort,
				"web_port":          inst.WebPort,
				"web_root":          inst.WebRoot,
				"printer_data_dir":  inst.PrinterDataDir,
			})
		}
		printJSON(map[string]interface{}{
			"local_ip":         ip,
			"release_version":  relVersion,
			"instances":        instList,
		})
		return true
	}

	if len(instances) == 0 {
		fmt.Println("  No instances found")
		return true
	}
	for _, inst := range instances {
		running := "○"
		if inst.IsRunning {
			running = "●"
		}
		fmt.Printf("  %s %s  (port %d)\n", running, inst.Name, inst.MoonrakerPort)
	}
	return true
}
