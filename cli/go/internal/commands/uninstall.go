package commands

import (
	"fmt"
	"os"

	"github.com/E3CNC/e3cnc/cli/go/internal/bootstrap"
)

// ── uninstall ─────────────────────────────────────────────────────

func cmdUninstall(jsonOut bool, args []string) bool {
	inst := resolveInstance(args)
	if inst == nil {
		fmt.Fprintln(os.Stderr, "  Error: no instance found")
		return true
	}

	if err := bootstrap.Uninstall(inst); err != nil {
		fmt.Fprintf(os.Stderr, "  ❌ Uninstall failed: %v\n", err)
		return true
	}
	return true
}
