// Package bootstrap — unified package manager abstraction.
// Detects the installed package manager at runtime and provides a common
// interface for list updates, package installation, and existence checks.
package bootstrap

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/E3CNC/e3cnc/cli/go/internal/rootrun"
)

// PackageManager defines the interface that every distribution-specific
// implementation must satisfy. All methods execute via sudo.
type PackageManager interface {
	// Update refreshes the distro's package index.
	Update() error

	// Install installs the given generic package names using resolved
	// distro-specific names. Already-installed packages are skipped.
	// Returns a slice of messages describing what was done (skipped vs installed).
	Install(names []string) ([]string, error)

	// Find reports whether a generic package name is currently installed.
	Find(name string) bool

	// Resolve maps generic package identifiers to distro-specific names.
	// Returns a map from generic → resolved [][]. A nil entry means the
	// package is not needed on this distro.
	Resolve(names []string) map[string][]string
}

// ── Detection ───────────────────────────────────────────────────────

// lookPath is used for testing; swap in a mock during test setup.
var lookPath = exec.LookPath

// Distrolabel returns the canonical label for the detected package manager,
// e.g. "deb", "fedora", "arch", etc. It also returns the corresponding
// PackageManager implementation.
func DetectPackageManager() (label string, pm PackageManager, err error) {
	switch {
	case commandExists("apt-get"):
		return "deb", &AptManager{}, nil
	case commandExists("dnf"):
		return "fedora", &DnfManager{}, nil
	case commandExists("yum"):
		return "rhel8+", &YumManager{}, nil
	case commandExists("pacman"):
		return "arch", &PacmanManager{}, nil
	case commandExists("zypper"):
		return "opensuse", &ZypperManager{}, nil
	case commandExists("apk"):
		return "alpine", &ApkManager{}, nil
	default:
		return "", nil, fmt.Errorf(
			"unsupported package manager: no supported PM found "+
				"(checked: apt-get, dnf, yum, pacman, zypper, apk)",
		)
	}
}

// commandExists returns true if an executable with the given name is found
// in PATH (uses exec.LookPath via the injectable lookPath variable).
func commandExists(name string) bool {
	_, err := lookPath(name)
	return err == nil
}

// ── Compatibility check ────────────────────────────────────────────

// CheckDistroCompatibility runs an early detection of the package manager
// and returns a user-friendly error if the distro is not supported.
// Call this before installSystemPackages to fail fast with a clear message.
func CheckDistroCompatibility() error {
	label, _, err := DetectPackageManager()
	if err != nil {
		return fmt.Errorf("unsupported distribution: %w\n\n"+
			"  E3CNC currently supports Debian, Ubuntu, Fedora, RHEL/CentOS, Arch Linux,\n"+
			"  openSUSE, and Alpine Linux. If your distribution uses a different package\n"+
			"  manager, you may need to install the required packages manually:\n"+
			"    python3, python3-venv, python3-dev, git, curl, unzip, zstd, supervisor,\n"+
			"    nginx, build-essential, libssl-dev, libffi-dev", err)
	}
	fmt.Printf("  Detected package manager: %s\n", label)
	return nil
}

// ── Common helpers ──────────────────────────────────────────────────

// runSudo executes a command as root, non-interactively, writing output to the
// consolidated install log so failures are captured for diagnosis.
func runSudo(args ...string) error {
	return rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(), args...)
}

// ── Deb (Debian / Ubuntu) ──────────────────────────────────────────

type AptManager struct{}

var _ PackageManager = (*AptManager)(nil)

func (a *AptManager) Update() error {
	return runSudo("apt-get", "update")
}

func (a *AptManager) Resolve(names []string) map[string][]string {
	return resolveWithMap(names, Packages, "deb")
}

func (a *AptManager) Install(names []string) ([]string, error) {
	if err := a.Update(); err != nil {
		return nil, fmt.Errorf("apt-get update: %w", err)
	}

	resolved := a.Resolve(names)
	packages := make([]string, 0, len(resolved))
	for _, pkgs := range resolved {
		packages = append(packages, pkgs...)
	}
	if len(packages) == 0 {
		return []string{"All requested packages already installed"}, nil
	}

	msgs := make([]string, 0, len(packages))
	msgs = append(msgs, fmt.Sprintf("Installing %d package(s): %v", len(packages), packages))

	if err := rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(),
		append([]string{"apt-get", "install", "-y"}, packages...)...); err != nil {
		return msgs, fmt.Errorf("apt-get install: %w", err)
	}
	msgs = append(msgs, "Installation complete")
	return msgs, nil
}

