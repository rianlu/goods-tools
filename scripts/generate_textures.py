#!/usr/bin/env python3
"""Generate craft textures for badge preview.

Outputs 1024x1024 RGBA PNGs into public/textures/.
Textures bake full-strength color; runtime controls opacity/blend.
Target mean luminance ~128-150 so 'overlay' blending stays brightness-neutral.

Usage: python3 scripts/generate_textures.py
"""

import os

import numpy as np
from PIL import Image, ImageFilter

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'textures')


def value_noise(shape, scale, seed, octaves=1, persistence=0.5):
    """Smooth value noise in [0,1] via bilinear-interpolated random grids."""
    rng = np.random.default_rng(seed)
    h, w = shape
    total = np.zeros(shape)
    amp, norm = 1.0, 0.0
    for octave in range(octaves):
        cell = max(2, int(scale / (2 ** octave)))
        grid = rng.random((h // cell + 2, w // cell + 2))
        ys = np.arange(h) / cell
        xs = np.arange(w) / cell
        y0 = ys.astype(int)
        x0 = xs.astype(int)
        fy = ys - y0
        fx = xs - x0
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        n00 = grid[np.ix_(y0, x0)]
        n01 = grid[np.ix_(y0, x0 + 1)]
        n10 = grid[np.ix_(y0 + 1, x0)]
        n11 = grid[np.ix_(y0 + 1, x0 + 1)]
        fxg, fyg = np.meshgrid(fx, fy)
        n = (n00 * (1 - fxg) * (1 - fyg) + n01 * fxg * (1 - fyg)
             + n10 * (1 - fxg) * fyg + n11 * fxg * fyg)
        total += amp * n
        norm += amp
        amp *= persistence
    return total / norm


def hsv_to_rgb(h, s, v):
    """Vectorized HSV->RGB, all inputs/outputs in [0,1]."""
    h = h % 1.0
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    conds = [i == k for k in range(6)]
    r = np.select(conds, [v, q, p, p, t, v])
    g = np.select(conds, [t, v, v, q, p, p])
    b = np.select(conds, [p, p, t, v, v, q])
    return r, g, b


def save(name, r, g, b, blur=0.0):
    rgb = np.stack([r, g, b], axis=-1)
    rgb = np.clip(rgb * 255, 0, 255).astype(np.uint8)
    alpha = np.full((SIZE, SIZE, 1), 255, dtype=np.uint8)
    img = Image.fromarray(np.concatenate([rgb, alpha], axis=-1), 'RGBA')
    if blur > 0:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    path = os.path.join(OUT_DIR, name)
    img.save(path, optimize=True)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    print(f'{name}: mean lum {lum.mean():.0f}, {os.path.getsize(path) // 1024}KB')


def gen_rainbow():
    """素面镭射: broad diagonal spectral bands, gently warped, metallic sheen."""
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(float)
    d = (x + y) / np.sqrt(2)
    warp = (value_noise((SIZE, SIZE), 320, seed=7, octaves=2) - 0.5) * 150
    dd = d + warp
    period = 400.0
    hue = dd / period
    band = 0.5 + 0.5 * np.cos(2 * np.pi * dd / period)
    grain = (value_noise((SIZE, SIZE), 3, seed=8) - 0.5) * 0.04
    sat = 0.78 + 0.08 * band
    val = 0.46 + 0.17 * band + grain
    save('rainbow-holographic.png', *hsv_to_rgb(hue, sat, val))


def gen_cracked_ice():
    """碎冰镭射: Voronoi shards, per-shard hue + facet gradient, bright cracks."""
    rng = np.random.default_rng(11)
    seeds = 150
    pts = rng.random((seeds, 2)) * SIZE
    cell_dir = rng.random(seeds) * 2 * np.pi
    hue_jit = rng.normal(0, 0.10, seeds)
    val_jit = rng.normal(0, 0.05, seeds)
    sat_cell = 0.58 + rng.random(seeds) * 0.24

    hue = np.zeros((SIZE, SIZE))
    sat = np.zeros((SIZE, SIZE))
    val = np.zeros((SIZE, SIZE))
    xs = np.arange(SIZE)
    for row0 in range(0, SIZE, 64):
        rows = np.arange(row0, min(row0 + 64, SIZE))
        yy, xx = np.meshgrid(rows, xs, indexing='ij')
        dx = xx[..., None] - pts[:, 0]
        dy = yy[..., None] - pts[:, 1]
        dist2 = dx * dx + dy * dy
        idx = np.argmin(dist2, axis=-1)
        part = np.partition(dist2, 1, axis=-1)
        edge = np.sqrt(part[..., 1]) - np.sqrt(part[..., 0])
        proj = (dx[np.arange(len(rows))[:, None], np.arange(SIZE), idx] * np.cos(cell_dir[idx])
                + dy[np.arange(len(rows))[:, None], np.arange(SIZE), idx] * np.sin(cell_dir[idx]))
        facet = np.clip(proj / 110 + 0.5, 0, 1)
        h = (0.6 * (xx + yy) / (2 * SIZE) + hue_jit[idx]) % 1.0
        s = sat_cell[idx]
        v = 0.40 + 0.32 * facet + val_jit[idx]
        crack = edge < 2.4
        h = np.where(crack, h, h)
        s = np.where(crack, 0.12, s)
        v = np.where(crack, 0.94, v)
        hue[rows] = h
        sat[rows] = s
        val[rows] = v
    save('cracked-ice.png', *hsv_to_rgb(hue, sat, np.clip(val, 0, 1)), blur=0.7)


def gen_lattice():
    """方格镭射: grid of square facets, alternating gradient direction, dark seams."""
    cell = 26
    y, x = np.mgrid[0:SIZE, 0:SIZE]
    row, col = y // cell, x // cell
    u = (x % cell) / cell
    w = (y % cell) / cell
    rng = np.random.default_rng(13)
    jitter = rng.random((SIZE // cell + 2, SIZE // cell + 2))
    parity = (row + col) % 2
    facet = np.where(parity == 0, (u + w) / 2, (1 - u + w) / 2)
    hue = (row * 0.047 + col * 0.061 + jitter[row, col] * 0.14) % 1.0
    sat = np.full((SIZE, SIZE), 0.62)
    val = 0.42 + 0.30 * facet
    seam = (x % cell < 1) | (y % cell < 1)
    val = np.where(seam, val * 0.5, val)
    sat = np.where(seam, 0.3, sat)
    save('lattice.png', *hsv_to_rgb(hue, sat, val), blur=0.5)


def gen_pearl():
    """珠光: soft iridescent low-frequency wash + fine shimmer speckle."""
    n = value_noise((SIZE, SIZE), 360, seed=21, octaves=3)
    n2 = value_noise((SIZE, SIZE), 180, seed=22, octaves=2)
    keys_x = np.array([0.0, 0.33, 0.66, 1.0])
    keys_h = np.array([0.90, 0.45, 0.60, 0.10])
    hue = np.interp(n, keys_x, keys_h)
    sat = 0.22 + 0.20 * n2
    rng = np.random.default_rng(23)
    shimmer = (rng.random((SIZE, SIZE)) < 0.05) * rng.random((SIZE, SIZE)) * 0.14
    val = 0.62 + 0.20 * (n - 0.5) + 0.08 * n2 + shimmer
    save('pearl.png', *hsv_to_rgb(hue, sat, np.clip(val, 0, 1)), blur=0.6)


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    gen_rainbow()
    gen_cracked_ice()
    gen_lattice()
    gen_pearl()
