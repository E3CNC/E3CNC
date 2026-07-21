package tui

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"

	tea "github.com/charmbracelet/bubbletea"
)

// UpdateScreen represents which update wizard screen is shown.
type UpdateScreen int

const (
	UpdateScreenCheck UpdateScreen = iota
	UpdateScreenConfirm
	UpdateScreenProgress
	UpdateScreenResult
)

// UpdateModel is the BubbleTea model for the update wizard.
type UpdateModel struct {
	screen      UpdateScreen
	current     *deploy.Release
	latest      *deploy.GitHubAsset
	changelog   string
	width       int
	height      int
	err         error
	cursor      int
	showAboutUp bool
	step        int // download -> extract -> activate -> health_checks
	checks      []deploy.HealthCheck
	rolledBack  bool
	done        bool
}

// NewUpdateModel creates a new update wizard model.
func NewUpdateModel() UpdateModel {
	return UpdateModel{screen: UpdateScreenCheck}
}

func (m UpdateModel) Init() tea.Cmd {
	return tea.Batch(
		m.checkVersionsCmd(),
		m.fetchChangelogCmd(),
	)
}

// commands returning tea.Msg
func (m UpdateModel) checkVersionsCmd() tea.Cmd {
	return func() tea.Msg { return m.checkVersions() }
}
func (m UpdateModel) fetchChangelogCmd() tea.Cmd {
	return func() tea.Msg { return m.fetchChangelog() }
}

type updateVersionMsg struct {
	current *deploy.Release
	latest  *deploy.GitHubAsset
	err     error
}

type changelogMsg struct {
	body string
	err  error
}

type updateStepMsg struct{}

func (m UpdateModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tea.KeyMsg:
		switch m.screen {
		case UpdateScreenResult:
			switch msg.String() {
			case "enter", "q", "esc":
				m.done = true
				return m, nil
			}
		case UpdateScreenConfirm:
			switch msg.String() {
			case "up", "k":
				if m.cursor > 0 {
					m.cursor--
				}
			case "down", "j":
				if m.cursor < 1 {
					m.cursor++
				}
			case "enter", " ":
				if m.cursor == 0 {
					m.screen = UpdateScreenProgress
					m.step = 0
					return m, m.runUpdate()
				}
				m.done = true
				return m, nil
			case "q", "esc":
				m.done = true
				return m, nil
			}
		}

	case updateVersionMsg:
		m.current = msg.current
		m.latest = msg.latest
		m.err = msg.err
		if msg.err != nil {
			m.screen = UpdateScreenResult
			return m, nil
		}
		if m.current != nil && m.latest != nil {
			currentVer := strings.TrimPrefix(m.current.Version, "v")
			latestVer := strings.TrimPrefix(m.latest.Name, "e3cnc-stack-")
			latestVer = strings.TrimSuffix(latestVer, ".tar.zst")
			if currentVer == latestVer {
				m.showAboutUp = true
				m.screen = UpdateScreenResult
				return m, nil
			}
		}
		m.screen = UpdateScreenConfirm
		m.cursor = 0
		return m, nil

	case changelogMsg:
		if msg.err == nil {
			m.changelog = msg.body
		}
		return m, nil
	}
	return m, nil
}

func (m UpdateModel) View() string {
	switch m.screen {
	case UpdateScreenCheck:
		return m.viewCheck()
	case UpdateScreenConfirm:
		return m.viewConfirm()
	case UpdateScreenProgress:
		return m.viewProgress()
	case UpdateScreenResult:
		return m.viewResult()
	default:
		return ""
	}
}

func (m UpdateModel) viewCheck() string {
	var sb strings.Builder
	sb.WriteString(BoxStyle.Render(
		TitleStyle.Render("Checking for updates...") + "\n",
	))
	sb.WriteString(SpinnerStyle.Render("  Querying GitHub releases\n"))
	return sb.String()
}