func (a *AptManager) Find(name string) bool {
	cmd := exec.Command("dpkg-query", "-W", "-f=${Status}", name)
	out, err := cmd.Output()
	if err != nil {
		return false
	}
	// dpkg returns "install ok installed" on success
	return strings.Contains(string(out), "installed")
}

// ── DNF (Fedora / RHEL family) ─────────────────────────────────────

type DnfManager struct{}

var _ PackageManager = (*DnfManager)(nil)

func (d *DnfManager) Update() error {
	// check-update returns exit 100 if updates available or nothing to do — both OK
	_ = rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(), "dnf", "check-update") // non-fatal
	return nil
}

func (d *DnfManager) Resolve(names []string) map[string][]string {
	return resolveWithMap(names, Packages, "fedora", "rhel8+")
}

func (d *DnfManager) Install(names []string) ([]string, error) {
	d.Update()

	resolved := d.Resolve(names)
	packages := make([]string, 0, len(resolved))
	for _, pkgs := range resolved {
		packages = append(packages, pkgs...)
	}
	if len(packages) == 0 {
		return []string{"All requested packages already installed"}, nil
	}

	msgs := make([]string, 0, len(packages)+1)
	msgs = append(msgs, fmt.Sprintf("Installing %d package(s): %v", len(packages), packages))

	if err := rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(),
		append([]string{"dnf", "install", "-y", "--assumeyes", "--allowerasing"}, packages...)...); err != nil {
		return msgs, fmt.Errorf("dnf install: %w", err)
	}
	msgs = append(msgs, "Installation complete")
	return msgs, nil
}

func (d *DnfManager) Find(name string) bool {
	cmd := exec.Command("rpm", "-q", name)
	return cmd.Run() == nil
}

// ── YUM (Legacy RHEL/CentOS 6/7 fallback) ─────────────────────────

type YumManager struct{}

var _ PackageManager = (*YumManager)(nil)

func (y *YumManager) Update() error {
	// yum makesinfo is equivalent to dnf check-update but less noisy
	_ = rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(), "yum", "check-update") // non-fatal
	return nil
}

func (y *YumManager) Resolve(names []string) map[string][]string {
	return resolveWithMap(names, Packages, "rhel8+", "fedora")
}

func (y *YumManager) Install(names []string) ([]string, error) {
	y.Update()

	resolved := y.Resolve(names)
	packages := make([]string, 0, len(resolved))
	for _, pkgs := range resolved {
		packages = append(packages, pkgs...)
	}
	if len(packages) == 0 {
		return []string{"All requested packages already installed"}, nil
	}

	msgs := make([]string, 0, len(packages)+1)
	msgs = append(msgs, fmt.Sprintf("Installing %d package(s): %v", len(packages), packages))

	if err := rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(),
		append([]string{"yum", "install", "-y", "--assumeyes"}, packages...)...); err != nil {
		return msgs, fmt.Errorf("yum install: %w", err)
	}
	msgs = append(msgs, "Installation complete")
	return msgs, nil
}

func (y *YumManager) Find(name string) bool {
	// yum info exits 0 if package exists, 1 otherwise
	cmd := exec.Command("yum", "info", "--quiet", name)
	return cmd.Run() == nil
}

// ── Pacman (Arch Linux) ────────────────────────────────────────────

type PacmanManager struct{}

var _ PackageManager = (*PacmanManager)(nil)

func (p *PacmanManager) Update() error {
	// -Sy only syncs the local database without upgrading everything
	return runSudo("pacman", "-Sy", "--noconfirm")
}

func (p *PacmanManager) Resolve(names []string) map[string][]string {
	return resolveWithMap(names, Packages, "arch")
}

func (p *PacmanManager) Install(names []string) ([]string, error) {
	if err := p.Update(); err != nil {
		return nil, fmt.Errorf("pacman -Sy: %w", err)
	}

	resolved := p.Resolve(names)
	packages := make([]string, 0, len(resolved))
	for _, pkgs := range resolved {
		packages = append(packages, pkgs...)
	}
	if len(packages) == 0 {
		return []string{"All requested packages already installed"}, nil
	}

	msgs := make([]string, 0, len(packages)+1)
	msgs = append(msgs, fmt.Sprintf("Installing %d package(s): %v", len(packages), packages))

	if err := rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(),
		append([]string{"pacman", "-S", "--noconfirm", "--needed", "--overwrite", "*"}, packages...)...); err != nil {
		return msgs, fmt.Errorf("pacman install: %w", err)
	}
	msgs = append(msgs, "Installation complete")
	return msgs, nil
}

