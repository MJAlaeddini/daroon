import { EXTRA, REFINE } from '@daroon/shared';
import { hexToLab, labRot, labToHex } from '../core/color';
import { clamp, hashStr, mulberry32 } from '../core/util';

/* ═════════════════════════ emotion lexicon & emotion→form parameters ═════════════════════════
   Parameters (0..1, drift −1..1): coh cohesion · reg geometric regularity · exp expansion · asym asymmetry ·
   sharp curvature sharpness · turb surface turbulence · tens internal tension · energy motion energy ·
   freq motion frequency · lum luminosity · diff colour diffusion · sep layer separation · dx,dy directional drift.
   These are artistic metaphors chosen by design, not psychological measurements. */
export const PK = [
  'coh',
  'reg',
  'exp',
  'asym',
  'sharp',
  'turb',
  'tens',
  'energy',
  'freq',
  'lum',
  'diff',
  'sep',
  'dx',
  'dy',
];
export const P0: Record<string, number> = {
  coh: 0.7,
  reg: 0.6,
  exp: 0.5,
  asym: 0.25,
  sharp: 0.05,
  turb: 0.3,
  tens: 0.3,
  energy: 0.3,
  freq: 0.3,
  lum: 0.5,
  diff: 0.9,
  sep: 0.4,
  dx: 0,
  dy: 0,
};
export const NEUTRAL_PAL = ['#f6ebe6', '#c6bde2', '#9fbccf'];
// [word, angle on the semantic ring (deg, 90 = top), palette [glow, core, edge], params, optional emoji]
export const CORE_DEF: [string, number, string[], Record<string, number>, string][] = [
  [
    'آرامش',
    135,
    ['#e3eef0', '#9db9cc', '#5f9693'],
    {
      coh: 0.95,
      reg: 0.9,
      exp: 0.55,
      asym: 0.1,
      sharp: 0,
      turb: 0.1,
      tens: 0.1,
      energy: 0.16,
      freq: 0.18,
      lum: 0.55,
      diff: 0.85,
      sep: 0.15,
      dx: 0,
      dy: 0.05,
    },
    '😌',
  ],
  [
    'امید',
    105,
    ['#fbe8d2', '#e9c29f', '#a993cf'],
    {
      coh: 0.75,
      reg: 0.6,
      exp: 0.7,
      asym: 0.35,
      sharp: 0.05,
      turb: 0.2,
      tens: 0.2,
      energy: 0.42,
      freq: 0.35,
      lum: 0.82,
      diff: 0.7,
      sep: 0.3,
      dx: 0.1,
      dy: 0.6,
    },
    '🌱',
  ],
  [
    'خوشحالی',
    75,
    ['#f9e7c2', '#f2b083', '#e3876f'],
    {
      coh: 0.8,
      reg: 0.65,
      exp: 0.9,
      asym: 0.2,
      sharp: 0.1,
      turb: 0.25,
      tens: 0.15,
      energy: 0.6,
      freq: 0.5,
      lum: 0.95,
      diff: 0.7,
      sep: 0.35,
      dx: 0,
      dy: 0.35,
    },
    '😊',
  ],
  [
    'اشتیاق',
    45,
    ['#ffe0b8', '#ef9670', '#cf6a8b'],
    {
      coh: 0.65,
      reg: 0.5,
      exp: 0.8,
      asym: 0.35,
      sharp: 0.3,
      turb: 0.4,
      tens: 0.35,
      energy: 0.82,
      freq: 0.65,
      lum: 0.85,
      diff: 0.55,
      sep: 0.45,
      dx: 0.4,
      dy: 0.3,
    },
    '✨',
  ],
  [
    'سردرگمی',
    15,
    ['#dfe3ea', '#9ea6b8', '#9a8fbf'],
    {
      coh: 0.3,
      reg: 0.3,
      exp: 0.5,
      asym: 0.5,
      sharp: 0.15,
      turb: 0.55,
      tens: 0.4,
      energy: 0.45,
      freq: 0.45,
      lum: 0.5,
      diff: 0.6,
      sep: 0.9,
      dx: 0.2,
      dy: 0,
    },
    '😵‍💫',
  ],
  [
    'نگرانی',
    -15,
    ['#d2cdee', '#7e74b2', '#3f4579'],
    {
      coh: 0.55,
      reg: 0.4,
      exp: 0.38,
      asym: 0.35,
      sharp: 0.25,
      turb: 0.5,
      tens: 0.75,
      energy: 0.45,
      freq: 0.85,
      lum: 0.4,
      diff: 0.5,
      sep: 0.45,
      dx: 0.1,
      dy: -0.1,
    },
    '😟',
  ],
  [
    'ترس',
    -45,
    ['#cbcfdc', '#67708c', '#4a3754'],
    {
      coh: 0.45,
      reg: 0.3,
      exp: 0.32,
      asym: 0.45,
      sharp: 0.4,
      turb: 0.6,
      tens: 0.9,
      energy: 0.5,
      freq: 0.9,
      lum: 0.35,
      diff: 0.4,
      sep: 0.55,
      dx: -0.1,
      dy: -0.25,
    },
    '😨',
  ],
  [
    'خشم',
    -75,
    ['#f0b9a1', '#b8573f', '#7d3048'],
    {
      coh: 0.72,
      reg: 0.38,
      exp: 0.5,
      asym: 0.4,
      sharp: 0.72,
      turb: 0.45,
      tens: 0.85,
      energy: 0.72,
      freq: 0.6,
      lum: 0.55,
      diff: 0.35,
      sep: 0.25,
      dx: 0.45,
      dy: 0,
    },
    '😠',
  ],
  [
    'دلخوری',
    -105,
    ['#ecc3c3', '#b06a78', '#6e4a6c'],
    {
      coh: 0.6,
      reg: 0.4,
      exp: 0.45,
      asym: 0.45,
      sharp: 0.45,
      turb: 0.35,
      tens: 0.55,
      energy: 0.4,
      freq: 0.45,
      lum: 0.4,
      diff: 0.5,
      sep: 0.3,
      dx: -0.2,
      dy: -0.2,
    },
    '😕',
  ],
  [
    'غم',
    -135,
    ['#bccbe6', '#6f7fae', '#5d4f86'],
    {
      coh: 0.55,
      reg: 0.35,
      exp: 0.36,
      asym: 0.85,
      sharp: 0.05,
      turb: 0.3,
      tens: 0.2,
      energy: 0.15,
      freq: 0.18,
      lum: 0.3,
      diff: 0.8,
      sep: 0.35,
      dx: 0,
      dy: -0.75,
    },
    '😢',
  ],
  [
    'دلتنگی',
    -165,
    ['#e4dcf0', '#b791aa', '#8fa3c4'],
    {
      coh: 0.6,
      reg: 0.45,
      exp: 0.5,
      asym: 0.6,
      sharp: 0.05,
      turb: 0.25,
      tens: 0.25,
      energy: 0.26,
      freq: 0.25,
      lum: 0.5,
      diff: 0.85,
      sep: 0.5,
      dx: -0.55,
      dy: -0.1,
    },
    '🥀',
  ],
  [
    'صمیمیت',
    165,
    ['#f7dfd4', '#d89a94', '#a9677a'],
    {
      coh: 0.9,
      reg: 0.7,
      exp: 0.6,
      asym: 0.15,
      sharp: 0,
      turb: 0.15,
      tens: 0.15,
      energy: 0.3,
      freq: 0.3,
      lum: 0.75,
      diff: 0.9,
      sep: 0.2,
      dx: 0,
      dy: 0,
    },
    '🤍',
  ],
];
export const TWEAK = {
  رهایی: { exp: 0.15, coh: -0.1, dy: 0.2, lum: 0.1 },
  سبکی: { exp: 0.1, dy: 0.25 },
  آسودگی: { coh: 0.03 },
  شادی: { energy: 0.1, lum: 0.05 },
  رضایت: { energy: -0.2, coh: 0.1, reg: 0.1 },
  سرخوشی: { energy: 0.25, sep: 0.15, turb: 0.1 },
  نزدیکی: { coh: 0.05 },
  قدردانی: { lum: 0.1, dy: 0.1 },
  محبت: { exp: 0.05, lum: 0.05 },
  خوش‌بینی: { dy: 0.15 },
  انتظار: { energy: -0.15, tens: 0.15, asym: 0.1 },
  انگیزه: { energy: 0.25, dx: 0.2 },
  هیجان: { energy: 0.15, turb: 0.15, freq: 0.15 },
  کنجکاوی: { asym: 0.15, dx: 0.3, sharp: -0.1 },
  بی‌تابی: { tens: 0.25, freq: 0.2 },
  حسرت: { dy: -0.25, asym: 0.1, lum: -0.08 },
  دلگیری: { exp: -0.08, lum: -0.08, coh: 0.05 },
  تنهایی: { coh: -0.15, sep: 0.2, exp: -0.12 },
  اندوه: { lum: -0.08, dy: -0.1 },
  دلشکستگی: { sharp: 0.2, sep: 0.25, coh: -0.15 },
  بی‌حوصلگی: { energy: -0.12, turb: -0.1, lum: -0.05 },
  پشیمانی: { dx: -0.3, tens: 0.15 },
  رنجش: { tens: 0.1, lum: -0.05 },
  کلافگی: { turb: 0.25, tens: 0.15, freq: 0.2 },
  ناامیدی: { dy: -0.35, lum: -0.12, energy: -0.15 },
  عصبانیت: { energy: 0.1 },
  حرص: { tens: 0.1, exp: -0.05 },
  بیزاری: { dx: -0.35, coh: -0.1 },
  دلشوره: { freq: 0.1, tens: 0.1, exp: -0.05 },
  دلهره: { tens: 0.15, turb: 0.1 },
  بلاتکلیفی: { sep: 0.3, coh: -0.2, reg: -0.1 },
  هراس: { tens: 0.08, exp: -0.06 },
  ناامنی: { coh: -0.15, sep: 0.15 },
  بی‌پناهی: { exp: -0.12, lum: -0.08 },
  گیجی: { turb: 0.1 },
  دوگانگی: { sep: 0.15, asym: 0.2 },
  پریشانی: { turb: 0.15, tens: 0.15 },
};
/* Each feeling's own gesture in the sculpture, kept apart from the averaged form above so that a mix of feelings
   still shows each one: [sag, rise, swirl, spike, tremor, hollow, bloom, embrace].
   sag: the body grows heavy and drops · rise: the crown lifts toward the light · swirl: the layers twist ·
   spike: sharp points break the edge · tremor: the edge trembles · hollow: the centre empties and the inner layers
   drift away · bloom: soft petals open · embrace: the inner layers become two that lean together. */
