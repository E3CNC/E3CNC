#!/bin/bash
# sync-wiki.sh — Push local wiki drafts (docs/wiki/) to the live GitHub wiki.
#
# The local docs/wiki/ directory is the source of truth for wiki content.
# This script makes the process repeatable: it clones/pulls the wiki repo,
# copies all local drafts over the wiki pages, removes pages that were
# retired, commits, and pushes.
#
# Usage:
#   ./scripts/sync-wiki.sh                  # interactive commit message
#   ./scripts/sync-wiki.sh v0.10.1          # commit message: "docs: sync wiki to v0.10.1"
#   ./scripts/sync-wiki.sh --dry-run        # show what would change, don't push
#
# Prerequisites: git push access to https://github.com/E3CNC/E3CNC.wiki.git
# (SSH or HTTPS — whatever the developer has configured).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIKI_SRC="$REPO_ROOT/docs/wiki"
WIKI_URL="https://github.com/E3CNC/E3CNC.wiki.git"
WIKI_DIR="${E3CNC_WIKI_DIR:-/tmp/e3cnc-wiki}"
DRY_RUN=false
VERSION=""

# Pages that exist on the live wiki but should NOT be kept.
# (Superseded by CHANGELOG.md — point-release notes.)
RETIRED_PAGES=(
    "Release-v0.8.0.md"
)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}✓${NC} $*"; }
log_warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} ${BOLD}Error:${NC} $*" >&2; }
log_step()  { echo -e "${CYAN}▸${NC} $*"; }

usage() {
    echo "Usage: $0 [version] [--dry-run]"
    echo
    echo "  version     Commit message version (e.g. v0.10.1). Default: interactive prompt."
    echo "  --dry-run   Show what would change without committing or pushing."
    exit 0
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --help|-h) usage ;;
        v*) VERSION="$arg" ;;
        *) log_error "Unknown argument: $arg"; usage ;;
    esac
done

if [[ ! -d "$WIKI_SRC" ]]; then
    log_error "Wiki source directory not found: $WIKI_SRC"
    exit 1
fi

if [[ -z "$(ls "$WIKI_SRC"/*.md 2>/dev/null)" ]]; then
    log_error "No markdown files found in $WIKI_SRC"
    exit 1
fi

# ── 1. Clone or pull the wiki repo ─────────────────────────────────
if [[ ! -d "$WIKI_DIR/.git" ]]; then
    log_step "Cloning wiki repo..."
    if ! git clone "$WIKI_URL" "$WIKI_DIR" 2>&1; then
        log_error "Failed to clone wiki repo from $WIKI_URL"
        exit 1
    fi
    log_info "Cloned wiki to $WIKI_DIR"
else
    log_step "Pulling latest wiki..."
    if ! (cd "$WIKI_DIR" && git pull --ff-only origin master 2>&1); then
        log_warn "Pull failed — continuing with existing clone"
    fi
fi

# ── 2. Copy local drafts over wiki pages ───────────────────────────
log_step "Copying local wiki drafts to $WIKI_DIR..."
changed=0
for page in "$WIKI_SRC"/*.md; do
    filename="$(basename "$page")"
    if [[ -f "$WIKI_DIR/$filename" ]]; then
        if ! cmp -s "$page" "$WIKI_DIR/$filename"; then
            cp "$page" "$WIKI_DIR/$filename"
            echo "  📝 Updated $filename"
            changed=1
        fi
    else
        cp "$page" "$WIKI_DIR/$filename"
        echo "  ➕ Added $filename"
        changed=1
    fi
done

# ── 3. Remove retired pages ────────────────────────────────────────
for retired in "${RETIRED_PAGES[@]}"; do
    if [[ -f "$WIKI_DIR/$retired" ]]; then
        rm -f "$WIKI_DIR/$retired"
        echo "  🗑️  Removed $retired"
        changed=1
    fi
done

if [[ "$changed" -eq 0 ]]; then
    log_info "Wiki is already up to date — no changes"
    exit 0
fi

# ── 4. Commit and push ─────────────────────────────────────────────
cd "$WIKI_DIR"
if [[ "$DRY_RUN" == "true" ]]; then
    log_step "Dry run — changes detected, not committing:"
    git status --short
    exit 0
fi

# Derive a version if not provided
if [[ -z "$VERSION" ]]; then
    VERSION="$(grep -m1 '"version"' "$REPO_ROOT/package.json" | sed -E 's/.*"version": *"([^"]+)".*/\1/')"
    VERSION="v${VERSION}"
fi

log_step "Committing (version: $VERSION)..."
git config user.name "E3CNC Docs" >/dev/null 2>&1 || true
git config user.email "docs@e3cnc.local" >/dev/null 2>&1 || true
git add -A

if git diff --cached --quiet; then
    log_info "No staged changes — nothing to commit"
    exit 0
fi

git commit -m "docs: sync wiki to $VERSION"
if [[ $? -ne 0 ]]; then
    log_error "Commit failed"
    exit 1
fi

log_step "Pushing to origin master..."
if ! git push origin master; then
    log_error "Push failed — check your git credentials for $WIKI_URL"
    exit 1
fi

log_info "Wiki synced to $VERSION"
