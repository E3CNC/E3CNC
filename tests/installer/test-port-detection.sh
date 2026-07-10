#!/bin/bash
# Standalone test for port auto-detection functions
set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PASS=0
FAIL=0

pass() { printf "  ${GREEN}✓${NC} %s\n" "$1"; PASS=$((PASS+1)); }
fail() { printf "  ${RED}✗${NC} %s\n" "$1"; FAIL=$((FAIL+1)); }

# ─── Copy functions from install.sh ──────────────────────────────────────────
check_port() {
    local port="$1"
    if ss -tuln | grep -q ":$port "; then
        return 1  # Port is in use
    fi
    return 0  # Port is free
}

find_free_port() {
    local start_port="$1"
    local max_tries="${2:-100}"
    local port=$start_port
    
    for ((i=0; i<max_tries; i++)); do
        if check_port "$port"; then
            echo "$port"
            return 0
        fi
        port=$((port + 1))
    done
    
    echo "ERROR: Could not find free port" >&2
    return 1
}

# ─── Tests ──────────────────────────────────────────────────────────────────
echo "[1] check_port() tests"
check_port 1 && pass "Port 1 is free" || fail "Port 1 should be free"
check_port 22 && fail "Port 22 (SSH) should be in use" || pass "Port 22 correctly detected as in use"

echo ""
echo "[2] find_free_port() tests"
PORT=$(find_free_port 50000)
if [[ "$PORT" =~ ^[0-9]+$ ]] && check_port "$PORT"; then
    pass "Found free port: $PORT"
else
    fail "Failed to find free port"
fi

echo ""
echo "[3] Port conflict simulation"
# Simulate a port conflict by checking if 8081 is free, then test find_free_port
if check_port 8081; then
    echo "  Port 8081 is free (no conflict to test)"
    pass "No conflict to test (8081 free)"
else
    NEW_PORT=$(find_free_port 8081)
    if [[ "$NEW_PORT" != "8081" ]] && check_port "$NEW_PORT"; then
        pass "Auto-detected new port: $NEW_PORT (8081 was in use)"
    else
        fail "Failed to auto-detect port"
    fi
fi

echo ""
echo "════════════════════════════════════════"
echo "Result: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
