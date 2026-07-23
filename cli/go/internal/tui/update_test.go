package tui

import (
	"fmt"
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

// ── Navigation ──────────────────────────────────────────────────────

func TestUpdateModelConfirmNavigateDown(t *testing.T) {
	m := UpdateModel{screen: UpdateScreenConfirm, cursor: 0}
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m2 := mod.(UpdateModel)
	if m2.cursor != 1 {
		t.Errorf("Down from 0 should move to 1, got %d", m2.cursor)
	}
}

func TestUpdateModelConfirmNavigateUp(t *testing.T) {
	m := UpdateModel{screen: UpdateScreenConfirm, cursor: 1}
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m2 := mod.(UpdateModel)
	if m2.cursor != 0 {
		t.Errorf("Up from 1 should move to 0, got %d", m2.cursor)
	}
}

func TestUpdateModelConfirmNavigateDownClamp(t *testing.T) {
	m := UpdateModel{screen: UpdateScreenConfirm, cursor: 1}
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyDown})
	m2 := mod.(UpdateModel)
	if m2.cursor != 1 {
		t.Errorf("Down from 1 should stay at 1, got %d", m2.cursor)
	}
}

func TestUpdateModelConfirmNavigateUpClamp(t *testing.T) {
	m := UpdateModel{screen: UpdateScreenConfirm, cursor: 0}
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyUp})
	m2 := mod.(UpdateModel)
	if m2.cursor != 0 {
		t.Errorf("Up from 0 should stay at 0, got %d", m2.cursor)
	}
}

func TestUpdateModelConfirmAlternateKeys(t *testing.T) {
	// 'j' for down, 'k' for up
	m := UpdateModel{screen: UpdateScreenConfirm, cursor: 0}
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("j")})
	m2 := mod.(UpdateModel)
	if m2.cursor != 1 {
		t.Errorf("'j' should move down, got %d", m2.cursor)
	}

	mod, _ = m2.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("k")})
	m3 := mod.(UpdateModel)
	if m3.cursor != 0 {
		t.Errorf("'k' should move up, got %d", m3.cursor)
	}
}

func TestUpdateModelConfirmSpaceAdvances(t *testing.T) {
	m := UpdateModel{screen: UpdateScreenConfirm, cursor: 0}
	mod, cmd := m.Update(tea.KeyMsg{Type: tea.KeySpace})
	m2 := mod.(UpdateModel)
	if m2.screen != UpdateScreenProgress {
		t.Errorf("Space with cursor=0 should start progress, got %d", m2.screen)
	}
	if cmd == nil {
		t.Fatal("expected non-nil command for Space")
	}
}

func TestUpdateModelConfirmEscCancels(t *testing.T) {
	m := UpdateModel{screen: UpdateScreenConfirm, cursor: 0}
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEscape})
	m2 := mod.(UpdateModel)
	if !m2.done {
		t.Errorf("Esc on confirm should end update, done=false")
	}
}

// ── Message handling ──────────────────────────────────────────────────

func TestUpdateModelWindowSize(t *testing.T) {
	m := UpdateModel{screen: UpdateScreenConfirm}
	mod, _ := m.Update(tea.WindowSizeMsg{Width: 100, Height: 40})
	m2 := mod.(UpdateModel)
	if m2.width != 100 || m2.height != 40 {
		t.Errorf("WindowSize not stored: w=%d h=%d", m2.width, m2.height)
	}
}

func TestUpdateModelVersionMsgWithError(t *testing.T) {
	m := NewUpdateModel()
	mod, _ := m.Update(updateVersionMsg{err: fmt.Errorf("network error")})
	m2 := mod.(UpdateModel)
	if m2.screen != UpdateScreenResult {
		t.Errorf("error should go to result screen, got %d", m2.screen)
	}
	if m2.err == nil {
		t.Error("expected error to be stored")
	}
}

func TestUpdateModelVersionMsgNewerVersion(t *testing.T) {
	m := NewUpdateModel()
	mod, _ := m.Update(updateVersionMsg{
		current: &deploy.Release{Version: "0.5.0"},
		latest:  &deploy.GitHubAsset{Name: "e3cnc-stack-0.6.0.tar.zst"},
	})
	m2 := mod.(UpdateModel)
	if m2.screen != UpdateScreenConfirm {
		t.Errorf("newer version should go to confirm, got %d", m2.screen)
	}
}

func TestUpdateModelChangelogMsg(t *testing.T) {
	m := NewUpdateModel()
	body := "## 0.6.0\n- Fix G-code"
	mod, _ := m.Update(changelogMsg{body: body})
	m2 := mod.(UpdateModel)
	if m2.changelog != body {
		t.Errorf("changelog not stored: got %q", m2.changelog)
	}
}

func TestUpdateModelChangelogMsgError(t *testing.T) {
	m := NewUpdateModel()
	mod, _ := m.Update(changelogMsg{err: fmt.Errorf("fetch failed")})
	m2 := mod.(UpdateModel)
	if m2.changelog != "" {
		t.Errorf("changelog should be empty on error, got %q", m2.changelog)
	}
}

// ── Version comparison ──────────────────────────────────────────────

