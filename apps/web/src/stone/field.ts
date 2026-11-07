/* The stone's shape: one radial field over the unit sphere, shared by every shell.
 *
 *   R(n) = R0 · softclamp(1 + Nbase(n) + Σ (mixG_i·G_i(n) + mixL_i·L_i(n)) + Fcross(n), 0.72, 1.27)
 *
 * G_i is a feeling's broad silhouette (rising, drooping, flattening, stretching, a hollow, an opening) and L_i its
 * surface character (lobes, folds, ripples, turbulence, tremor). Both are weighed partly by the plain weight w_i and
 * partly by a soft spatial mask μ_i, so in a mix each feeling keeps its own features at full strength in its own
 * region instead of every feature being averaged into a bland blob (the brief's "soft-max" rule).
 *
 * This file is the readable reference. The vertex shader in glsl.ts is a line-by-line port of it; keep the two in
 * step. The CPU version draws the Canvas 2D fallback and lets tests check silhouettes without a GPU. */

export type V3 = [number, number, number];

/** Everything one feeling contributes this frame (weights and motion already applied). */
export interface SlotFrame {
  w: number;
  lobes: number;
  asym: number;
  /** ridge sharpening 0.15..0.95 (from sharpness) */
  sharpK: number;
  uplift: number;
  compression: number;
  turb: number;
  /** tremor amplitude this frame (0 when motion is reduced) */
  tremor: number;
  anchor: V3;
  /** lobe phase: the set's phase plus the feeling's drift so far */
  phase: number;
  elong: number;
  tilt: number;
  cavity: number;
  twist: number;
  /** counter-current displacement this frame (oscillates, bounded) */
  counter: number;
  flat: number;
  fold: number;
  open: number;
  petal: number;
  ripple: number;
  /** travelling-wave amplitudes and phases this frame */
  rise: number;
  risePh: number;
  wave: number;
  wavePh: number;
  settle: number;
  /** slow flow of noise-based features */
  flow: number;
}
export interface FieldGlobals {
  offset: V3;
  tension: number;
  /** touch ripple: where (unit vector), how long ago (s), how strong (0..1) */
  touchDir: V3;
  touchAge: number;
  touch: number;
  tremT: number;
}

export const SHELL_AMP = [0.42, 0.85, 1, 1.12];
export const SHELL_PHASE = [0, 0.37, 0.74, 1.11];
export const MASK_K = 3.2;
/** Each shell reads the surface features through its own small turn, so the layers interleave instead of nesting
    as scaled copies of one another. */
export const SHELL_TURN = [0, 0.45, -0.35, 0.7];
const TURN_AXIS: V3 = [0.57, 0.7, 0.43];
export function turn(n: V3, k: number): V3 {
  const a = SHELL_TURN[k];
  if (!a) return n;
  const [ux, uy, uz] = norm3(TURN_AXIS);
  const c = Math.cos(a),
    s = Math.sin(a),
    d = (ux * n[0] + uy * n[1] + uz * n[2]) * (1 - c);
  return [
    n[0] * c + (uy * n[2] - uz * n[1]) * s + ux * d,
    n[1] * c + (uz * n[0] - ux * n[2]) * s + uy * d,
    n[2] * c + (ux * n[1] - uy * n[0]) * s + uz * d,
  ];
}

/* A smooth, cheap trigonometric noise: identical in TypeScript and GLSL, so CPU and GPU agree exactly. */
export function tn(x: number, y: number, z: number): number {
  return (
    Math.sin(x + 1.3 * Math.sin(y * 1.17 + 0.5)) *
    Math.sin(y * 1.07 + 1.3 * Math.sin(z * 1.31 + 1.7)) *
    Math.sin(z * 0.93 + 1.3 * Math.sin(x * 1.23 + 2.9))
  );
}
export const fbm = (x: number, y: number, z: number) =>
  tn(x, y, z) + 0.5 * tn(x * 2.03 + 7.1, y * 2.03 + 1.3, z * 2.03 + 4.7);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const softclamp = (x: number) => 0.995 + 0.275 * Math.tanh((x - 0.995) / 0.275);

