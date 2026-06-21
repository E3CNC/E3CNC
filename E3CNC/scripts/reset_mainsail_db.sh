#!/usr/bin/env bash
# Reset the Mainsail namespace in the Moonraker database to factory defaults.
# Useful for testing the first-time setup flow.
#
# Usage:
#   ./scripts/reset_mainsail_db.sh
#
# Requires:
#   - curl on the CNC host
#   - Moonraker API accessible at http://127.0.0.1:7125

set -euo pipefail

MOONRAKER_API="${MOONRAKER_API:-http://127.0.0.1:7125}"
NAMESPACE="mainsail"

echo "=== Reset Mainsail database to factory defaults ==="
echo "  Moonraker API: $MOONRAKER_API"
echo "  Namespace:     $NAMESPACE"
echo ""

# 1. Fetch all keys in the namespace
echo "[1/3] Fetching current database keys..."
DB_DUMP=$(curl -sf "$MOONRAKER_API/server/database/item?namespace=$NAMESPACE")
if [ -z "$DB_DUMP" ]; then
    # Try via JSON-RPC
    DB_DUMP=$(curl -sf -X POST "$MOONRAKER_API/server/database/item" \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"server.database.get_item\",\"params\":{\"namespace\":\"$NAMESPACE\"},\"id\":1}")
fi

TOP_KEYS=$(echo "$DB_DUMP" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    val = data.get('result', data)
    if isinstance(val, dict) and 'value' in val:
        val = val['value']
    print('\n'.join(val.keys()))
except Exception:
    sys.exit(1)
" 2>/dev/null) || {
    echo "  WARNING: Could not parse database, trying inline"
    TOP_KEYS=""
}

if [ -n "$TOP_KEYS" ]; then
    echo "  Found keys: $(echo "$TOP_KEYS" | wc -l)"
else
    echo "  No keys found or namespace already empty"
fi

# 2. Delete each top-level key
echo "[2/3] Deleting keys..."
DELETED=0
for key in $TOP_KEYS; do
    RESPONSE=$(curl -sf -X DELETE "$MOONRAKER_API/server/database/item?namespace=$NAMESPACE&key=$key" 2>/dev/null) && {
        DELETED=$((DELETED + 1))
        echo "    deleted: $key"
    } || {
        echo "    skipped: $key (not found or error)"
    }
done
echo "  Deleted $DELETED keys"

# 3. Set the default theme to E3CNC
echo "[3/3] Setting default theme to E3CNC..."
curl -sf -X POST "$MOONRAKER_API/server/database/item?namespace=$NAMESPACE&key=uiSettings.theme" \
    -H "Content-Type: application/json" \
    -d '{"value": "e3cnc"}' > /dev/null && echo "    theme -> e3cnc" || echo "    WARNING: could not set theme"

curl -sf -X POST "$MOONRAKER_API/server/database/item?namespace=$NAMESPACE&key=uiSettings.logo" \
    -H "Content-Type: application/json" \
    -d '{"value": "#00FF00"}' > /dev/null && echo "    logo -> #00FF00" || echo "    WARNING: could not set logo"

curl -sf -X POST "$MOONRAKER_API/server/database/item?namespace=$NAMESPACE&key=uiSettings.primary" \
    -H "Content-Type: application/json" \
    -d '{"value": "#00FF00"}' > /dev/null && echo "    primary -> #00FF00" || echo "    WARNING: could not set primary"

echo ""
echo "=== Database reset complete ==="
echo "Refresh the Mainsail web UI to see the initial setup flow."
