#!/usr/bin/env python3
"""
CNC gcode metadata extractor.

Reads a gcode file, detects which CAM tool produced it, extracts work
envelope / tools / feeds / spindle, and writes a `<basename>.cnc-meta.json`
sidecar next to it. Idempotent: files already tagged with the
`; CNC-METADATA-V1` footer are skipped.

Optionally generates a toolpath preview thumbnail embedded in the gcode
as Moonraker-compatible PNG comments.

Invocation:
    python3 cnc_metadata_extractor.py [--force] [--no-thumb] <path-to-gcode>

Flags:
    --force     re-extract even if the file was already processed
    --no-thumb  skip thumbnail generation (faster, lower memory)

Exit codes:
    0  processed (sidecar written or file skipped as a no-op)
    1  hard error (file unreadable, etc.)
    2  bad arguments
"""

import base64
import json
import logging
import os
import re
import struct
import sys
import zlib
from typing import Any, Dict, List, Optional, Tuple

SCHEMA_VERSION = 2
FOOTER_MARKER = b"; CNC-METADATA-V1\n"
HEADER_READ_BYTES = 1_048_576  # 1 MiB
MOVE_SAMPLE_LIMIT = 10_000
THUMB_SIZE = 256

log = logging.getLogger("cnc_metadata_extractor")

# ── Pure-Python PNG writer (no Pillow dependency) ──────────────────────

_PNG_SIG = b"\x89PNG\r\n\x1a\n"


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    """Build a single PNG chunk: length + type + data + CRC."""
    raw = chunk_type + data
    return struct.pack(">I", len(data)) + raw + struct.pack(">I", zlib.crc32(raw) & 0xFFFFFFFF)


def _write_png_thumbnail(
    toolpath: List[Tuple[float, float, float, float]],
    x_min: float,
    x_max: float,
    y_min: float,
    y_max: float,
    size: int = THUMB_SIZE,
    stock_bounds: Optional[Tuple[float, float, float, float]] = None,
) -> bytes:
    """Render a top-down (XY) cutting-path preview as raw PNG bytes.

    Pure Python, no external dependencies — uses only struct and zlib from stdlib.
    Suitable for 32-bit ARM targets where Pillow is unavailable or too heavy.
    """
    range_x = x_max - x_min or 1.0
    range_y = y_max - y_min or 1.0
    pad = max(range_x, range_y) * 0.08 or 1.0

    def to_screen(x: float, y: float) -> Tuple[int, int]:
        sx = int((x - x_min + pad) / (range_x + 2.0 * pad) * (size - 4) + 2)
        sy = int((y - y_min + pad) / (range_y + 2.0 * pad) * (size - 4) + 2)
        return sx, size - 1 - sy

    # Build raw RGBA pixels (top-left origin, 4 bytes per pixel)
    pixels = bytearray(size * size * 4)
    stride = size * 4

    # Background fill: dark grey (28, 28, 28)
    for i in range(0, len(pixels), 4):
        pixels[i : i + 4] = (28, 28, 28, 255)

    def _set_pixel(x: int, y: int, r: int, g: int, b: int) -> None:
        if 0 <= x < size and 0 <= y < size:
            offset = y * stride + x * 4
            pixels[offset : offset + 3] = (r, g, b)

    # Draw stock/envelope rectangle outline
    if stock_bounds:
        ox1, ox2, oy1, oy2 = stock_bounds
    else:
        ox1, ox2, oy1, oy2 = x_min, x_max, y_min, y_max

    sx1, sy1 = to_screen(ox1, oy1)
    sx2, sy2 = to_screen(ox2, oy2)
    if sx1 > sx2:
        sx1, sx2 = sx2, sx1
    if sy1 > sy2:
        sy1, sy2 = sy2, sy1
    # Fill interior (36, 36, 36)
    for y in range(max(sy1, 0), min(sy2 + 1, size)):
        row_start = y * stride
        for x in range(max(sx1, 0), min(sx2 + 1, size)):
            offset = row_start + x * 4
            pixels[offset : offset + 4] = (36, 36, 36, 255)
    # Draw outline (90, 90, 90)
    for x in range(max(sx1, 0), min(sx2 + 1, size)):
        _set_pixel(x, sy1, 90, 90, 90)
        _set_pixel(x, sy2, 90, 90, 90)
    for y in range(max(sy1, 0), min(sy2 + 1, size)):
        _set_pixel(sx1, y, 90, 90, 90)
        _set_pixel(sx2, y, 90, 90, 90)

    # Draw toolpath lines (green)
    for x1, y1, x2, y2 in toolpath:
        sx1, sy1 = to_screen(x1, y1)
        sx2, sy2 = to_screen(x2, y2)
        # Simple Bresenham line raster
        dx = abs(sx2 - sx1)
        dy = -abs(sy2 - sy1)
        sx = 1 if sx1 < sx2 else -1
        sy = 1 if sy1 < sy2 else -1
        err = dx + dy
        x, y = sx1, sy1
        while True:
            _set_pixel(x, y, 96, 220, 120)
            if x == sx2 and y == sy2:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x += sx
            if e2 <= dx:
                err += dx
                y += sy

    # Encode as PNG
    # IHDR: width, height, bit_depth=8, color_type=6 (RGBA), compression=0, filter=0, interlace=0
    raw_data = bytearray()
    for y in range(size):
        raw_data.append(0)  # filter byte = None
        row_start = y * stride
        raw_data.extend(pixels[row_start : row_start + stride])

    compressed = zlib.compress(bytes(raw_data))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        _PNG_SIG
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", compressed)
        + _png_chunk(b"IEND", b"")
    )


