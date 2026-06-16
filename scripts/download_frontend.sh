#!/usr/bin/env bash
# Download pre-built frontend from GitHub nightly release.
# Falls back to local build if the download fails or bun is available.
#
# Usage: ./scripts/download_frontend.sh [web_root]
#   web_root: target directory (default: ~/mainsail)

set -euo pipefail

WEB_ROOT="${1:-$HOME/mainsail}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OWNER="isaaceliape"
REPO="mainsail-cnc"

echo "=== Downloading pre-built frontend ==="

# Try to download from nightly release first
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

ZIP_URL="https://github.com/${OWNER}/${REPO}/releases/download/nightly/mainsail-cnc.zip"
ZIP_FILE="$TMP_DIR/mainsail-cnc.zip"

if curl -sfL "$ZIP_URL" -o "$ZIP_FILE" && [[ -s "$ZIP_FILE" ]]; then
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
    echo "    WARNING: could not download nightly build" >&2
    echo "    Falling back to local build (requires bun)..." >&2

    export PATH="${HOME}/.bun/bin:${PATH}"
    if command -v bun &>/dev/null; then
        cd "$REPO_ROOT"
        bun install --frozen-lockfile
        bun run build

        mkdir -p "$WEB_ROOT"
        find "$WEB_ROOT" -type f -not -name 'config.json' -delete 2>/dev/null || true
        find "$WEB_ROOT" -mindepth 1 -type d -empty -delete 2>/dev/null || true
        cp -a "$REPO_ROOT/dist/"* "$WEB_ROOT/"
        cp "$REPO_ROOT"/dist/.* "$WEB_ROOT/" 2>/dev/null || true
        echo "{\"buildTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"commit\":\"$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)\"}" > "$WEB_ROOT/version.json"

        echo "    local build deployed to $WEB_ROOT"

        if command -v sudo &>/dev/null; then
            sudo systemctl reload nginx 2>/dev/null || true
        elif command -v systemctl &>/dev/null; then
            systemctl reload nginx 2>/dev/null || true
        fi

        echo "=== Frontend built locally ==="
    else
        echo "    ERROR: bun not found and download failed" >&2
        echo "    Install bun: curl -fsSL https://bun.sh/install | bash" >&2
        exit 1
    fi
fi
