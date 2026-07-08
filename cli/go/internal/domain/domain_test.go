package domain

import (
	"testing"
	"time"
)

func TestStepStatusString(t *testing.T) {
	tests := []struct {
		status StepStatus
		want   string
	}{
		{StepPending, "pending"},
		{StepRunning, "running"},
		{StepCompleted, "completed"},
		{StepFailed, "failed"},
		{StepSkipped, "skipped"},
		{StepStatus(99), "unknown"},
	}

	for _, tc := range tests {
		got := tc.status.String()
		if got != tc.want {
			t.Errorf("StepStatus(%d).String() = %q, want %q", tc.status, got, tc.want)
		}
	}
}

func TestStepDefaults(t *testing.T) {
	s := Step{
		Number:    3,
		Label:     "Test step",
		Status:    StepRunning,
		StartedAt: time.Now(),
	}

	if s.Number != 3 {
		t.Errorf("Number = %d, want 3", s.Number)
	}
	if s.Label != "Test step" {
		t.Errorf("Label = %q, want 'Test step'", s.Label)
	}
	if s.Status != StepRunning {
		t.Errorf("Status = %d, want StepRunning", s.Status)
	}
	if s.StartedAt.IsZero() {
		t.Errorf("StartedAt should not be zero")
	}
}

func TestNopProgress(t *testing.T) {
	// Should not panic
	NopProgress(0, StepRunning, nil)
	NopProgress(1, StepCompleted, nil)
	NopProgress(2, StepFailed, nil)
}

func TestStepNames(t *testing.T) {
	if len(StepNames) != 9 {
		t.Errorf("StepNames length = %d, want 9", len(StepNames))
	}
	if StepNames[0] != "Install system packages" {
		t.Errorf("StepNames[0] = %q, want 'Install system packages'", StepNames[0])
	}
	if StepNames[8] != "Start services" {
		t.Errorf("StepNames[8] = %q, want 'Start services'", StepNames[8])
	}
}

func TestOutputFormatterMark(t *testing.T) {
	f := OutputFormatter{}

	if m := f.Mark(true, false); m != "✓" {
		t.Errorf("Mark(true, false) = %q, want ✓", m)
	}
	if m := f.Mark(false, true); m != "○" {
		t.Errorf("Mark(false, true) = %q, want ○", m)
	}
	if m := f.Mark(false, false); m != "✗" {
		t.Errorf("Mark(false, false) = %q, want ✗", m)
	}
}

func TestOutputFormatterWarnMark(t *testing.T) {
	f := OutputFormatter{}
	if m := f.WarnMark(); m != "⚠" {
		t.Errorf("WarnMark() = %q, want ⚠", m)
	}
}

func TestProgressCallbackType(t *testing.T) {
	// Verify ProgressCallback can be assigned
	var cb ProgressCallback = func(step int, status StepStatus, err error) {
		if step != 5 {
			t.Errorf("step = %d, want 5", step)
		}
		if status != StepCompleted {
			t.Errorf("status = %d, want StepCompleted", status)
		}
	}
	cb(5, StepCompleted, nil)
}
