#!/usr/bin/env bash
# Compatibility wrapper for legacy Moonraker update_manager installs.
#
# Delegates to the e3cnc-cli single-deploy flow.
# New E3CNC installs no longer register an [update_manager E3CNC] block,
# but older installs may still call this script until migrated.
#
# Usage:
#   ./build-scripts/post_update.sh

set -euo pipefail

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Guard: the repo must be cloned before this script can do anything useful.
if [[ ! -d "$REPO_ROOT/.git" ]]; then
    echo "[E3CNC] ERROR: This script must be run from inside a cloned E3CNC repository." >&2
    echo "[E3CNC]" >&2
    echo "[E3CNC]   Clone the repo first:" >&2
    echo "[E3CNC]     cd ~ && git clone https://github.com/E3CNC/E3CNC.git" >&2
    echo "[E3CNC]     cd E3CNC && ./build-scripts/post_update.sh" >&2
    echo "[E3CNC]" >&2
    exit 1
fi

echo "[E3CNC] Starting E3CNC update via e3cnc-cli…"
echo ""

# Delegate to e3cnc-cli update
cd "$REPO_ROOT"
./e3cnc-cli update --yes

echo ""
echo "[E3CNC] Update complete — refresh your browser to see the changes"
