package tui

import (
	"fmt"
	"strings"

	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── List View ────────────────────────────────────────────────────────────

func (m InstanceModel) viewList() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Instance Manager") + "\n" +
			SubtitleStyle.Render("Manage your CNC instances"),
	))
	b.WriteString("\n\n")

	if m.loadErr != "" {
		b.WriteString(FailStyle.Render(fmt.Sprintf("  Error: %s\n\n", m.loadErr)))
	}

	if m.loading {
		b.WriteString(SpinnerStyle.Render("  Loading instances..."))
		b.WriteString("\n\n")
		return b.String()
	}

	// Build list content for viewport
	var listBody strings.Builder
	if len(m.instances) > 0 {
		listBody.WriteString(SectionHeaderStyle.Render("Instances"))
		listBody.WriteString("\n")
		for i, inst := range m.instances {
			cursor := "  "
			style := MenuItemStyle
			if i == m.cursor {
				cursor = "▸ "
				if m.screen == InstList {
					style = MenuItemSelectedStyle
				}
			}
			running := "○"
			if inst.IsRunning {
				running = "●"
			}
			line := fmt.Sprintf("%s%s %s", cursor, running, inst.Name)
			listBody.WriteString(style.Render(line))
			listBody.WriteString("\n")
			if inst.Name != "" {
				listBody.WriteString(DimStyle.Render(fmt.Sprintf("   Port: %d  URL: http://%s:%d/", inst.MoonrakerPort, instance.GetLocalIP(), inst.WebPort)))
				listBody.WriteString("\n")
			}
			listBody.WriteString("\n")
		}
	} else {
		listBody.WriteString(DimStyle.Render("  No instances found"))
		listBody.WriteString("\n")
	}

	// Update viewport content and scroll to keep cursor visible
	m.listViewport.SetContent(listBody.String())
	lineHeight := (m.cursor * 3) + 1 // each instance takes ~3 lines
	m.listViewport.SetYOffset(max(0, lineHeight-m.listViewport.Height+2))

	b.WriteString(m.listViewport.View())
	b.WriteString("\n")

	b.WriteString(SectionHeaderStyle.Render("Actions"))
	b.WriteString("\n")
	for _, opt := range []string{"[n] New instance", "[d] Delete instance", "[r] Refresh"} {
		b.WriteString(DimStyle.Render(fmt.Sprintf("  %s\n", opt)))
	}

	b.WriteString(HelpStyle.Render("↑/↓ navigate  ·  n: create  ·  d: delete  ·  r: refresh  ·  b: back to menu"))
	return b.String()
}

// ── Create Form ──────────────────────────────────────────────────────────

func (m InstanceModel) viewCreate() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		TitleStyle.Render("Create Instance") + "\n" +
			SubtitleStyle.Render("Set up a new CNC instance"),
	))
	b.WriteString("\n\n")

	b.WriteString(DimStyle.Render("Instance name\n"))
	b.WriteString(fmt.Sprintf("  %s\n\n", m.createNameInput.View()))
	b.WriteString(DimStyle.Render("  Port (leave 0 for auto-assign)\n"))
	b.WriteString(fmt.Sprintf("  %s\n\n", m.createPortInput.View()))

	b.WriteString(HelpStyle.Render("Tab: next field  ·  Enter: create  ·  Esc: back"))
	return b.String()
}

// ── Delete Confirmation ──────────────────────────────────────────────────

func (m InstanceModel) viewDelete() string {
	var b strings.Builder

	b.WriteString(BoxStyle.Render(
		FailStyle.Render("Delete Instance") + "\n" +
			DimStyle.Render("This action cannot be undone"),
	))
	b.WriteString("\n\n")

	if m.cursor >= 0 && m.cursor < len(m.instances) {
		inst := m.instances[m.cursor]
		b.WriteString(FailStyle.Render(fmt.Sprintf("  Delete '%s'?", inst.Name)))
	} else if m.deleteTarget != "" {
		b.WriteString(FailStyle.Render(fmt.Sprintf("  Delete '%s'?", m.deleteTarget)))
	} else {
		b.WriteString(DimStyle.Render("  This will remove all instance data and configurations."))
		b.WriteString("\n")
		b.WriteString(DimStyle.Render("  Services associated with this instance will be stopped."))
	}

	b.WriteString("\n\n")
	b.WriteString(HelpStyle.Render("Enter: confirm delete  ·  Esc: cancel"))
	return b.String()
}
