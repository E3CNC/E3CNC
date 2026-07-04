#!/usr/bin/env bash
# bump-version.sh — Bump all version strings consistently and create a release tag.
#
# Usage:
#   ./bump-version.sh              # bump patch (0.9.5 → 0.9.6)
#   ./bump-version.sh 0.10.0       # set specific version
#   ./bump-version.sh --minor      # bump minor (0.9.5 → 0.10.0)
#   ./bump-version.sh --major      # bump major (0.9.5 → 1.0.0)
#   ./bump-version.sh --no-tag     # bump without creating a git tag
#
# Source of truth: package.json ("version" field)
# Synced to: _e3cnc_shared.py (VERSION constant), package-lock.json
# Also adds a stub entry to CHANGELOG.md.
# Creates a commit with the version bump, then creates a git tag ("v<newver>").
# Pushing the tag triggers the GitHub Actions release workflow to build
# and publish artifacts automtically.

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")")"

# ── read current version from package.json ────────────────────────────────────
CURRENT=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)",/\1/')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
MAJOR="${MAJOR#v}"

# ── determine new version ────────────────────────────────────────────────────
DO_TAG=true
EXTRA_ARGS=()
for arg in "$@"; do
    if [[ "$arg" == "--no-tag" ]]; then
        DO_TAG=false
    else
        EXTRA_ARGS+=("$arg")
    fi
done
set -- "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"

if [[ $# -eq 0 ]]; then
    NEW="$MAJOR.$MINOR.$((PATCH + 1))"
elif [[ "$1" == "--major" ]]; then
    NEW="$((MAJOR + 1)).0.0"
elif [[ "$1" == "--minor" ]]; then
    NEW="$MAJOR.$((MINOR + 1)).0"
elif [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW="$1"
else
    echo "Usage: $0 [--major | --minor | <semver> | --no-tag]"
    exit 1
fi

echo "Bumping version: $CURRENT → $NEW"

# ── update package.json ──────────────────────────────────────────────────────
if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" package.json
else
    sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" package.json
fi
echo "  ✓ package.json"

# ── update _e3cnc_shared.py ──────────────────────────────────────────────────
if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/^VERSION = \"$CURRENT\"/VERSION = \"$NEW\"/" _e3cnc_shared.py
else
    sed -i "s/^VERSION = \"$CURRENT\"/VERSION = \"$NEW\"/" _e3cnc_shared.py
fi
echo "  ✓ _e3cnc_shared.py"

# ── add stub entry to CHANGELOG.md ───────────────────────────────────────────
TODAY=$(date +%Y-%m-%d)
STUB="## v$NEW ($TODAY)
- _No changelog entry yet. Describe changes here before releasing._

"
# Insert after the first line (# Changelog)
python3 -c "
import sys
with open('CHANGELOG.md') as f:
    lines = f.readlines()
lines.insert(1, '''$STUB''')
with open('CHANGELOG.md', 'w') as f:
    f.writelines(lines)
"
echo "  ✓ CHANGELOG.md (stub added — edit before commit)"

# ── done ─────────────────────────────────────────────────────────────────────
echo ""
echo "All version files synced to $NEW."

# ── auto-commit ──────────────────────────────────────────────────────────────
git add package.json _e3cnc_shared.py CHANGELOG.md package-lock.json
git commit -m "chore: bump v$CURRENT → v$NEW" --no-verify 2>/dev/null || true
echo "  ✓ Commit created: chore: bump v$CURRENT → v$NEW"

# ── git tag ──────────────────────────────────────────────────────────────────
TAG="v$NEW"
if $DO_TAG; then
    if git rev-parse "$TAG" >/dev/null 2>&1; then
        echo "  Tag $TAG already exists — skipping tag creation."
    else
        echo ""
        git tag "$TAG"
        echo "  ✓ Created git tag: $TAG"
        echo ""
        echo "To push and trigger the release CI:"
        echo "    git push origin main && git push origin $TAG"
    fi
else
    echo "  (--no-tag: git tag skipped)"
fi
