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

// ── Screen 0: Mode Selection ─────────────────────────────────────

func (m InstallModel) viewModeSelect() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("E3CNC Install Wizard") + "\n" +
			SubtitleStyle.Render("Choose how to set up your CNC"),
	))
	b.WriteString("\n\n")

	items := []struct {
		label       string
		description string
	}{
		{"Import existing Klipper", "Use an existing Klipper installation on this machine"},
		{"Create new E3CNC instance", "Set up a fresh E3CNC instance from scratch"},
	}

	for i, item := range items {
		cursor := "  "
		style := MenuItemStyle
		if i == m.modeCursor {
			cursor = "▸ "
			style = MenuItemSelectedStyle
		}
		b.WriteString(style.Render(fmt.Sprintf("%s%s", cursor, item.label)))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render(fmt.Sprintf("  %s", item.description)))
		b.WriteString("\n\n")
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("↑/↓ navigate  ·  Enter: select  ·  b: back to menu"))
	return b.String()
}

// ── Screen 1: Pre-Flight Checks ──────────────────────────────────

func (m InstallModel) viewPreFlight() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Pre-Flight Checks") + "\n" +
			SubtitleStyle.Render("Checking your system meets the requirements"),
	))
	b.WriteString("\n\n")

	for _, check := range m.preFlightChecks {
		mark := "○"
		style := DimStyle

		switch check.Status {
		case "passed":
			mark = "✓"
			style = OkStyle
		case "failed":
			mark = "✗"
			style = FailStyle
		case "running":
			mark = m.spinner.View()
			style = InfoStyle
		}

		line := fmt.Sprintf("  %s %s", mark, check.Label)
		if check.Detail != "" {
			line += DimStyle.Render(fmt.Sprintf("  (%s)", check.Detail))
		}
		b.WriteString(style.Render(line))
		b.WriteString("\n")
	}

	b.WriteString("\n")

	allPassed := true
	for _, r := range m.preFlightChecks {
		if r.Status == "failed" {
			allPassed = false
			break
		}
	}

	if allPassed {
		b.WriteString(OkStyle.Render("  ✓ All checks passed"))
		b.WriteString("\n\n")
		b.WriteString(HelpStyle.Render("Press Enter to continue · b: back to menu"))
	} else if len(m.preFlightChecks) > 0 {
		b.WriteString(FailStyle.Render("  ✗ Some checks failed"))
		b.WriteString("\n\n")
		b.WriteString(HelpStyle.Render("Fix the issues above. Press Enter to proceed anyway · b: back to menu"))
	} else {
		b.WriteString(SpinnerStyle.Render("  Running checks..."))
	}

	return b.String()
}

// ── Screen 2: MCU Selection ───────────────────────────────────────

func (m InstallModel) viewMCUSelect() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Select MCU") + "\n" +
			SubtitleStyle.Render("Choose the controller board for this instance"),
	))
	b.WriteString("\n\n")

	if len(m.mcuDevices) == 0 {
		b.WriteString(WarnStyle.Render("  No MCU devices detected"))
		b.WriteString("\n\n")
		b.WriteString(DimStyle.Render("  Connect your controller board via USB"))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render("  then press 'r' to rescan."))
	} else {
		for i, dev := range m.mcuDevices {
			cursor := "  "
			style := MenuItemStyle
			if i == m.mcuCursor {
				cursor = "▸ "
				style = MenuItemSelectedStyle
			}
			fullPath := filepath.Join("/dev/serial/by-id", dev)
			realPath, _ := os.Readlink(fullPath)
			if realPath != "" && !filepath.IsAbs(realPath) {
				realPath = filepath.Join("/dev", realPath)
			}
			display := dev
			if len(dev) > 55 {
				display = dev[:55] + "..."
			}
			b.WriteString(style.Render(fmt.Sprintf("%s%s", cursor, display)))
			b.WriteString("\n")
			if realPath != "" {
				b.WriteString(DimStyle.Render(fmt.Sprintf("     → %s", realPath)))
				b.WriteString("\n")
			}
			b.WriteString("\n")
		}
	}

	b.WriteString("\n")
	b.WriteString(HelpStyle.Render("↑/↓ navigate  ·  Enter to confirm  ·  r: rescan  ·  b: back to menu"))
	return b.String()
}

// ── Screen 3: Instance Configuration ────────────────────────────────────

func (m InstallModel) viewConfig() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Name Your Instance") + "\n" +
			SubtitleStyle.Render("Give this CNC instance a name"),
	))
	b.WriteString("\n\n")

	b.WriteString(DimStyle.Render("  Instance name"))
	b.WriteString("\n")
	b.WriteString(m.nameInput.View())
	b.WriteString("\n")
	b.WriteString(DimStyle.Render("   Lowercase letters, numbers, hyphens"))
	b.WriteString("\n\n")

	b.WriteString(BoxStyle.Render(
		fmt.Sprintf("Moonraker port: %d (auto-assigned)", m.moonrakerPort),
	))
	b.WriteString("\n")
	b.WriteString(BoxStyle.Render(
		fmt.Sprintf("MCU: %s", shortenMCUPath(m.mcuPath)),
	))
	b.WriteString("\n\n")

	b.WriteString(HelpStyle.Render("Type the name  ·  Enter: confirm  ·  Esc: back to menu"))
	return b.String()
}

// ── Screen 4: Firmware Check ─────────────────────────────────────

func (m InstallModel) viewFirmwareCheck() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("MCU Firmware") + "\n" +
			SubtitleStyle.Render("Check if your controller board needs flashing"),
	))
	b.WriteString("\n\n")

	b.WriteString(fmt.Sprintf("  MCU: %s\n\n", shortenMCUPath(m.mcuPath)))

	if strings.Contains(m.mcuPath, "Klipper") || strings.Contains(m.mcuPath, "klipper") {
		b.WriteString(OkStyle.Render("  ✓ Klipper firmware detected"))
		b.WriteString("\n\n")
		b.WriteString(DimStyle.Render("  Your MCU appears to already have Klipper firmware."))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render("  You can proceed with the installation."))
	} else {
		b.WriteString(WarnStyle.Render("  ⚠ No Klipper firmware detected"))
		b.WriteString("\n\n")
		b.WriteString(DimStyle.Render("  The MCU may need to be flashed with Klipper firmware."))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render("  You can do this after installation via 'Flash MCU' in the menu."))
	}

	b.WriteString("\n\n")
	b.WriteString(HelpStyle.Render("Enter to start installation  ·  b: back to MCU selection"))
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
	if m.screen == ScreenVerification {
		helpText = HelpStyle.Render("Press Enter to return to menu")
	}

	showLog := m.verbose || m.screen == ScreenVerification
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
		return lipgloss.JoinVertical(lipgloss.Top,
			header,
			stepsBody,
			logContent,
			"",
			helpText,
		)
	}

	return header + stepsBody + "\n" + helpText
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