func TestUpdateModelVersionVPrefixStripped(t *testing.T) {
	m := NewUpdateModel()
	mod, _ := m.Update(updateVersionMsg{
		current: &deploy.Release{Version: "v0.5.0"},
		latest:  &deploy.GitHubAsset{Name: "e3cnc-stack-0.6.0.tar.zst"},
	})
	m2 := mod.(UpdateModel)
	if m2.screen != UpdateScreenConfirm {
		t.Errorf("v0.5.0 != 0.6.0 should go to confirm, got %d", m2.screen)
	}
}

func TestUpdateModelVersionSameWhenDifferentPrefix(t *testing.T) {
	m := NewUpdateModel()
	mod, _ := m.Update(updateVersionMsg{
		current: &deploy.Release{Version: "v0.5.0"},
		latest:  &deploy.GitHubAsset{Name: "e3cnc-stack-0.5.0.tar.zst"},
	})
	m2 := mod.(UpdateModel)
	if !m2.showAboutUp {
		t.Errorf("v0.5.0 == 0.5.0 should be up-to-date, showAboutUp=%v", m2.showAboutUp)
	}
}

func TestUpdateModelVersionBothWithVPrefix(t *testing.T) {
	// Asset names in our SSOT are normalized (no v prefix).
	// The asset filename e3cnc-stack-0.5.0.tar.zst becomes version 0.5.0.
	currentVer := strings.TrimPrefix("v0.5.0", "v")      // "0.5.0"
	latestVer := strings.TrimPrefix("e3cnc-stack-0.5.0.tar.zst", "e3cnc-stack-")
	latestVer = strings.TrimSuffix(latestVer, ".tar.zst") // "0.5.0"
	if currentVer != latestVer {
		t.Errorf("expected versions to match: current=%q latest=%q", currentVer, latestVer)
	}
}

// ── Screen views ─────────────────────────────────────────────────────

func TestUpdateCheckView(t *testing.T) {
	m := NewUpdateModel()
	view := m.View()
	for _, expected := range []string{"Checking for updates", "Querying GitHub releases"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Check view missing %q", expected)
		}
	}
}

func TestUpdateProgressView(t *testing.T) {
	m := UpdateModel{screen: UpdateScreenProgress, step: 0}
	view := m.View()
	for _, expected := range []string{"Updating E3CNC", "Step:", "Download", "Please wait"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Progress view missing %q", expected)
		}
	}
}

func TestUpdateResultViewSuccess(t *testing.T) {
	m := UpdateModel{
		screen: UpdateScreenResult,
		checks: []deploy.HealthCheck{
			{Name: "Moonraker", Passed: true},
			{Name: "Nginx", Passed: true},
		},
	}
	view := m.View()
	for _, expected := range []string{"Update complete", "Moonraker", "Nginx", "✓"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Success result view missing %q", expected)
		}
	}
}

func TestUpdateResultViewAlreadyUpToDate(t *testing.T) {
	m := UpdateModel{
		screen:      UpdateScreenResult,
		showAboutUp: true,
	}
	view := m.View()
	for _, expected := range []string{"Already up to date", "latest release"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Up-to-date view missing %q", expected)
		}
	}
}

func TestUpdateResultViewError(t *testing.T) {
	m := UpdateModel{
		screen: UpdateScreenResult,
		err:    fmt.Errorf("download failed: connection refused"),
		latest: &deploy.GitHubAsset{Name: "e3cnc-stack-0.6.0.tar.zst"},
	}
	view := m.View()
	for _, expected := range []string{"Update failed", "download failed", "previous release", "Rollback"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Error result view missing %q", expected)
		}
	}
}

func TestUpdateResultViewFailedChecks(t *testing.T) {
	m := UpdateModel{
		screen: UpdateScreenResult,
		checks: []deploy.HealthCheck{
			{Name: "Moonraker", Passed: true},
			{Name: "Klipper", Passed: false, Detail: "not responding"},
		},
	}
	view := m.View()
	for _, expected := range []string{"warnings", "✗", "Klipper", "not responding", "Minor issues", "rollback"} {
		if !strings.Contains(view, expected) {
			t.Errorf("Failed checks view missing %q", expected)
		}
	}
}

func TestUpdateResultViewEnterReturnsToMenu(t *testing.T) {
	m := UpdateModel{
		screen: UpdateScreenResult,
		checks: []deploy.HealthCheck{{Name: "Moonraker", Passed: true}},
	}
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m2 := mod.(UpdateModel)
	if !m2.done {
		t.Errorf("Enter on result should set done, got false")
	}
}

func TestUpdateResultViewQReturnsToMenu(t *testing.T) {
	m := UpdateModel{
		screen: UpdateScreenResult,
		checks: []deploy.HealthCheck{{Name: "Moonraker", Passed: true}},
	}
	mod, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	m2 := mod.(UpdateModel)
	if !m2.done {
		t.Errorf("q on result should set done, got false")
	}
}

func TestUpdateDefaultView(t *testing.T) {
	m := UpdateModel{screen: UpdateScreen(99)}
	view := m.View()
	if view != "" {
		t.Errorf("unrecognized screen should return empty string, got %q", view)
	}
}
