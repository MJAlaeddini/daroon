/* From a choice of feelings to the stone's target: which feelings, how much of each, and where each one lives on the
 * surface. Everything here depends only on the unordered set (and optional intensities), so the same choice always
 * resolves to the same stone, on any device and after any reload. */
import { EMOTIONS, EMOTION_IDS, type EmotionId } from './presets';

export interface Feeling {
  id: EmotionId;
  /** 0..1; when absent every chosen feeling weighs the same */
  intensity?: number;
}
export type Vec3 = [number, number, number];

/** What one feeling contributes to a resolved stone. */
export interface Part {
  id: EmotionId;
  weight: number;
  /** centre of the feeling's region on the surface (unit vector, y up, +z toward the viewer) */
  anchor: Vec3;
  /** phase of the feeling's lobes, radians */
  phase: number;
}
export interface ResolvedState {
  ordered: EmotionId[];
  parts: Part[];
  seed: number;
  /** domain shift of the shared base noise, so every combination gets its own underlying grain */
  offset: Vec3;
  /** the pose the stone turns toward, radians around the vertical */
  yaw: number;
  /** mean intensity, 0..1 (1 when none is given) */
  energy: number;
  /** how strongly the chosen feelings pull against each other, 0..1 */
  tension: number;
}

export const MAX_FEELINGS = 3;

/** FNV-1a, 32 bit. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
/** mulberry32: a small deterministic generator, the same everywhere. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

export function resolveState(selected: Feeling[]): ResolvedState {
  if (selected.length > MAX_FEELINGS) throw new Error(`choose at most ${MAX_FEELINGS} feelings`);
  const ids = selected.map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw new Error('a feeling was chosen twice');
  for (const id of ids) if (!EMOTIONS[id]) throw new Error(`unknown feeling: ${id}`);
  const ordered = [...selected].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const key = ordered.map((x) => x.id).join('|');
  const seed = stableHash(key);
  const r = rng(seed);
  const raw = ordered.map((x) => clamp01(x.intensity ?? 1));
  const sum = raw.reduce((a, b) => a + b, 0);
  const weights = sum > 0 ? raw.map((x) => x / sum) : raw.map(() => 1 / raw.length);
  const n = ordered.length;
  /* Regions face the viewer and share the circle around the stone; a feeling that lifts (hope, joy) takes the upper
     part and a heavy one (sadness, hurt) the lower part, so a mix reads as one figure: a heavy envelope with light
     rising out of it, not three patches in arbitrary places. */
  const base = r() * Math.PI * 2;
  const parts: Part[] = ordered.map((f, j) => {
    const e = EMOTIONS[f.id];
    const a = base + (j * Math.PI * 2) / Math.max(n, 1) + (r() - 0.5) * 0.5;
    const lift = e.shape.uplift * 1.25;
    return {
      id: f.id,
      weight: weights[j],
      anchor: norm([Math.cos(a), Math.sin(a) * 0.7 + lift, 0.55]),
      phase: r() * Math.PI * 2,
    };
  });
  /* kept small: the grain is shifted, not replaced, so a morph between two choices never churns through it */
  const offset: Vec3 = [r() * 2.4 - 1.2, r() * 2.4 - 1.2, r() * 2.4 - 1.2];
  const yaw = (r() - 0.5) * 1.1;
  let tension = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const a = EMOTIONS[ordered[i].id].shape,
        b = EMOTIONS[ordered[j].id].shape;
      tension +=
        weights[i] *
        weights[j] *
        4 *
        (0.5 * Math.abs(a.uplift - b.uplift) +
          Math.abs(a.sharpness - b.sharpness) +
          0.5 * Math.abs(a.turbulence - b.turbulence));
    }
  const energy = n ? raw.reduce((a, b) => a + b, 0) / n : 0;
  return { ordered: ordered.map((x) => x.id), parts, seed, offset, yaw, energy, tension: clamp01(tension) };
}

/** Every distinct choice of one, two or three feelings: 12 + 66 + 220 = 298. */
export function allSelections(): EmotionId[][] {
  const out: EmotionId[][] = [];
  const ids = [...EMOTION_IDS];
  for (let i = 0; i < ids.length; i++) {
    out.push([ids[i]]);
    for (let j = i + 1; j < ids.length; j++) {
      out.push([ids[i], ids[j]]);
      for (let k = j + 1; k < ids.length; k++) out.push([ids[i], ids[j], ids[k]]);
    }
  }
  return out;
}

/** «سنگ ترکیبی: غم، خشم، امید» — the stone described in words, so nothing depends on colour alone. */
export function describe(ids: EmotionId[]): string {
  if (!ids.length) return 'سنگ آرام، هنوز بی‌نام';
  const names = ids.map((id) => EMOTIONS[id].label).join('، ');
  return ids.length === 1 ? `سنگ ${names}` : `سنگ ترکیبی: ${names}`;
}
