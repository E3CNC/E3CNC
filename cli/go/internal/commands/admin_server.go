package commands

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

const AdminPort = 8081

// ── admin-server ───────────────────────────────────────────────────

// cmdAdminServer starts the admin HTTP server.
// Blocks until the server stops (or is killed).
func cmdAdminServer(jsonOut bool) bool {
	port := AdminPort

	// Override port via environment variable
	if envPort := os.Getenv("E3CNC_ADMIN_PORT"); envPort != "" {
		fmt.Sscanf(envPort, "%d", &port)
	}

	// Find frontend directory: check repo-local dist first, then production path
	frontendDir := findAdminFrontend()
	os.MkdirAll(frontendDir, 0755)

	mux := http.NewServeMux()

	// ── API routes ──────────────────────────────────────────────
	mux.HandleFunc("/api/status", corsMW(handleAdminStatus))
	mux.HandleFunc("/api/instances", corsMW(handleAdminInstances))
	mux.HandleFunc("/api/releases", corsMW(handleAdminReleases))
	mux.HandleFunc("/api/health", corsMW(handleAdminHealth))
	mux.HandleFunc("/api/backup/", corsMW(handleAdminBackup))

	// ── Static frontend ─────────────────────────────────────────
	fs := http.FileServer(http.Dir(frontendDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		// SPA fallback: serve index.html for any non-file path
		path := filepath.Join(frontendDir, r.URL.Path)
		if _, err := os.Stat(path); err == nil && !strings.HasSuffix(r.URL.Path, "/") {
			fs.ServeHTTP(w, r)
			return
		}
		// Serve index.html for SPA routing
		indexPath := filepath.Join(frontendDir, "index.html")
		if fi, err := os.Stat(indexPath); err == nil {
			http.ServeContent(w, r, "index.html", fi.ModTime(), mustOpen(indexPath))
		} else {
			// No frontend built yet — show API-only info page
			serveWelcomePage(w, r, port)
		}
	})

	addr := fmt.Sprintf(":%d", port)
	ip := getOutboundIP()

	fmt.Printf("\n  🌐 E3CNC Admin Server\n")
	fmt.Printf("     Local:   http://localhost:%d\n", port)
	if ip != "" {
		fmt.Printf("     Network: http://%s:%d\n", ip, port)
	}
	fmt.Printf("     Admin:   %s\n\n", filepath.Join(instance.E3CNCHome(), "admin", "frontend"))

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	err := server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "  Admin server error: %v\n", err)
		return false
	}
	return true
}

// ── API Handlers ───────────────────────────────────────────────────

func handleAdminStatus(w http.ResponseWriter, r *http.Request) {
	version := instance.ReadCurrentVersion()
	instances, _ := instance.DetectInstances()
	releases := deploy.GetReleases()

	resp := map[string]interface{}{
		"version":        version,
		"hostname":       getHostname(),
		"instance_count": len(instances),
		"release_count":  len(releases),
		"uptime_seconds": getUptime(),
		"admin_port":     AdminPort,
	}
	writeJSON(w, resp)
}

func handleAdminInstances(w http.ResponseWriter, r *http.Request) {
	instances, err := instance.DetectInstances()
	if err != nil {
		writeJSON(w, map[string]interface{}{"error": err.Error(), "instances": []interface{}{}})
		return
	}

	type instanceWithChecks struct {
		Name           string                `json:"name"`
		MoonrakerPort  int                   `json:"moonraker_port"`
		WebPort        int                   `json:"web_port"`
		IsRunning      bool                  `json:"is_running"`
		ConfigDir      string                `json:"config_dir"`
		WebRoot        string                `json:"web_root"`
		MoonrakerSvc   string                `json:"moonraker_service"`
		KlipperSvc     string                `json:"klipper_service"`
		HealthChecks   []deploy.HealthCheck  `json:"health_checks"`
	}

	var list []instanceWithChecks
	for _, inst := range instances {
		checks := deploy.RunHealthChecks(inst)
		list = append(list, instanceWithChecks{
			Name:          inst.Name,
			MoonrakerPort: inst.MoonrakerPort,
			WebPort:       inst.WebPort,
			IsRunning:     inst.IsRunning,
			ConfigDir:     inst.ConfigDir,
			WebRoot:       inst.WebRoot,
			MoonrakerSvc:  inst.MoonrakerService,
			KlipperSvc:    inst.KlipperService,
			HealthChecks:  checks,
		})
	}

	writeJSON(w, map[string]interface{}{
		"local_ip":  instance.GetLocalIP(),
		"instances": list,
	})
}

