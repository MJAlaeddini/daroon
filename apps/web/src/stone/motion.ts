/* The stone over time: weights morph from the current choice to the next, and the clocks of breath, pulse, drift and
 * tremor keep running so the stone is one living thing that never restarts.
 *
 * Every feeling (plus the resting "neutral" stone) has a track: its weight, its region's anchor and its lobe phase.
 * A new choice starts a 1.3 s smoothstep from wherever the tracks are now to the resolved targets, so a change in the
 * middle of a change is still seamless. Frequencies are mixed from the current weights and integrated into phases,
 * so a slower or faster breath never jumps. */
import { hexToOklab, type Lab } from './color';
import type { FieldGlobals, SlotFrame, V3 } from './field';
import { EMOTIONS, EMOTION_IDS, NEUTRAL, RENDERER, type Emotion } from './presets';
import { resolveState, type Feeling, type ResolvedState } from './resolve';

const ALL: Emotion[] = [...EMOTION_IDS.map((id) => EMOTIONS[id]), NEUTRAL];
const NEUTRAL_I = ALL.length - 1;
const LABS: Lab[][] = ALL.map((e) => [
  hexToOklab(e.palette.outer),
  hexToOklab(e.palette.middle),
  hexToOklab(e.palette.core),
]);
/** at most this many feelings are drawn at once (three leaving while three arrive) */
export const MAX_SLOTS = 6;

interface Track {
  w: number;
  anchor: V3;
  phase: number;
}
interface Globals {
  offset: V3;
  yaw: number;
  energy: number;
  tension: number;
}
export interface Frame {
  slots: SlotFrame[];
  /** OKLab outer, middle and core of each slot */
  labs: Lab[][];
  g: FieldGlobals;
  /** base radius of each shell (nesting applied) */
  radii: number[];
  /** breathing, pulse and recoil of each shell this frame */
  scale: number[];
  /** each shell's offset from the centre: inner layers rise with lifting feelings and sink with heavy ones */
  shift: V3[];
  /** the body's proportions as a symmetric 3×3 matrix (column-major) and its inverse for normals */
  body: number[];
  bodyN: number[];
  yaw: number;
  glow: number;
  /** a weighted core colour for the soft light behind the stone */
  haloLab: Lab;
}

const smoothstep = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;
const wrapPi = (a: number) => a - TAU * Math.round(a / TAU);
const nlerp = (a: V3, b: V3, t: number): V3 => {
  const v: V3 = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
function inverse3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h,
    B = -(d * i - f * g),
    C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
}
const copyTrack = (t: Track): Track => ({ w: t.w, anchor: [...t.anchor] as V3, phase: t.phase });

export class StoneMotion {
  /** stillness for people who ask for less motion: no oscillation, a shorter morph */
  reduced = false;
  /** seconds since the stone was born; never reset */
  clock = 0;
  state: ResolvedState;
  private cur: Track[];
  private from: Track[];
  private to: Track[];
  private gCur: Globals;
  private gFrom: Globals;
  private gTo: Globals;
  private t0 = -10;
  private dur = RENDERER.motionTransitionSeconds;
  private breath = 0;
  private pulse = 0;
  private tremT = 0;
  private risePh = 0;
  private wavePh = 0;
  private drift: number[] = ALL.map(() => 0);
  private touchDir: V3 = [0, 0, 1];
  private touchAge = 9;
  private touch = 0;

  constructor(initial: Feeling[] = []) {
    this.state = resolveState(initial);
    this.to = this.targets(this.state);
    this.cur = this.to.map(copyTrack);
    this.from = this.to.map(copyTrack);
    this.gTo = this.globals(this.state);
    this.gCur = { ...this.gTo };
    this.gFrom = { ...this.gTo };
  }

