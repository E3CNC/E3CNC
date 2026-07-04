#!/usr/bin/env bash
# build-tui.sh — Build the e3cnc-tui binary for linux/arm64 and commit it to the repo.
#
# The binary is checked into the repo so `git pull` = latest TUI on any machine.
# Run this after making changes to cli/go/.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Building e3cnc-tui for linux/arm64..."
cd cli/go
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build \
  -ldflags="-s -w -X main.version=$(git describe --tags --abbrev=0 2>/dev/null || echo '0.0.0-dev')" \
  -trimpath \
  -o ../../e3cnc-tui \
  ./cmd/e3cnc-tui/

cd ../..
echo "Built: $(ls -lh e3cnc-tui | awk '{print $5}')"
echo ""
echo "To commit:"
echo "  git add e3cnc-tui e3cnc-cli && git commit -m 'chore: update e3cnc-tui binary'"
