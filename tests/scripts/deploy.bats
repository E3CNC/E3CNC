setup() {
    load '/tmp/bats-support/load'
    load '/tmp/bats-assert/load'

    # Run everything from a temp directory to avoid touching real files
    TEST_TEMP=$(mktemp -d)
    export HOME="$TEST_TEMP/home"
    mkdir -p "$HOME"

    # Stub the deploy script's source dir with a minimal replica
    SOURCE_DIR="$TEST_TEMP/source"
    mkdir -p "$SOURCE_DIR/dist"
    echo "build artifact" > "$SOURCE_DIR/dist/index.html"
    touch "$SOURCE_DIR/dist/.htaccess"

    # Path to the real deploy script
    DEPLOY_SCRIPT="$(cd "$(dirname "$BATS_TEST_DIRNAME")/.." && pwd)/deploy.sh"

    # Stub bun — just touch a build marker instead of actually building
    cat > "$TEST_TEMP/bun" <<'SCRIPT'
#!/bin/bash
if [[ "$1" = "install" ]]; then
    mkdir -p node_modules
    touch node_modules/.install-stamp
    exit 0
fi
if [[ "$1" = "run" && "$2" = "build" ]]; then
    # Need a real package.json for bun install to succeed
    echo '{"name":"test"}' > package.json 2>/dev/null || true
    echo "build complete" > dist/index.html
    echo ".htaccess content" > dist/.htaccess
    exit 0
fi
echo "unexpected bun call: $*" >&2
exit 1
SCRIPT
    chmod +x "$TEST_TEMP/bun"

    # Stub systemctl to verify it gets called
    cat > "$TEST_TEMP/systemctl" <<'SCRIPT'
#!/bin/bash
echo "systemctl:$*" >> "$TEST_TEMP/systemctl-calls"
SCRIPT
    chmod +x "$TEST_TEMP/systemctl"

    # Stub sudo
    cat > "$TEST_TEMP/sudo" <<'SCRIPT'
#!/bin/bash
exec "$@"
SCRIPT
    chmod +x "$TEST_TEMP/sudo"
}

teardown() {
    rm -rf "$TEST_TEMP"
}

@test "dry-run mode prints what it would do and exits 0" {
    run "$DEPLOY_SCRIPT"
    assert_success
    assert_output --partial "dry-run"
    assert_output --partial "Would run:"
    assert_output --partial "deploy.sh --live"
}

@test "dry-run mode does NOT build or deploy" {
    run "$DEPLOY_SCRIPT"
    assert_success
    assert [ ! -f "$HOME/mainsail/index.html" ]
}

@test "--live build and deploy" {
    PATH="$TEST_TEMP:$PATH" \
    E3CNC_DIR="$SOURCE_DIR" \
    MAINSAIL_DEPLOY_DIR="$HOME/mainsail" \
    run "$DEPLOY_SCRIPT" --live

    assert_success
    # Should have created the target dir and copied files
    assert [ -f "$HOME/mainsail/index.html" ]
    # Should have written version.json
    assert [ -f "$HOME/mainsail/version.json" ]
}

@test "--live copies hidden files (e.g. .htaccess)" {
    PATH="$TEST_TEMP:$PATH" \
    E3CNC_DIR="$SOURCE_DIR" \
    MAINSAIL_DEPLOY_DIR="$HOME/mainsail" \
    run "$DEPLOY_SCRIPT" --live

    assert_success
    assert [ -f "$HOME/mainsail/.htaccess" ]
}

@test "--live preserves config.json" {
    mkdir -p "$HOME/mainsail"
    echo "my-config" > "$HOME/mainsail/config.json"

    PATH="$TEST_TEMP:$PATH" \
    E3CNC_DIR="$SOURCE_DIR" \
    MAINSAIL_DEPLOY_DIR="$HOME/mainsail" \
    run "$DEPLOY_SCRIPT" --live

    assert_success
    assert [ -f "$HOME/mainsail/config.json" ]
    run cat "$HOME/mainsail/config.json"
    assert_output "my-config"
}

@test "--live fails with helpful message when bun is missing" {
    PATH="" \
    E3CNC_DIR="$SOURCE_DIR" \
    MAINSAIL_DEPLOY_DIR="$HOME/mainsail" \
    run "$DEPLOY_SCRIPT" --live

    assert_failure
    assert_output --partial "not found in PATH"
}

@test "creates target directory if it doesn't exist" {
    PATH="$TEST_TEMP:$PATH" \
    E3CNC_DIR="$SOURCE_DIR" \
    MAINSAIL_DEPLOY_DIR="$HOME/mainsail-new" \
    run "$DEPLOY_SCRIPT" --live

    assert_success
    assert [ -d "$HOME/mainsail-new" ]
    assert [ -f "$HOME/mainsail-new/index.html" ]
}
