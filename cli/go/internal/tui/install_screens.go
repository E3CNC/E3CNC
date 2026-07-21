package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/lipgloss"
)

// ── Screen 1: Detection (streaming system checks) ─────────────────

func (m InstallModel) viewDetection() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("E3CNC Install Wizard") + "\n" +
			SubtitleStyle.Render("Checking your system"),
	))
	b.WriteString("\n\n")

	for _, d := range m.detectionResults {
		mark := "○"
		style := DimStyle

		switch d.Status {
		case "passed":
			mark = "✓"
			style = OkStyle
		case "failed":
			mark = "✗"
			style = FailStyle
		case "running":
			mark = m.spinner.View()
			style = InfoStyle
		case "pending":
			mark = "○"
			style = DimStyle
		case "timedout":
			mark = "⚠"
			style = WarnStyle
		}

		line := fmt.Sprintf("  %s %s", mark, d.Label)
		if d.Detail != "" {
			line += DimStyle.Render(fmt.Sprintf("  (%s)", d.Detail))
		}
		b.WriteString(style.Render(line))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(SpinnerStyle.Render("  Scanning system..."))

	return b.String()
}

// ── Screen 1a: MCU Picker (when >3 devices detected) ──────────────

func (m InstallModel) viewMCUPicker() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Select MCU Device") + "\n" +
			SubtitleStyle.Render("Multiple MCU devices detected — choose one"),
	))
	b.WriteString("\n\n")

	for i, dev := range m.mcuDevices {
		cursor := "  "
		style := MenuItemStyle
		if i == m.mcuCursor {
			cursor = "▸ "
			style = MenuItemSelectedStyle
		}
		short := shortenMCUPath(dev)
		b.WriteString(style.Render(fmt.Sprintf("  %s%s", cursor, short)))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("↑/↓: select  ·  Enter: confirm  ·  r: rescan  ·  q: back to menu"))
	return b.String()
}

// ── Klipper Install Picker ─────────────────────────────────────────

func (m InstallModel) viewKlipperPicker() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Select Klipper Installation") + "\n" +
			SubtitleStyle.Render("Multiple Klipper installations found — choose one to import"),
	))
	b.WriteString("\n\n")

	for i, inst := range m.klipperInstalls {
		cursor := "  "
		style := MenuItemStyle
		if i == m.klipperCursor {
			cursor = "▸ "
			style = MenuItemSelectedStyle
		}

		// Build a short description for each install
		desc := inst.KlipperDir
		if desc == "" {
			desc = inst.PrinterCfg
		}
		if desc == "" {
			desc = fmt.Sprintf("Service: %s", inst.ServiceName)
		}

		// Add MCU info if available
		detail := ""
		if inst.MCUPath != "" {
			detail = fmt.Sprintf(" (MCU: %s)", shortenMCUPath(inst.MCUPath))
		}
		if inst.MoonrakerInstalled {
			detail += " [Moonraker]"
		}
		if inst.ViaSystemd {
			detail += " [systemd]"
		}

		b.WriteString(style.Render(fmt.Sprintf("  %s%s%s", cursor, desc, detail)))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("↑/↓: select  ·  Enter: confirm  ·  b: back  ·  q: quit"))
	return b.String()
}

// ── Screen 2: Decision/Confirm ────────────────────────────────────

