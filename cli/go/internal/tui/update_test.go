package tui

import (
	"strings"
	"testing"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	tea "github.com/charmbracelet/bubbletea"
)

func TestNewUpdateModel(t *testing.T) {
	m := NewUpdateModel()
	if m.screen != UpdateScreenCheck {
		t.Errorf("NewUpdateModel(): screen = %d, expected UpdateScreenCheck", m.screen)
	}
	if m.cursor != 0 {
		t.Errorf("NewUpdateModel(): cursor = %d, expected 0", m.cursor)
	}
}

func TestUpdateModelConfirmShowsVersions(t *testing.T) {
	m := UpdateModel{
		screen: UpdateScreenConfirm,
		current: &deploy.Release{Version: "0.5.0"},
		latest:  &deploy.GitHubAsset{Name: "e3cnc-stack-0.6.0.tar.zst"},
	}

	view := m.View()
	for _, expected := range []string{"0.5.0", "0.6.0", "Update Available"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Update confirm view missing %q", expected)
		}
	}
}

func TestUpdateModelConfirmShowsChangelog(t *testing.T) {
	m := UpdateModel{
		screen:    UpdateScreenConfirm,
		changelog: "## 0.6.0\n- Fix G-code post-processing",
	}

	view := m.View()
	for _, expected := range []string{"## 0.6.0", "- Fix G-code post-processing"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Update confirm view missing changelog line %q", expected)
		}
	}
}

func TestUpdateModelConfirmSelectedAdvances(t *testing.T) {
	m := UpdateModel{
		screen: UpdateScreenConfirm,
		cursor: 0,
	}

	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(UpdateModel)
	if m2.screen != UpdateScreenProgress {
		t.Errorf("Enter with cursor=0 should start progress, got %d", m2.screen)
	}
	if cmd == nil {
		t.Fatal("expected non-nil command for update start")
	}
}

func TestUpdateModelConfirmCancel(t *testing.T) {
	m := UpdateModel{
		screen: UpdateScreenConfirm,
		cursor: 1,
	}

	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	m2 := mod.(UpdateModel)
	if !m2.done {
		t.Errorf("q on confirm should end update, done=false")
	}
}

func TestUpdateModelAlreadyUpToDate(t *testing.T) {
	m := UpdateModel{
		screen:  UpdateScreenCheck,
		current: &deploy.Release{Version: "0.7.0"},
		latest:  &deploy.GitHubAsset{Name: "e3cnc-stack-0.7.0.tar.zst"},
	}

	mod, _ := m.Update(updateVersionMsg{current: m.current, latest: m.latest})
	m2 := mod.(UpdateModel)
	if !m2.showAboutUp {
		t.Errorf("same versions should set showAboutUp, got %v", m2.showAboutUp)
	}
}

func TestUpdateModelResultShowsRollbackWarning(t *testing.T) {
	m := UpdateModel{
		screen:     UpdateScreenResult,
		rolledBack: true,
		checks: []deploy.HealthCheck{
			{Name: "Moonraker", Passed: true},
		},
	}

	view := m.View()
	for _, expected := range []string{"Update complete", "Auto-rolled back", "New release is preserved"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Update result view missing %q", expected)
		}
	}
}
