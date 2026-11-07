import { describe, expect, it } from 'vitest';
import { CORE_KEYS } from '@daroon/shared';
import { field, masks, type V3 } from '../src/stone/field';
import { StoneMotion } from '../src/stone/motion';
import { EMOTIONS, EMOTION_IDS, ID_BY_LABEL, type EmotionId } from '../src/stone/presets';
import { silhouette } from '../src/stone/renderer';
import { allSelections, describe as describeStone, resolveState } from '../src/stone/resolve';

const sel = (ids: EmotionId[]) => ids.map((id) => ({ id }));
function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}
/** Directions spread evenly over the sphere (Fibonacci lattice). */
const dirs = (n: number): V3[] =>
  Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n,
      r = Math.sqrt(1 - y * y),
      a = i * 2.399963;
    return [Math.cos(a) * r, y, Math.sin(a) * r] as V3;
  });
/** The outer outline as a radial profile around its centre, scaled to mean 1: shape without size. */
function profile(ids: EmotionId[]): number[] {
  const m = new StoneMotion();
  m.reduced = true;
  m.snap(sel(ids));
  const fr = m.frame();
  const pts = silhouette(fr.slots, fr.g, 3, fr.yaw, 96, fr.body);
  const r = pts.map(([x, y]) => Math.hypot(x, y));
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  return r.map((x) => x / mean);
}
const rms = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);

describe('emotion stone: presets', () => {
  it('has exactly the twelve feelings the app offers', () => {
    expect(EMOTION_IDS).toHaveLength(12);
    expect(Object.keys(ID_BY_LABEL).sort()).toEqual([...CORE_KEYS].sort());
    for (const id of EMOTION_IDS) expect(EMOTIONS[id].palette.core).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('emotion stone: resolving a choice', () => {
  it('knows 12 singles, 66 pairs and 220 triples, 298 in all, each with its own target', () => {
    const all = allSelections();
    expect(all.filter((s) => s.length === 1)).toHaveLength(12);
    expect(all.filter((s) => s.length === 2)).toHaveLength(66);
    expect(all.filter((s) => s.length === 3)).toHaveLength(220);
    const seeds = new Set(all.map((ids) => resolveState(sel(ids)).seed));
    expect(seeds.size).toBe(298);
    const targets = new Set(all.map((ids) => JSON.stringify(resolveState(sel(ids)))));
    expect(targets.size).toBe(298);
  });

  it('does not care about the order feelings were chosen in', () => {
    for (const ids of allSelections().filter((s) => s.length > 1)) {
      const ref = JSON.stringify(resolveState(sel(ids)));
      for (const p of permutations(ids)) expect(JSON.stringify(resolveState(sel(p)))).toBe(ref);
    }
  });

  it('weighs feelings equally unless intensities say otherwise, and keeps weights summing to one', () => {
    expect(resolveState(sel(['anger', 'calm'])).parts.map((p) => p.weight)).toEqual([0.5, 0.5]);
    const w = resolveState([
      { id: 'joy', intensity: 1 },
      { id: 'fear', intensity: 0.25 },
    ]).parts;
    expect(w.find((p) => p.id === 'joy')!.weight).toBeCloseTo(0.8);
    expect(w.reduce((s, p) => s + p.weight, 0)).toBeCloseTo(1);
  });

  it('refuses more than three feelings and the same feeling twice', () => {
    expect(() => resolveState(sel(['joy', 'hope', 'calm', 'fear']))).toThrow();
    expect(() => resolveState(sel(['joy', 'joy']))).toThrow();
  });

  it('describes the stone in words, so colour is never the only cue', () => {
    expect(describeStone(['sadness', 'anger', 'hope'])).toBe('سنگ ترکیبی: غم، خشم، امید');
    expect(describeStone([])).toBe('سنگ آرام، هنوز بی‌نام');
  });
});

describe('emotion stone: form', () => {
  it('stays within the bounded radius everywhere, for every state and every shell', () => {
    const D = dirs(160);
    for (const ids of allSelections()) {
      const m = new StoneMotion(sel(ids));
      m.update(0.37);
      const fr = m.frame();
      for (let k = 0; k < 4; k++)
        for (const d of D) {
          const r = field(d, k, fr.slots, fr.g);
          expect(r).toBeGreaterThanOrEqual(0.72);
          expect(r).toBeLessThanOrEqual(1.27);
        }
    }
  });

  it('gives the same still for the same choice, every time', () => {
    const a = new StoneMotion(),
      b = new StoneMotion(sel(['fear']));
    b.update(3.3);
    a.snap(sel(['hope', 'anger', 'sadness']));
    b.snap(sel(['sadness', 'hope', 'anger']));
    expect(JSON.stringify(a.frame())).toBe(JSON.stringify(b.frame()));
  });

  it('gives every single feeling its own silhouette', () => {
    const P = EMOTION_IDS.map((id) => profile([id]));
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++)
        expect(rms(P[i], P[j]), `${EMOTION_IDS[i]} vs ${EMOTION_IDS[j]}`).toBeGreaterThan(0.012);
  });

  it('makes anger + sadness + hope a new shape, not any of its singles or pairs', () => {
    const tri = profile(['anger', 'sadness', 'hope']);
    const parts: EmotionId[][] = [
      ['anger'],
      ['sadness'],
      ['hope'],
      ['anger', 'sadness'],
      ['anger', 'hope'],
      ['sadness', 'hope'],
    ];
    for (const p of parts) expect(rms(tri, profile(p)), p.join('+')).toBeGreaterThan(0.012);
  });

  it('lets each feeling in a mix own a region of the surface instead of averaging everything', () => {
    const m = new StoneMotion(sel(['anger', 'calm']));
    const fr = m.frame();
    const own = [0, 0];
    for (const d of dirs(400)) {
      const mu = masks(d, fr.slots, fr.g);
      mu.forEach((x, i) => (own[i] = Math.max(own[i], x)));
    }
    expect(Math.min(...own)).toBeGreaterThan(0.85);
  });
});

describe('emotion stone: motion', () => {
  it('morphs without a jump when feelings are added, swapped and removed, even mid-morph', () => {
    const D = dirs(120);
    const m = new StoneMotion(sel(['calm']));
    m.update(2);
    const sample = () => {
      const fr = m.frame();
      return D.map((d) => field(d, 3, fr.slots, fr.g) * fr.radii[3] * fr.scale[3]);
    };
    let prev = sample(),
      worst = 0;
    const run = (secs: number) => {
      for (let t = 0; t < secs; t += 1 / 60) {
        m.update(1 / 60);
        const cur = sample();
        cur.forEach((r, i) => (worst = Math.max(worst, Math.abs(r - prev[i]))));
        prev = cur;
      }
    };
    m.set(sel(['calm', 'anger']));
    run(0.6);
    m.set(sel(['fear', 'anxiety', 'confusion']));
    run(2);
    m.set([]);
    run(2);
    expect(worst).toBeLessThan(0.02);
  });

  it('keeps the clock running across changes, and holds still when motion is reduced', () => {
    const m = new StoneMotion(sel(['joy']));
    for (let i = 0; i < 10; i++) m.update(0.1);
    m.set(sel(['joy', 'hope']));
    expect(m.clock).toBeCloseTo(1);
    const r = new StoneMotion(sel(['anxiety']));
    r.reduced = true;
    r.update(0.5);
    const a = JSON.stringify(r.frame());
    r.update(0.5);
    expect(JSON.stringify(r.frame())).toBe(a);
  });
});