func (m InstallModel) viewDecision() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Installation Summary") + "\n" +
			SubtitleStyle.Render("Review and confirm your setup"),
	))
	b.WriteString("\n\n")

	// Mode selector
	b.WriteString(DimStyle.Render("  Install mode:"))
	b.WriteString("\n")
	modes := []struct {
		label       string
		description string
	}{
		{"Import existing Klipper", "Use an existing Klipper installation on this machine"},
		{"Create new E3CNC instance", "Set up a fresh E3CNC instance from scratch"},
	}
	for i, mode := range modes {
		cursor := "  "
		style := MenuItemStyle
		if i == m.modeCursor {
			cursor = "▸ "
			style = MenuItemSelectedStyle
		}
		b.WriteString(style.Render(fmt.Sprintf("  %s%s", cursor, mode.label)))
		b.WriteString("\n")
	}
	b.WriteString("\n")

	// Instance name input
	b.WriteString(DimStyle.Render("  Instance name:"))
	b.WriteString("\n  ")
	b.WriteString(m.nameInput.View())
	b.WriteString("\n")
	b.WriteString(DimStyle.Render("   Lowercase letters, numbers, hyphens"))
	b.WriteString("\n\n")

	// Auto-detected summary
	b.WriteString(BoxStyle.Render(
		DimStyle.Render("  Auto-detected:"),
	))
	b.WriteString("\n")
	for _, d := range m.detectionResults {
		symbol := "○"
		style := DimStyle
		switch d.Status {
		case "passed":
			symbol = "✓"
			style = OkStyle
		case "failed":
			symbol = "✗"
			style = FailStyle
		case "timedout":
			symbol = "⚠"
			style = WarnStyle
		}
		line := fmt.Sprintf("    %s %s", symbol, d.Label)
		if d.Detail != "" {
			line += DimStyle.Render(fmt.Sprintf("  (%s)", d.Detail))
		}
		b.WriteString(style.Render(line))
		b.WriteString("\n")
	}

	// MCU devices summary
	if len(m.mcuDevices) > 0 {
		b.WriteString("\n")
		b.WriteString(OkStyle.Render(fmt.Sprintf("  MCU: %s", shortenMCUPath(m.mcuDevices[0]))))
		b.WriteString("\n")
		if len(m.mcuDevices) > 1 {
			b.WriteString(DimStyle.Render(fmt.Sprintf("  + %d more device(s)", len(m.mcuDevices)-1)))
			b.WriteString("\n")
		}
	}

	// Firmware status
	if m.mcuPath != "" {
		b.WriteString("  ")
		if isKlipperFirmware(m.mcuPath) {
			b.WriteString(OkStyle.Render("  ✓ Klipper firmware detected"))
		} else {
			b.WriteString(WarnStyle.Render("  ⚠ No Klipper firmware detected"))
		}
		b.WriteString("\n")
	}

	// Import warning: no Klipper installations found
	if m.installMode == 1 && len(m.klipperInstalls) == 0 {
		b.WriteString("\n")
		b.WriteString(FailStyle.Render("  ✗ No existing Klipper installation found"))
		b.WriteString("\n")
		b.WriteString(WarnStyle.Render("     Select \"Create new E3CNC instance\" for a fresh install"))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("↑/↓: mode  ·  Enter: install  ·  r: rescan  ·  q: back to menu"))
	return b.String()
}

// ── Screen 5: Execution Dashboard ───────────────────────────────────────

