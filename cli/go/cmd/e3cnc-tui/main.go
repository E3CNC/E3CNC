package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal/commands"
	"github.com/E3CNC/e3cnc/cli/go/internal/tui"
)

// version is set at build time via -ldflags.
// MUST be unexported (lowercase) — Go 1.26+ only allows -X on unexported vars.
var version = "0.0.0-dev"

func main() {
	args := os.Args[1:]

	// --version flag
	if len(args) == 1 && (args[0] == "--version" || args[0] == "-v") {
		fmt.Printf("e3cnc-tui v%s\n", version)
		os.Exit(0)
	}

	// --help flag
	if len(args) == 1 && (args[0] == "--help" || args[0] == "-h") {
		printUsage()
		os.Exit(0)
	}

	// No args: enter interactive TUI
	if len(args) == 0 {
		p := tea.NewProgram(tui.New(version), tea.WithAltScreen(), tea.WithMouseAllMotion())
		if _, err := p.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "Error starting TUI: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// Has args: run Go-native dispatch directly
	cmd := args[0]
	jsonOut := false
	var cmdArgs []string
	for _, a := range args[1:] {
		if a == "--json" {
			jsonOut = true
		} else {
			cmdArgs = append(cmdArgs, a)
		}
	}
	commands.RunDispatch(cmd, jsonOut, cmdArgs)
}

func printUsage() {
	fmt.Println(`e3cnc-tui - E3CNC Terminal UI

Usage:
  e3cnc-tui              Open the interactive TUI menu
  e3cnc-tui <command>    Run a CLI command
  e3cnc-tui --version    Show version
  e3cnc-tui --help       Show this help

Commands:
  install         Full installation (bootstrap + release)
  deploy          Deploy frontend
  update          Full-stack update
  uninstall       Remove E3CNC components
  status          Check installation status
  check           Check dependencies
  detect-mcu      Scan for MCU devices
  flash-mcu       Build and flash Klipper firmware
  init-config     Generate printer.cfg
  releases        List installed releases
  rollback        Roll back to previous release
  prune           Remove old releases
  prune-backups   Remove old backups
  instances       List instances
  migrate         Migrate from old layout
  migrate-instances  Migrate KIAUH instances
  restart         Restart services
  admin-page      Regenerate admin page
  import-instance Import KIAUH instance
  clilog          View CLI log
  backup          Create backup
  restore         Restore from backup
  diagnose        Run diagnostics
  logs            Tail logs

Run 'e3cnc-tui <command> --help' for command-specific flags.`)

	if version != "0.0.0-dev" {
		fmt.Printf("\nVersion: %s\n", version)
	}
}