/** Unnormalised mask weights: each feeling owns a soft, flowing region around its anchor. */
export function masks(n: V3, slots: SlotFrame[], g: FieldGlobals): number[] {
  const o = g.offset;
  const p0 = n[0] * 1.9 + o[0],
    p1 = n[1] * 1.9 + o[1],
    p2 = n[2] * 1.9 + o[2];
  let wx = n[0] + 0.45 * tn(p0, p1, p2),
    wy = n[1] + 0.45 * tn(p0 + 3.1, p1 + 3.1, p2 + 3.1),
    wz = n[2] + 0.45 * tn(p0 + 6.2, p1 + 6.2, p2 + 6.2);
  const l = Math.hypot(wx, wy, wz) || 1;
  wx /= l;
  wy /= l;
  wz /= l;
  const m = slots.map((s) => s.w * Math.exp(MASK_K * (wx * s.anchor[0] + wy * s.anchor[1] + wz * s.anchor[2] - 1)));
  const sum = m.reduce((a, b) => a + b, 0) || 1;
  /* A feeling with little weight (arriving or leaving) owns no region yet: it blends in evenly, and its region grows
     out of the surface as its weight passes ~0.15. Without this, a fading feeling would hold its whole region until
     the moment it is dropped. */
  const mu = m.map((x, i) => {
    const q = smooth(0, 0.15, slots[i].w);
    return q * (x / sum) + (1 - q) * slots[i].w;
  });
  const t = mu.reduce((a, b) => a + b, 0) || 1;
  return mu.map((x) => x / t);
}

/** A feeling's broad silhouette. */
export function globalPart(n: V3, s: SlotFrame): number {
  const [x, y, z] = n;
  const r = Math.sqrt(Math.max(1e-6, 1 - y * y));
  const U = s.uplift,
    aU = Math.abs(U),
    sU = U >= 0 ? 1 : -1;
  let G = 0.26 * aU * Math.exp(-((y - 0.62 * sU) ** 2) / 0.2) - 0.06 * aU;
  G -= 0.08 * Math.max(0, -U) * smooth(0.3, 1, y);
  G -= s.compression * (0.2 * Math.exp(-((y + 0.3) ** 2) / 0.1) * r + 0.04);
  G += s.flat * (0.09 * r * r - 0.17 * y * y);
  const ax = Math.sin(s.tilt),
    ay = Math.cos(s.tilt);
  const d = x * ax + y * ay;
  G += s.elong * (0.26 * d * d - 0.09);
  if (s.cavity > 0) {
    const c = norm3([0.6 * s.anchor[0], 0.15 + 0.3 * s.anchor[1], 1]);
    const c2 = norm3([c[0] + 0.3, c[1] + 0.12, c[2]]);
    const d1 = 1 - (x * c[0] + y * c[1] + z * c[2]),
      d2 = 1 - (x * c2[0] + y * c2[1] + z * c2[2]);
    G -= s.cavity * 0.32 * Math.exp(-d1 / 0.22) * (1 - 0.85 * Math.exp(-d2 / 0.07));
  }
  G += s.open * (0.07 * Math.exp(-((y - 0.68) ** 2) / 0.03) - 0.14 * Math.exp(-(1 - y) / 0.1));
  G += s.rise * 0.035 * Math.sin(5 * y - s.risePh) * r;
  const az = Math.atan2(z, x);
  G += s.wave * 0.035 * Math.sin(2 * az + 1.4 * Math.sin(s.wavePh)) * r;
  G += s.settle * -0.03 * y;
  return G;
}