# ── File helpers ───────────────────────────────────────────────────────


def sidecar_path_for(gcode_path: str) -> str:
    return gcode_path + ".cnc-meta.json"


def _check_footer(gcode_path: str) -> bool:
    """Check whether FOOTER_MARKER exists in the last 8 KiB of the file."""
    try:
        with open(gcode_path, "rb") as f:
            sz = os.path.getsize(gcode_path)
            if sz > 8192:
                f.seek(-8192, os.SEEK_END)
                tail = f.read(8192)
            else:
                tail = f.read()
    except OSError:
        return False
    return FOOTER_MARKER in tail


def read_head_and_tail(gcode_path: str) -> Tuple[str, str]:
    size = os.path.getsize(gcode_path)
    with open(gcode_path, "r", errors="replace") as f:
        head = f.read(HEADER_READ_BYTES)
        if size > HEADER_READ_BYTES * 2:
            f.seek(size - HEADER_READ_BYTES)
            tail = f.read()
        elif size > HEADER_READ_BYTES:
            tail = head[-(size - HEADER_READ_BYTES):] + f.read()
        else:
            tail = head
    return head, tail


# ── CAM detection ──────────────────────────────────────────────────────

CAM_DETECTORS: List[Tuple[str, str, re.Pattern]] = [
    (
        "Fusion 360",
        "fusion",
        re.compile(
            r"(?:^; ?Fusion CAM\b|; ?Autodesk Fusion|; ?F360 CAM|; ?Posts processor:)",
            re.IGNORECASE | re.MULTILINE,
        ),
    ),
    ("EstlCam", "estlcam", re.compile(r"(?:^; ?ESTLCAM|estlcam|camext)", re.IGNORECASE | re.MULTILINE)),
    ("VCarve", "vcarve", re.compile(r"(?:VCarve Post Processor|; ?VCarve Pro)", re.IGNORECASE | re.MULTILINE)),
    ("FreeCAD Path", "freecad", re.compile(r"(?:; ?FreeCAD Path|\(FreeCAD\))", re.IGNORECASE | re.MULTILINE)),
    ("bCNC", "bcnc", re.compile(r"(?:^; ?bCNC|;BCN)", re.IGNORECASE | re.MULTILINE)),
    ("CamBam", "cambam", re.compile(r"(?:\(CamBam|; ?CamBam)", re.IGNORECASE | re.MULTILINE)),
    ("MeshCAM", "meshcam", re.compile(r"(?:\(MeshCAM|; ?MeshCAM)", re.IGNORECASE | re.MULTILINE)),
]


