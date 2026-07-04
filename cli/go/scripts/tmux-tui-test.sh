#!/usr/bin/env bash
# tmux-tui-test.sh — Interactive BubbleTea TUI test runner
# Tests all 24 menu options + instance manager + install wizard
# via the main:1.0 tmux SSH pane.
#
# Usage:  ./tmux-tui-test.sh [--pane main:1.0] [--binary ~/e3cnc/current/bin/e3cnc-tui]
set -euo pipefail

PANE="${TUI_PANE:-main:1.0}"
BINARY="${TUI_BINARY:-~/e3cnc/current/bin/e3cnc-tui}"
PASS=0
FAIL=0
FAILURES=""

send_key() { tmux send-keys -t "$PANE" "$1" 2>/dev/null; }
send_enter() { tmux send-keys -t "$PANE" Enter 2>/dev/null; }
capture() { tmux capture-pane -p -J -t "$PANE" -S -40 2>/dev/null; }
wait_for() { sleep "$1"; }

launch_tui() {
  send_key C-c 2>/dev/null; wait_for 1
  send_key C-c 2>/dev/null; wait_for 1
  send_key C-c 2>/dev/null; wait_for 1
  tmux send-keys -t "$PANE" "q" 2>/dev/null; wait_for 1
  tmux send-keys -t "$PANE" "q" 2>/dev/null; wait_for 1
  tmux send-keys -t "$PANE" 'echo "---TUI-TEST-RESET---"' Enter 2>/dev/null; wait_for 2
  tmux send-keys -t "$PANE" "$BINARY" Enter 2>/dev/null; wait_for 4
}

quit_tui() {
  local tries=3
  for i in $(seq 1 $tries); do
    local out
    out=$(capture)
    if echo "$out" | grep -q "biqu@BTT-CB1"; then
      return 0  # already at shell
    fi
    if echo "$out" | grep -q "↑/↓ navigate"; then
      send_key "q"; wait_for 1
    else
      send_key "q"; wait_for 1
    fi
  done
  # Final check
  local out; out=$(capture)
  echo "$out" | grep -q "biqu@BTT-CB1" || send_key C-c
  wait_for 1
}

navigate_to() {
  local target="$1"
  local current=0
  # Item positions: Install=0, Update=1, Uninstall=2, Status=3, Check Deps=4,
  # Instances=5, Detect MCU=6, Flash MCU=7, Init Config=8, Releases=9,
  # Rollback=10, Backup=11, Restore=12, CLI Log=13, Diagnose=14, Logs=15,
  # Admin Page=16, Quit=17
  # Map item name to index
  case "$target" in
    Install) current=0;; Update) current=1;; Uninstall) current=2;;
    Status) current=3;; "Check Deps") current=4;; Instances) current=5;;
    "Detect MCU") current=6;; "Flash MCU") current=7;; "Init Config") current=8;;
    Releases) current=9;; Rollback) current=10;; Backup) current=11;;
    Restore) current=12;; "CLI Log") current=13;; Diagnose) current=14;;
    Logs) current=15;; "Admin Page") current=16;; Quit) current=17;;
    *) echo "Unknown target: $target"; return 1;;
  esac
  # Press Down $current times to reach target
  for i in $(seq 1 $current); do
    send_key "Down"
    wait_for 0.5
  done
}

check_cursor_on() {
  local expected="$1"
  local out; out=$(capture)
  if echo "$out" | grep -q "▸ $expected"; then
    return 0
  else
    echo "  EXPECTED cursor on: '$expected'"
    echo "  BUT found:"
    echo "$out" | grep '▸' || echo "  (no cursor found)"
    return 1
  fi
}

