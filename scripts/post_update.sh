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
# 0. Bootstrap Ansible (in case the user added the update manager
#    block manually without running the Ansible install playbook first)
# ------------------------------------------------------------------
if ! command -v ansible-playbook &>/dev/null; then
    echo "  Ansible not found — installing…"
    if ! command -v pip3 &>/dev/null && ! command -v pip &>/dev/null; then
        echo "  ERROR: pip not found. Install python3-pip first:"
        echo "    sudo apt install python3-pip"
        exit 1
    fi
    PIP="$(command -v pip3 || command -v pip)"
    $PIP install ansible --user 2>&1 | tail -1
    export PATH="$HOME/.local/bin:$PATH"
fi

if ! python3 -c 'import ansible_collections.community.general' 2>/dev/null; then
    echo "  Installing community.general collection…"
    ansible-galaxy collection install community.general 2>&1 | tail -1
fi

# ------------------------------------------------------------------
# 1. Backup user configs and frontend
# ------------------------------------------------------------------
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${HOME}/printer_data/config/e3cnc-backup-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

# 1a. Frontend files
echo "  Backing up frontend…"
if [[ -d "${HOME}/mainsail" ]] && [[ -n "$(ls -A "${HOME}/mainsail" 2>/dev/null)" ]]; then
    mkdir -p "$BACKUP_DIR/frontend"
    cp -a "${HOME}/mainsail/." "$BACKUP_DIR/frontend/"
fi

# 1b. Printer config directory
echo "  Backing up printer config…"
if [[ -d "${HOME}/printer_data/config" ]]; then
    mkdir -p "$BACKUP_DIR/config"

    # Copy all config files except old backups
    rsync -a --exclude='e3cnc-backup-*' "${HOME}/printer_data/config/" "$BACKUP_DIR/config/"
fi

# 1c. WCS offsets (if present)
if [[ -f "${HOME}/wcs_offsets.json" ]]; then
    echo "  Backing up WCS offsets…"
    cp -a "${HOME}/wcs_offsets.json" "$BACKUP_DIR/"
fi

echo "  Backup saved to $BACKUP_DIR"

# Remove old backups, keep the 3 most recent
ls -1d "${HOME}/printer_data/config/e3cnc-backup-"* 2>/dev/null | sort -r | tail -n +4 | while read -r old; do
    rm -rf "$old"
    echo "  Pruned old backup: $old"
done

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
