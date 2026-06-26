#!/usr/bin/env bash
# Run unit tests in batches to avoid worker memory limits on large suites.
# Usage: scripts/run-tests-batched.sh [batch_size]

set -euo pipefail

BATCH_SIZE="${1:-20}"
TEST_DIR="tests"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Collect all test files and split into batches
find "$TEST_DIR" -name "*.spec.ts" | sort > "$TMP_DIR/all-tests.txt"
TOTAL=$(wc -l < "$TMP_DIR/all-tests.txt" | tr -d ' ')

if [ "$TOTAL" -eq 0 ]; then
    echo "No test files found in $TEST_DIR"
    exit 1
fi

split -l "$BATCH_SIZE" "$TMP_DIR/all-tests.txt" "$TMP_DIR/batch-"
BATCHES=("$TMP_DIR"/batch-*)
BATCH_COUNT=${#BATCHES[@]}

echo "Running $TOTAL tests in $BATCH_COUNT batches of up to $BATCH_SIZE files..."

FAILED=0
for batch in "${BATCHES[@]}"; do
    echo ""
    echo "=== Running batch: $(basename "$batch") ==="
    # Read files into array
    FILES=()
    while IFS= read -r line || [ -n "$line" ]; do
        FILES+=("$line")
    done < "$batch"
    NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=6144}"
    export NODE_OPTIONS
    if ! bun run test:unit "${FILES[@]}"; then
        FAILED=1
        echo "!!! Batch $(basename "$batch") failed"
    fi
done

echo ""
if [ "$FAILED" -eq 0 ]; then
    echo "All batches passed."
    exit 0
else
    echo "One or more batches failed."
    exit 1
fi
