#!/bin/bash
# E3CNC full-stack dev container entrypoint
#
# Starts three processes in dependency order:
#   1. Simulator MCU (PTY connected to Klippy)
#   2. Klippy (connects to MCU via PTY, opens UDS for Moonraker)
#   3. Moonraker (connects to Klippy via UDS)
#
# Health check mode queries Moonraker for klippy_state.
#
# PTY creation is done via a small Python helper since socat has
# issues with PTY in some container environments.

set -euo pipefail

# ── Paths ──────────────────────────────────────────────────────────────────
SIMULATOR_BIN="/usr/local/bin/klipper_simulator"
KLIPPER_DIR="/app/vendor/klipper"
MOONRAKER_DIR="/app/vendor/moonraker"
PRINTER_CFG="/app/printer.cfg"
MOONRAKER_CFG="/app/moonraker.conf"
SIMULATOR_PTY="/tmp/simulator-pty"
KLIPPY_UDS="/tmp/klippy_uds"
PID_FILE="/tmp/container.pids"

# ── PTY helper (Python) ──────────────────────────────────────────────────────
# Creates a PTY pair, wires the slave end to the simulator MCU's stdin/stdout,
# and writes the master PTY path to stdout so the script can use it.
read -r -d '' PTY_HELPER <<'PYEOF' || true
import os, pty, sys, signal, time

# Create a PTY pair. The slave side appears as /dev/pts/N and is what
# Klippy opens as a serial port. The master fd is what the simulator
# MCU reads/writes via stdin/stdout.
master_fd, slave_fd = pty.openpty()
slave_name = os.ttyname(slave_fd)  # e.g. /dev/pts/0

pid = os.fork()
if pid == 0:
    # Child: connect master fd to stdin/stdout, exec simulator
    os.close(slave_fd)
    os.dup2(master_fd, 0)  # stdin <- reads Klippy commands from PTY
    os.dup2(master_fd, 1)  # stdout -> writes responses to PTY
    os.dup2(master_fd, 2)  # stderr
    if master_fd > 2:
        os.close(master_fd)
    os.execv("/usr/local/bin/klipper_simulator", ["klipper_simulator"])
    sys.exit(1)
else:
    # Parent: close both fds, write slave PTY path
    os.close(master_fd)
    os.close(slave_fd)
    print(f"PTY_SLAVE={slave_name}")
    print(f"CHILD_PID={pid}")
    sys.stdout.flush()
    # Monitor child — if it exits, parent exits too
    try:
        while True:
            wpid, status = os.waitpid(pid, os.WNOHANG)
            if wpid == pid:
                sys.exit(os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1)
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        os.kill(pid, signal.SIGTERM)
        os.waitpid(pid, 0)
        sys.exit(0)
PYEOF

# ── Start subsystem ──────────────────────────────────────────────────────────

start() {
    echo "=== E3CNC Dev Container starting ==="

    rm -f "$PID_FILE"

    # ── Step 1: Start simulator MCU via PTY ──────────────────────────────
    echo "[1] Starting simulator MCU via PTY..."
    rm -f "$SIMULATOR_PTY"

    # Launch Python PTY helper in background, capture its output
    python3 -c "$PTY_HELPER" > /tmp/pty-output.txt 2>&1 &
    PTY_HELPER_PID=$!

    # Wait for PTY info
    sleep 1
    if [ -f /tmp/pty-output.txt ]; then
        PTY_SLAVE=$(grep "^PTY_SLAVE=" /tmp/pty-output.txt | cut -d= -f2- || true)
        MCU_PID=$(grep "^CHILD_PID=" /tmp/pty-output.txt | cut -d= -f2- || true)
    fi

    if [ -z "${PTY_SLAVE:-}" ]; then
        echo "ERROR: PTY slave not created. Output:" >&2
        cat /tmp/pty-output.txt >&2
        exit 1
    fi

    # Symlink for Klippy config (points to slave TTY path)
    ln -sf "$PTY_SLAVE" "$SIMULATOR_PTY"
    echo "  MCU PID: $MCU_PID"
    echo "  PTY slave (Klippy serial): $PTY_SLAVE"
    echo "  PTY link: $SIMULATOR_PTY"
    echo "PTY_HELPER=$PTY_HELPER_PID" > "$PID_FILE"
    echo "MCU=$MCU_PID" >> "$PID_FILE"

    # ── Step 2: Start Klippy ─────────────────────────────────────────────
    echo "[2] Starting Klippy..."
    cd "$KLIPPER_DIR"
    python3 klippy/klippy.py "$PRINTER_CFG" \
        -a "$KLIPPY_UDS" \
        -l /tmp/klippy.log \
        -v 2>&1 &
    KLIPPY_PID=$!
    echo "  Klippy PID: $KLIPPY_PID"
    echo "KLIPPY=$KLIPPY_PID" >> "$PID_FILE"
    cd /app

    # ── Step 3: Start Moonraker ──────────────────────────────────────────
    echo "[3] Starting Moonraker..."
    cd "$MOONRAKER_DIR"
    python3 moonraker/moonraker.py \
        -c "$MOONRAKER_CFG" \
        -d /tmp/moonraker-data \
        -l /tmp/moonraker.log 2>&1 &
    MOONRAKER_PID=$!
    echo "  Moonraker PID: $MOONRAKER_PID"
    echo "MOONRAKER=$MOONRAKER_PID" >> "$PID_FILE"
    cd /app

    echo "=== All processes started ==="
    echo "  Moonraker:   http://localhost:7125"
    echo "  Klippy UDS:  $KLIPPY_UDS"
    echo "  MCU PTY:     $SIMULATOR_PTY ($PTY_SLAVE)"

    # Trap SIGTERM/SIGINT to clean up child processes
    trap cleanup SIGTERM SIGINT EXIT

    # Wait for any process to exit, then kill the others
    set +e
    while true; do
        for p in "$PTY_HELPER_PID" "$KLIPPY_PID" "$MOONRAKER_PID"; do
            if ! kill -0 "$p" 2>/dev/null; then
                echo "Process $p exited. Shutting down..."
                cleanup
                exit 1
            fi
        done
        sleep 5
    done
}

# ── Cleanup ──────────────────────────────────────────────────────────────────

cleanup() {
    echo "Shutting down..."
    if [ -f "$PID_FILE" ]; then
        while IFS='=' read -r name pid; do
            kill "$pid" 2>/dev/null || true
        done < "$PID_FILE"
        wait 2>/dev/null
    fi
    rm -f "$PID_FILE" "$SIMULATOR_PTY"
}

# ── Health check subsystem ───────────────────────────────────────────────────

health() {
    # Query Moonraker's /server/info endpoint
    local resp
    resp=$(curl -sf --max-time 3 http://localhost:7125/server/info 2>/dev/null || true)

    if [ -z "$resp" ]; then
        echo "UNHEALTHY: Moonraker not responding"
        exit 1
    fi

    # Check klippy_state
    local klippy_state
    klippy_state=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',{}).get('klippy_state','unknown'))" 2>/dev/null || echo "unknown")

    if [ "$klippy_state" = "ready" ]; then
        echo "HEALTHY: Klippy state=$klippy_state"
        exit 0
    else
        echo "UNHEALTHY: Klippy state=$klippy_state (expected 'ready')"
        exit 1
    fi
}

# ── Main dispatch ────────────────────────────────────────────────────────────

case "${1:-start}" in
    start)
        start
        ;;
    health)
        health
        ;;
    *)
        echo "Usage: $0 {start|health}"
        exit 1
        ;;
esac