/* The twelve stones as the owner designed them (docs/stone/base), reduced to their light: each WebP is the stone's
 * glow on black (scripts/extract-stones.py separates it from the painted ground), and outlines.json holds where
 * its light is centred and how far its body reaches in 256 directions (units: half the image). */
import anger from './art/anger.webp';
import anxiety from './art/anxiety.webp';
import calm from './art/calm.webp';
import confusion from './art/confusion.webp';
import fear from './art/fear.webp';
import hope from './art/hope.webp';
import hurt from './art/hurt.webp';
import intimacy from './art/intimacy.webp';
import joy from './art/joy.webp';
import longing from './art/longing.webp';
import missing from './art/missing.webp';
import sadness from './art/sadness.webp';
import outlines from './art/outlines.json';
import { EMOTION_IDS, type EmotionId } from './presets';

export const ART_URL: Record<EmotionId, string> = {
  joy,
  hope,
  calm,
  longing,
  intimacy,
  missing,
  sadness,
  hurt,
  fear,
  anxiety,
  confusion,
  anger,
};
export const OUTLINE_BINS = 256;
export const ART: Record<EmotionId, { center: [number, number]; outline: number[] }> = outlines as Record<
  EmotionId,
  { center: [number, number]; outline: number[] }
>;

/** The outline of a stone at angle `a` (radians, counter-clockwise from +x), interpolated between samples. */
export function outlineAt(id: EmotionId, a: number): number {
  const o = ART[id].outline,
    n = o.length;
  const f = (((a / (2 * Math.PI)) % 1) + 1) % 1;
  const x = f * n,
    i = Math.floor(x),
    t = x - i;
  return o[i % n] * (1 - t) + o[(i + 1) % n] * t;
}

/* ── loading ── */
const images = new Map<EmotionId, HTMLImageElement>();
let all: Promise<void> | null = null;
export function artImage(id: EmotionId): HTMLImageElement | undefined {
  const im = images.get(id);
  return im && im.complete && im.naturalWidth ? im : undefined;
}
/** Starts loading every stone (once) and resolves when all twelve can be drawn. */
export function loadArt(): Promise<void> {
  if (!all)
    all = Promise.all(
      EMOTION_IDS.map(
        (id) =>
          new Promise<void>((res) => {
            const im = new Image();
            im.decoding = 'async';
            im.onload = im.onerror = () => res();
            im.src = ART_URL[id];
            images.set(id, im);
          }),
      ),
    ).then(() => undefined);
  return all;
}
