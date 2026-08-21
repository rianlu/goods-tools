#!/usr/bin/env python3
"""Calibrate an AI-generated texture image into a craft texture slot.

Usage: python3 scripts/calibrate_texture.py <input-image> <slot>
Slots: rainbow | cracked-ice | lattice | pearl | silver-glitter | gold-glitter

Pipeline: center-crop square -> resize 1024 -> flat-field correction
(removes vignette / hotspot) -> luminance normalization for the slot's
blend mode -> save into public/textures/.
"""

import os
import sys

import numpy as np
from PIL import Image, ImageFilter

SIZE = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'textures')

# overlay slots: mean luminance ~target keeps 'overlay' blending brightness-neutral.
# screen slots: black background must be truly black ('screen' treats black as no-op).
SLOTS = {
    'rainbow': {'file': 'rainbow-holographic.png', 'mode': 'overlay', 'lum': 135},
    'cracked-ice': {'file': 'cracked-ice.png', 'mode': 'overlay', 'lum': 135},
    'lattice': {'file': 'lattice.png', 'mode': 'overlay', 'lum': 135},
    'pearl': {'file': 'pearl.png', 'mode': 'overlay', 'lum': 165},
    'silver-glitter': {'file': 'silver-glitter.png', 'mode': 'screen'},
    'gold-glitter': {'file': 'gold-glitter.png', 'mode': 'screen'},
}


def luminance(arr):
    return 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]


def main():
    if len(sys.argv) != 3 or sys.argv[2] not in SLOTS:
        print(__doc__)
        sys.exit(1)
    src_path, slot_name = sys.argv[1], sys.argv[2]
    slot = SLOTS[slot_name]

    img = Image.open(src_path).convert('RGB')
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    arr = np.asarray(img).astype(np.float64)

    lum = luminance(arr)
    print(f'input: mean lum {lum.mean():.0f}, p3 {np.percentile(lum, 3):.0f}, '
          f'p99.5 {np.percentile(lum, 99.5):.0f}')

    if slot['mode'] == 'overlay':
        # Flat-field: estimate low-frequency brightness (vignette / hotspot)
        # on a small copy, divide it out with bounded gain.
        field_img = Image.fromarray(lum.astype(np.uint8)).resize((256, 256))
        field_img = field_img.filter(ImageFilter.GaussianBlur(48))
        field = np.asarray(field_img.resize((SIZE, SIZE), Image.BILINEAR)).astype(np.float64)
        gain = np.clip(field.mean() / np.maximum(field, 1), 0.6, 1.6)
        arr = arr * gain[..., None]

        # Normalize mean luminance to the slot target.
        mean = luminance(arr).mean()
        arr = np.clip(arr * (slot['lum'] / max(mean, 1)), 0, 255)

        # Saturation report (HSV): warn if the source is too washed out.
        hsv = np.asarray(Image.fromarray(arr.astype(np.uint8)).convert('HSV')).astype(np.float64)
        sat = hsv[..., 1].mean() / 255
        if sat < 0.35:
            print(f'warning: mean saturation {sat:.2f} < 0.35 — 素材偏淡, 建议重新生成更饱和的原图')
        else:
            print(f'mean saturation {sat:.2f}')
    else:
        # screen mode (glitter on black): pin black point, stretch highlights.
        black = np.percentile(lum, 3)
        white = np.percentile(lum, 99.5)
        arr = np.clip((arr - black) / max(white - black, 1) * 255, 0, 255)

    out_path = os.path.join(OUT_DIR, slot['file'])
    out = Image.fromarray(arr.astype(np.uint8), 'RGB').convert('RGBA')
    out.save(out_path, optimize=True)
    result_lum = luminance(arr)
    print(f'saved {out_path}: mean lum {result_lum.mean():.0f}, '
          f'{os.path.getsize(out_path) // 1024}KB')


if __name__ == '__main__':
    main()
