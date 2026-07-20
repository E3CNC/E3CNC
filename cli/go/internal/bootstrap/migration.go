package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"
)

// MigrateOldDir migrates data from the legacy lowercase ~/e3cnc directory
// to the current uppercase ~/E3CNC directory.
//
// Three scenarios:
//  1. Only old dir exists → rename to new
//  2. Both exist → merge (non-destructive, skip existing)
//  3. Only new dir exists → no-op
func MigrateOldDir() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot determine home directory: %w", err)
	}

	oldDir := filepath.Join(home, "e3cnc")
	newDir := E3CNCHome()

	oldExists := dirExists(oldDir)
	newExists := dirExists(newDir)

	// On case-insensitive filesystems (macOS), e3cnc and E3CNC may resolve
	// to the same directory. Check if they're actually different.
	if oldExists && newExists {
		oldInfo, _ := os.Stat(oldDir)
		newInfo, _ := os.Stat(newDir)
		if oldInfo != nil && newInfo != nil && os.SameFile(oldInfo, newInfo) {
			// Same directory on case-insensitive filesystem
			return nil
		}
	}

	// Scenario 3: only new dir exists (or neither) → nothing to do
	if !oldExists {
		return nil
	}

	// Scenario 1: only old dir exists → rename
	if oldExists && !newExists {
		fmt.Printf("  Migrating %s → %s\n", oldDir, newDir)
		if err := os.Rename(oldDir, newDir); err != nil {
			// If rename fails (e.g., cross-device or macOS tmpdir), fall back to copy+delete
			fmt.Fprintf(os.Stderr, "  Rename failed (%v), falling back to copy+delete\n", err)
			if err := copyAndRemove(oldDir, newDir); err != nil {
				return fmt.Errorf("migrate %s → %s: %w", oldDir, newDir, err)
			}
		}
		return nil
	}

	// Scenario 2: both exist → merge non-destructively
	fmt.Printf("  Merging %s into %s (non-destructive)\n", oldDir, newDir)
	return mergeDirs(oldDir, newDir)
}

// copyAndRemove copies src to dst recursively, then removes src.
// Used as a fallback when os.Rename fails (e.g., cross-device, macOS tmpdir).
func copyAndRemove(src, dst string) error {
	if err := copyDirPreserve(src, dst); err != nil {
		return fmt.Errorf("copy %s → %s: %w", src, dst, err)
	}
	return os.RemoveAll(src)
}

// mergeDirs copies contents from srcDir into dstDir, skipping files that
// already exist in dstDir. After merge, srcDir is removed.
func mergeDirs(srcDir, dstDir string) error {
	err := filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err // pass through errors
		}

		// Compute relative path
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return fmt.Errorf("cannot compute relative path for %s: %w", path, err)
		}
		if rel == "." {
			return nil
		}

		dstPath := filepath.Join(dstDir, rel)

		// Preserve symlinks (e.g. the `current` symlink pointing to an
		// active instance directory) instead of reading them as files.
		if info.Mode()&os.ModeSymlink != 0 {
			if _, serr := os.Lstat(dstPath); serr == nil {
				return nil // skip existing
			}
			target, lerr := os.Readlink(path)
			if lerr != nil {
				return fmt.Errorf("readlink %s: %w", path, lerr)
			}
			if serr := os.Symlink(target, dstPath); serr != nil {
				return fmt.Errorf("symlink %s -> %s: %w", dstPath, target, serr)
			}
			return nil
		}

		if info.IsDir() {
			// Create directory in destination if it doesn't exist
			if err := os.MkdirAll(dstPath, info.Mode()); err != nil {
				return fmt.Errorf("mkdir %s: %w", dstPath, err)
			}
			return nil
		}

		// For files, skip if destination already exists
		if _, err := os.Stat(dstPath); err == nil {
			return nil // skip existing
		}

		// Copy the file (preserve permissions)
		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}
		if err := os.WriteFile(dstPath, data, info.Mode()); err != nil {
			return fmt.Errorf("write %s: %w", dstPath, err)
		}

		return nil
	})

	if err != nil {
		// Clean up on failure: remove the partially created files
		fmt.Fprintf(os.Stderr, "  Warning: merge failed mid-way, manual cleanup may be needed: %v\n", err)
		return fmt.Errorf("merge: %w", err)
	}

	// Remove old directory after successful merge
	if err := os.RemoveAll(srcDir); err != nil {
		fmt.Fprintf(os.Stderr, "  Warning: could not remove %s after merge: %v\n", srcDir, err)
		// Non-fatal: data was merged successfully
	}

	return nil
}

// dirExists returns true if path exists and is a directory.
func dirExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}
