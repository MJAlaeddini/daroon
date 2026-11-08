/* From a choice of feelings to the stone's target: which feelings, how much of each, and how they sit together.
 * Everything here depends only on the unordered set (and optional intensities), so the same choice always resolves
 * to the same stone, on any device and after any reload.
 *
 * A mix is built like the brief's examples ("a heavy blue envelope, a crimson fold inside, an amber core"): the
 * heaviest feeling (lowest uplift) forms the outer envelope, the lightest the core, and each is turned a little so
 * the combination gets a pose of its own. */
import { EMOTIONS, EMOTION_IDS, type EmotionId } from './presets';

export interface Feeling {
  id: EmotionId;
  /** 0..1; when absent every chosen feeling weighs the same */
  intensity?: number;
}

/** What one feeling contributes to a resolved stone. */
export interface Part {
  id: EmotionId;
  weight: number;
  /** where its layer sits, from the core (0) to the envelope (1) */
  band: number;
  /** how far its art is turned in this combination, radians (0 for a single feeling) */
  turn: number;
}
export interface ResolvedState {
  ordered: EmotionId[];
  parts: Part[];
  seed: number;
  /** phase of the gentle waviness of the boundaries between layers */
  wobble: number;
  /** mean intensity, 0..1 (1 when none is given) */
  energy: number;
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
  /* heavy to light: the envelope first, the core last */
  const byWeight = [...ordered].sort(
    (a, b) => EMOTIONS[a.id].shape.uplift - EMOTIONS[b.id].shape.uplift || (a.id < b.id ? -1 : 1),
  );
  const BANDS = [[0.5], [0.95, 0.12], [1, 0.55, 0.08]][Math.max(0, n - 1)];
  const parts: Part[] = ordered.map((f, j) => ({
    id: f.id,
    weight: weights[j],
    band: BANDS[byWeight.indexOf(f)],
    turn: n === 1 ? 0 : (r() - 0.5) * 0.7,
  }));
  const wobble = r() * Math.PI * 2;
  const energy = n ? raw.reduce((a, b) => a + b, 0) / n : 0;
  return { ordered: ordered.map((x) => x.id), parts, seed, wobble, energy };
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