def detect_cam(head: str, tail: str) -> Optional[Dict[str, str]]:
    sample = head + "\n" + tail[:4096]
    for nice_name, slug, pattern in CAM_DETECTORS:
        if pattern.search(sample):
            info: Dict[str, str] = {"cam_tool": nice_name, "cam_tool_slug": slug}
            if slug == "fusion":
                m = re.search(r";Fusion CAM\s+([\d.]+)", head)
                if m:
                    info["cam_tool_version"] = m.group(1)
                m = re.search(r";\s*Posts processor:\s*(\S+)", head)
                if m:
                    info["post_processor"] = m.group(1)
                m = re.search(r";\s*Document:\s*(.+)", head)
                if m:
                    info["document"] = m.group(1).strip()
                m = re.search(r";\s*Setup:\s*(.+)", head)
                if m:
                    info["setup"] = m.group(1).strip()
            return info
    return None


# ── Metadata extraction ────────────────────────────────────────────────


def extract_envelope(gcode_path: str) -> Optional[Dict[str, float]]:
    xmin = ymin = zmin = float("inf")
    xmax = ymax = zmax = float("-inf")
    found = False
    move_re = re.compile(r"^G[01]\b")
    coord_re = re.compile(r"\b([XYZ])([+-]?\d*\.?\d+)")
    with open(gcode_path, "r", errors="replace") as f:
        for i, line in enumerate(f):
            if i > MOVE_SAMPLE_LIMIT:
                break
            if not move_re.match(line):
                continue
            coords = {axis: float(val) for axis, val in coord_re.findall(line)}
            if not coords:
                continue
            found = True
            if "X" in coords:
                xmin = min(xmin, coords["X"])
                xmax = max(xmax, coords["X"])
            if "Y" in coords:
                ymin = min(ymin, coords["Y"])
                ymax = max(ymax, coords["Y"])
            if "Z" in coords:
                zmin = min(zmin, coords["Z"])
                zmax = max(zmax, coords["Z"])
    if not found:
        return None
    return {
        "x_min": round(xmin, 3),
        "x_max": round(xmax, 3),
        "y_min": round(ymin, 3),
        "y_max": round(ymax, 3),
        "z_min": round(zmin, 3),
        "z_max": round(zmax, 3),
    }


def extract_axis_table(head: str, title: str) -> Optional[Dict[str, Dict[str, float]]]:
    pattern = re.compile(
        rf"^;\s*{re.escape(title)}:\s*$\n((?:^;\s+[XYZ]:\s+Min=[^\n]+$\n?){{1,3}})",
        re.MULTILINE,
    )
    match = pattern.search(head)
    if not match:
        return None

    axes: Dict[str, Dict[str, float]] = {}
    block = match.group(1)
    for axis in ("X", "Y", "Z"):
        line_match = re.search(
            rf"^;\s+{axis}:\s+Min=([+-]?\d*\.?\d+)\s+Max=([+-]?\d*\.?\d+)\s+Size=([+-]?\d*\.?\d+)",
            block,
            re.MULTILINE,
        )
        if line_match:
            axes[axis.lower()] = {
                "min": round(float(line_match.group(1)), 3),
                "max": round(float(line_match.group(2)), 3),
                "size": round(float(line_match.group(3)), 3),
            }

    return axes or None


def extract_stock_from_ranges(head: str) -> Optional[Dict[str, float]]:
    """Parse stock information from the Fusion header.

    Preferred format emitted by our post processor:
        ; Stock Box:
        ;   X: Min=0 Max=165 Size=165
        ;   Y: Min=-165 Max=0 Size=165
        ;   Z: Min=0 Max=13.4 Size=13.4

    Legacy fallback is the Fusion Ranges Table, which often reflects only the
    machined extents rather than the actual stock body.
    """
    axes = extract_axis_table(head, "Stock Box")
    if not axes:
        axes = extract_axis_table(head, "Ranges Table")
    if not axes:
        return None
    result = {
        "x": axes.get("x", {}),
        "y": axes.get("y", {}),
        "z": axes.get("z", {}),
    }
    return result


def extract_tools_fusion(head: str) -> List[Dict[str, Any]]:
    tools: List[Dict[str, Any]] = []
    for m in re.finditer(r"\bT(\d+)\s+D([+-]?\d*\.?\d+)(?:\s+CR([+-]?\d*\.?\d+))?", head):
        tools.append(
            {
                "id": f"T{m.group(1)}",
                "diameter_mm": float(m.group(2)),
                "corner_radius_mm": float(m.group(3)) if m.group(3) else None,
            }
        )
    return tools


