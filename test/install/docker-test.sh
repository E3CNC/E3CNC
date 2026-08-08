# test/install/docker-test.sh
# Simple Docker-based install.sh tester
# Usage: ./docker-test.sh [ubuntu|debian|raspbian] [amd64|arm64]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Helpers ──────────────────────────────────────────────────────────────────
log() { echo -e "[$(date +'%H:%M:%S')] $*"; }
pass() { echo -e "  ${GREEN}✓ PASS${NC} $*"; }
fail() { echo -e "  ${RED}✗ FAIL${NC} $*"; }

# ─── Test configs ─────────────────────────────────────────────────────────────
declare -A DISTRO_IMAGES=(
    ["ubuntu"]="ubuntu:22.04"
    ["debian"]="debian:11"
    ["raspbian"]="balenalib/raspberrypi3-debian:bullseye"  # ARMv7
)

# ─── Run test ─────────────────────────────────────────────────────────────────
run_test() {
    local distro="${1:-ubuntu}"
    local arch="${2:-amd64}"
    local image="${DISTRO_IMAGES[$distro]}"
    
    if [[ -z "$image" ]]; then
        echo "Unknown distro: $distro"
        exit 1
    fi
    
    log "Testing $distro ($arch) with image $image..."
    
    # Create a test script that runs inside the container
    local test_script="/tmp/e3cnc-install-test-$distro-$arch.sh"
    cat > "$test_script" <<'SCRIPT'
#!/bin/bash
set -uo pipefail
echo "=== E3CNC Install Test ==="
echo "Distro: $(cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"
echo "Arch: $(uname -m)"
echo ""
echo "=== Installing dependencies ==="
apt-get update && apt-get install -y curl git sudo jq
echo ""
echo "=== Downloading install.sh ==="
curl -fsSL https://raw.githubusercontent.com/E3CNC/E3CNC/main/install.sh -o /tmp/install.sh
chmod +x /tmp/install.sh
echo ""
echo "=== Running install.sh --help ==="
bash /tmp/install.sh --help
echo ""
echo "=== Test complete ==="
SCRIPT
    
    # Run in Docker
    local output
    output=$(docker run \
        --platform "linux/$arch" \
        --rm \
        -v "$test_script:/test.sh" \
        "$image" \
        bash /test.sh 2>&1) || true
    
    # Check results
    if echo "$output" | grep -q "E3CNC Installer"; then
        pass "$distro ($arch)"
        return 0
    else
        fail "$distro ($arch)"
        echo "$output"
        return 1
    fi
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    local distro="${1:-ubuntu}"
    local arch="${2:-amd64}"
    
    run_test "$distro" "$arch"
}

main "$@"
