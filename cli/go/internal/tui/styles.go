package tui

import (
	"github.com/charmbracelet/lipgloss"
)

// Color palette matching the current green/cyan theme.
var (
	ColorGreen  = lipgloss.Color("#00ff66")
	ColorCyan   = lipgloss.Color("#00dd55")
	ColorYellow = lipgloss.Color("#ffcc00")
	ColorRed    = lipgloss.Color("#ff3333")
	ColorDim    = lipgloss.Color("#666666")
	ColorWhite  = lipgloss.Color("#ffffff")
	ColorBg     = lipgloss.Color("#000000")
)

// Style definitions.
var (
	AppStyle = lipgloss.NewStyle().
		Padding(1, 2).
		Background(ColorBg)
	TitleStyle = lipgloss.NewStyle().
		Foreground(ColorGreen).
		Bold(true).
		MarginBottom(1)
	SubtitleStyle = lipgloss.NewStyle().
		Foreground(ColorDim).
		Italic(true).
		MarginBottom(1)
	StatusBarStyle = lipgloss.NewStyle().
		Foreground(ColorDim).
		Padding(0, 1).
		MarginTop(1)
	MenuItemStyle = lipgloss.NewStyle().
		Foreground(ColorWhite).
		Padding(0, 1)
	MenuItemSelectedStyle = lipgloss.NewStyle().
		Foreground(ColorGreen).
		Bold(true).
		Padding(0, 1)
	DestructiveStyle = lipgloss.NewStyle().
		Foreground(ColorRed).
		Bold(true).
		Padding(0, 1)
	InfoStyle = lipgloss.NewStyle().
		Foreground(ColorCyan)
	OkStyle = lipgloss.NewStyle().
		Foreground(ColorGreen)
	WarnStyle = lipgloss.NewStyle().
		Foreground(ColorYellow)
	FailStyle = lipgloss.NewStyle().
		Foreground(ColorRed).
		Bold(true)
	DimStyle = lipgloss.NewStyle().
		Foreground(ColorDim)
	HelpStyle = lipgloss.NewStyle().
		Foreground(ColorDim).
		MarginTop(1)
	SpinnerStyle = lipgloss.NewStyle().
		Foreground(ColorGreen)
	ProgressBarStyle = lipgloss.NewStyle().
		Foreground(ColorGreen).
		Background(lipgloss.Color("#333333"))
	StepPendingStyle = lipgloss.NewStyle().
		Foreground(ColorDim)
	StepRunningStyle = lipgloss.NewStyle().
		Foreground(ColorCyan).
		Bold(true)
	StepCompletedStyle = lipgloss.NewStyle().
		Foreground(ColorGreen)
	StepFailedStyle = lipgloss.NewStyle().
		Foreground(ColorRed).
		Bold(true)
	ConfirmTitleStyle = lipgloss.NewStyle().
		Foreground(ColorYellow).
		Bold(true).
		MarginBottom(1)
	ConfirmDestructiveStyle = lipgloss.NewStyle().
		Foreground(ColorRed).
		Bold(true).
		MarginBottom(1)
	SectionHeaderStyle = lipgloss.NewStyle().
		Foreground(ColorCyan).
		Bold(true).
		MarginTop(1)
	CheckPassStyle = lipgloss.NewStyle().
		Foreground(ColorGreen)
	CheckFailStyle = lipgloss.NewStyle().
		Foreground(ColorRed)
	CheckWarnStyle = lipgloss.NewStyle().
		Foreground(ColorYellow)
	BoxStyle = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(ColorDim).
		Padding(1, 2).
		MarginTop(1).
		MarginBottom(1)
)

// Border constants for dividing sections.
var (
	DashedBorder = lipgloss.NewStyle().
			Foreground(ColorDim).
			Width(50).
			Border(lipgloss.NormalBorder(), false, false, false, true).
			BorderStyle(lipgloss.ThickBorder()).
			BorderForeground(ColorDim)
)
