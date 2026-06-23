#!/usr/bin/env bash
# Post-update hook for Moonraker's update_manager.
# Runs after `git pull` on the E3CNC_UI monorepo.
#
# Delegates to the Ansible redeploy playbook, which handles:
#   - Frontend rebuild + deploy
#   - CNC agent re-vendor
#   - Metadata extractor re-deploy
#   - WCS Klipper plugin + macros re-deploy
#   - Moonraker restart
#
# Usage:
#   ./scripts/post_update.sh
#
# Add to moonraker.conf:
#   [update_manager E3CNC_UI]
#   post_update_script: ~/E3CNC_UI/scripts/post_update.sh

set -euo pipefail

# Ensure local install paths are on PATH (bun, ansible, etc.)
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ------------------------------------------------------------------
# 1. Backup existing frontend
# ------------------------------------------------------------------
WEB_ROOT="${HOME}/mainsail"
BACKUP_DIR="${HOME}/printer_data/config/mainsail-backup"

if [[ -d "$WEB_ROOT" ]] && [[ -n "$(ls -A "$WEB_ROOT" 2>/dev/null)" ]]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_PATH="${BACKUP_DIR}-${TIMESTAMP}"
    mkdir -p "$BACKUP_PATH"
    cp -a "$WEB_ROOT/." "$BACKUP_PATH/"
    echo "  Backed up $WEB_ROOT → $BACKUP_PATH"

    # Remove old backups, keep the 3 most recent
    ls -1d "${BACKUP_DIR}-"* 2>/dev/null | sort -r | tail -n +4 | while read -r old; do
        rm -rf "$old"
        echo "  Pruned old backup: $old"
    done
else
    echo "  No existing frontend found — skipping backup"
fi

echo ""
echo "=== E3CNC_UI post-update ==="
echo "  Repo: $REPO_ROOT"
echo "  Delegating to Ansible redeploy playbook..."
echo ""

cd "$REPO_ROOT/ansible"
ansible-playbook \
  -i inventory/local.yml \
  playbooks/redeploy.yml \
  --diff

echo ""
echo "=== post-update complete ==="
