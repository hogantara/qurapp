"""Generate icon-512.png / icon-192.png — flat eight-point star app icon.

Pure-stdlib PNG writer (zlib + struct); no image libraries needed.
The star is the same rub-el-hizb geometry used for the app's ayah markers:
two concentric squares, one rotated 45 degrees, on the app's beige background.

Usage:  python3 tools/build_icon.py
"""
import os
import struct
import zlib

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BG = (236, 228, 210)      # --bg beige
STAR = (143, 115, 57)     # --accent bronze
INNER = (247, 242, 230)   # --surface ivory
DOT = (107, 82, 29)       # --accent-deep

def in_star(px, py, cx, cy, half):
    """Inside the union of an axis-aligned and a 45-degree-rotated square."""
    dx, dy = px - cx, py - cy
    axis = abs(dx) <= half and abs(dy) <= half
    diamond = abs(dx) + abs(dy) <= half * 1.4142135
    return axis or diamond

def render(size):
    cx = cy = size / 2
    outer = size * 0.245   # half-side of outer star square
    inner = size * 0.205
    dot_r = size * 0.085
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter byte
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            if (px - cx) ** 2 + (py - cy) ** 2 <= dot_r ** 2:
                c = DOT
            elif in_star(px, py, cx, cy, inner):
                c = INNER
            elif in_star(px, py, cx, cy, outer):
                c = STAR
            else:
                c = BG
            row += bytes(c)
        rows.append(bytes(row))
    return b"".join(rows)

def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data)))

def write_png(path, size):
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    idat = zlib.compress(render(size), 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))
    print(f"{path}: {size}x{size}, {os.path.getsize(path)} bytes")

write_png(os.path.join(BASE, "icon-512.png"), 512)
write_png(os.path.join(BASE, "icon-192.png"), 192)
