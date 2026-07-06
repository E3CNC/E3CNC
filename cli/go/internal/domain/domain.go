// Package domain defines shared types and interfaces for the E3CNC CLI domain layer.
// It has NO dependencies on tui, bootstrap, deploy, or any I/O package.
// Pure Go types only — fully testable without filesystem, network, or terminal.
package domain

import "time"

// StepStatus represents the status of an install or operation step.
type StepStatus int

const (
	StepPending   StepStatus = iota
	StepRunning
	StepCompleted
	StepFailed
	StepSkipped
)

func (s StepStatus) String() string {
	switch s {
	case StepPending:
		return "pending"
	case StepRunning:
		return "running"
	case StepCompleted:
		return "completed"
	case StepFailed:
		return "failed"
	case StepSkipped:
		return "skipped"
	default:
		return "unknown"
	}
}

// Step describes a single installation/operation step.
type Step struct {
	Number    int
	Label     string
	Status    StepStatus
	StartedAt time.Time
	Duration  time.Duration
	Error     string
}

// ProgressCallback is called by an operation to report step progress.
type ProgressCallback func(step int, status StepStatus, err error)

// NopProgress is a no-op ProgressCallback.
func NopProgress(int, StepStatus, error) {}

// StepNames returns the canonical list of install step labels.
var StepNames = []string{
	"Install system packages",
	"Configure sudoers",
	"Create directories",
	"Vendor Moonraker and Klipper",
	"Create virtualenvs",
	"Generate config files",
	"Install systemd services",
	"Configure nginx and mDNS",
	"Start services",
}

// OutputFormatter provides consistent ✓/✗/○/⚠ formatting for CLI and TUI.
type OutputFormatter struct{}

// Mark returns a colored status mark and its meaning string.
func (OutputFormatter) Mark(passed bool, optional bool) (symbol string) {
	if passed {
		return "✓"
	}
	if optional {
		return "○"
	}
	return "✗"
}

// WarnMark returns the warning symbol.
func (OutputFormatter) WarnMark() string { return "⚠" }