export const MOTIF_KEYS = ['sag', 'rise', 'swirl', 'spike', 'tremor', 'hollow', 'bloom', 'embrace'] as const;
export const MOTIF: Record<string, number[]> = {
  آرامش: [0, 0.1, 0, 0, 0, 0, 0.25, 0],
  امید: [0, 1, 0, 0, 0, 0, 0.3, 0],
  خوشحالی: [0, 0.35, 0, 0, 0.1, 0, 1, 0],
  اشتیاق: [0, 0.3, 0.15, 0.2, 0.45, 0, 0.5, 0],
  سردرگمی: [0, 0, 1, 0, 0.15, 0.15, 0, 0],
  نگرانی: [0, 0, 0.25, 0, 1, 0.1, 0, 0],
  ترس: [0.1, 0, 0, 0.25, 0.75, 0.35, 0, 0],
  خشم: [0, 0, 0.1, 1, 0.25, 0, 0, 0],
  دلخوری: [0.35, 0, 0.1, 0.4, 0.1, 0, 0, 0],
  غم: [1, 0, 0, 0, 0, 0.2, 0, 0],
  دلتنگی: [0.3, 0, 0, 0, 0, 1, 0, 0.15],
  صمیمیت: [0, 0.1, 0, 0, 0, 0, 0.3, 1],
};
export const NO_MOTIF = [0, 0, 0, 0, 0, 0, 0, 0];
export const tweak = (P, t: Record<string, number> = {}) => {
  const o = { ...P };
  for (const k in t) o[k] = k === 'dx' || k === 'dy' ? clamp(o[k] + t[k], -1, 1) : clamp(o[k] + t[k]);
  return o;
};
export const LEX: Record<string, any> = {};
CORE_DEF.forEach(([key, angle, pal, P, emo]) => {
  LEX[key] = { key, angle, pal, P: { ...P0, ...P }, M: MOTIF[key] || NO_MOTIF, emo, core: true, parent: key };
});
export function addChild(k, par, i) {
  if (LEX[k]) return;
  const p = LEX[par];
  LEX[k] = {
    key: k,
    angle: p.angle + (i - 1) * 9,
    pal: p.pal.map((h) => labToHex(labRot(hexToLab(h), (i - 1) * 16 + 6, (i - 1) * 0.02))),
    P: tweak(p.P, TWEAK[k]),
    M: p.M,
    emo: p.emo,
    core: false,
    parent: par,
  };
}
Object.entries(REFINE).forEach(([par, list]) => list.forEach((k, i) => addChild(k, par, i)));
Object.entries(EXTRA).forEach(([k, par]) => addChild(k, par, 2));
export function lex(key) {
  if (LEX[key]) return LEX[key];
  if (key.startsWith('custom:')) {
    const h = hashStr(key),
      rnd = mulberry32(h);
    const pal = NEUTRAL_PAL.map((x) => labToHex(labRot(hexToLab(x), h % 360, 0, 1.9)));
    const P = { ...P0 };
    ['coh', 'reg', 'exp', 'asym', 'turb', 'tens', 'energy', 'lum', 'sep'].forEach(
      (k) => (P[k] = clamp(P[k] + (rnd() - 0.5) * 0.3)),
    );
    // a word of one's own gets a quiet gesture of its own too
    const M = NO_MOTIF.map(() => (rnd() < 0.3 ? rnd() * 0.6 : 0));
    return (LEX[key] = { key, angle: (h % 360) - 180, pal, P, M, emo: '', core: false, parent: null, custom: true });
  }
  return { key, angle: 0, pal: NEUTRAL_PAL, P: { ...P0 }, M: NO_MOTIF, emo: '', core: false, parent: null };
}
export const SWATCHES = {
  mist: { n: 'مه', pal: ['#e2ecf2', '#9fb8cf', '#6c8bab'] },
  sage: { n: 'سبز خاکی', pal: ['#e3ece0', '#a3bba4', '#6c8c76'] },
  apricot: { n: 'زردآلو', pal: ['#fbe3cf', '#f0b48c', '#d4826a'] },
  gold: { n: 'زعفرانی', pal: ['#f6e6b8', '#dcb565', '#b48a3c'] },
  rose: { n: 'گلی', pal: ['#f6d9dc', '#d58f9c', '#a35c71'] },
  lilac: { n: 'یاسی', pal: ['#ebe4f7', '#b3a2dc', '#7d6bb0'] },
  indigo: { n: 'نیلی', pal: ['#cdd1ec', '#6c76b5', '#424a88'] },
  ember: { n: 'اخگری', pal: ['#f1c8b8', '#c46a55', '#8a3a4f'] },
  graphite: { n: 'گرافیتی', pal: ['#dcdde4', '#8c8f9e', '#585b69'] },
};
export const palFor = (key: string, color?: string | null): string[] =>
  color && SWATCHES[color] ? SWATCHES[color].pal : lex(key).pal;
export const LABC = new Map();
export function labsFor(key: string, color?: string | null) {
  const k = key + '|' + (color || '');
  if (!LABC.has(k)) LABC.set(k, palFor(key, color).map(hexToLab));
  return LABC.get(k);
}
export const NEU_LABS = NEUTRAL_PAL.map(hexToLab);
/* the waiting sculpture on the home and sign-in screens: the neutral form, a little warmer and brighter */
export const HOME_PAL = ['#fff1e0', '#f2b7c4', '#9fc6ec'];
export const HOME_LABS = HOME_PAL.map(hexToLab);
export const cvars = (key: string, color?: string | null) => {
  const p = palFor(key, color);
  return `--c0:${p[0]};--c1:${p[1]};--c2:${p[2]}`;
};