/** A feeling's surface character. */
export function localPart(n: V3, s: SlotFrame, k: number, g: FieldGlobals): number {
  const [x, y, z] = n;
  const o = g.offset;
  const r = Math.sqrt(Math.max(1e-6, 1 - y * y));
  const az = Math.atan2(z, x);
  const el = Math.asin(Math.max(-1, Math.min(1, y)));
  const sp = SHELL_PHASE[k] * (1 + s.asym);
  let th = s.lobes * az + (1.7 + 0.35 * s.lobes) * el + s.twist * 2.2 * y + s.counter * Math.tanh(3 * y) + s.phase + sp;
  th += s.asym * 1.4 * tn(x * 1.3 + o[0], y * 1.3 + o[1], z * 1.3 + o[2]);
  const sn = Math.sin(th);
  const tri = Math.asin(s.sharpK * sn) / Math.asin(s.sharpK);
  let pf = Math.pow(r, 1.5);
  pf *= 1 + s.petal * (1.6 * smooth(-0.35, 0.75, y) - 1);
  const ad = norm3([-s.anchor[2], 0.3, s.anchor[0]]);
  const am = 1 + s.asym * 0.8 * (x * ad[0] + y * ad[1] + z * ad[2]);
  const amp = 0.15 / (1 + 0.07 * s.lobes);
  let L = amp * am * pf * tri;
  /* a second, lower wave around a different axis, so lobes never line up like the segments of a fruit */
  const y2 = -z,
    r2 = Math.sqrt(Math.max(1e-6, 1 - y2 * y2));
  const th2 =
    (Math.floor(s.lobes / 2) + 1) * Math.atan2(y, x) -
    1.3 * Math.asin(Math.max(-1, Math.min(1, y2))) +
    0.7 * s.phase +
    2.1;
  L += 0.45 * amp * am * Math.sin(th2) * Math.pow(r2, 1.2);
  L -= s.fold * 0.1 * Math.pow(Math.max(0, -sn), 3) * pf;
  const f = s.flow;
  L +=
    s.ripple * 0.03 * (tn(x * 6.5 + f, y * 6.5 - f, z * 6.5 + o[2]) + 0.5 * tn(x * 11 - f, y * 11 + o[1], z * 11 + f));
  L += s.turb * 0.11 * fbm(x * 1.6 + o[0] + 0.25 * f, y * 1.6 + o[1], z * 1.6 + o[2] - 0.25 * f);
  L += s.tremor * tn(x * 5 + g.tremT, y * 5 - g.tremT * 0.7, z * 5 + g.tremT * 0.4);
  return L;
}

export function norm3(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Radius multiplier of shell k along unit direction n (before the shell's base radius and its breathing). */
export function field(n: V3, k: number, slots: SlotFrame[], g: FieldGlobals): number {
  const mu = masks(n, slots, g);
  const o = g.offset;
  let F = 0.055 * fbm(n[0] * 1.1 + o[0], n[1] * 1.1 + o[1], n[2] * 1.1 + o[2]);
  let s2 = 0;
  const nk = turn(n, k);
  slots.forEach((s, i) => {
    const mixG = 0.4 * s.w + 0.6 * mu[i],
      mixL = 0.15 * s.w + 0.85 * mu[i];
    F += SHELL_AMP[k] * (mixG * globalPart(n, s) + mixL * localPart(nk, s, k, g));
    s2 += mu[i] * mu[i];
  });
  /* where two feelings meet, opposing energies leave a soft crease rather than cancelling out */
  const seam = 1 - s2;
  F += g.tension * seam * (-0.035 + 0.012 * Math.sin(18 * (n[0] * 0.6 + n[1] * 0.8) + o[0]));
  if (g.touch > 0) {
    const a = Math.acos(Math.max(-1, Math.min(1, n[0] * g.touchDir[0] + n[1] * g.touchDir[1] + n[2] * g.touchDir[2])));
    F +=
      g.touch *
      0.03 *
      (1 - Math.exp(-12 * g.touchAge)) *
      Math.exp(-2.5 * g.touchAge) *
      Math.sin(10 * a - 18 * g.touchAge) *
      Math.exp(-1.5 * a);
  }
  return softclamp(1 + F);
}
