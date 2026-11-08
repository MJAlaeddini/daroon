"""Separate each stone's light from its dark painted background, and measure its outline.

For every 1024² concept image:
  1. find the stone: bright pixels connected to the centre, holes filled;
  2. estimate the background under it from the pixels around it (normalized Gaussian convolution);
  3. light = image − background, faded out softly beyond the stone and its glow;
  4. outline: the stone's radius in 256 directions from its centre of light.
Writes <id>.png (light on black, 768²) and stones.json (centre and outline per stone, in units of half the image).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
NAMES = {
    'aramesh': 'calm', 'omid': 'hope', 'khoshhali': 'joy', 'eshteghagh': 'longing', 'samimiyat': 'intimacy',
    'deltangi': 'missing', 'gham': 'sadness', 'delkhori': 'hurt', 'tars': 'fear', 'negarani': 'anxiety',
    'sardargomi': 'confusion', 'khashm': 'anger',
}
N = 1024
BINS = 256


def blur(a, sigma):
    """Gaussian blur through the FFT (wraps, so pad first)."""
    pad = int(3 * sigma)
    a = np.pad(a, ((pad, pad), (pad, pad)) + (((0, 0),) if a.ndim == 3 else ()), mode='edge')
    h, w = a.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    if a.ndim == 3:
        out = np.stack([np.fft.irfft2(np.fft.rfft2(a[..., c]) * g, s=(h, w)) for c in range(a.shape[2])], -1)
    else:
        out = np.fft.irfft2(np.fft.rfft2(a) * g, s=(h, w))
    return out[pad:-pad, pad:-pad]


def fill_component(mask, seed):
    """Keep the component of `mask` that contains `seed`, with its holes filled."""
    im = Image.fromarray((mask * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(im, seed, 128)
    comp = np.asarray(im) == 128
    # holes: background not reachable from the border
    inv = Image.fromarray(((~comp) * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(inv, (0, 0), 128)
    outside = np.asarray(inv) == 128
    return ~outside


meta = {}
for src, eid in NAMES.items():
    img = np.asarray(Image.open(SRC / f'{src}.png').convert('RGB')).astype(np.float64) / 255
    Y = img @ np.array([0.2126, 0.7152, 0.0722])
    sm = blur(Y, 2)
    c0 = sm[312:712, 312:712]
    sy, sx = np.unravel_index(np.argmax(c0), c0.shape)
    seed = (int(sx + 312), int(sy + 312))
    # pass 1: a generous threshold finds the stone roughly; pass 2 measures it against the background around it
    stone = fill_component(sm > 0.2, seed)
    for _ in range(2):
        near = blur(stone.astype(float), 14) > 0.01
        w = (~near).astype(float)
        bg = blur(img * w[..., None], 40) / np.maximum(blur(w, 40)[..., None], 1e-4)
        bgY = bg @ np.array([0.2126, 0.7152, 0.0722])
        stone = fill_component((sm - bgY) > 0.05, seed)
    # subtract only the plain dark ground (a local estimate would also take away the stone's own glow and shift its
    # colour); the window then fades everything beyond the stone and its glow, panel edges included
    yy, xx = np.mgrid[0:N, 0:N]
    ring = np.hypot(yy - N / 2, xx - N / 2) > 0.46 * N
    ground = np.percentile(img[ring], 25, axis=0)
    light = np.clip(img - ground, 0, None)
    grown = blur(stone.astype(float), 10) > 0.02
    window = np.clip(blur(grown.astype(float), 20) * 1.4, 0, 1)
    light *= window[..., None]
    # centre of light and outline
    ys, xs = np.nonzero(stone)
    wts = Y[ys, xs]
    cy, cx = (ys * wts).sum() / wts.sum(), (xs * wts).sum() / wts.sum()
    prof = []
    for k in range(BINS):
        a = 2 * np.pi * k / BINS
        r = 0
        for step in range(1, 600):
            x, y = int(round(cx + step * np.cos(a))), int(round(cy - step * np.sin(a)))
            if x < 0 or y < 0 or x >= N or y >= N:
                break
            if stone[y, x]:
                r = step
        prof.append(r)
    prof = np.array(prof, float)
    k = np.exp(-0.5 * (np.arange(-6, 7) / 2.0) ** 2)
    k /= k.sum()
    prof = np.convolve(np.concatenate([prof[-6:], prof, prof[:6]]), k, mode='same')[6:-6]
    meta[eid] = {
        'center': [round((cx - N / 2) / (N / 2), 4), round(-(cy - N / 2) / (N / 2), 4)],
        'outline': [round(r / (N / 2), 4) for r in prof],
    }
    out = Image.fromarray((np.clip(light, 0, 1) * 255).round().astype(np.uint8)).resize((768, 768), Image.LANCZOS)
    out.save(OUT / f'{eid}.png')
    print(eid, 'centre', meta[eid]['center'], 'radius', round(float(prof.mean()) / (N / 2), 3), 'max light', round(float(light.max()), 3))

(OUT / 'stones.json').write_text(json.dumps(meta))
