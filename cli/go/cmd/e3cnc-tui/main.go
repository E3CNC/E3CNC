package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/E3CNC/e3cnc/cli/go/internal"
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

	// No args: enter interactive TUI with auto-re-launch loop
	if len(args) == 0 {
		for {
			p := tea.NewProgram(tui.New(), tea.WithAltScreen())
			finalModel, err := p.Run()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error starting TUI: %v\n", err)
				os.Exit(1)
			}

			// If a command was selected, run it then loop back
			if m, ok := finalModel.(tui.Model); ok && m.DispatchCmd != "" {
				// Run Go-native command
				if !commands.RunDispatch(m.DispatchCmd, false, nil) {
					// Fall back to Python CLI
					cliDir, pythonExe, err := internal.FindPythonCLI()
					if err != nil {
						fmt.Fprintf(os.Stderr, "Error: %v\n", err)
						os.Exit(1)
					}
					workDir := filepath.Dir(cliDir)
					pyArgs := []string{"-m", "cli", m.DispatchCmd}
					ctx, cancel := context.WithCancel(context.Background())
					defer cancel()
					sigCh := make(chan os.Signal, 1)
					signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
					go func() {
						<-sigCh
						cancel()
					}()
					result, err := internal.RunPython(ctx, pythonExe, pyArgs, workDir,
						func(line string) { fmt.Println(line) },
						func(line string) { fmt.Fprintln(os.Stderr, line) },
					)
					if err != nil {
						fmt.Fprintf(os.Stderr, "Error: %v\n", err)
						os.Exit(1)
					}
					if result.ExitCode != 0 {
						os.Exit(result.ExitCode)
					}
				}
				// Wait for user to press b/Enter to return, or q/Ctrl+C to quit
				fmt.Print("\nb: back to menu  ·  q: quit  ·  Enter: back  ·  Ctrl+C: quit\n> ")
				var buf [1]byte
				os.Stdin.Read(buf[:])
				response := string(buf[0])
				if response == "q" {
					return
				}
				// Any other key (b, Enter = \n) goes back to menu
				continue
			}
			return
		}
	}

	// Has args: try Go-native dispatch first, fall back to Python
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

	// Try Go-native dispatch
	if commands.RunDispatch(cmd, jsonOut, cmdArgs) {
		return
	}

	// Load commands manifest and validate the command
	manifest, err := internal.LoadCommands()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: cannot load commands manifest: %v\n", err)
		fmt.Fprintf(os.Stderr, "Falling back to direct Python dispatch.\n")
	}

	if manifest != nil && !manifest.IsKnownCommand(cmd) {
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", cmd)
		fmt.Fprintf(os.Stderr, "Run 'e3cnc-tui --help' for available commands.\n")
		os.Exit(1)
	}

	// Resolve Python CLI path for commands not yet ported to Go
	cliDir, pythonExe, err := internal.FindPythonCLI()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		fmt.Fprintf(os.Stderr, "Make sure E3CNC is installed or run from the repo checkout.\n")
		os.Exit(1)
	}

	// Build args for Python: python3 -m cli <cmd> [args...]
	pyArgs := []string{"-m", "cli", cmd}
	pyArgs = append(pyArgs, args[1:]...)
	workDir := filepath.Dir(cliDir)

	// Set up signal handling for graceful cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		cancel()
	}()

	// Run the command with streaming output
	result, err := internal.RunPython(ctx, pythonExe, pyArgs, workDir,
		func(line string) { fmt.Println(line) },
		func(line string) { fmt.Fprintln(os.Stderr, line) },
	)

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error executing command: %v\n", err)
		os.Exit(1)
	}

	if result.Cancelled {
		fmt.Fprintln(os.Stderr, "\nCommand cancelled.")
		os.Exit(130)
	}

	if result.TimedOut {
		fmt.Fprintln(os.Stderr, "\nCommand timed out.")
		os.Exit(124)
	}

	if result.ExitCode != 0 {
		os.Exit(result.ExitCode)
	}
}

func printUsage() {
	fmt.Println(`e3cnc-tui - E3CNC Terminal UI

Usage:
  e3cnc-tui              Open the interactive TUI menu
  e3cnc-tui <command>    Run a CLI command (dispatches to e3cnc-cli)
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
