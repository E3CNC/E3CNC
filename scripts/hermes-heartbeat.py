#!/usr/bin/env python3
"""Hermes Heartbeat Watchdog.

Uses `hermes status` + `herdr pane list` to detect stalled Hermes sessions
showing "Connect timeout" and nudges them with Enter to resume.
"""

import json
import os
import re
import subprocess
import sys
import time

INTERVAL = 30
COOLDOWN = 120
COOLDOWN_DIR = "/tmp/hermes-heartbeat-cooldowns"
os.makedirs(COOLDOWN_DIR, exist_ok=True)

MY_PANE_ID = os.environ.get("HERDR_PANE_ID", "")
WORKSPACE_ID = os.environ.get("HERDR_WORKSPACE_ID", "")


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def warn(msg):
    print(f"[{time.strftime('%H:%M:%S')}] ⚠ {msg}", flush=True)

def act(msg):
    print(f"[{time.strftime('%H:%M:%S')}] ▶ {msg}", flush=True)


def hermes_session_count():
    """Return active session count from `hermes status`."""
    try:
        out = subprocess.run(
            ["hermes", "status"],
            capture_output=True, text=True, timeout=15
        ).stdout
        m = re.search(r"Active:\s+(\d+)\s+session", out)
        return int(m.group(1)) if m else 0
    except Exception as e:
        log(f"hermes status failed: {e}")
        return -1


def get_herdr_panes():
    """Return list of pane dicts from herdr."""
    try:
        out = subprocess.run(
            ["herdr", "pane", "list", "--workspace", WORKSPACE_ID],
            capture_output=True, text=True, timeout=10
        ).stdout
        data = json.loads(out)
        return data.get("result", {}).get("panes", [])
    except Exception as e:
        log(f"herdr list failed: {e}")
        return []


def read_pane_output(pane_id):
    """Return last lines of output from a pane."""
    try:
        out = subprocess.run(
            ["herdr", "pane", "read", pane_id, "--source", "recent-unwrapped", "--lines", "15"],
            capture_output=True, text=True, timeout=10
        ).stdout
        return [l.strip() for l in out.split("\n") if l.strip()]
    except Exception as e:
        log(f"read pane {pane_id}: {e}")
        return []


def cooldown_file(pane_id):
    return os.path.join(COOLDOWN_DIR, pane_id.replace("/", "_"))


def check_cooldown(pane_id):
    cf = cooldown_file(pane_id)
    if not os.path.exists(cf):
        return False
    try:
        last = int(open(cf).read().strip())
        return (time.time() - last) < COOLDOWN
    except (ValueError, OSError):
        return False


def set_cooldown(pane_id):
    try:
        with open(cooldown_file(pane_id), "w") as f:
            f.write(str(int(time.time())))
    except OSError:
        pass


log(f"Hermes Heartbeat Watchdog started (interval: {INTERVAL}s, cooldown: {COOLDOWN}s)")

while True:
    session_count = hermes_session_count()
    panes = get_herdr_panes()
    hermes_panes = [p for p in panes
                    if p.get("agent") == "hermes"
                    and p.get("pane_id") != MY_PANE_ID]

    log(f"hermes status: {session_count} active session(s), "
        f"{len(hermes_panes)} Hermes pane(s)")

    for p in hermes_panes:
        pid = p["pane_id"]
        status = p.get("agent_status", "") or ""

        # Only check non-working panes
        if status == "working":
            continue

        if check_cooldown(pid):
            continue

        lines = read_pane_output(pid)
        found = False
        for line in lines[-5:]:
            if line.startswith("Connect timeout"):
                found = True
                break

        if found:
            warn(f"Pane {pid} has 'Connect timeout' (status: {status}, "
                 f"hermes active: {session_count}) — nudging")
            try:
                subprocess.run(["herdr", "pane", "run", pid, ""],
                               capture_output=True, timeout=5)
                set_cooldown(pid)
                act(f"Enter sent to pane {pid}")
            except Exception as e:
                log(f"nudge error: {e}")
        else:
            log(f"Pane {pid} idle (status: {status}) — no timeout")

    time.sleep(INTERVAL)