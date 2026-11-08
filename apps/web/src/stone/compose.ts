/* The stone over time. Every feeling (and the resting stone) has a track: its weight, its layer (core to envelope)
 * and its turn. A new choice eases every track from where it is to its target over 1.3 s (smoothstep), so a change in
 * the middle of a change is still seamless; the clock never restarts, so each stone keeps moving as it was. */
import { ART, artImage, outlineAt } from './art';
import { movesAt, STILL, type Moves } from './choreo';
import { EMOTION_IDS, RENDERER, type EmotionId } from './presets';
import { resolveState, type Feeling, type ResolvedState } from './resolve';

export type StoneId = EmotionId | 'neutral';
const ALL: StoneId[] = [...EMOTION_IDS, 'neutral'];
const NEUTRAL_I = ALL.length - 1;
/** at most this many stones are drawn at once (three leaving while three arrive) */
export const MAX_SLOTS = 6;

export interface Slot {
  id: StoneId;
  /** the art this slot draws (the resting stone borrows calm's, quietened) */
  art: EmotionId;
  /** row of its outline in the outline texture */
  row: number;
  w: number;
  band: number;
  turn: number;
  center: [number, number];
  /** 0 = its own colours, 1 = grey */
  desat: number;
  moves: Moves;
}
export interface Frame {
  slots: Slot[];
  wobble: number;
}

interface Track {
  w: number;
  band: number;
  turn: number;
}
const smoothstep = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;
const wrapPi = (a: number) => a - TAU * Math.round(a / TAU);

export class StoneMotion {
  /** stillness for people who ask for less motion: no movement, a shorter morph */
  reduced = false;
  /** seconds since the stone was born; never reset */
  clock = 0;
  state: ResolvedState;
  private cur: Track[];
  private from: Track[];
  private to: Track[];
  private wob = { cur: 0, from: 0, to: 0 };
  private t0 = -10;
  private dur = RENDERER.motionTransitionSeconds;
  private touchAt = -10;
  private touchV = 0;

  constructor(initial: Feeling[] = []) {
    this.state = resolveState(initial);
    this.to = this.targets(this.state);
    this.cur = this.to.map((t) => ({ ...t }));
    this.from = this.to.map((t) => ({ ...t }));
    this.wob = { cur: this.state.wobble, from: this.state.wobble, to: this.state.wobble };
  }

  private targets(s: ResolvedState): Track[] {
    const t: Track[] = ALL.map(() => ({ w: 0, band: 0.5, turn: 0 }));
    if (!s.parts.length) t[NEUTRAL_I] = { w: 1, band: 0.5, turn: 0 };
    for (const p of s.parts) t[ALL.indexOf(p.id)] = { w: p.weight, band: p.band, turn: p.turn };
    return t;
  }

  /** Choose feelings (0..3; none is the resting stone). */
  set(feelings: Feeling[]): void {
    this.state = resolveState(feelings);
    this.from = this.cur.map((t) => ({ ...t }));
    this.to = this.targets(this.state);
    /* a stone that leaves keeps its place while it fades; one that arrives grows in its own place */
    this.to.forEach((t, i) => {
      if (t.w === 0) {
        t.band = this.cur[i].band;
        t.turn = this.cur[i].turn;
      } else if (this.cur[i].w < 1e-3) {
        this.from[i].band = t.band;
        this.from[i].turn = t.turn;
      }
    });
    this.wob.from = this.wob.cur;
    this.wob.to = this.state.wobble;
    this.t0 = this.clock;
    this.dur = this.reduced ? 0.6 : RENDERER.motionTransitionSeconds;
  }

  /** A touch: the stone swells a little and its light lifts, then settles (negative draws it in, for a removal). */
  touch(v = 1): void {
    if (this.reduced) return;
    this.touchAt = this.clock;
    this.touchV = v;
  }
  /** whether a touch is still settling */
  get touching(): boolean {
    return this.clock - this.touchAt < 1.4;
  }

  /** Jump straight to a choice, clock at zero and nothing moving: the canonical still of that stone. */
  snap(feelings: Feeling[]): void {
    this.state = resolveState(feelings);
    this.to = this.targets(this.state);
    this.cur = this.to.map((t) => ({ ...t }));
    this.from = this.to.map((t) => ({ ...t }));
    this.wob = { cur: this.state.wobble, from: this.state.wobble, to: this.state.wobble };
    this.clock = 0;
    this.t0 = -10;
    this.touchAt = -10;
  }

  get morphing(): boolean {
    return this.clock - this.t0 < this.dur;
  }

  update(dt: number): void {
    this.clock += Math.min(dt, 0.1);
    const p = smoothstep((this.clock - this.t0) / this.dur);
    this.cur.forEach((c, i) => {
      const a = this.from[i],
        b = this.to[i];
      c.w = lerp(a.w, b.w, p);
      c.band = lerp(a.band, b.band, p);
      c.turn = a.turn + wrapPi(b.turn - a.turn) * p;
    });
    this.wob.cur = this.wob.from + wrapPi(this.wob.to - this.wob.from) * p;
  }

  frame(): Frame {
    const live = this.cur
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c.w > 1e-3)
      .sort((a, b) => b.c.w - a.c.w)
      .slice(0, MAX_SLOTS)
      .sort((a, b) => a.i - b.i);
    const sum = live.reduce((s, x) => s + x.c.w, 0) || 1;
    const still = this.reduced || this.clock === 0;
    const age = this.clock - this.touchAt;
    const env =
      this.touching && !still
        ? this.touchV * (age < 0.12 ? smoothstep(age / 0.12) : Math.exp(-(age - 0.12) / 0.35))
        : 0;
    const movesOf = (id: StoneId): Moves => {
      if (still) return STILL;
      const m = movesAt(id, this.clock);
      if (env) {
        m.scale += 0.022 * env;
        m.glow += 0.16 * env;
      }
      return m;
    };
    return {
      wobble: this.wob.cur,
      slots: live.map(({ c, i }) => {
        const id = ALL[i],
          art: EmotionId = id === 'neutral' ? 'calm' : id;
        return {
          id,
          art,
          row: i,
          w: c.w / sum,
          band: c.band,
          turn: c.turn,
          center: ART[art].center,
          desat: id === 'neutral' ? 0.45 : 0,
          moves: movesOf(id),
        };
      }),
    };
  }

  /** whether every stone this frame needs has its art loaded */
  ready(): boolean {
    return this.frame().slots.every((s) => !!artImage(s.art));
  }
}

/** The outline of a frame at angle `a`: the soft maximum of its stones' outlines, as the shader computes it. */
export function outlineOf(frame: Frame, a: number): number {
  let s = 0;
  for (const sl of frame.slots) s += sl.w * outlineAt(sl.art, a - sl.turn) ** 3;
  return Math.cbrt(Math.max(s, 1e-6));
}
