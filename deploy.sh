#!/bin/bash
# Deploy mainsail-cnc fork to the web server directory.
# Usage: ./deploy.sh [--live]
#   --live  Copy build to the live nginx directory (default: dry-run with status)

set -euo pipefail

# Configurable paths — override as needed
export PATH="${HOME}/.bun/bin:${PATH}"
MAINSAIL_CNC_DIR="${MAINSAIL_CNC_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
DEPLOY_DIR="${MAINSAIL_DEPLOY_DIR:-$HOME/mainsail}"

REPO_DIR="$1"
MODE="dry-run"
if [ "$REPO_DIR" = "--live" ]; then
  MODE="live"
fi

echo "=== mainsail-cnc deploy ==="
echo "  Source:  $MAINSAIL_CNC_DIR"
echo "  Target:  $DEPLOY_DIR"
echo "  Mode:    $MODE"
echo ""

if [ "$MODE" = "dry-run" ]; then
  echo "[dry-run] Would run: cd $MAINSAIL_CNC_DIR && bun install --frozen-lockfile && bun run build"
  echo "[dry-run] Would deploy dist/ to $DEPLOY_DIR (preserving config.json)"
  echo "Run: ./deploy.sh --live  to actually deploy."
  exit 0
fi

# Check prerequisites
if ! command -v bun &>/dev/null; then
  echo "ERROR: 'bun' not found in PATH."
  echo "  Install it: curl -fsSL https://bun.sh/install | bash"
  echo "  Or set: export PATH=\"\$HOME/.bun/bin:\$PATH\""
  exit 1
fi

cd "$MAINSAIL_CNC_DIR"
echo ">>> Installing dependencies..."
bun install --frozen-lockfile

echo ">>> Building..."
bun run build

echo ">>> Deploying to $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"

# Remove existing files (preserving config.json if present)
if [ -d "$DEPLOY_DIR" ]; then
  find "$DEPLOY_DIR" -type f -not -name 'config.json' -delete 2>/dev/null || true
  find "$DEPLOY_DIR" -mindepth 1 -type d -empty -delete 2>/dev/null || true
fi

cp -a "$MAINSAIL_CNC_DIR/dist/"* "$DEPLOY_DIR/"
# Copy hidden files too (e.g. .htaccess)
cp "$MAINSAIL_CNC_DIR"/dist/.* "$DEPLOY_DIR/" 2>/dev/null || true

# Reload nginx (use sudo if available)
if command -v sudo &>/dev/null; then
  sudo systemctl reload nginx 2>/dev/null || echo "Warning: could not reload nginx — do it manually."
elif command -v systemctl &>/dev/null; then
  systemctl reload nginx 2>/dev/null || echo "Warning: could not reload nginx — do it manually."
else
  echo "Warning: could not reload nginx — do it manually."
fi

echo ""
echo "deployed mainsail-cnc"