func handleAdminReleases(w http.ResponseWriter, r *http.Request) {
	releases := deploy.GetReleases()
	current := deploy.GetCurrentRelease()
	currentVersion := ""
	if current != nil {
		currentVersion = current.Version
	}
	writeJSON(w, map[string]interface{}{
		"current_version": currentVersion,
		"releases":        releases,
	})
}

func handleAdminHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"status": "ok"})
}

func handleAdminBackup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract instance name from path: /api/backup/<name>
	name := strings.TrimPrefix(r.URL.Path, "/api/backup/")
	name = strings.TrimSpace(name)
	if name == "" || strings.Contains(name, "/") {
		http.Error(w, "invalid instance name", http.StatusBadRequest)
		return
	}

	inst, err := instance.FromName(name)
	if err != nil {
		writeJSON(w, map[string]string{"error": fmt.Sprintf("instance %q not found", name)})
		return
	}

	path, err := deploy.Backup(inst)
	if err != nil {
		writeJSON(w, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, map[string]string{"backup_path": path, "instance": name})
}

// ── Middleware ─────────────────────────────────────────────────────

func corsMW(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

// ── Helpers ────────────────────────────────────────────────────────

// findAdminFrontend locates the admin frontend directory.
// Checks: E3CNC_ADMIN_FRONTEND env var, then admin/dist relative to
// the binary's location (handles both development and release layouts),
// then ~/e3cnc/admin/frontend (production install).
func findAdminFrontend() string {
	// 1. Environment override
	if env := os.Getenv("E3CNC_ADMIN_FRONTEND"); env != "" {
		if fi, err := os.Stat(env); err == nil && fi.IsDir() {
			return env
		}
	}

	// 2. Relative to executable (try various depths for dev vs release)
	exe, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exe)
		for depth := 0; depth <= 6; depth++ {
			// Try depth levels of .. from exe dir
			parts := []string{exeDir}
			for i := 0; i < depth; i++ {
				parts = append(parts, "..")
			}
			parts = append(parts, "admin", "dist")
			candidate := filepath.Join(parts...)
			abs, _ := filepath.Abs(candidate)
			if fi, err := os.Stat(abs); err == nil && fi.IsDir() {
				return abs
			}
		}
	}

	// 3. Relative to cwd
	if cwd, err := os.Getwd(); err == nil {
		candidate := filepath.Join(cwd, "admin", "dist")
		if fi, err := os.Stat(candidate); err == nil && fi.IsDir() {
			return candidate
		}
	}

	// 4. Production path
	return filepath.Join(instance.E3CNCHome(), "admin", "frontend")
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	data, _ := json.MarshalIndent(v, "", "  ")
	w.Write(data)
}

func getOutboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return ""
	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP.String()
}

func getUptime() int64 {
	// Simple: return process start time relative to now
	// For a real uptime on Linux, read /proc/uptime
	return 0
}

func mustOpen(path string) *os.File {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	return f
}

func serveWelcomePage(w http.ResponseWriter, r *http.Request, port int) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	html := `<!DOCTYPE html>
<html><head><title>E3CNC Admin</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:sans-serif;margin:2rem;background:#1a1a2e;color:#eee;max-width:600px}
h1{color:#00d4aa}a{color:#00d4aa}.card{background:#16213e;padding:1rem;margin:1rem 0;border-radius:8px}
code{background:#0f3460;padding:2px 6px;border-radius:4px}
</style></head><body>
<h1>E3CNC Admin</h1>
<p>Admin API server running.</p>
<div class="card">
<h2>API Endpoints</h2>
<p><code><a href="/api/status">/api/status</a></code> — System status</p>
<p><code><a href="/api/instances">/api/instances</a></code> — All instances with health checks</p>
<p><code><a href="/api/releases">/api/releases</a></code> — Installed releases</p>
</div>
<div class="card">
<h2>Frontend</h2>
<p>The admin frontend is not yet built.</p>
|Run <code>cd admin && bun install && bun run build</code> to build it.</p>
</div>
</body></html>`
	w.Write([]byte(html))
}