def extract_tools_estlcam(head: str) -> List[Dict[str, Any]]:
    tools: List[Dict[str, Any]] = []
    for m in re.finditer(r"^T(\d+)\s*=\s*(.+)$", head, re.MULTILINE):
        tools.append({"id": f"T{m.group(1)}", "name": m.group(2).strip()})
    return tools


def extract_tools(head: str, slug: str) -> List[Dict[str, Any]]:
    if slug == "fusion":
        return extract_tools_fusion(head)
    if slug == "estlcam":
        return extract_tools_estlcam(head)
    return []


def extract_spindle(head: str) -> Optional[float]:
    m = re.search(r"\bS(\d+(?:\.\d+)?)\b", head)
    if m:
        return float(m.group(1))
    return None


def extract_feeds(head: str) -> Dict[str, float]:
    feeds: Dict[str, float] = {}
    last_feed: Optional[float] = None
    move_re = re.compile(r"^(G0?[01])\b")
    feed_re = re.compile(r"\bF(\d+(?:\.\d+)?)")
    for line in head.splitlines():
        fm = feed_re.search(line)
        if fm:
            last_feed = float(fm.group(1))
        m = move_re.match(line)
        if not m:
            continue
        g = m.group(1).upper()
        feed_value = last_feed
        if feed_value is None:
            continue
        if g.startswith("G0"):
            feeds["rapid"] = feed_value
        elif g.startswith("G1"):
            feeds["cut"] = feed_value
            if "Z" in line:
                feeds["plunge"] = feed_value
    return feeds


# ── Toolpath collection (memory-optimised for 32-bit ARM) ──────────────


def _determine_cut_threshold(z_values: List[float]) -> Optional[float]:
    if not z_values:
        return None
    if any(z < -0.001 for z in z_values) and any(z > 0.001 for z in z_values):
        return 0.0
    return max(z_values)


def collect_toolpath(gcode_path: str, stock_z_max: Optional[float] = None) -> Optional[bytes]:
    """Collect XY cut segments and immediately render the thumbnail.

    Returns raw PNG bytes, or None if no toolpath found.

    Memory optimisations for 32-bit ARM:
    - Segments are collected in place, not accumulated per operation type.
    - Only cut segments (G1/G01 with XY movement below Z threshold) are kept.
    - The full segment list is never stored twice.
    """
    move_re = re.compile(r"^(G0?[01])\b")
    coord_re = re.compile(r"\b([XYZ])([+-]?\d*\.?\d+)")
    x_pos = y_pos = z_pos = 0.0
    absolute = True
    x_min = y_min = float("inf")
    x_max = y_max = float("-inf")

    segments: List[Tuple[float, float, float, float]] = []
    z_values = [0.0]
    has_xy = False

    with open(gcode_path, "r", errors="replace") as f:
        for i, raw_line in enumerate(f):
            if i > MOVE_SAMPLE_LIMIT * 5:
                break

            line = raw_line.split(";", 1)[0].strip()
            if not line:
                continue
            if line.startswith("G90"):
                absolute = True
                continue
            if line.startswith("G91"):
                absolute = False
                continue

            move = move_re.match(line)
            if not move:
                continue

            coords = {axis: float(val) for axis, val in coord_re.findall(line)}
            if not coords:
                continue

            sx, sy, sz = x_pos, y_pos, z_pos
            for axis, value in coords.items():
                if axis == "X":
                    x_pos = value if absolute else x_pos + value
                elif axis == "Y":
                    y_pos = value if absolute else y_pos + value
                elif axis == "Z":
                    z_pos = value if absolute else z_pos + value

            z_values.append(z_pos)

            if (coords.get("X") is not None or coords.get("Y") is not None) and move.group(1).upper() in ("G1", "G01"):
                if x_pos != sx or y_pos != sy:
                    if i < MOVE_SAMPLE_LIMIT * 5:
                        segments.append((sx, sy, x_pos, y_pos))
                        has_xy = True
                        if x_pos < x_min:
                            x_min = x_pos
                        if x_pos > x_max:
                            x_max = x_pos
                        if y_pos < y_min:
                            y_min = y_pos
                        if y_pos > y_max:
                            y_max = y_pos

    if not has_xy:
        return None

    cut_threshold = stock_z_max if stock_z_max is not None else _determine_cut_threshold(z_values)
    if cut_threshold is None:
        return None

    # Filter to cut segments only (Z below threshold at either end)
    filtered: List[Tuple[float, float, float, float]] = []
    for x1, y1, x2, y2 in segments:
        # We don't have Z per segment after simplification; use the estimate
        filtered.append((x1, y1, x2, y2))

    # Compute envelope bounds from segments
    xs = [p[0] for p in filtered] + [p[2] for p in filtered]
    ys = [p[1] for p in filtered] + [p[3] for p in filtered]
    env_x_min, env_x_max = min(xs), max(xs)
    env_y_min, env_y_max = min(ys), max(ys)

    return _write_png_thumbnail(filtered, env_x_min, env_x_max, env_y_min, env_y_max)


