#!/bin/bash
# E3CNC multi-distro package manager integration test.
# Builds a static linux/amd64 test binary and runs it inside Docker
# containers for each supported distro, verifying real DetectPackageManager,
# Resolve(), and Install() behavior on actual package managers.
#
# Usage:
#   bash tests/installer/test-pkgmgr-docker.sh          # run all distros
#   bash tests/installer/test-pkgmgr-docker.sh ubuntu   # run one distro
#
# Distros covered: deb (Ubuntu), fedora (Fedora), rhel8+ (Rocky),
#                  arch (Arch Linux), alpine (Alpine), opensuse (openSUSE)
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GO_DIR="$REPO_ROOT/cli/go"
TEST_BIN="/tmp/pkgmgr-bootstrap.test"
FILTER="${1:-all}"

echo "═══ Building multi-distro package manager test binary ═══"
cd "$GO_DIR" || exit 1
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go test -c -o "$TEST_BIN" ./internal/bootstrap/ || {
    echo "✗ Failed to build test binary"; exit 1
}
echo "✓ Test binary: $TEST_BIN"

run_distro() {
    local name="$1" image="$2" platform="${3:-linux/amd64}" expect_pm="$4" resolve="$5"
    local setup="${6:-}" shell="${7:-bash}" test_run="${8:-TestIntegration}"

    if [[ "$FILTER" != "all" && "$FILTER" != "$name" ]]; then
        return 0
    fi

    echo
    echo "═══ Testing $name ($image) ═══"
    local cmd=""
    [[ -n "$setup" ]] && cmd+="$setup; "
    cmd+="E3CNC_INTEGRATION_TEST=1 E3CNC_EXPECT_PM=$expect_pm E3CNC_EXPECT_RESOLVE=\"$resolve\" $TEST_BIN $test_run -test.v 2>&1"

    docker run --rm --platform "$platform" -v "$TEST_BIN:$TEST_BIN" "$image" "$shell" -c "$cmd" 2>&1 | grep -v "WARNING:"
    local rc=${PIPESTATUS[0]}
    if [[ $rc -eq 0 ]]; then
        echo "✓ $name PASSED"
    else
        echo "✗ $name FAILED (exit $rc)"
    fi
    return $rc
}

FAILED=0

# Ubuntu / Debian (apt)
run_distro "ubuntu" "installer-ubuntu" "linux/amd64" "deb" \
    "python3-venv=python3-venv;libssl-dev=libssl-dev;build-essential=build-essential" || FAILED=1

# Fedora (dnf)
run_distro "fedora" "installer-fedora" "linux/amd64" "fedora" \
    "python3-venv=python3-virtualenv;libssl-dev=openssl-devel;build-essential=gcc-c++" || FAILED=1

# Rocky Linux (dnf + --allowerasing)
run_distro "rocky" "installer-rocky" "linux/amd64" "fedora" \
    "python3-venv=python3-virtualenv;libssl-dev=openssl-devel;build-essential=gcc-c++;curl=curl" || FAILED=1

# Arch Linux (pacman) — detection/resolution only.
# NOTE: pacman cannot run under QEMU emulation (seccomp sandbox error with
# the alpm user), so the install probe is skipped on emulated amd64. On real
# Arch hardware the full suite runs. Detection + resolution still verified.
run_distro "arch" "archlinux:latest" "linux/amd64" "arch" \
    "python3-venv=python-virtualenv;libssl-dev=openssl;build-essential=base-devel;python3-dev=" \
    "pacman -Sy --noconfirm sudo >/dev/null 2>&1 || true" "bash" \
    "-test.run 'TestIntegrationDetect|TestIntegrationResolve'" || FAILED=1

# Alpine (apk) — musl
run_distro "alpine" "alpine:latest" "linux/amd64" "alpine" \
    "python3-venv=py3-virtualenv;libssl-dev=openssl-dev;build-essential=build-base" \
    "apk add --no-cache sudo bash >/dev/null 2>&1" "sh" || FAILED=1

# openSUSE (zypper)
run_distro "opensuse" "opensuse/leap:latest" "linux/amd64" "opensuse" \
    "python3-venv=python3-virtualenv;libssl-dev=openssl-devel;build-essential=gcc-c++" \
    "zypper -n install sudo >/dev/null 2>&1" || FAILED=1

echo
if [[ $FAILED -eq 0 ]]; then
    echo "═══ ALL DISTROS PASSED ═══"
else
    echo "═══ SOME DISTROS FAILED (see above) ═══"
fi
rm -f "$TEST_BIN"
exit $FAILED
