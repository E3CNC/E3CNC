#!/usr/bin/env bash
# build-tui.sh — Build the e3cnc-tui binary for one or more architectures.
#
# Usage:
#   ./build-tui.sh                 # build for arm64 (default)
#   ./build-tui.sh arm64           # build for arm64 only
#   ./build-tui.sh amd64           # build for amd64 only
#   ./build-tui.sh all             # build for all supported architectures
#
# The default (no args) builds arm64 only, matching the old behaviour.
# "all" builds both arm64 + amd64.
#
# Output binaries land in the repo root as e3cnc-tui-<arch>.
set -euo pipefail

cd "$(dirname "$0")/.."

# ── supported architectures ─────────────────────────────────────────
SUPPORTED_ARCHS=("arm64" "amd64")

# ── resolve target archs ────────────────────────────────────────────
ARCHS=()
if [[ $# -eq 0 ]]; then
  ARCHS=("arm64")
else
  case "$1" in
    all)
      ARCHS=("${SUPPORTED_ARCHS[@]}")
      ;;
    arm64|amd64)
      ARCHS=("$1")
      ;;
    *)
      echo "Unknown architecture: $1"
      echo "Supported: ${SUPPORTED_ARCHS[*]}, or 'all'"
      exit 1
      ;;
  esac
fi

cd cli/go

for arch in "${ARCHS[@]}"; do
  VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo '0.0.0-dev')
  output="../../bin/e3cnc-tui-${arch}"
  echo "Building e3cnc-tui for linux/${arch} (${VERSION})..."
  CGO_ENABLED=0 GOOS=linux GOARCH="${arch}" go build \
    -ldflags="-s -w -X main.version=${VERSION}" \
    -trimpath \
    -o "${output}" \
    ./cmd/e3cnc-tui/
  echo "  Built: $(ls -lh "${output}" | awk '{print $5}')"
done

cd ../..
echo ""
echo "Done. To commit:"
echo "  git add bin/e3cnc-tui-* && git commit -m 'chore: update e3cnc-tui binaries'"