  private targets(s: ResolvedState): Track[] {
    const t: Track[] = ALL.map(() => ({ w: 0, anchor: [0, 0.3, 1] as V3, phase: 0 }));
    if (!s.parts.length) t[NEUTRAL_I] = { w: 1, anchor: [0, 0.3, 0.95], phase: 0.6 };
    for (const p of s.parts) t[EMOTION_IDS.indexOf(p.id)] = { w: p.weight, anchor: p.anchor, phase: p.phase };
    return t;
  }
  private globals(s: ResolvedState): Globals {
    return {
      offset: s.parts.length ? s.offset : [0.4, -0.6, 0.3],
      yaw: s.yaw,
      energy: s.parts.length ? s.energy : 1,
      tension: s.tension,
    };
  }

  /** Choose feelings (1..3, or none for the resting stone). `touch` is the direction the press came from. */
  set(feelings: Feeling[], touch?: V3): void {
    const next = resolveState(feelings);
    const prevIds = new Set(this.state.ordered);
    this.state = next;
    this.from = this.cur.map(copyTrack);
    this.gFrom = { ...this.gCur, offset: [...this.gCur.offset] as V3 };
    this.to = this.targets(next);
    /* a feeling that leaves keeps its place while it fades; one that arrives grows in its own place */
    this.to.forEach((t, i) => {
      if (t.w === 0) {
        t.anchor = [...this.cur[i].anchor] as V3;
        t.phase = this.cur[i].phase;
      } else if (this.cur[i].w < 1e-3) {
        this.from[i].anchor = [...t.anchor] as V3;
        this.from[i].phase = t.phase;
      }
    });
    this.gTo = this.globals(next);
    this.t0 = this.clock;
    this.dur = this.reduced ? 0.6 : RENDERER.motionTransitionSeconds;
    const added = next.parts.find((p) => !prevIds.has(p.id));
    this.touchDir = touch ?? added?.anchor ?? [0, 0.2, 1];
    this.touchAge = 0;
    this.touch = this.reduced ? 0 : 1;
  }

  /** Jump straight to a choice, with every clock at zero: the canonical still of that stone. */
  snap(feelings: Feeling[]): void {
    this.state = resolveState(feelings);
    this.to = this.targets(this.state);
    this.cur = this.to.map(copyTrack);
    this.from = this.to.map(copyTrack);
    this.gTo = this.globals(this.state);
    this.gCur = { ...this.gTo };
    this.gFrom = { ...this.gTo };
    this.clock = 0;
    this.t0 = -10;
    this.breath = this.pulse = this.tremT = this.risePh = this.wavePh = 0;
    this.drift = ALL.map(() => 0);
    this.touch = 0;
    this.touchAge = 9;
  }

  get morphing(): boolean {
    return this.clock - this.t0 < this.dur;
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    const p = smoothstep((this.clock - this.t0) / this.dur);
    this.cur.forEach((c, i) => {
      const a = this.from[i],
        b = this.to[i];
      c.w = lerp(a.w, b.w, p);
      c.anchor = nlerp(a.anchor, b.anchor, p);
      c.phase = a.phase + wrapPi(b.phase - a.phase) * p;
    });
    const gA = this.gFrom,
      gB = this.gTo;
    this.gCur = {
      offset: [
        lerp(gA.offset[0], gB.offset[0], p),
        lerp(gA.offset[1], gB.offset[1], p),
        lerp(gA.offset[2], gB.offset[2], p),
      ],
      yaw: gA.yaw + wrapPi(gB.yaw - gA.yaw) * p,
      energy: lerp(gA.energy, gB.energy, p),
      tension: lerp(gA.tension, gB.tension, p),
    };
    if (this.reduced) return;
    let bHz = 0,
      pHz = 0,
      tr = 0;
    this.cur.forEach((c, i) => {
      const m = ALL[i].motion;
      bHz += c.w * m.breathHz;
      pHz += c.w * m.pulseHz;
      tr += c.w * m.tremor;
      this.drift[i] += dt * m.drift * 2.2;
    });
    this.breath += TAU * bHz * dt;
    this.pulse += TAU * pHz * dt;
    this.tremT += dt * (1.2 + 7 * tr);
    this.risePh += dt * 1.1;
    this.wavePh += dt * 0.55;
    this.touchAge += dt;
    if (this.touchAge > 2) this.touch = 0;
  }

