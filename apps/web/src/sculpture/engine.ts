import { labToHex } from '../core/color';
import { clamp, lerp } from '../core/util';
import { NEUTRAL_PAL, NEU_LABS, P0, PK, labsFor, lex, palFor } from '../domain/lexicon';
import { DB } from '../state/store';

/* ═════════════════════════ engine: springs, slots, phases ═════════════════════════ */
export const STIFF = { coh:2.4, reg:3.4, exp:3.6, asym:3.2, sharp:3.2, turb:2.9, tens:2.9, energy:2.5, freq:2.5, lum:5, diff:4, sep:2.3, dx:3, dy:3 };
export const SHAPEY = new Set(['exp','asym','reg','sharp']);
export const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => DB.settings.motion === 'calm' || (DB.settings.motion === 'system' && mqReduce.matches);
export const habit = () => clamp((DB.visits - 1) / 8);   // motion quiets with repeated use
export const mqDark = matchMedia('(prefers-color-scheme: dark)');
export function isDark(){ const t = document.documentElement.dataset.theme; if (t) return t === 'dark'; return mqDark.matches; }
export const isSpectrum = () => document.documentElement.dataset.direction === 'spectrum';

export class Engine {
  P: Record<string, number>; V: Record<string, number>;
  slots: { key: string | null; angle: number; w: number; v: number; wT: number; lab: number[][]; labT: number[][] | null; lexp: number; ltens: number }[];
  neutral: number; nv: number; neutralT: number; mod: Record<string, number>; hintMod: Record<string, number>;
  open: number; openV: number; openT: number; ph: number[];
  ripple: { x: number; y: number; age: number; str: number; k: number; sp: number; dec: number };
  pt: number[]; ptT: number[]; seed: number; _pt: ReturnType<typeof setTimeout> | undefined;
  constructor(){
    this.P = { ...P0 }; this.V = {}; PK.forEach(k => this.V[k] = 0);
    this.slots = [0, 1, 2].map(() => ({ key: null, angle: 0, w: 0, v: 0, wT: 0, lab: NEU_LABS.map(a => a.slice()), labT: null, lexp: 0, ltens: 0 }));
    this.neutral = 1; this.nv = 0; this.neutralT = 1; this.mod = {}; this.hintMod = {};
    this.open = 0; this.openV = 0; this.openT = 0;
    this.ph = [Math.random() * 40, Math.random() * 40, 0, 0];
    this.ripple = { x: 0, y: 0, age: 9, str: 0, k: 24, sp: 8, dec: 1.6 };
    this.pt = [0, 0]; this.ptT = [0, 0]; this.seed = Math.random();
  }
  setSpec(spec){
    const items = (spec.items || []).slice(0, 3), keys = items.map(i => i.key);
    for (const s of this.slots) if (s.key && !keys.includes(s.key)) s.wT = 0;
    for (const it of items){
      let s = this.slots.find(x => x.key === it.key);
      if (!s){
        s = this.slots.find(x => !x.key) || this.slots.find(x => x.wT === 0 && x.w < .02) || this.slots.filter(x => x.wT === 0).sort((a, b) => a.w - b.w)[0];
        if (!s) continue;
        s.key = it.key; s.w = 0; s.v = 0; s.lab = labsFor(it.key, it.color).map(a => a.slice());
      }
      const L = lex(it.key); s.wT = 1; s.labT = labsFor(it.key, it.color); s.angle = L.angle; s.lexp = (L.P.exp - .5) * 1.6; s.ltens = L.P.tens;
    }
    this.neutralT = items.length ? (spec.neutral || 0) : 1;
  }
  pulse(v = 1, hold = 380){ this.openT = v; clearTimeout(this._pt); this._pt = setTimeout(() => this.openT = 0, hold); }
  rippleAt(angleRad, key, out = true){
    if (reduced()) return; const P = key ? lex(key).P : P0;
    this.ripple = { x: Math.cos(angleRad) * .5, y: Math.sin(angleRad) * .5, age: 0, str: (out ? 1 : -.55) * (1 - .35 * habit()), k: 16 + 26 * P.freq, sp: 5 + 9 * P.energy, dec: .9 + 1.6 * (1 - P.energy) * .6 + P.tens * .6 };
  }
  update(dt){
    const rm = reduced(), ms = rm ? .12 : (1 - .2 * habit());
    const kmul = rm ? 2.2 : 1;
    for (const s of this.slots){
      const k = 7 * kmul; s.v += (k * k * (s.wT - s.w) - 2 * .95 * k * s.v) * dt; s.w = clamp(s.w + s.v * dt, 0, 1.15);
      if (s.labT){ const a = 1 - Math.exp(-dt * 5); for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) s.lab[i][c] = lerp(s.lab[i][c], s.labT[i][c], a); }
      if (s.wT === 0 && s.w < .004){ s.key = null; s.w = 0; s.v = 0; }
    }
    { const k = 4 * kmul; this.nv += (k * k * (this.neutralT - this.neutral) - 2 * k * this.nv) * dt; this.neutral = clamp(this.neutral + this.nv * dt); }
    const T = {}; let ws = this.neutral; PK.forEach(k => T[k] = P0[k] * this.neutral);
    for (const s of this.slots){ if (!s.key || s.w <= 0) continue; const P = lex(s.key).P; ws += s.w; PK.forEach(k => T[k] += P[k] * s.w); }
    PK.forEach(k => { T[k] = ws > 1e-4 ? T[k] / ws : P0[k]; T[k] += (this.mod[k] || 0) + (this.hintMod[k] || 0); T[k] = (k === 'dx' || k === 'dy') ? clamp(T[k], -1, 1) : clamp(T[k]); });
    PK.forEach(k => { const st = STIFF[k] * kmul, z = (SHAPEY.has(k) && !rm) ? .78 : 1; this.V[k] += (st * st * (T[k] - this.P[k]) - 2 * z * st * this.V[k]) * dt; this.P[k] += this.V[k] * dt; });
    { const k = 5.5; this.openV += (k * k * (this.openT - this.open) - 2 * .7 * k * this.openV) * dt; this.open += this.openV * dt; }
    const P = this.P;
    this.ph[0] += dt * (.16 + .85 * P.energy) * ms; this.ph[1] += dt * (.14 + 1.05 * P.freq) * ms; this.ph[2] += dt * (.12 + .7 * P.energy + .3 * P.tens) * ms; this.ph[3] += dt * ms;
    this.ripple.age += dt;
    const a = 1 - Math.exp(-dt * 3); this.pt[0] = lerp(this.pt[0], this.ptT[0], a); this.pt[1] = lerp(this.pt[1], this.ptT[1], a);
  }
  dominantHex(){ let best = null; for (const s of this.slots) if (s.key && (!best || s.w > best.w)) best = s; return best && best.w > .2 ? labToHex(best.lab[1]) : null; }
}
export function buildU(st, scale: number, halo: number, dk?: number){
  const S = new Float32Array(12), K = new Float32Array(27), N = new Float32Array(9), P = st.P;
  st.slots.forEach((s, i) => { S[i*4] = s.angle * Math.PI / 180; S[i*4+1] = s.key ? s.w : 0; S[i*4+2] = s.lexp; S[i*4+3] = s.ltens; for (let j = 0; j < 3; j++) for (let c = 0; c < 3; c++) K[i*9 + j*3 + c] = s.lab[j][c]; });
  NEU_LABS.forEach((l, j) => { N[j*3] = l[0]; N[j*3+1] = l[1]; N[j*3+2] = l[2]; });
  const r = st.ripple;
  let main = null, mw = 0; st.slots.forEach(s => { if (s.key && s.w > mw){ mw = s.w; main = s; } });
  return { ph: st.ph, A: [P.exp, P.reg, P.asym, P.sharp], B: [P.turb, P.tens, P.lum, P.coh], C: [P.diff, P.sep, P.dx, P.dy],
    D: [st.open, dk != null ? dk : (isDark() ? 1 : 0), dk != null ? 0 : (isSpectrum() ? 1 : 0), st.neutral], S, K, N, R: [r.x, r.y, r.age, r.str], R2: [r.k, r.sp, r.dec, 0], pt: st.pt,
    seed: st.seed || 0, scale, halo, P, mainPal: main ? palFor(main.key, null) : NEUTRAL_PAL };
}
export function staticState(spec){
  const items = (spec.items || []).slice(0, 3), n = items.length ? (spec.neutral || 0) : 1, P = {}; let ws = n;
  PK.forEach(k => P[k] = P0[k] * n);
  const slots = [0, 1, 2].map(i => { const it = items[i]; if (!it) return { key: null, w: 0, angle: 0, lab: NEU_LABS, lexp: 0, ltens: 0 };
    const L = lex(it.key); PK.forEach(k => P[k] += L.P[k]); ws += 1; return { key: it.key, w: 1, angle: L.angle, lab: labsFor(it.key, it.color), lexp: (L.P.exp - .5) * 1.6, ltens: L.P.tens }; });
  PK.forEach(k => P[k] /= Math.max(ws, 1e-4)); const s = spec.seed || 0;
  return { P, slots, neutral: n, open: 0, ph: [s * 97, s * 61, s * 37, s * 13], ripple: { x: 0, y: 0, age: 9, str: 0, k: 20, sp: 8, dec: 2 }, pt: [0, 0], seed: s };
}