func (m UpdateModel) viewConfirm() string {
	currentVer := "unknown"
	if m.current != nil {
		currentVer = m.current.Version
	}
	latestVer := "unknown"
	if m.latest != nil {
		latestVer = strings.TrimPrefix(m.latest.Name, "e3cnc-stack-")
		latestVer = strings.TrimSuffix(latestVer, ".tar.zst")
	}

	var sb strings.Builder
	sb.WriteString(BoxStyle.Render(
		TitleStyle.Render("Update Available") + "\n\n" +
			InfoStyle.Render(fmt.Sprintf("  Current: %s", currentVer)) + "\n" +
			InfoStyle.Render(fmt.Sprintf("  Latest:  %s", latestVer)) + "\n\n" +
			DimStyle.Render("  Press Enter to update, q to cancel"),
	))
	if m.cursor == 0 {
		sb.WriteString("\n\n")
		sb.WriteString(MenuItemSelectedStyle.Render("  ▸ Update now"))
		sb.WriteString("\n")
		sb.WriteString(MenuItemStyle.Render("    Cancel"))
	} else {
		sb.WriteString("\n\n")
		sb.WriteString(MenuItemStyle.Render("  Update now"))
		sb.WriteString("\n")
		sb.WriteString(MenuItemSelectedStyle.Render("  ▸ Cancel"))
	}
	sb.WriteString("\n\n")
	sb.WriteString(HelpStyle.Render("↑/↓: select  ·  Enter: confirm  ·  q: cancel"))
	if m.changelog != "" {
		lines := strings.Split(m.changelog, "\n")
		sb.WriteString("\n\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "## ") || strings.HasPrefix(line, "# ") {
				sb.WriteString(WarnStyle.Render("    "+line) + "\n")
			} else if strings.HasPrefix(line, "- ") {
				sb.WriteString(DimStyle.Render("      "+line) + "\n")
			} else {
				sb.WriteString(DimStyle.Render("    "+line) + "\n")
			}
		}
	}
	return sb.String()
}

func (m UpdateModel) viewProgress() string {
	steps := []string{"Download", "Extract", "Activate", "Health checks"}
	if m.step >= len(steps) {
		m.step = len(steps) - 1
	}
	currentStep := steps[m.step]

	var sb strings.Builder
	sb.WriteString(TitleStyle.Render("Updating E3CNC"))
	sb.WriteString("\n\n")
	sb.WriteString(DimStyle.Render(fmt.Sprintf("  Step: %s", currentStep)))
	sb.WriteString("\n")
	sb.WriteString(SpinnerStyle.Render("  Please wait..."))
	sb.WriteString("\n")
	return sb.String()
}

