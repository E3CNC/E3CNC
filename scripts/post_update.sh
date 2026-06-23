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

log()  { echo "[E3CNC] $*"; }
ok()   { echo "[E3CNC] ✓ $*"; }
fail() { echo "[E3CNC] ✗ $*"; exit 1; }

log "Starting E3CNC_UI update…"
log ""

# ------------------------------------------------------------------
# 1. Check dependencies
# ------------------------------------------------------------------
log "Checking dependencies…"

MISSING=""
for cmd in git python3 curl unzip rsync; do
    command -v "$cmd" &>/dev/null || MISSING="$MISSING $cmd"
done
command -v pip3 &>/dev/null || command -v pip &>/dev/null || MISSING="$MISSING pip3"

if [[ -n "$MISSING" ]]; then
    log "Missing: $MISSING"
    log "Install with: sudo apt update && sudo apt install -y python3-pip git curl unzip rsync"
    fail "Missing dependencies — aborting"
fi
ok "All dependencies found"

# ------------------------------------------------------------------
# 2. Bootstrap Ansible (if missing — e.g. manual update-manager install)
# ------------------------------------------------------------------
log "Checking Ansible…"

if ! command -v ansible-playbook &>/dev/null; then
    log "Ansible not found — installing via pip…"
    PIP="$(command -v pip3 || command -v pip)"
    $PIP install ansible --user 2>&1 | tail -1
    export PATH="$HOME/.local/bin:$PATH"
    log "Ansible installed"
fi

if ! python3 -c 'import ansible_collections.community.general' 2>/dev/null; then
    log "Installing community.general Ansible collection…"
    ansible-galaxy collection install community.general 2>&1 | tail -1
fi
ok "Ansible ready"

# ------------------------------------------------------------------
# 3. Backup user configs and frontend
# ------------------------------------------------------------------
log "Creating backup…"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="${HOME}/printer_data/config/e3cnc-backup-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

if [[ -d "${HOME}/mainsail" ]] && [[ -n "$(ls -A "${HOME}/mainsail" 2>/dev/null)" ]]; then
    mkdir -p "$BACKUP_DIR/frontend"
    cp -a "${HOME}/mainsail/." "$BACKUP_DIR/frontend/"
fi

if [[ -d "${HOME}/printer_data/config" ]]; then
    mkdir -p "$BACKUP_DIR/config"
    rsync -a --exclude='e3cnc-backup-*' "${HOME}/printer_data/config/" "$BACKUP_DIR/config/"
fi

if [[ -f "${HOME}/wcs_offsets.json" ]]; then
    cp -a "${HOME}/wcs_offsets.json" "$BACKUP_DIR/"
fi

# Prune old backups (keep 3 most recent)
ls -1d "${HOME}/printer_data/config/e3cnc-backup-"* 2>/dev/null | sort -r | tail -n +4 | while read -r old; do
    rm -rf "$old"
    log "Pruned old backup: $(basename "$old")"
done

ok "Backup saved to $(basename "$BACKUP_DIR")"

# ------------------------------------------------------------------
# 4. Deploy frontend, agent, plugins via Ansible
# ------------------------------------------------------------------
log ""
log "Deploying frontend, agent, and plugins…"
log ""

cd "$REPO_ROOT/ansible"
ansible-playbook \
  -i inventory/local.yml \
  playbooks/redeploy.yml \
  --diff

log ""
log "E3CNC_UI update complete"
log "Refresh your browser to see the changes"
