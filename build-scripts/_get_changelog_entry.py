#!/usr/bin/env python3
"""Extract the changelog entry for a given version from CHANGELOG.md."""
import sys, re

version = sys.argv[1] if len(sys.argv) > 1 else ''
changelog_path = 'CHANGELOG.md'

try:
    with open(changelog_path) as f:
        content = f.read()
except FileNotFoundError:
    print(f"Error: {changelog_path} not found", file=sys.stderr)
    sys.exit(1)

# Find the section for the given version
pattern = rf'^## {re.escape(version)}\b(.*?)(?=^## |\Z)'
match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
if match:
    print(match.group(1).strip())
else:
    print(f"Warning: No entry found for {version} in {changelog_path}", file=sys.stderr)
    sys.exit(1)
