import { clamp } from '../core/util';
import { NEU_LABS, lex } from '../domain/lexicon';
import { DB } from '../state/store';
import { StoneMotion, type Frame } from '../stone/compose';
import { EMOTIONS, EMOTION_IDS, ID_BY_LABEL, type EmotionId } from '../stone/presets';
import type { Feeling } from '../stone/resolve';

/* ═════════════════════════ engine: the emotion stone behind the app's sculpture ═════════════════════════
   The look and motion live in src/stone (the owner's twelve stones, combined and moved in a shader); this class keeps
   the small surface the rest of the app talks to: setSpec, rippleAt, pulse, update, dominantHex. */
export const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => DB.settings.motion === 'calm' || (DB.settings.motion === 'system' && mqReduce.matches);
export const habit = () => clamp((DB.visits - 1) / 8); // motion quiets with repeated use
export const mqDark = matchMedia('(prefers-color-scheme: dark)');
export function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return mqDark.matches;
}
export const isSpectrum = () => document.documentElement.dataset.direction === 'spectrum';

/** A word's core feeling: itself, the core it refines, or (for a word of the person's own) the nearest core on the ring. */
const CORE_ANGLE = EMOTION_IDS.map((id) => [id, lex(EMOTIONS[id].label).angle] as const);
export function coreOf(key: string): EmotionId | null {
  if (ID_BY_LABEL[key]) return ID_BY_LABEL[key];
  const L = lex(key);
  if (L.parent && ID_BY_LABEL[L.parent]) return ID_BY_LABEL[L.parent];
  if (!L.custom) return null;
  let best: EmotionId | null = null,
    gap = 1e9;
  for (const [id, a] of CORE_ANGLE) {
    const d = Math.abs(((L.angle - a + 540) % 360) - 180);
    if (d < gap) ((gap = d), (best = id));
  }
  return best;
}
/** A spec (the words of an entry, a day or a pattern) as the stone's feelings: up to three distinct cores. */
export function toFeelings(spec: { items?: { key: string }[] } | null | undefined): Feeling[] {
  const ids: EmotionId[] = [];
  for (const it of spec?.items || []) {
    const id = coreOf(it.key);
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length === 3) break;
  }
  return ids.map((id) => ({ id }));
}

export class Engine {
  readonly motion = new StoneMotion();
  private key = '';
  /* kept for the screens that still set them; the stone's look comes from its art, so they have no effect */
  mod: Record<string, number> = {};
  hintMod: Record<string, number> = {};
  neuT = NEU_LABS;
  pt = [0, 0];
  ptT = [0, 0];

  setSpec(spec): void {
    this.motion.strength = spec?.intensity ?? 2;
    const f = toFeelings(spec),
      k = f.map((x) => x.id).join('|');
    if (k === this.key) return;
    this.key = k;
    this.motion.reduced = reduced();
    this.motion.set(f);
  }
  /** a word was touched: the stone answers (out = added, swells; otherwise removed, draws in a little) */
  rippleAt(_angle?: number, _key?: string, out = true): void {
    if (reduced()) return;
    this.motion.touch(out ? 1 - 0.35 * habit() : -0.55);
  }
  pulse(v = 1, _hold?: number): void {
    if (reduced()) return;
    this.motion.touch(0.6 * v);
  }
  update(dt: number): void {
    this.motion.reduced = reduced();
    this.motion.update(dt);
  }
  frame(): Frame {
    return this.motion.frame();
  }
  /** something is changing (a morph or a touch), so the stage draws every frame */
  busy(): boolean {
    return this.motion.morphing || this.motion.touching;
  }
  /** the colour of the strongest feeling, for the tab bar and the spectrum tint */
  dominantHex(): string | null {
    let best = null;
    for (const s of this.motion.frame().slots) if (s.id !== 'neutral' && (!best || s.w > best.w)) best = s;
    return best && best.w > 0.2 ? EMOTIONS[best.id as EmotionId].palette.middle : null;
  }
}
