// Package commands provides Go-native implementations of all E3CNC CLI commands.
//
// RunDispatch() is the single entry point. It handles all 24 commands in-process,
// eliminating Python subprocess overhead entirely.
package commands

import (
	"encoding/json"
	"fmt"
	"os/exec"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// RunDispatch runs a command natively in Go.
// Returns true if the command was handled (even if it failed — the error
// was printed to stderr). Returns false if the command is not yet implemented
// in Go and should fall through to Python.
func RunDispatch(cmd string, jsonOut bool, args []string) bool {
	switch cmd {
	case "status":
		return cmdStatus(jsonOut)
	case "check", "check-deps":
		return cmdCheck(jsonOut)
	case "instances", "inst", "list":
		return cmdInstances(jsonOut)
	case "releases", "rel":
		return cmdReleases(jsonOut)
	case "clilog":
		return cmdCliLog(jsonOut)
	case "update", "redeploy":
		return cmdUpdate(jsonOut, args)
	case "backup":
		return cmdBackup(jsonOut, args)
	case "restore":
		return cmdRestore(jsonOut, args)
	case "rollback":
		return cmdRollback(jsonOut, args)
	case "prune":
		return cmdPrune(jsonOut, args)
	case "prune-backups":
		return cmdPruneBackups(jsonOut, args)
	case "diagnose", "diag", "doctor":
		return cmdDiagnose(jsonOut)
	case "logs":
		return cmdLogs(jsonOut, args)
	case "admin-page":
		return cmdAdminPage(jsonOut)
	case "admin-server":
		return cmdAdminServer(jsonOut)
	case "detect-mcu", "detect", "scan":
		return cmdDetectMCU(jsonOut)
	case "init-config", "init":
		return cmdInitConfig(jsonOut, args)
	case "restart":
		return cmdRestart(jsonOut, args)
	case "install":
		return cmdInstall(jsonOut, args)
	case "uninstall":
		return cmdUninstall(jsonOut, args)
	case "deploy":
		return cmdDeploy(jsonOut, args)
	case "flash-mcu", "flash", "build":
		return cmdFlashMCU(jsonOut, args)
	case "migrate":
		return cmdMigrate(jsonOut, args)
	case "migrate-instances":
		return cmdMigrateInstances(jsonOut, args)
	case "import-instance":
		return cmdImportInstance(jsonOut, args)
	}
	return true // handled (even if unknown, don't fall through to Python)
}

// ── helpers ───────────────────────────────────────────────────────

func activeInstance() *instance.Instance {
	inst, err := instance.GetActiveInstance()
	if err != nil {
		return nil
	}
	return inst
}

func printJSON(v interface{}) {
	data, _ := json.MarshalIndent(v, "", "  ")
	fmt.Println(string(data))
}

func resolveInstance(args []string) *instance.Instance {
	inst := activeInstance()
	for i, arg := range args {
		if arg == "--instance" || arg == "-p" || arg == "--name" {
			if i+1 < len(args) {
				if inst2, err := instance.FromName(args[i+1]); err == nil {
					inst = inst2
				}
			}
		}
	}
	return inst
}

func hasBin(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
