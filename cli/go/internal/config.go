package internal

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// State represents the persistent state for e3cnc-tui.
type State struct {
	ActiveInstance string `json:"active_instance,omitempty"`
	Theme          string `json:"theme,omitempty"`
	LastInstallID  string `json:"last_install_id,omitempty"`
}

// InstallJournal tracks an install attempt with step-by-step status.
type InstallJournal struct {
	InstallID    string    `json:"install_id"`
	InstanceName string    `json:"instance_name"`
	StartedAt    time.Time `json:"started_at"`
	CompletedAt  time.Time `json:"completed_at,omitempty"`
	LastStep     int       `json:"last_step"`
	TotalSteps   int       `json:"total_steps"`
	Status       string    `json:"status"` // "running", "completed", "failed"
	Error        string    `json:"error,omitempty"`
	RolledBack   bool      `json:"rolled_back,omitempty"`
}

// statePath returns the path to the state file.
func statePath() string {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".e3cnc-tui")
	os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "state.json")
}

// InstallJournalPath returns the path to the install journal.
func InstallJournalPath() string {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".e3cnc-tui")
	os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "install-journal.json")
}

// LoadState reads the persistent state from disk.
func LoadState() State {
	var s State
	data, err := os.ReadFile(statePath())
	if err != nil {
		return s
	}
	json.Unmarshal(data, &s)
	return s
}

// SaveState writes the persistent state to disk.
func SaveState(s State) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(statePath(), data, 0644)
}

// WriteInstallJournal writes an install journal entry to disk.
func WriteInstallJournal(j InstallJournal) error {
	data, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(InstallJournalPath(), data, 0644)
}

// ReadInstallJournal reads the install journal from disk.
// Returns an empty journal if none exists.
func ReadInstallJournal() InstallJournal {
	var j InstallJournal
	data, err := os.ReadFile(InstallJournalPath())
	if err != nil {
		return j
	}
	json.Unmarshal(data, &j)
	return j
}

// DefaultPaths returns standard E3CNC paths relative to the user's home.
func DefaultPaths() map[string]string {
	home, _ := os.UserHomeDir()
	return map[string]string{
		"e3cnc_root":    filepath.Join(home, "e3cnc"),
		"instances_dir": filepath.Join(home, "e3cnc", "instances"),
		"current_link":  filepath.Join(home, "e3cnc", "current"),
		"releases_dir":  filepath.Join(home, "e3cnc", "releases"),
		"cli_log":       filepath.Join(home, "e3cnc", "cli.log"),
	}
}
