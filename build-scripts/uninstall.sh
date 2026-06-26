#!/usr/bin/env bash
# Uninstall E3CNC: remove agents, config sections, plugins, and macros.
#
# Usage:
#   ./scripts/uninstall.sh                         # uninstall locally
#   CNC_HOST=myprinter ./scripts/uninstall.sh       # uninstall remote via SSH
#
# This reverses every step in install_to_moonraker.sh. It does NOT:
#   - delete the ~/E3CNC repo checkout
#   - delete your printer.cfg or g-code files
#   - restore stock Mainsail (reinstall via KIAUH or your backup after running this)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CNC_HOST="${CNC_HOST:-localhost}"

# Same run_on_target logic as install_to_moonraker.sh
run_on_target() {
    if [[ "$CNC_HOST" = "localhost" ]]; then
        eval "$@"
    else
        ssh "$CNC_HOST" "set -e; $@"
    fi
}

if [[ "$CNC_HOST" = "localhost" ]]; then
    REMOTE_HOME=$HOME
else
    REMOTE_HOME=$(ssh -o BatchMode=yes "$CNC_HOST" 'echo $HOME')
fi

REMOTE_COMPONENTS_DIR="$REMOTE_HOME/moonraker/moonraker/components"
REMOTE_CONF="$REMOTE_HOME/printer_data/config/moonraker.conf"
REMOTE_EXTRACTOR_PATH="$REMOTE_HOME/printer_data/scripts/cnc_metadata_extractor.py"
REMOTE_KLIPPER_EXTRAS="$REMOTE_HOME/klipper/klippy/extras"
REMOTE_MACROS_DIR="$REMOTE_HOME/printer_data/config/macros"
REMOTE_E3CNC_DIR="$REMOTE_HOME/printer_data/config/E3CNC"
REMOTE_DEPLOY_DIR="$REMOTE_HOME/mainsail"

echo "=== E3CNC uninstall ==="
echo "  Target: $CNC_HOST"
echo ""

# ---------------------------------------------------------------------------
# 1) Remove vendored components from Moonraker
# ---------------------------------------------------------------------------
echo "==> [1/6] remove vendored cnc_agent from moonraker/components/"
run_on_target "
    rm -rf '$REMOTE_COMPONENTS_DIR/cnc_agent'
    echo '    removed cnc_agent'
"

echo "==> [2/6] remove vendored cnc_metadata from moonraker/components/"
run_on_target "
    rm -rf '$REMOTE_COMPONENTS_DIR/cnc_metadata'
    echo '    removed cnc_metadata'
"

# ---------------------------------------------------------------------------
# 2) Remove the extractor script
# ---------------------------------------------------------------------------
echo "==> [3/6] remove cnc_metadata_extractor.py"
run_on_target "
    rm -f '$REMOTE_EXTRACTOR_PATH'
    echo '    removed extractor'
"

# ---------------------------------------------------------------------------
# 3) Remove [cnc_agent], [cnc_metadata], and [update_manager E3CNC]
#    from moonraker.conf
# ---------------------------------------------------------------------------
echo "==> [4/6] remove [cnc_agent], [cnc_metadata], [update_manager E3CNC] from moonraker.conf"
# Read the remote conf, filter it locally, write it back.
# This avoids quoting nightmares with inline Python over SSH/eval.
REMOTE_CONF_CONTENT=$(run_on_target "cat '$REMOTE_CONF'" 2>/dev/null || echo "")
if [[ -n "$REMOTE_CONF_CONTENT" ]]; then
    # Back up on the target
    run_on_target "cp '$REMOTE_CONF' '${REMOTE_CONF}.uninstallbak'" 2>/dev/null || true

    # Filter out the three CNC sections using awk
    FILTERED=$(echo "$REMOTE_CONF_CONTENT" | awk '
        /^\[/ { in_section = 0 }
        /^\[cnc_agent\]/ { in_section = 1; next }
        /^\[cnc_metadata\]/ { in_section = 1; next }
        /^\[update_manager E3CNC\]/ { in_section = 1; next }
        !in_section
    ')

    # Write the filtered config back
    echo "$FILTERED" | run_on_target "cat > '$REMOTE_CONF'"
    echo "    removed CNC sections from moonraker.conf"
else
    echo "    moonraker.conf not found — skipping"
fi

# ---------------------------------------------------------------------------
# 4) Remove Klipper extra plugin and macros
# ---------------------------------------------------------------------------
echo "==> [5/6] remove Klipper WCS plugin and macros"
run_on_target "
    rm -f '$REMOTE_KLIPPER_EXTRAS/work_coordinate_systems.py'
    rm -f '$REMOTE_MACROS_DIR/wcs_macros.cfg'
    echo '    removed WCS plugin and macros'

    # Remove empty macros directory if left behind
    rmdir '$REMOTE_MACROS_DIR' 2>/dev/null || true
"

# ---------------------------------------------------------------------------
# 5) Restart Moonraker
# ---------------------------------------------------------------------------
echo "==> [6/6] restart Moonraker"
run_on_target "sudo systemctl restart moonraker" || {
    echo "    WARNING — could not restart moonraker (do it manually)" >&2
}

echo ""
echo "=== Uninstall complete ==="
echo ""
echo "Next steps:"
echo "  1. Restore the stock Mainsail frontend:"
echo "       cd ~ && git clone https://github.com/mainsail-crew/mainsail.git ~/mainsail-tmp"
echo "       cp -a ~/mainsail-tmp/* ~/mainsail/"
echo "       rm -rf ~/mainsail-tmp"
echo "     Or reinstall via KIAUH."
echo "  2. Restore your backed-up config files (printer.cfg is untouched)."
echo "  3. Restart nginx: sudo systemctl restart nginx"
