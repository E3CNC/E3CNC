#!/usr/bin/env bash
# Restore E3CNC_UI from a previous backup.
#
# Lists all e3cnc-backup-* directories in ~/printer_data/config/
# and lets you restore frontend, config, or both.
#
# Usage:
#   ./scripts/restore_backup.sh                    # interactive picker
#   ./scripts/restore_backup.sh --list              # just list backups
#   ./scripts/restore_backup.sh <backup-dir>        # restore from a specific backup

set -euo pipefail

BACKUP_DIR="${HOME}/printer_data/config"
WEB_ROOT="${HOME}/mainsail"

log()  { echo "[E3CNC] $*"; }
ok()   { echo "[E3CNC] ✓ $*"; }
fail() { echo "[E3CNC] ✗ $*"; exit 1; }

# --- Collect available backups ---
mapfile -t BACKUPS < <(ls -1d "${BACKUP_DIR}/e3cnc-backup-"* 2>/dev/null | sort -r || true)

if [[ ${#BACKUPS[@]} -eq 0 ]]; then
    fail "No backups found in $BACKUP_DIR/e3cnc-backup-*"
fi

# --- --list mode ---
if [[ "${1:-}" == "--list" ]]; then
    echo "Available backups:"
    for b in "${BACKUPS[@]}"; do
        size=$(du -sh "$b" 2>/dev/null | cut -f1)
        echo "  $(basename "$b")  ($size)"
    done
    exit 0
fi

# --- Determine which backup to restore ---
SELECTED=""
if [[ -n "${1:-}" ]]; then
    # User provided a path — use it directly
    if [[ -d "$1" ]]; then
        SELECTED="$1"
    elif [[ -d "${BACKUP_DIR}/$1" ]]; then
        SELECTED="${BACKUP_DIR}/$1"
    else
        fail "Backup not found: $1"
    fi
else
    # Interactive picker
    echo "Available backups:"
    for i in "${!BACKUPS[@]}"; do
        name=$(basename "${BACKUPS[$i]}")
        size=$(du -sh "${BACKUPS[$i]}" 2>/dev/null | cut -f1)
        echo "  [$((i+1))] $name  ($size)"
    done
    echo ""
    read -r -p "Which backup to restore? [1-${#BACKUPS[@]}]: " choice
    if [[ ! "$choice" =~ ^[0-9]+$ ]] || [[ "$choice" -lt 1 ]] || [[ "$choice" -gt "${#BACKUPS[@]}" ]]; then
        fail "Invalid choice"
    fi
    SELECTED="${BACKUPS[$((choice-1))]}"
fi

log "Restoring from: $(basename "$SELECTED")"
echo ""

# --- Check what's available in the backup ---
HAS_FRONTEND=false
HAS_CONFIG=false
HAS_WCS=false

[[ -d "$SELECTED/frontend" ]] && HAS_FRONTEND=true
[[ -d "$SELECTED/config" ]] && HAS_CONFIG=true
[[ -f "$SELECTED/wcs_offsets.json" ]] && HAS_WCS=true

# --- Restore frontend ---
if $HAS_FRONTEND; then
    log "Restoring frontend to $WEB_ROOT …"
    mkdir -p "$WEB_ROOT"
    # Preserve existing config.json in the target
    cp -a "$SELECTED/frontend/." "$WEB_ROOT/"
    ok "Frontend restored"
else
    log "No frontend backup found — skipping"
fi

# --- Restore printer config ---
if $HAS_CONFIG; then
    log "Restoring printer config to ${HOME}/printer_data/config/ …"
    # Don't overwrite current e3cnc-backup-* directories
    rsync -a --exclude='e3cnc-backup-*' "$SELECTED/config/" "${HOME}/printer_data/config/"
    ok "Printer config restored"
else
    log "No config backup found — skipping"
fi

# --- Restore WCS offsets ---
if $HAS_WCS; then
    log "Restoring WCS offsets …"
    cp -a "$SELECTED/wcs_offsets.json" "${HOME}/wcs_offsets.json"
    ok "WCS offsets restored"
fi

# --- Reload nginx ---
if command -v sudo &>/dev/null; then
    sudo systemctl reload nginx 2>/dev/null || true
elif command -v systemctl &>/dev/null; then
    systemctl reload nginx 2>/dev/null || true
fi

echo ""
ok "Restore complete from $(basename "$SELECTED")"
log "Hard-refresh your browser (Ctrl+Shift+R / Cmd+Shift+R) to see the restored frontend"
