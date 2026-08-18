package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/E3CNC/e3cnc/cli/go/internal/deploy"
	"github.com/E3CNC/e3cnc/cli/go/internal/instance"
)

// ── First-release acquisition ──────────────────────────────────────
//
// The bootstrap step "Vendor Moonraker and Klipper" copies the vendored
// components out of the *current release* (~/E3CNC/current →
// ~/E3CNC/releases/<version>/vendor/...). On a fresh install no release has
// been downloaded yet, so ~/E3CNC/current does not exist and the step used
// to fail with "no current release: readlink .../current: no such file or
// directory".
//
// ensureCurrentRelease() fixes that by mirroring what `e3cnc-tui update`
// already does: when no current release exists, find the latest
// `e3cnc-stack-*.tar.zst` GitHub artifact, download it, extract it into
// ~/E3CNC/releases/<version>/, and activate it as the current release.

// releaseFetcher obtains and activates the latest stack release.
// Overridable in tests (e.g. to stage a local fake release offline).
var releaseFetcher = fetchAndActivateLatestRelease

// ensureCurrentRelease is a no-op when a current release already exists,
// otherwise it downloads + activates the latest release. Bootstrap calls it
// before the "Vendor Moonraker and Klipper" step so that step never sees a
// missing ~/E3CNC/current on a fresh install.
func ensureCurrentRelease() error {
	if _, err := os.Readlink(instance.CurrentLink()); err == nil {
		return nil // current release already set up (update / reinstall path)
	}
	fmt.Println("  No current release found — downloading latest E3CNC stack...")
	InstallLogf("No current release found — downloading latest E3CNC stack...")
	if err := releaseFetcher(); err != nil {
		return fmt.Errorf("obtain E3CNC release: %w", err)
	}
	fmt.Println("  ✓ Current release ready")
	InstallLogf("✓ Current release ready")
	return nil
}

// fetchAndActivateLatestRelease downloads the latest e3cnc-stack artifact
// from GitHub Releases, extracts it into ~/E3CNC/releases/<version>, and
// activates it via the `current` symlink. Retries up to 3 times on GitHub
// API rate-limit errors with exponential backoff.
func fetchAndActivateLatestRelease() error {
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		if attempt > 1 {
			backoff := time.Duration(attempt*attempt) * 5 * time.Second
			fmt.Printf("  Retrying in %v (attempt %d/3)...\n", backoff, attempt)
			time.Sleep(backoff)
		}

		asset, err := deploy.FindStackArtifact()
		if err != nil {
			lastErr = fmt.Errorf("find stack artifact: %w", err)
			if strings.Contains(err.Error(), "GITHUB_RATE_LIMIT") {
				fmt.Println("  ⚠ GitHub API rate limited, retrying...")
				continue
			}
			return lastErr
		}

		assetPath, err := deploy.DownloadArtifact(asset, filepath.Join(os.TempDir(), "e3cnc-download"))
		if err != nil {
			lastErr = fmt.Errorf("download stack artifact: %w", err)
			if strings.Contains(err.Error(), "429") || strings.Contains(err.Error(), "503") {
				fmt.Println("  ⚠ Download failed (transient), retrying...")
				continue
			}
			return lastErr
		}

		version := strings.TrimPrefix(asset.Name, "e3cnc-stack-")
		version = strings.TrimSuffix(version, ".tar.zst")

		if _, err := deploy.ExtractArtifact(assetPath, instance.ReleasesDir(), version); err != nil {
			return fmt.Errorf("extract stack artifact: %w", err)
		}
		if err := deploy.ActivateRelease(version); err != nil {
			return fmt.Errorf("activate release %s: %w", version, err)
		}
		InstallLogf("Activated release %s", version)
		return nil
	}
	return fmt.Errorf("obtain E3CNC release (3 attempts): %w", lastErr)
}