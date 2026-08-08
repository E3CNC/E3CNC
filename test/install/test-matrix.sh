# test/install/test-matrix.sh
# Multi-arch Docker test matrix for install.sh
# Usage: ./test-matrix.sh [--arch arm64|amd64|all] [--distro ubuntu|debian|all]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Test matrix ──────────────────────────────────────────────────────────────
# Format: "distro:arch"
TESTS=(
    "ubuntu:22.04:amd64"
    "ubuntu:22.04:arm64"
    "debian:11:amd64"
    "debian:11:arm64"
    "debian:12:amd64"
    "debian:12:arm64"
)

# ─── Results ──────────────────────────────────────────────────────────────────
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"
SUMMARY_FILE="$RESULTS_DIR/summary.log"
> "$SUMMARY_FILE"

# ─── Helpers ──────────────────────────────────────────────────────────────────
log() { echo -e "[$(date +'%H:%M:%S')] $*"; }
pass() { echo -e "  ${GREEN}✓ PASS${NC} $*"; }
fail() { echo -e "  ${RED}✗ FAIL${NC} $*"; }

# ─── Check prerequisites ──────────────────────────────────────────────────────
check_prereqs() {
    log "Checking prerequisites..."
    for cmd in docker; do
        if ! command -v "$cmd" &>/dev/null; then
            echo "Missing: $cmd"
            exit 1
        fi
    done
    
    # Check QEMU emulation for ARM
    if ! docker run --rm --platform linux/arm64 alpine:latest uname -m 2>/dev/null | grep -q "aarch64"; then
        log "Setting up QEMU emulation..."
        docker run --rm --privileged multiarch/qemu-user-static --reset -p yes &>/dev/null || true
    fi
}

# ─── Run install test ────────────────────────────────────────────────────────
run_test() {
    local distro="$1"
    local arch="$2"
    local test_name="${distro//:/}-${arch}"
    local container_name="e3cnc-test-${test_name}"
    
    log "Testing $distro ($arch)..."
    
    # Remove old container
    docker rm -f "$container_name" &>/dev/null || true
    
    # Run install.sh in container
    local output
    output=$(docker run \
        --name "$container_name" \
        --platform "linux/$arch" \
        --rm \
        "$distro" \
        bash -c "apt-get update && apt-get install -y curl git sudo jq && cd /tmp && curl -fsSL https://raw.githubusercontent.com/E3CNC/E3CNC/main/install.sh | bash -s -- --unattended" 2>&1) || true
    
    # Check for success markers
    if echo "$output" | grep -q "INSTALLATION COMPLETE"; then
        pass "$distro ($arch)"
        echo "PASS $distro $arch" >> "$SUMMARY_FILE"
    elif echo "$output" | grep -q "INSTALL_EXIT_CODE=0"; then
        pass "$distro $arch"
        echo "PASS $distro $arch" >> "$SUMMARY_FILE"
    else
        fail "$distro ($arch)"
        echo "FAIL $distro $arch" >> "$SUMMARY_FILE"
        echo "$output" > "$RESULTS_DIR/${test_name}.log"
    fi
    
    docker rm -f "$container_name" &>/dev/null || true
}

# ─── Print summary ───────────────────────────────────────────────────────────
print_summary() {
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Test Results Summary${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
    
    local pass_count fail_count
    pass_count=$(grep -c "PASS" "$SUMMARY_FILE" 2>/dev/null || echo 0)
    fail_count=$(grep -c "FAIL" "$SUMMARY_FILE" 2>/dev/null || echo 0)
    
    echo -e "  ${GREEN}Passed:${NC} $pass_count"
    echo -e "  ${RED}Failed:${NC} $fail_count"
    echo ""
    
    if [[ $fail_count -gt 0 ]]; then
        echo -e "${RED}Failed tests:${NC}"
        grep "FAIL" "$SUMMARY_FILE"
        echo ""
        echo -e "${YELLOW}Debug logs: $RESULTS_DIR/${NC}"
        return 1
    else
        echo -e "${GREEN}All tests passed!${NC}"
        return 0
    fi
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    local arch_filter="${1:-all}"
    local distro_filter="${2:-all}"
    
    check_prereqs
    
    log "Starting install.sh test matrix..."
    log "Results: $RESULTS_DIR"
    echo ""
    
    for test in "${TESTS[@]}"; do
        local distro="${test%%:*}"
        local arch="${test##*:}"
        
        if [[ "$distro_filter" != "all" && "$distro" != *"$distro_filter"* ]]; then
            continue
        fi
        
        if [[ "$arch_filter" != "all" && "$arch" != "$arch_filter" ]]; then
            continue
        fi
        
        run_test "$distro" "$arch"
        echo ""
    done
    
    print_summary
}

main "$@"
