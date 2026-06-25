#!/usr/bin/env bash
# Download pre-built frontend from GitHub nightly release.
#
# This script downloads a pre-built frontend zip from GitHub releases.
# It does NOT build locally — building on-device (especially 32-bit ARM)
# is unreliable and OOMs. If the download fails, the user is told how to
# download manually.
#
# Usage: ./scripts/download_frontend.sh [web_root]
#   web_root: target directory (default: ~/mainsail)

set -euo pipefail

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"

WEB_ROOT="${1:-$HOME/mainsail}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OWNER="E3CNC"
REPO="E3CNC_UI"

echo "=== Downloading pre-built frontend ==="

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# Resolve release version — try git tag first, then package.json
TAG_VER=$(git -C "$REPO_ROOT" tag --points-at HEAD | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)
if [[ -n "$TAG_VER" ]]; then
    RELEASE_VER="$TAG_VER"
elif command -v node &>/dev/null; then
    RELEASE_VER="v$(node -p "require('$REPO_ROOT/package.json').version")"
else
    RELEASE_VER="v$(grep -oP '"version"\s*:\s*"\K[^"]+' "$REPO_ROOT/package.json" || echo '0.0.0')"
fi
ASSET_NAME="E3CNC_UI-${RELEASE_VER}.zip"
ZIP_FILE="$TMP_DIR/$ASSET_NAME"

echo "    target release asset: $ASSET_NAME"

RELEASES_API_URL="https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=10"
if command -v node &>/dev/null; then
    ZIP_URL=$(curl -sfL "$RELEASES_API_URL" | node -e "
let data = '';
process.stdin.on('data', c => data += c);
process.stdin.on('end', () => {
  try {
    const releases = JSON.parse(data);
    for (const release of releases) {
      const asset = (release.assets || []).find(a => a.name === '$ASSET_NAME');
      if (asset) {
        console.log(asset.browser_download_url);
        return;
      }
    }
    console.log('');
  } catch (e) {
    console.log('');
  }
});
")
else
    echo "    WARNING: node not found — skipping release lookup" >&2
    ZIP_URL=""
fi

if [[ -n "$ZIP_URL" ]] && curl -sfL "$ZIP_URL" -o "$ZIP_FILE" && [[ -s "$ZIP_FILE" ]]; then
    echo "    downloaded nightly build ($(du -h "$ZIP_FILE" | cut -f1))"

    mkdir -p "$WEB_ROOT"
    find "$WEB_ROOT" -type f -not -name 'config.json' -delete 2>/dev/null || true
    find "$WEB_ROOT" -mindepth 1 -type d -empty -delete 2>/dev/null || true

    unzip -oq "$ZIP_FILE" -d "$WEB_ROOT"

    if [[ ! -f "$WEB_ROOT/version.json" ]]; then
        echo "{\"buildTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"commit\":\"$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)\"}" > "$WEB_ROOT/version.json"
    fi

    echo "    extracted to $WEB_ROOT"

    # Reload nginx
    if command -v sudo &>/dev/null; then
        sudo systemctl reload nginx 2>/dev/null || true
    elif command -v systemctl &>/dev/null; then
        systemctl reload nginx 2>/dev/null || true
    fi

    echo "=== Frontend updated via nightly release ==="
else
    echo "    ERROR: could not download nightly build from GitHub releases." >&2
    echo "" >&2
    echo "    The frontend is distributed as a pre-built release and must be" >&2
    echo "    downloaded from: https://github.com/${OWNER}/${REPO}/releases" >&2
    echo "" >&2
    echo "    To download and deploy manually:" >&2
    echo "      1. Find the release for ${RELEASE_VER} on GitHub" >&2
    echo "      2. Download ${ASSET_NAME}" >&2
    echo "      3. Run: unzip -o ${ASSET_NAME} -d ${WEB_ROOT}" >&2
    echo "      4. Run: sudo systemctl reload nginx" >&2
    exit 1
fi
