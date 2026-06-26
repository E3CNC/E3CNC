#!/usr/bin/env python3
"""Comment out a conflicting [update_manager mainsail] block in moonraker.conf."""

from __future__ import annotations

import sys
from pathlib import Path


def comment_out_mainsail_update_manager(path: Path) -> bool:
    """Comment out an active [update_manager mainsail] block.

    Returns True if the file was modified, otherwise False.
    """
    if not path.exists():
        return False

    text = path.read_text()
    lines = text.splitlines(True)
    out: list[str] = []
    i = 0
    changed = False

    while i < len(lines):
        line = lines[i]
        if line.lstrip().startswith("[update_manager mainsail]"):
            start = i
            while i < len(lines):
                cur = lines[i]
                if i > start and cur.lstrip().startswith("["):
                    break
                if cur.strip() and not cur.lstrip().startswith("#"):
                    out.append("# " + cur)
                    changed = True
                else:
                    out.append(cur)
                i += 1
            continue
        out.append(line)
        i += 1

    if changed:
        path.write_text("".join(out))
    return changed


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {argv[0]} <moonraker.conf>", file=sys.stderr)
        return 2

    changed = comment_out_mainsail_update_manager(Path(argv[1]))
    print("changed" if changed else "ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
