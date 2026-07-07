package commands

import (
	"fmt"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── admin-page ────────────────────────────────────────────────────

func cmdAdminPage(jsonOut bool) bool {
	ip := instance.GetLocalIP()
	if jsonOut {
		printJSON(map[string]interface{}{
			"url": fmt.Sprintf("http://%s:%d", ip, AdminPort),
		})
		return true
	}
	fmt.Printf("  Admin dashboard is served by the admin-server.\n")
	fmt.Printf("  Run: e3cnc-tui admin-server\n")
	fmt.Printf("  URL: http://%s:%d/\n", ip, AdminPort)
	return true
}