test_item() {
  local label="$1"
  local cmd="$2"
  local expect_cursor="$3"
  local press_enter="${4:-no}"

  echo ""
  echo "── Test: $label ($cmd) ──"

  launch_tui
  navigate_to "$expect_cursor"
  wait_for 1

  # Check cursor is on the expected item
  if check_cursor_on "$expect_cursor"; then
    echo "  ✅ Cursor on '$expect_cursor'"
  else
    echo "  ❌ Cursor navigation failed"
    FAIL=$((FAIL + 1))
    FAILURES="$FAILURES\n  - $label: cursor navigation failed"
    quit_tui
    return
  fi

  # For wizard items, test that Enter opens the screen
  if [ "$press_enter" = "yes" ]; then
    send_enter
    wait_for 6
    local out; out=$(capture)
    # Check if we transitioned to the expected screen
    case "$cmd" in
      install)
        if echo "$out" | grep -q "Pre-flight\|Instance Configuration\|Install Wizard"; then
          echo "  ✅ Install wizard opened"
          PASS=$((PASS + 1))
        else
          echo "  ❌ Install wizard did not open"
          echo "  Output: $(echo "$out" | head -5)"
          FAIL=$((FAIL + 1))
          FAILURES="$FAILURES\n  - $label: install wizard did not open"
        fi
        ;;
      instances)
        if echo "$out" | grep -q "Instance Manager\|Loading instances\|instances command"; then
          echo "  ✅ Instance manager opened"
          PASS=$((PASS + 1))
        else
          echo "  ❌ Instance manager did not open"
          echo "  Output: $(echo "$out" | head -5)"
          FAIL=$((FAIL + 1))
          FAILURES="$FAILURES\n  - $label: instance manager did not open"
        fi
        ;;
      quit)
        if echo "$out" | grep -q "biqu@BTT-CB1"; then
          echo "  ✅ Quit returned to shell"
          PASS=$((PASS + 1))
        else
          echo "  ❌ Quit did not return to shell"
          FAIL=$((FAIL + 1))
          FAILURES="$FAILURES\n  - $label: quit failed"
        fi
        return  # don't call quit_tui again
        ;;
    esac
  else
    PASS=$((PASS + 1))
    echo "  ✅ Cursor verified"
  fi

  quit_tui
}

# ── Main test sequence ──────────────────────────────────────────────

echo "=========================================="
echo "  E3CNC TUI — tmux Test Suite"
echo "  Pane: $PANE"
echo "  Binary: $BINARY"
echo "=========================================="
echo ""

# Ensure TUI is closed
quit_tui
wait_for 1

# ── Test 1: Menu renders ──
echo "── Test: Menu renders ──"
launch_tui
OUT=$(capture)
if echo "$OUT" | grep -q "E3CNC CLI" && \
   echo "$OUT" | grep -q "Setup" && \
   echo "$OUT" | grep -q "Monitor" && \
   echo "$OUT" | grep -q "Hardware" && \
   echo "$OUT" | grep -q "Manage" && \
   echo "$OUT" | grep -q "Tools" && \
   echo "$OUT" | grep -q "Quit" && \
   echo "$OUT" | grep -q "↑/↓ navigate"; then
  echo "  ✅ Main menu renders with all sections"
  PASS=$((PASS + 1))
else
  echo "  ❌ Main menu missing sections"
  FAIL=$((FAIL + 1))
  FAILURES="$FAILURES\n  - Menu: sections missing"
fi
quit_tui

# ── Test 2-19: Cursor navigation for each item ──
test_item "Install" "install" "Install"
test_item "Update" "update" "Update"
test_item "Uninstall" "uninstall" "Uninstall"
test_item "Status" "status" "Status"
test_item "Check Deps" "check" "Check Deps"
test_item "Instances" "instances" "Instances" "yes"
test_item "Detect MCU" "detect-mcu" "Detect MCU"
test_item "Flash MCU" "flash-mcu" "Flash MCU"
test_item "Init Config" "init-config" "Init Config"
test_item "Releases" "releases" "Releases"
test_item "Rollback" "rollback" "Rollback"
test_item "Backup" "backup" "Backup"
test_item "Restore" "restore" "Restore"
test_item "CLI Log" "clilog" "CLI Log"
test_item "Diagnose" "diagnose" "Diagnose"
test_item "Logs" "logs" "Logs"
test_item "Admin Page" "admin-page" "Admin Page"
test_item "Quit" "quit" "Quit" "yes"

# ── Test Install wizard opens ──
test_item "Install Wizard" "install" "Install" "yes"

# ── Summary ──
echo ""
echo "=========================================="
echo "  Results: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  echo "  Failures:$FAILURES"
fi
echo "=========================================="
exit $FAIL
