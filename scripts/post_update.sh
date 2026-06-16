#!/usr/bin/env bash
# Post-update hook for Moonraker's update_manager.
# Runs after `git pull` on the mainsail-cnc monorepo.
#
# Usage:
#   ./scripts/post_update.sh
#
# Add to moonraker.conf:
#   [update_manager mainsail-cnc]
#   post_update_script: ~/mainsail-cnc/scripts/post_update.sh
#
# What it does:
#   1. Rebuilds and redeploys the frontend (bun install + build + deploy + nginx reload)
#   2. Re-vendors the CNC agent components into Moonraker
#   3. Re-deploys the metadata extractor
#   4. Re-deploys the WCS Klipper plugin and macros
#   5. Restarts Moonraker

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.bun/bin:${PATH}"

# Derived paths
COMPONENTS_DIR="$HOME/moonraker/moonraker/components"
KLIPPER_EXTRAS_DIR="$HOME/klipper/klippy/extras"
MACROS_DIR="$HOME/printer_data/config/macros"
SCRIPTS_DIR="$HOME/printer_data/scripts"
WEB_ROOT="$HOME/mainsail"

echo "=== mainsail-cnc post-update ==="
echo "  Repo: $REPO_ROOT"
echo ""

# ---------------------------------------------------------------------------
# 1) Frontend: download pre-built CI artifact or build locally
# ---------------------------------------------------------------------------
echo "==> [1/5] Frontend rebuild and deploy"
"$REPO_ROOT/scripts/download_frontend.sh" "$WEB_ROOT"

# ---------------------------------------------------------------------------
# 2) Re-vendor CNC agent components
# ---------------------------------------------------------------------------
echo "==> [2/5] Re-vendor CNC agent"

AGENT_SRC="$REPO_ROOT/moonraker-cnc-agent/src/moonraker_cnc_agent"

for pkg in cnc_agent cnc_metadata; do
    dst="$COMPONENTS_DIR/$pkg"
    mkdir -p "$dst"
    if [[ -f "$AGENT_SRC/${pkg}.py" ]]; then
        install -m 0644 "$AGENT_SRC/${pkg}.py" "$dst/${pkg}.py"
    fi
    # __init__.py re-exports load_component
    cat > "$dst/__init__.py" <<PY
from .${pkg} import load_component
__all__ = ['load_component']
PY
    echo "    vendored $pkg"
done

# ---------------------------------------------------------------------------
# 3) Re-deploy metadata extractor
# ---------------------------------------------------------------------------
echo "==> [3/5] Re-deploy metadata extractor"
mkdir -p "$SCRIPTS_DIR"
install -m 0755 "$REPO_ROOT/scripts/cnc_metadata_extractor.py" "$SCRIPTS_DIR/cnc_metadata_extractor.py"
echo "    extractor deployed"

# ---------------------------------------------------------------------------
# 4) Re-deploy WCS Klipper plugin and macros
# ---------------------------------------------------------------------------
echo "==> [4/5] Re-deploy WCS plugin and macros"
install -m 0644 "$REPO_ROOT/klipper-extras/work_coordinate_systems.py" "$KLIPPER_EXTRAS_DIR/work_coordinate_systems.py"
mkdir -p "$MACROS_DIR"
install -m 0644 "$REPO_ROOT/klipper-macros/wcs_macros.cfg" "$MACROS_DIR/wcs_macros.cfg"
echo "    WCS plugin and macros deployed"

# ---------------------------------------------------------------------------
# 5) Restart Moonraker
# ---------------------------------------------------------------------------
echo "==> [5/5] Restart Moonraker"
sudo systemctl restart moonraker
echo "    Moonraker restarted"

echo ""
echo "=== post-update complete ==="
