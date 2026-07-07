#!/usr/bin/env python3
"""Generate a grouped changelog from git log between two refs."""
import subprocess, collections, sys

prev = sys.argv[1] if len(sys.argv) > 1 else ''
if prev:
    raw = subprocess.run(['git', 'log', '--format=%s', f'{prev}..HEAD'],
        capture_output=True, text=True).stdout.strip()
else:
    raw = subprocess.run(['git', 'log', '--format=%s', '-20', 'HEAD'],
        capture_output=True, text=True).stdout.strip()

groups = collections.OrderedDict([
    ('feat', 'Features'), ('fix', 'Bug Fixes'), ('docs', 'Documentation'),
    ('refactor', 'Refactoring'), ('perf', 'Performance'), ('remove', 'Removed'),
    ('spec', 'Specs'), ('chore', 'Maintenance'),
])

commits = [l.strip() for l in raw.split('\n') if l.strip()]
categorized = {}
for c in commits:
    scope_desc = c.split(': ', 1)
    if len(scope_desc) == 2:
        prefix = scope_desc[0].split('(')[0]
        desc = scope_desc[1][0].upper() + scope_desc[1][1:]
        group = groups.get(prefix, 'Other')
    else:
        desc = c[0].upper() + c[1:]
        group = 'Other'
    categorized.setdefault(group, []).append(desc)

for group, gnames in groups.items():
    items = categorized.pop(group, [])
    if items:
        print(f'### {gnames}')
        print()
        for item in items:
            print(f'  - {item}')
        print()
for group, items in categorized.items():
    if items:
        print(f'### {group}')
        print()
        for item in items:
            print(f'  - {item}')
        print()