func (m UpdateModel) viewResult() string {
	var sb strings.Builder
	if m.showAboutUp {
		sb.WriteString(BoxStyle.Render(
			TitleStyle.Render("Already up to date") + "\n\n" +
				DimStyle.Render("  You are running the latest release."),
		))
		sb.WriteString("\n\n")
		sb.WriteString(HelpStyle.Render("Press Enter to return to menu"))
		return sb.String()
	}

	if m.err != nil {
		sb.WriteString(BoxStyle.Render(
			FailStyle.Render("Update failed") + "\n\n" +
				DimStyle.Render("  Error:") + "\n" +
				FailStyle.Render(fmt.Sprintf("  %s", m.err.Error())),
		))
		if m.latest != nil {
			latestVer := strings.TrimPrefix(m.latest.Name, "e3cnc-stack-")
			latestVer = strings.TrimSuffix(latestVer, ".tar.zst")
			sb.WriteString("\n")
			sb.WriteString(FailStyle.Render(fmt.Sprintf("  The previous release is still active: v%s", latestVer)))
			sb.WriteString("\n")
			sb.WriteString(DimStyle.Render("  You can retry, or use Rollback from the main menu"))
		}
	} else if len(m.checks) > 0 {
		failed := 0
		for _, c := range m.checks {
			if !c.Passed {
				failed++
			}
		}
		title := "Update complete"
		style := OkStyle
		if failed > 0 || m.rolledBack {
			title = "Update complete with warnings"
			style = WarnStyle
		}
		sb.WriteString(BoxStyle.Render(style.Render(title) + "\n\n"))
		sb.WriteString(DimStyle.Render("  Health checks:"))
		sb.WriteString("\n")
		for _, c := range m.checks {
			mark := "✓"
			st := OkStyle
			if !c.Passed {
				mark = "✗"
				st = FailStyle
			}
			line := fmt.Sprintf("    %s %s", mark, c.Name)
			if c.Detail != "" {
				line += DimStyle.Render(fmt.Sprintf("  (%s)", c.Detail))
			}
			sb.WriteString(st.Render(line))
			sb.WriteString("\n")
		}
		if m.rolledBack {
			sb.WriteString("\n")
			sb.WriteString(FailStyle.Render("  Auto-rolled back due to critical failure."))
			sb.WriteString("\n")
			sb.WriteString(DimStyle.Render("  New release is preserved on disk for inspection."))
		} else if failed > 0 {
			sb.WriteString("\n")
			sb.WriteString(WarnStyle.Render("  Minor issues detected. Use menu to rollback if needed."))
		}
	} else {
		sb.WriteString(BoxStyle.Render(
			OkStyle.Render("Update complete") + "\n\n" +
				DimStyle.Render("  Restart services if needed."),
		))
	}

	sb.WriteString("\n\n")
	sb.WriteString(HelpStyle.Render("Press Enter to return to menu"))
	return sb.String()
}

func (m UpdateModel) checkVersions() updateVersionMsg {
	current := deploy.GetCurrentRelease()
	asset, err := deploy.FindStackArtifact()
	return updateVersionMsg{current: current, latest: asset, err: err}
}

func (m UpdateModel) fetchChangelog() changelogMsg {
	body, err := fetchLatestReleaseBody()
	if err != nil {
		return changelogMsg{body: "", err: err}
	}
	return changelogMsg{body: body}
}

func fetchLatestReleaseBody() (string, error) {
	url := fmt.Sprintf("%s/releases/latest", deploy.GitHubReleases)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fetch release: HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var rel struct {
		Body string `json:"body"`
	}
	if err := json.Unmarshal(data, &rel); err != nil {
		return "", err
	}
	return rel.Body, nil
}

func (m UpdateModel) runUpdate() tea.Cmd {
	return func() tea.Msg { return updateStepMsg{} }
}

func (m UpdateModel) performUpdate() (UpdateModel, tea.Cmd) {
	version := "unknown"
	if m.latest != nil {
		version = strings.TrimPrefix(m.latest.Name, "e3cnc-stack-")
		version = strings.TrimSuffix(version, ".tar.zst")
	}
	m.step = 0

	assetPath, err := deploy.DownloadArtifact(m.latest, instance.ReleasesDir())
	if err != nil {
		m.err = err
		m.step = 0
		return m, nil
	}
	m.step = 1

	relDir, err := deploy.ExtractArtifact(assetPath, instance.ReleasesDir(), version)
	if err != nil {
		m.err = err
		m.step = 1
		return m, nil
	}
	_ = relDir
	m.step = 2

	previous := ""
	if link, linkErr := os.Readlink(instance.CurrentLink()); linkErr == nil {
		if link != "" {
			previous = filepath.Base(link)
		}
	}

	if err := deploy.ActivateRelease(version); err != nil {
		m.err = err
		m.step = 2
		return m, nil
	}
	m.step = 3

	inst, _ := instance.FromName("default")
	checks := deploy.RunHealthChecks(inst)
	m.checks = checks
	critical := 0
	for _, c := range checks {
		if !c.Passed && !c.IsOptional {
			critical++
		}
	}
	if critical > 0 {
		if previous != "" {
			_ = deploy.ActivateRelease(previous)
		}
		m.rolledBack = true
	}
	m.step = 4
	m.screen = UpdateScreenResult
	return m, nil
}