  frame(): Frame {
    const mf = this.reduced ? 0 : 0.7 + 0.3 * this.gCur.energy;
    const live = this.cur
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c.w > 1e-4)
      .sort((a, b) => b.c.w - a.c.w)
      .slice(0, MAX_SLOTS)
      .sort((a, b) => a.i - b.i);
    const wsum = live.reduce((s, x) => s + x.c.w, 0) || 1;
    const sb = Math.sin(this.breath);
    const body = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    let nest = 0,
      lift = 0,
      pulseAmp = 0,
      recoil = 0,
      glow = 0;
    const halo: Lab = [0, 0, 0];
    const slots: SlotFrame[] = live.map(({ c, i }) => {
      const e = ALL[i],
        w = c.w / wsum,
        sh = e.shape,
        sc = e.sculpt,
        d = this.drift[i];
      nest += w * sc.nest;
      lift += w * sh.uplift;
      const ax = Math.sin(sc.tilt),
        ay = Math.cos(sc.tilt),
        st = 0.22 * sc.elong;
      const m = [
        1 + sc.wide + st * ax * ax,
        st * ax * ay,
        0,
        st * ax * ay,
        1 + sc.tall + st * ay * ay,
        0,
        0,
        0,
        1 + 0.6 * sc.wide,
      ];
      for (let j = 0; j < 9; j++) body[j] += w * m[j];
      pulseAmp += w * (0.006 + 0.022 * sc.pulse + 0.1 * e.glow);
      recoil += w * sc.recoil;
      glow += w * e.glow;
      for (let j = 0; j < 3; j++) halo[j] += w * LABS[i][2][j];
      return {
        w,
        lobes: sh.lobes,
        asym: sh.asymmetry,
        sharpK: 0.15 + 0.8 * sh.sharpness,
        uplift: sh.uplift,
        compression: sh.compression,
        turb: sh.turbulence,
        tremor: mf * e.motion.tremor * 0.045,
        anchor: c.anchor,
        phase: c.phase + d,
        elong: sc.elong,
        tilt: sc.tilt,
        cavity: sc.cavity,
        twist: sc.twist,
        counter: sc.counter * (0.35 + 0.9 * mf * Math.sin(d * 0.9 + 1)),
        flat: sc.flat,
        fold: sc.fold,
        open: sc.open,
        petal: sc.petal,
        ripple: sc.ripple,
        rise: sc.rise * mf,
        risePh: this.risePh,
        wave: sc.wave * mf,
        wavePh: this.wavePh,
        settle: sc.settle * (0.6 + 0.4 * mf * sb),
        flow: d * 0.8,
      };
    });
    const u = this.clock % 3.6;
    const env = u < 0.07 ? smoothstep(u / 0.07) : Math.exp(-(u - 0.07) / 0.35);
    const radii = RENDERER.radii.map((r) => lerp(r, 0.88, 0.34 * nest * (0.85 + 0.15 * mf * sb)));
    const scale = radii.map((_, k) => {
      const b = 1 + mf * 0.02 * Math.sin(this.breath - 0.55 * k);
      const pu = 1 + mf * pulseAmp * (0.5 + 0.5 * Math.sin(this.pulse - 1.1 * k)) ** 4;
      return b * pu * (1 - mf * 0.03 * recoil * env);
    });
    const side = 0.5 * Math.sin(this.gCur.offset[0]);
    const shift = radii.map((_, k): V3 => {
      const d = (3 - k) / 3;
      return [d * 0.05 * side, d * 0.09 * lift, d * 0.02];
    });
    return {
      slots,
      shift,
      body,
      bodyN: inverse3(body),
      labs: live.map(({ i }) => LABS[i]),
      g: {
        offset: this.gCur.offset,
        tension: this.gCur.tension,
        touchDir: this.touchDir,
        touchAge: this.touchAge,
        touch: this.touch,
        tremT: this.tremT,
      },
      radii,
      scale,
      yaw: this.gCur.yaw + mf * 0.12 * Math.sin(this.clock * 0.11),
      glow,
      haloLab: halo,
    };
  }
}