func (m InstallModel) viewExecDashboard() string {
	var header, stepsBody string
	{
		var b strings.Builder
		elapsed := time.Since(m.startedAt).Round(time.Second)
		b.WriteString(TitleStyle.Render(fmt.Sprintf("Installing E3CNC — step %d of %d", m.current+1, len(m.steps))))
		b.WriteString("\n")
		b.WriteString(SubtitleStyle.Render(fmt.Sprintf("Elapsed: %s", elapsed)))
		b.WriteString("\n\n")

		if m.progressPct > 0 {
			bar := m.progBar.ViewAs(m.progressPct)
			b.WriteString(DimStyle.Render("  Progress: "))
			b.WriteString(bar)
		} else {
			b.WriteString(strings.Repeat(" ", 12))
		}
		b.WriteString("\n")
		header = b.String()
	}

	{
		var b strings.Builder
		for i, step := range m.steps {
			symbol := ""
			style := DimStyle

			switch step.Status {
			case StepPending:
				symbol = fmt.Sprintf("[%d/%d]", step.Number, len(m.steps))
				style = StepPendingStyle
			case StepRunning:
				symbol = m.spinner.View()
				style = StepRunningStyle
			case StepCompleted:
				symbol = "✓"
				style = StepCompletedStyle
			case StepFailed:
				symbol = "✗"
				style = StepFailedStyle
			case StepSkipped:
				symbol = "○"
				style = DimStyle
			}

			duration := ""
			if step.Status == StepCompleted && step.Duration > 0 {
				if step.Duration < time.Second {
					duration = fmt.Sprintf(" %dms", step.Duration.Milliseconds())
				} else {
					duration = fmt.Sprintf(" %s", step.Duration.Round(time.Second))
				}
			} else if step.Status == StepRunning && !step.StartedAt.IsZero() {
				duration = fmt.Sprintf(" %s", time.Since(step.StartedAt).Round(time.Second))
			}

			line := fmt.Sprintf("  %s %s%s", symbol, step.Label, duration)
			if i == m.current && step.Status == StepRunning {
				line += "  ◌"
			}
			b.WriteString(style.Render(line))
			b.WriteString("\n")
		}
		topRows := m.logViewport.Height + 1
		stepsBody = lipgloss.NewStyle().Height(topRows).MaxHeight(topRows).Render(b.String())
	}

	helpText := HelpStyle.Render("v: toggle verbose (on)  ·  Ctrl+C: cancel")

	var result string

	showLog := m.verbose
	var logContent string
	if showLog && len(m.logBuffer) > 0 {
		vpView := m.logViewport.View()
		sp := m.logViewport.ScrollPercent()
		vpLines := strings.Split(vpView, "\n")
		thumb := int(sp * float64(len(vpLines)-1))
		var sb strings.Builder
		for i, line := range vpLines {
			if i == thumb {
				sb.WriteString(line + DimStyle.Render(" █"))
			} else {
				sb.WriteString(line)
			}
			if i < len(vpLines)-1 {
				sb.WriteString("\n")
			}
		}
		logContent = lipgloss.JoinVertical(
			lipgloss.Top,
			DimStyle.Render(fmt.Sprintf("── Log ─────────────────────── %02d%% ──", int(sp*100))),
			sb.String(),
		)
	} else if m.verbose {
		logContent = lipgloss.JoinVertical(lipgloss.Top,
			DimStyle.Render("── Log ──────────────────────────────────────"),
			strings.Repeat("\n", max(0, m.logViewport.Height-1)),
		)
	}

	if logContent != "" {
		result = lipgloss.JoinVertical(lipgloss.Top,
			header,
			stepsBody,
			logContent,
			"",
			helpText,
		)
	} else {
		result = header + stepsBody + "\n" + helpText
	}

	// Error overlay
	if m.showErrorOverlay {
		failedStep := m.steps[m.failedStep]
		overlay := BoxStyle.Render(
			FailStyle.Render(fmt.Sprintf("Step [%d/%d] — %s — FAILED", failedStep.Number, len(m.steps), failedStep.Label)) + "\n\n" +
				DimStyle.Render("Error details:") + "\n" +
				FailStyle.Render(fmt.Sprintf("  %s", m.err)) + "\n\n" +
				WarnStyle.Render("  [r] Retry step  [s] Skip  [a] Abort and rollback"),
		)
		result = lipgloss.JoinVertical(lipgloss.Top,
			result,
			"",
			overlay,
		)
	}

	return result
}

// ── Verification Screen ──────────────────────────────────────────────

