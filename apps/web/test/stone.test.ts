import { describe, expect, it } from 'vitest';
import { CORE_KEYS } from '@daroon/shared';
import { ART, OUTLINE_BINS, outlineAt } from '../src/stone/art';
import { CHOREO, movesAt, STILL } from '../src/stone/choreo';
import { outlineOf, StoneMotion } from '../src/stone/compose';
import { EMOTIONS, EMOTION_IDS, ID_BY_LABEL, type EmotionId } from '../src/stone/presets';
import { allSelections, describe as describeStone, resolveState } from '../src/stone/resolve';

const sel = (ids: EmotionId[]) => ids.map((id) => ({ id }));
function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}
/** a stone's outline as a profile scaled to mean 1: its shape without its size */
function profile(ids: EmotionId[]): number[] {
  const m = new StoneMotion();
  m.snap(sel(ids));
  const fr = m.frame();
  const r = Array.from({ length: 96 }, (_, i) => outlineOf(fr, (i / 96) * Math.PI * 2));
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  return r.map((x) => x / mean);
}
const rms = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);

describe('emotion stone: the twelve stones', () => {
  it('has exactly the twelve feelings the app offers, each with its art and outline', () => {
    expect(EMOTION_IDS).toHaveLength(12);
    expect(Object.keys(ID_BY_LABEL).sort()).toEqual([...CORE_KEYS].sort());
    for (const id of EMOTION_IDS) {
      expect(ART[id].outline).toHaveLength(OUTLINE_BINS);
      expect(Math.min(...ART[id].outline)).toBeGreaterThan(0.3);
      expect(Math.max(...ART[id].outline)).toBeLessThan(Math.SQRT2);
      expect(Math.hypot(...ART[id].center)).toBeLessThan(0.3);
    }
  });

  it('gives every single stone its own outline', () => {
    const P = EMOTION_IDS.map((id) => profile([id]));
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++)
        expect(rms(P[i], P[j]), `${EMOTION_IDS[i]} vs ${EMOTION_IDS[j]}`).toBeGreaterThan(0.02);
  });

  it('draws a single feeling exactly as designed: its own outline, untouched art, nothing moving in the still', () => {
    for (const id of EMOTION_IDS) {
      const m = new StoneMotion();
      m.snap(sel([id]));
      const fr = m.frame();
      expect(fr.slots).toHaveLength(1);
      expect(fr.slots[0]).toMatchObject({ art: id, w: 1, turn: 0, desat: 0, moves: STILL });
      for (let i = 0; i < 16; i++) expect(outlineOf(fr, i * 0.4)).toBeCloseTo(outlineAt(id, i * 0.4), 6);
    }
  });
});

describe('emotion stone: resolving a choice', () => {
  it('knows 12 singles, 66 pairs and 220 triples, 298 in all, each with its own target', () => {
    const all = allSelections();
    expect(all.filter((s) => s.length === 1)).toHaveLength(12);
    expect(all.filter((s) => s.length === 2)).toHaveLength(66);
    expect(all.filter((s) => s.length === 3)).toHaveLength(220);
    expect(new Set(all.map((ids) => resolveState(sel(ids)).seed)).size).toBe(298);
    expect(new Set(all.map((ids) => JSON.stringify(resolveState(sel(ids))))).size).toBe(298);
  });

  it('does not care about the order feelings were chosen in', () => {
    for (const ids of allSelections().filter((s) => s.length > 1)) {
      const ref = JSON.stringify(resolveState(sel(ids)));
      for (const p of permutations(ids)) expect(JSON.stringify(resolveState(sel(p)))).toBe(ref);
    }
  });

  it('puts the heaviest feeling outside and the lightest at the core', () => {
    const band = (ids: EmotionId[], id: EmotionId) => resolveState(sel(ids)).parts.find((p) => p.id === id)!.band;
    const tri: EmotionId[] = ['anger', 'sadness', 'hope'];
    expect(band(tri, 'sadness')).toBeGreaterThan(band(tri, 'anger'));
    expect(band(tri, 'anger')).toBeGreaterThan(band(tri, 'hope'));
    expect(band(['calm', 'joy'], 'calm')).toBeGreaterThan(band(['calm', 'joy'], 'joy'));
    for (const ids of allSelections()) {
      const parts = resolveState(sel(ids)).parts;
      const byUplift = [...parts].sort((a, b) => EMOTIONS[a.id].shape.uplift - EMOTIONS[b.id].shape.uplift);
      for (let i = 1; i < byUplift.length; i++) expect(byUplift[i].band).toBeLessThanOrEqual(byUplift[i - 1].band);
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

describe('emotion stone: combinations', () => {
  it('makes anger + sadness + hope a new outline, not any of its singles or pairs', () => {
    const tri = profile(['anger', 'sadness', 'hope']);
    const parts: EmotionId[][] = [
      ['anger'],
      ['sadness'],
      ['hope'],
      ['anger', 'sadness'],
      ['anger', 'hope'],
      ['sadness', 'hope'],
    ];
    for (const p of parts) expect(rms(tri, profile(p)), p.join('+')).toBeGreaterThan(0.01);
  });

  it('keeps the points of a pointed stone in a mix instead of averaging them away', () => {
    /* the soft maximum never falls below the plain average, and reaches out to the larger outline */
    for (const ids of allSelections().filter((s) => s.length > 1)) {
      const m = new StoneMotion();
      m.snap(sel(ids));
      const fr = m.frame();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const avg = fr.slots.reduce((s, sl) => s + sl.w * outlineAt(sl.art, a - sl.turn), 0);
        expect(outlineOf(fr, a)).toBeGreaterThanOrEqual(avg - 1e-9);
      }
    }
  });
});

describe('emotion stone: motion', () => {
  it('morphs without a jump when feelings are added, swapped and removed, even mid-morph', () => {
    const m = new StoneMotion(sel(['calm']));
    m.update(0.1);
    let prev = m.frame(),
      worst = 0;
    const run = (secs: number) => {
      for (let t = 0; t < secs; t += 1 / 60) {
        m.update(1 / 60);
        const cur = m.frame();
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          worst = Math.max(worst, Math.abs(outlineOf(cur, a) - outlineOf(prev, a)));
        }
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

  it('keeps every movement small and starts every stone from its designed pose', () => {
    for (const id of [...EMOTION_IDS, 'neutral' as const]) {
      for (let t = 0; t < 20; t += 0.05) {
        const m = movesAt(id, t);
        expect(Math.abs(m.scale) + Math.abs(m.inner)).toBeLessThan(0.08);
        expect(Math.abs(m.swirl) + Math.abs(m.counter)).toBeLessThan(0.2);
        expect(Math.abs(m.rise) + Math.abs(m.sway) + Math.abs(m.ripple) + Math.abs(m.tremor)).toBeLessThan(0.06);
        expect(Math.abs(m.glow)).toBeLessThan(0.3);
      }
      const at0 = CHOREO[id](0);
      for (const k of ['scale', 'inner', 'swirl', 'counter', 'rise', 'glow'] as const)
        expect(at0[k] ?? 0).toBeCloseTo(0, 9);
    }
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

  it('gives the same still for the same choice, every time', () => {
    const a = new StoneMotion(),
      b = new StoneMotion(sel(['fear']));
    b.update(3.3);
    a.snap(sel(['hope', 'anger', 'sadness']));
    b.snap(sel(['sadness', 'hope', 'anger']));
    expect(JSON.stringify(a.frame())).toBe(JSON.stringify(b.frame()));
  });
});