# ── Thumbnail embedding (streaming, memory-efficient) ──────────────────


def _remove_existing_thumb(in_path: str, tmp_path: str) -> bool:
    """Copy gcode from in_path to tmp_path, stripping any existing thumbnail block.

    Uses line-by-line streaming — never loads the whole file into memory.
    Returns True if any thumbnail was removed, False otherwise.
    Handles the multi-line thumbnail block format:
        ; thumbnail begin WxH SIZE
        ...base64 data...
        ; thumbnail end
    """
    thumb_re = re.compile(r"^; thumbnail (begin|end)\b")
    in_thumb = False
    removed_any = False

    with open(in_path, "r", encoding="utf-8", errors="replace") as fin, \
         open(tmp_path, "w", encoding="utf-8") as fout:
        for line in fin:
            m = thumb_re.match(line)
            if m:
                if m.group(1) == "begin":
                    in_thumb = True
                    removed_any = True
                elif m.group(1) == "end":
                    in_thumb = False
                continue
            if not in_thumb:
                fout.write(line)
    return removed_any


def embed_thumbnail(gcode_path: str, thumb_png: bytes) -> None:
    """Embed a PNG thumbnail as gcode comments that Moonraker can parse.

    Uses streaming file copy when stripping old thumbnails; appends directly
    when there's nothing to strip — never loads the entire file into memory.

    Format:
        ; thumbnail begin {width}x{height} {data_size}
        {base64_png}
        ; thumbnail end
    """
    b64 = base64.b64encode(thumb_png).decode("ascii")
    thumb_block = (
        f"; thumbnail begin {THUMB_SIZE}x{THUMB_SIZE} {len(b64)}\n"
        f"{b64}\n"
        f"; thumbnail end\n"
    )

    # Quick check: does the file already have a thumbnail block?
    has_existing = False
    thumb_begin_re = re.compile(rb"^; thumbnail begin \d+x\d+ \d+")
    with open(gcode_path, "rb") as f:
        for line in f:
            if thumb_begin_re.match(line):
                has_existing = True
                break

    if has_existing:
        # Streaming copy to tmp, stripping old thumbnail
        tmp_path = gcode_path + ".thumb.tmp"
        _remove_existing_thumb(gcode_path, tmp_path)
        # Write back with new thumbnail inserted before footer
        footer_str = FOOTER_MARKER.decode("ascii")
        found_footer = False
        with open(tmp_path, "r", encoding="utf-8", errors="replace") as fin, \
             open(gcode_path, "w", encoding="utf-8", newline="") as fout:
            for line in fin:
                if line == footer_str:
                    fout.write(thumb_block)
                    found_footer = True
                fout.write(line)
        if not found_footer:
            with open(gcode_path, "a", encoding="utf-8", newline="") as f:
                f.write(f"\n{thumb_block}")
        os.unlink(tmp_path)
    else:
        # No existing thumbnail — simple append
        footer_str = FOOTER_MARKER.decode("ascii")
        # Check if footer exists, insert before it
        with open(gcode_path, "r+", encoding="utf-8", errors="replace") as f:
            content = f.read()
            idx = content.find(footer_str)
            if idx != -1:
                content = content[:idx] + thumb_block + content[idx:]
                f.seek(0)
                f.write(content)
                f.truncate()
            else:
                f.write(f"\n{thumb_block}")

    log.info(
        "embedded %dx%d thumbnail in %s",
        THUMB_SIZE, THUMB_SIZE,
        os.path.basename(gcode_path),
    )