func (m InstallModel) viewVerification() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Installation Complete") + "\n" +
			SubtitleStyle.Render(fmt.Sprintf("E3CNC instance: %s", m.instanceName)),
	))
	b.WriteString("\n\n")

	// Summary of all steps
	b.WriteString(DimStyle.Render("  Steps:"))
	b.WriteString("\n")
	totalOk := 0
	for _, step := range m.steps {
		symbol := ""
		style := DimStyle
		switch step.Status {
		case StepCompleted:
			symbol = "✓"
			style = OkStyle
			totalOk++
		case StepFailed:
			symbol = "✗"
			style = FailStyle
		case StepSkipped:
			symbol = "○"
			style = DimStyle
		default:
			symbol = "○"
			style = DimStyle
		}
		b.WriteString(style.Render(fmt.Sprintf("    %s %s", symbol, step.Label)))
		b.WriteString("\n")
	}

	b.WriteString("\n")

	// Health check results
	if len(m.healthChecks) > 0 {
		b.WriteString(DimStyle.Render("  Health checks:"))
		b.WriteString("\n")
		for _, c := range m.healthChecks {
			symbol := "✓"
			style := OkStyle
			if !c.Passed {
				symbol = "✗"
				style = FailStyle
			}
			line := fmt.Sprintf("    %s %s", symbol, c.Name)
			if c.Detail != "" {
				line += DimStyle.Render(fmt.Sprintf("  (%s)", c.Detail))
			}
			b.WriteString(style.Render(line))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}

	// Instance URL and next steps
	b.WriteString(BoxStyle.Render(
		DimStyle.Render("  Next steps:") + "\n\n" +
			InfoStyle.Render(fmt.Sprintf("    Web UI: http://%s.local:%d", m.mDNSHostname, m.webPort)) + "\n" +
			InfoStyle.Render(fmt.Sprintf("    Admin:  http://%s.local:%d/admin", m.mDNSHostname, m.webPort)) + "\n\n" +
			DimStyle.Render("    Use 'e3cnc-tui' to manage your instance") + "\n" +
			DimStyle.Render("    Or visit the Web UI to configure MCU and macros"),
	))

	// Error summary if any
	if m.err != nil {
		b.WriteString("\n")
		b.WriteString(WarnStyle.Render(fmt.Sprintf("  ⚠ %s", m.err)))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("Press Enter to return to menu"))
	return b.String()
}

// ── Screen 6: Error Recovery ────────────────────────────────────────────

func (m InstallModel) viewErrorRecovery() string {
	var b strings.Builder

	step := m.steps[m.failedStep]

	b.WriteString(FailStyle.Render(fmt.Sprintf("Step [%d/%d] — %s — FAILED", step.Number, len(m.steps), step.Label)))
	b.WriteString("\n\n")

	errDetail := step.ErrorDetail
	if errDetail == "" && m.err != nil {
		errDetail = m.err.Error()
	}
	if errDetail != "" {
		b.WriteString(BoxStyle.Render(
			DimStyle.Render("Error:") + "\n" +
				FailStyle.Render(fmt.Sprintf("  %s", errDetail)),
		))
	} else {
		b.WriteString(BoxStyle.Render(
			DimStyle.Render("An error occurred during this step.") + "\n\n" +
				InfoStyle.Render("Likely cause:") + "\n" +
				DimStyle.Render("  Check your network connection and permissions.") + "\n\n" +
				InfoStyle.Render("Suggested fix:") + "\n" +
				WarnStyle.Render("  Check logs with 'e3cnc-tui diagnose'"),
		))
	}
	b.WriteString("\n\n")

	b.WriteString("[r] Retry step\n")
	b.WriteString("[s] Skip (not recommended)\n")
	b.WriteString("[a] Abort and rollback\n")

	return b.String()
}

// ── Utilities ────────────────────────────────────

// newProgressBar creates a progress bar with the E3CNC theme (green→cyan).
func newProgressBar() progress.Model {
	p := progress.New(
		progress.WithGradient("#00ff66", "#00ffff"),
		progress.WithoutPercentage(),
	)
	p.Width = 40
	p.ShowPercentage = true
	return p
}

// shortenMCUPath truncates a long MCU path for display.
func shortenMCUPath(path string) string {
	if len(path) > 50 {
		return path[:50] + "..."
	}
	return path
}

// isKlipperFirmware checks whether the selected MCU path indicates Klipper firmware.
func isKlipperFirmware(path string) bool {
	return strings.Contains(strings.ToLower(path), "klipper")
}

// scanMCUDevices scans /dev/serial/by-id/ for connected MCU devices.
func scanMCUDevices() []string {
	dir := "/dev/serial/by-id/"
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var devices []string
	for _, e := range entries {
		if e.Type().IsRegular() || e.Type()&os.ModeSymlink != 0 {
			fullPath := filepath.Join(dir, e.Name())
			realPath, _ := os.Readlink(fullPath)
			if realPath != "" {
				if !filepath.IsAbs(realPath) {
					realPath = filepath.Join("/dev/serial/by-id", realPath)
				}
				devices = append(devices, e.Name())
			} else {
				devices = append(devices, e.Name())
			}
		}
	}
	return devices
}
