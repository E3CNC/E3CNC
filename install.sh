#!/bin/bash
# E3CNC Bootstrap Installer - Downloads e3cnc-tui and hands off to Go binary
# Usage: sudo ./install.sh [--unattended] [--test-ports] [--dir <path>]
set -uo pipefail

SCRIPT_VERSION="0.1.0"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="e3cnc-tui"
RELEASE_URL="https://github.com/E3CNC/E3CNC/releases/latest/download"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log_error() { echo -e "${RED}✗${NC} ${BOLD}Error:${NC} $*" >&2; }
log_info()  { echo -e "${GREEN}✓${NC} $*"; }
log_warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
log_step()  { echo -e "${CYAN}▸${NC} $*"; }

detect_architecture() {
    local arch; arch=$(uname -m)
    case "$arch" in
        aarch64|arm64) echo "arm64" ;;
        x86_64|amd64)  echo "amd64" ;;
        armv6l|armv7l)
            log_error "Unsupported architecture: ${arch}. E3CNC builds 64-bit binaries (arm64/amd64) only."
            echo ""
            echo "  Your ${arch} system (e.g. Raspberry Pi Zero, Pi 1) cannot run arm64 binaries."
            echo ""
            echo "  Options:"
            echo "    1. Install a 64-bit OS (Raspberry Pi OS 64-bit, Ubuntu Server, etc.)"
            echo "       — the Pi's CPU supports it; the default OS is often 32-bit."
            echo "    2. Build from source: cd cli/go && CGO_ENABLED=0 GOARCH=arm GOARM=6 go build -o e3cnc-tui ./cmd/e3cnc-tui/"
            echo "       — requires Go toolchain on the target machine."
            exit 1 ;;
        *) log_error "Unsupported architecture: ${arch}. Supported architectures: arm64, amd64. If you have a 32-bit ARM system (armv6l/armv7l), see the error above for workarounds."; exit 1 ;;
    esac
}

check_disk_space() {
    local needed_mb=100
    local available_mb; available_mb=$(df -m /tmp | awk 'NR==2{print $4}')
    if [[ "$available_mb" -lt "$needed_mb" ]]; then
        log_error "Insufficient disk space: ${available_mb} MB available, ${needed_mb} MB required in /tmp"
        exit 1
    fi
}

usage() {
    echo "E3CNC Bootstrap Installer v${SCRIPT_VERSION}"
    echo
    echo "Usage: sudo $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --unattended    Run without prompts (use defaults)"
    echo "  --dir <path>    Specify custom installation directory"
    echo "  --test-ports    Test port auto-detection via e3cnc-tui"
    echo "  --version, -v   Show version and exit"
    echo "  --help, -h      Show this help message"
    echo
    echo "Environment variables:"
    echo "  E3CNC_DIR       Set installation directory (default: ~/E3CNC)"
    exit 0
}

# install_binary installs the downloaded temp file as the e3cnc-tui binary.
# Guards against a stale *directory* at the destination (leftover from an
# older or partial install): `mv` would otherwise move the file *inside* the
# directory, leaving the path as a directory and breaking the handoff with
# "Is a directory" (exit 126). Returns 0 on success, 1 on failure.
install_binary() {
    local src="$1" dst="$2"

    if [[ -d "$dst" ]]; then
        log_warn "Removing stale directory at ${dst} (leftover from a previous install)"
        rm -rf "$dst"
    fi

    chmod +x "$src" && mv -f "$src" "$dst"

    # Verify the installed path is a regular executable file.
    if [[ -f "$dst" && -x "$dst" && ! -d "$dst" ]]; then
        return 0
    fi
    log_error "Binary install failed: ${dst} is not an executable file"
    return 1
}

main() {
    local UNATTENDED=false TEST_PORTS=false CUSTOM_DIR=""

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --unattended) UNATTENDED=true; shift ;;
            --dir) CUSTOM_DIR="${2:-}"; [[ -z "$CUSTOM_DIR" ]] && { log_error "--dir requires a path"; exit 1; }; shift 2 ;;
            --test-ports) TEST_PORTS=true; shift ;;
            --version|-v) echo "e3cnc-installer v${SCRIPT_VERSION}"; exit 0 ;;
            --help|-h) usage ;;
            *) log_error "Unknown option: $1"; usage; exit 1 ;;
        esac
    done

    # ── Pre-flight checks ──────────────────────────────────────────
    [[ $EUID -ne 0 ]] && { log_error "This installer must be run with sudo"; echo "Usage: sudo $0 [--unattended]"; exit 1; }

    local arch; arch=$(detect_architecture)
    log_info "Architecture: ${arch}"
    local binary_path="$INSTALL_DIR/$BINARY_NAME"

    check_disk_space
    log_info "Disk space: OK"

    # ── Download binary ────────────────────────────────────────────
    local download_url="${RELEASE_URL}/${BINARY_NAME}-${arch}"
    local checksum_url="${download_url}.sha256"
    local temp_file; temp_file=$(mktemp)
    local checksum_file; checksum_file=$(mktemp)

    log_step "Downloading ${BINARY_NAME} (${arch})..."
    if ! curl -fSL --max-time 120 --progress-bar "$download_url" -o "$temp_file" 2>&1; then
        log_error "Download failed: ${download_url}
  Check your network connection and try again.
  Manual download: ${download_url}"
        rm -f "$temp_file" "$checksum_file"; exit 1
    fi

    # ── SHA256 checksum verification ───────────────────────────────
    log_step "Verifying checksum..."
    if curl -fsSL --max-time 30 "$checksum_url" -o "$checksum_file" 2>/dev/null && [[ -s "$checksum_file" ]]; then
        local expected; expected=$(cut -d' ' -f1 < "$checksum_file")
        local actual; actual=$(sha256sum "$temp_file" | cut -d' ' -f1)
        if [[ "$expected" != "$actual" ]]; then
            log_error "Checksum mismatch! The downloaded file may be corrupted.
  Expected: ${expected}
  Got:      ${actual}
  Try re-running the installer."
            rm -f "$temp_file" "$checksum_file"; exit 1
        fi
        log_info "Checksum verified"
    else
        log_error "Checksum file not found at ${checksum_url}. Cannot verify binary integrity.
  Skipping verification is unsafe. Aborting for security.
  If this issue persists, check your network or download manually from:
  ${download_url}"
        rm -f "$temp_file" "$checksum_file"; exit 1
    fi
    rm -f "$checksum_file"

    # ── Install binary ─────────────────────────────────────────────
    if ! install_binary "$temp_file" "$binary_path"; then
        rm -f "$temp_file"
        exit 1
    fi
    log_info "Installed ${BINARY_NAME} to ${binary_path}"

    # ── --test-ports: delegate to Go binary ─────────────────────────
    if [[ "$TEST_PORTS" == "true" ]]; then
        log_step "Running port auto-detection..."
        exec "$binary_path" install --port-detect
    fi

    # ── Hand off to Go binary ──────────────────────────────────────
    log_step "Launching E3CNC installation wizard..."
    local go_args="install"
    [[ "$UNATTENDED" == "true" ]] && go_args+=" --yes"
    if [[ -n "$CUSTOM_DIR" ]]; then
        E3CNC_DIR="$CUSTOM_DIR" exec "$binary_path" $go_args
    else
        exec "$binary_path" $go_args
    fi
}

# Only run main when executed directly (not when sourced by tests).
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