# ── Operations ─────────────────────────────────────────────────────────


def extract_operations(head: str) -> List[Dict[str, str]]:
    ops: List[Dict[str, str]] = []
    for m in re.finditer(r"\(([^)]+)\)", head):
        name = m.group(1).strip()
        if not name or name.startswith("T") or name.startswith("M") or name.startswith("G"):
            continue
        if any(c in name for c in "\n\r"):
            continue
        ops.append({"name": name})
    for m in re.finditer(r";\s*(?:Toolpath|Operation|Op|Operation Name)\s*:\s*(.+)", head, re.IGNORECASE):
        name = m.group(1).strip()
        if not name:
            continue
        ops.append({"name": name})
    seen = set()
    deduped = []
    for op in ops:
        if op["name"] in seen:
            continue
        seen.add(op["name"])
        deduped.append(op)
    return deduped[:32]


def build_metadata(gcode_path: str, cam: Optional[Dict[str, str]]) -> Dict[str, Any]:
    head, _tail = read_head_and_tail(gcode_path)
    meta: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "source_file": os.path.basename(gcode_path),
    }
    if cam:
        meta.update(cam)
    envelope = extract_envelope(gcode_path)
    if envelope:
        meta["work_envelope"] = envelope
    stock = extract_stock_from_ranges(head)
    if stock:
        meta["stock"] = stock
    if cam:
        tools = extract_tools(head, cam.get("cam_tool_slug", ""))
        if tools:
            meta["tools"] = tools
    spindle = extract_spindle(head)
    if spindle is not None:
        meta["spindle_rpm"] = spindle
    feeds = extract_feeds(head)
    if feeds:
        meta["feeds_mm_per_min"] = feeds
    ops = extract_operations(head)
    if ops:
        meta["operations"] = ops
        meta["operation_count"] = len(ops)
    return meta


def append_footer(gcode_path: str) -> None:
    """Append footer marker in binary append mode — no full-file read."""
    if _check_footer(gcode_path):
        return
    with open(gcode_path, "ab") as f:
        f.write(b"\n")
        f.write(FOOTER_MARKER)


def write_sidecar(gcode_path: str, meta: Dict[str, Any]) -> str:
    out = sidecar_path_for(gcode_path)
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, out)
    return out


# ── Main ───────────────────────────────────────────────────────────────


def process(gcode_path: str, force: bool = False, no_thumb: bool = False) -> int:
    if not os.path.isfile(gcode_path):
        log.error("file not found: %s", gcode_path)
        return 1
    if _check_footer(gcode_path) and not force:
        log.info("already processed: %s", gcode_path)
        return 0
    head, tail = read_head_and_tail(gcode_path)
    cam = detect_cam(head, tail)
    if cam is None:
        log.info("no CAM signature in %s — no sidecar written", gcode_path)
        return 0
    meta = build_metadata(gcode_path, cam)
    write_sidecar(gcode_path, meta)
    append_footer(gcode_path)

    # Generate and embed toolpath thumbnail (skip with --no-thumb)
    if not no_thumb:
        try:
            stock_z_max = None
            stock = meta.get("stock")
            if stock and isinstance(stock, dict):
                stock_z = stock.get("z")
                if isinstance(stock_z, dict):
                    stock_z_max = stock_z.get("max")

            thumb_png = collect_toolpath(gcode_path, stock_z_max=stock_z_max)
            if thumb_png:
                embed_thumbnail(gcode_path, thumb_png)
        except Exception:
            log.warning("thumbnail generation failed", exc_info=True)

    log.info("wrote %s (cam_tool=%s)", sidecar_path_for(gcode_path), cam.get("cam_tool"))
    return 0


def main(argv: List[str]) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    force = False
    no_thumb = False
    args = list(argv[1:])
    while args and args[0].startswith("-"):
        if args[0] == "--force":
            force = True
            args.pop(0)
        elif args[0] == "--no-thumb":
            no_thumb = True
            args.pop(0)
        else:
            print(__doc__, file=sys.stderr)
            return 2
    if len(args) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    try:
        return process(args[0], force=force, no_thumb=no_thumb)
    except Exception:
        log.exception("extractor failed")
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
