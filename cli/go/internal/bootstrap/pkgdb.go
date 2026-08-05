// Package bootstrap — package name alias database.
// Maps generic (distributor-neutral) package identifiers to distro-specific
// package names. Every entry must cover all six distro families: deb, fedora,
// rhel8+, arch, alpine, opensuse. A "*" key means the name is universal.
//
// Supported generic packages (original hard-coded list + common extras):
//   git, curl, unzip, zstd, nginx, supervisor, python3, python3-pip,
//   python3-venv, python3-dev, build-essential, libffi-dev, libssl-dev,
//   avahi-utils, tree, iproute2
package bootstrap

// PackageAlias maps a distro family ID to the actual package name(s).
// An empty string means the package is not needed on that distro
// (e.g., Python dev headers are bundled with the base package on Arch).
// Multi-value arrays represent cases where one generic package expands
// to several real packages (currently unused — all entries are single-value).
type PackageAlias map[string][]string

// Packages maps generic package names to distro-specific names.
// Universal packages get a "*" entry shared across all distros.
var Packages = map[string]PackageAlias{
	"git": {
		"*": {"git"},
	},
	"curl": {
		"*": {"curl"},
	},
	"unzip": {
		"*": {"unzip"},
	},
	"zstd": {
		"*": {"zstd"},
	},
	"nginx": {
		"*": {"nginx"},
	},
	"supervisor": {
		"*": {"supervisor"},
	},
	"python3": {
		"*": {"python3"},
	},
	"python3-pip": {
		"*": {"python3-pip"},
	},
	"avahi-utils": {
		"*": {"avahi-utils"},
	},
	"tree": {
		"*": {"tree"},
	},
	"iproute2": {
		"*": {"iproute2"},
	},
	"python3-venv": {
		"deb":      {"python3-venv"},
		"fedora":   {"python3-virtualenv"},
		"rhel8+":   {"python3-virtualenv"},
		"arch":     {"python-virtualenv"},
		"alpine":   {"py3-virtualenv"},
		"opensuse": {"python3-virtualenv"},
	},
	"python3-dev": {
		"deb":      {"python3-dev"},
		"fedora":   {"python3-devel"},
		"rhel8+":   {"python3-devel"},
		"arch":     {}, // Arch includes dev headers in base python package
		"alpine":   {"python3-dev"},
		"opensuse": {"python3-devel"},
	},
	"build-essential": {
		"deb":      {"build-essential"},
		"fedora":   {"gcc-c++"},
		"rhel8+":   {"gcc-c++"},
		"arch":     {"base-devel"}, // meta-group; covers gcc, make, etc.
		"alpine":   {"build-base"},
		"opensuse": {"gcc-c++"},
	},
	"libffi-dev": {
		"deb":      {"libffi-dev"},
		"fedora":   {"libffi-devel"},
		"rhel8+":   {"libffi-devel"},
		"arch":     {"libffi"}, // no -dev split on Arch
		"alpine":   {"libffi-dev"},
		"opensuse": {"libffi-devel"},
	},
	"libssl-dev": {
		"deb":      {"libssl-dev"},
		"fedora":   {"openssl-devel"}, // NOT libssl-devel!
		"rhel8+":   {"openssl-devel"},
		"arch":     {"openssl"},       // no -dev split on Arch
		"alpine":   {"openssl-dev"},
		"opensuse": {"openssl-devel"},
	},
}

// AllPackages returns the canonical list of all managed generic package names
// in a stable order (matching the original hard-coded apt-get list).
func AllPackages() []string {
	return []string{
		"git", "curl", "unzip", "zstd", "nginx", "supervisor",
		"python3", "python3-pip", "python3-venv", "python3-dev",
		"build-essential", "libffi-dev", "libssl-dev", "avahi-utils",
	}
}
