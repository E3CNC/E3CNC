#!/bin/bash
# E3CNC Installer Test Runner
# Runs inside Docker container to test install.sh across target environments
# Usage: /workspace/test-runner.sh <os-name>

set -uo pipefail

OS_NAME="${1:-unknown}"
TEST_PASSED=0
TEST_FAILED=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

pass() { printf "  ${GREEN}✓${NC} %s\n" "$1"; TEST_PASSED=$((TEST_PASSED + 1)); }
fail() { printf "  ${RED}✗${NC} %s\n" "$1"; TEST_FAILED=$((TEST_FAILED + 1)); }
skip() { printf "  ${YELLOW}○${NC} %s (skipped)\n" "$1"; }

echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD}  E3CNC Installer Test: ${OS_NAME}${NC}"
echo -e "${BOLD}  $(uname -m) | $(command -v apt-get &>/dev/null && echo apt || (command -v dnf &>/dev/null && echo dnf || echo unknown))${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

# ─── Test 1: Architecture ────────────────────────────────
echo -e "${BOLD}[1] Architecture Detection${NC}"
ARCH=$(uname -m)
case "$ARCH" in
    aarch64|arm64|x86_64|amd64) pass "Supported arch: $ARCH" ;;
    *) fail "Unsupported arch: $ARCH" ;;
esac

# ─── Test 2: Package Manager ─────────────────────────────
echo ""
echo -e "${BOLD}[2] Package Manager${NC}"
PM=""
command -v apt-get &>/dev/null && PM="apt"
command -v dnf &>/dev/null && PM="dnf"
command -v yum &>/dev/null && PM="yum"
[[ -n "$PM" ]] && pass "Detected: $PM" || fail "No supported PM found"

# ─── Test 3: Dependencies ────────────────────────────────
echo ""
echo -e "${BOLD}[3] Dependencies${NC}"
for dep in git curl unzip python3; do
    command -v "$dep" &>/dev/null && pass "$dep" || fail "$dep missing"
done

# ─── Test 4: install.sh Syntax ───────────────────────────
echo ""
echo -e "${BOLD}[4] Install Script${NC}"
# Try multiple locations for install.sh
for p in /workspace/install.sh ./install.sh /tmp/e3cnc-test/install.sh; do
    if [[ -f "$p" ]]; then
        INSTALL_SH="$p"
        break
    fi
done

if [[ -n "${INSTALL_SH:-}" ]]; then
    if bash -n "$INSTALL_SH" 2>/dev/null; then
        pass "install.sh syntax valid ($INSTALL_SH)"
    else
        fail "install.sh syntax error: $(bash -n "$INSTALL_SH" 2>&1)"
    fi
else
    fail "install.sh not found"
fi

# ─── Test 5: Mock Binary ──────────────────────────────────
echo ""
echo -e "${BOLD}[5] Mock Binary${NC}"
# Prefer mock binary in cwd, fall back to system binary
if [[ -x ./e3cnc-tui ]]; then
    BIN="./e3cnc-tui"
    pass "Mock binary found in cwd"
elif [[ -x /usr/local/bin/e3cnc-tui ]]; then
    BIN="/usr/local/bin/e3cnc-tui"
else
    fail "Binary not found"
    BIN=""
fi

if [[ -n "$BIN" ]]; then
    VER=$("$BIN" --version 2>&1)
    [[ "$VER" == v* ]] && pass "--version: $VER" || fail "--version: unexpected output: $VER"
    # Run in subshell without -u to avoid bashrc PS1 issues
    (set +u; "$BIN" --help 2>&1 | grep -q "Commands:") && pass "--help has Commands section" || fail "--help missing Commands"
fi

# ─── Test 6: Directory Creation (sandbox) ───────────────
echo ""
echo -e "${BOLD}[6] Directory Structure${NC}"
SAND="/tmp/e3cnc-sandbox"
rm -rf "$SAND"
mkdir -p "$SAND"/{releases,instances,backups,logs}
for d in releases instances backups logs; do
    [[ -d "$SAND/$d" ]] && pass "$d created" || fail "$d missing"
done

# ─── Test 7: Binary in Sandbox ───────────────────────────
echo ""
echo -e "${BOLD}[7] Binary in Sandbox${NC}"
cp /usr/local/bin/e3cnc-tui "$SAND/releases/e3cnc-tui"
chmod +x "$SAND/releases/e3cnc-tui"
"$SAND/releases/e3cnc-tui" --version 2>&1 | grep -q "v" && pass "Binary runs from sandbox" || fail "Binary failed in sandbox"

# ─── Summary ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
printf "${BOLD}  Result: %s${NC}\n" "$OS_NAME"
echo -e "${BOLD}════════════════════════════════════════${NC}"
printf "  ${GREEN}Passed:${NC}  %d\n" "$TEST_PASSED"
printf "  ${RED}Failed:${NC}  %d\n" "$TEST_FAILED"
printf "  ${YELLOW}Total:${NC}    %d\n" "$((TEST_PASSED + TEST_FAILED))"
echo ""

[[ $TEST_FAILED -eq 0 ]] && exit 0 || exit 1