func (p *PacmanManager) Find(name string) bool {
	cmd := exec.Command("pacman", "-Q", "--quiet", name)
	return cmd.Run() == nil
}

// ── Zypper (openSUSE / SUSE Enterprise) ────────────────────────────

type ZypperManager struct{}

var _ PackageManager = (*ZypperManager)(nil)

func (z *ZypperManager) Update() error {
	return runSudo("zypper", "refresh", "-y")
}

func (z *ZypperManager) Resolve(names []string) map[string][]string {
	return resolveWithMap(names, Packages, "opensuse")
}

func (z *ZypperManager) Install(names []string) ([]string, error) {
	z.Update()

	resolved := z.Resolve(names)
	packages := make([]string, 0, len(resolved))
	for _, pkgs := range resolved {
		packages = append(packages, pkgs...)
	}
	if len(packages) == 0 {
		return []string{"All requested packages already installed"}, nil
	}

	msgs := make([]string, 0, len(packages)+1)
	msgs = append(msgs, fmt.Sprintf("Installing %d package(s): %v", len(packages), packages))

	if err := rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(),
		append([]string{"zypper", "install", "-y"}, packages...)...); err != nil {
		return msgs, fmt.Errorf("zypper install: %w", err)
	}
	msgs = append(msgs, "Installation complete")
	return msgs, nil
}

func (z *ZypperManager) Find(name string) bool {
	// zypper search does not support --quiet (exit 2), and zypper search's
	// exit code is unreliable for presence checks. rpm -q is the canonical
	// RPM-family presence query and works on openSUSE/SLES.
	cmd := exec.Command("rpm", "-q", name)
	return cmd.Run() == nil
}

// ── APK (Alpine Linux) ─────────────────────────────────────────────

type ApkManager struct{}

var _ PackageManager = (*ApkManager)(nil)

func (a *ApkManager) Update() error {
	return runSudo("apk", "update")
}

func (a *ApkManager) Resolve(names []string) map[string][]string {
	return resolveWithMap(names, Packages, "alpine")
}

func (a *ApkManager) Install(names []string) ([]string, error) {
	if err := a.Update(); err != nil {
		return nil, fmt.Errorf("apk update: %w", err)
	}

	resolved := a.Resolve(names)
	packages := make([]string, 0, len(resolved))
	for _, pkgs := range resolved {
		packages = append(packages, pkgs...)
	}
	if len(packages) == 0 {
		return []string{"All requested packages already installed"}, nil
	}

	msgs := make([]string, 0, len(packages)+1)
	msgs = append(msgs, fmt.Sprintf("Installing %d package(s): %v", len(packages), packages))

	if err := rootrun.RunAsRootStream(InstallLogWriter(), InstallLogWriter(),
		append([]string{"apk", "add", "--no-cache", "--no-scripts"}, packages...)...); err != nil {
		return msgs, fmt.Errorf("apk add: %w", err)
	}
	msgs = append(msgs, "Installation complete")
	return msgs, nil
}

func (a *ApkManager) Find(name string) bool {
	cmd := exec.Command("apk", "info", "--installed", name)
	return cmd.Run() == nil
}

// ── Utilities ───────────────────────────────────────────────────────

// resolveWithMap looks up each generic package name in the alias map,
// preferring the first matching key in order (firstMatchKeys), falling
// back to "*" (universal). Empty-value entries mean "not needed".
func resolveWithMap(
	names []string,
	aliases map[string]PackageAlias,
	firstMatchKeys ...string,
) map[string][]string {
	result := make(map[string][]string, len(names))
	for _, generic := range names {
		entry, ok := aliases[generic]
		if !ok {
			// Package not in map — passthrough as-is
			result[generic] = []string{generic}
			continue
		}

		// Try preferred keys first, then universal
		var chosen []string
		found := false
		for _, key := range firstMatchKeys {
			if vals, hasKey := entry[key]; hasKey {
				chosen = vals
				found = true
				break
			}
		}
		if !found {
			if vals, hasStar := entry["*"]; hasStar {
				chosen = vals
			}
		}
		result[generic] = chosen
	}
	return result
}
