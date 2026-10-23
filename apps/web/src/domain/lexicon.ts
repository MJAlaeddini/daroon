import { EXTRA, REFINE } from '@daroon/shared';
import { hexToLab, labRot, labToHex } from '../core/color';
import { clamp, hashStr, mulberry32 } from '../core/util';

/* ═════════════════════════ emotion lexicon & emotion→form parameters ═════════════════════════
   Parameters (0..1, drift −1..1): coh cohesion · reg geometric regularity · exp expansion · asym asymmetry ·
   sharp curvature sharpness · turb surface turbulence · tens internal tension · energy motion energy ·
   freq motion frequency · lum luminosity · diff colour diffusion · sep layer separation · dx,dy directional drift.
   These are artistic metaphors chosen by design, not psychological measurements. */
export const PK = ['coh','reg','exp','asym','sharp','turb','tens','energy','freq','lum','diff','sep','dx','dy'];
export const P0: Record<string, number> = { coh:.7, reg:.6, exp:.5, asym:.25, sharp:.05, turb:.3, tens:.3, energy:.3, freq:.3, lum:.5, diff:.9, sep:.4, dx:0, dy:0 };
export const NEUTRAL_PAL = ['#f6ebe6', '#c6bde2', '#9fbccf'];
// [word, angle on the semantic ring (deg, 90 = top), palette [glow, core, edge], params, optional emoji]
export const CORE_DEF: [string, number, string[], Record<string, number>, string][] = [
  ['آرامش', 135, ['#e3eef0','#9db9cc','#5f9693'], {coh:.95,reg:.9,exp:.55,asym:.1,sharp:0,turb:.1,tens:.1,energy:.16,freq:.18,lum:.55,diff:.85,sep:.15,dx:0,dy:.05}, '😌'],
  ['امید', 105, ['#fbe8d2','#e9c29f','#a993cf'], {coh:.75,reg:.6,exp:.7,asym:.35,sharp:.05,turb:.2,tens:.2,energy:.42,freq:.35,lum:.82,diff:.7,sep:.3,dx:.1,dy:.6}, '🌱'],
  ['خوشحالی', 75, ['#f9e7c2','#f2b083','#e3876f'], {coh:.8,reg:.65,exp:.9,asym:.2,sharp:.1,turb:.25,tens:.15,energy:.6,freq:.5,lum:.95,diff:.7,sep:.35,dx:0,dy:.35}, '😊'],
  ['اشتیاق', 45, ['#ffe0b8','#ef9670','#cf6a8b'], {coh:.65,reg:.5,exp:.8,asym:.35,sharp:.3,turb:.4,tens:.35,energy:.82,freq:.65,lum:.85,diff:.55,sep:.45,dx:.4,dy:.3}, '✨'],
  ['سردرگمی', 15, ['#dfe3ea','#9ea6b8','#9a8fbf'], {coh:.3,reg:.3,exp:.5,asym:.5,sharp:.15,turb:.55,tens:.4,energy:.45,freq:.45,lum:.5,diff:.6,sep:.9,dx:.2,dy:0}, '😵‍💫'],
  ['نگرانی', -15, ['#d2cdee','#7e74b2','#3f4579'], {coh:.55,reg:.4,exp:.38,asym:.35,sharp:.25,turb:.5,tens:.75,energy:.45,freq:.85,lum:.4,diff:.5,sep:.45,dx:.1,dy:-.1}, '😟'],
  ['ترس', -45, ['#cbcfdc','#67708c','#4a3754'], {coh:.45,reg:.3,exp:.32,asym:.45,sharp:.4,turb:.6,tens:.9,energy:.5,freq:.9,lum:.35,diff:.4,sep:.55,dx:-.1,dy:-.25}, '😨'],
  ['خشم', -75, ['#f0b9a1','#b8573f','#7d3048'], {coh:.72,reg:.38,exp:.5,asym:.4,sharp:.72,turb:.45,tens:.85,energy:.72,freq:.6,lum:.55,diff:.35,sep:.25,dx:.45,dy:0}, '😠'],
  ['دلخوری', -105, ['#ecc3c3','#b06a78','#6e4a6c'], {coh:.6,reg:.4,exp:.45,asym:.45,sharp:.45,turb:.35,tens:.55,energy:.4,freq:.45,lum:.4,diff:.5,sep:.3,dx:-.2,dy:-.2}, '😕'],
  ['غم', -135, ['#bccbe6','#6f7fae','#5d4f86'], {coh:.55,reg:.35,exp:.36,asym:.85,sharp:.05,turb:.3,tens:.2,energy:.15,freq:.18,lum:.3,diff:.8,sep:.35,dx:0,dy:-.75}, '😢'],
  ['دلتنگی', -165, ['#e4dcf0','#b791aa','#8fa3c4'], {coh:.6,reg:.45,exp:.5,asym:.6,sharp:.05,turb:.25,tens:.25,energy:.26,freq:.25,lum:.5,diff:.85,sep:.5,dx:-.55,dy:-.1}, '🥀'],
  ['صمیمیت', 165, ['#f7dfd4','#d89a94','#a9677a'], {coh:.9,reg:.7,exp:.6,asym:.15,sharp:0,turb:.15,tens:.15,energy:.3,freq:.3,lum:.75,diff:.9,sep:.2,dx:0,dy:0}, '🤍'],
];
export const TWEAK = {
  'رهایی':{exp:.15,coh:-.1,dy:.2,lum:.1}, 'سبکی':{exp:.1,dy:.25}, 'آسودگی':{coh:.03},
  'شادی':{energy:.1,lum:.05}, 'رضایت':{energy:-.2,coh:.1,reg:.1}, 'سرخوشی':{energy:.25,sep:.15,turb:.1},
  'نزدیکی':{coh:.05}, 'قدردانی':{lum:.1,dy:.1}, 'محبت':{exp:.05,lum:.05},
  'خوش‌بینی':{dy:.15}, 'انتظار':{energy:-.15,tens:.15,asym:.1}, 'انگیزه':{energy:.25,dx:.2},
  'هیجان':{energy:.15,turb:.15,freq:.15}, 'کنجکاوی':{asym:.15,dx:.3,sharp:-.1}, 'بی‌تابی':{tens:.25,freq:.2},
  'حسرت':{dy:-.25,asym:.1,lum:-.08}, 'دلگیری':{exp:-.08,lum:-.08,coh:.05}, 'تنهایی':{coh:-.15,sep:.2,exp:-.12},
  'اندوه':{lum:-.08,dy:-.1}, 'دلشکستگی':{sharp:.2,sep:.25,coh:-.15}, 'بی‌حوصلگی':{energy:-.12,turb:-.1,lum:-.05}, 'پشیمانی':{dx:-.3,tens:.15},
  'رنجش':{tens:.1,lum:-.05}, 'کلافگی':{turb:.25,tens:.15,freq:.2}, 'ناامیدی':{dy:-.35,lum:-.12,energy:-.15},
  'عصبانیت':{energy:.1}, 'حرص':{tens:.1,exp:-.05}, 'بیزاری':{dx:-.35,coh:-.1},
  'دلشوره':{freq:.1,tens:.1,exp:-.05}, 'دلهره':{tens:.15,turb:.1}, 'بلاتکلیفی':{sep:.3,coh:-.2,reg:-.1},
  'هراس':{tens:.08,exp:-.06}, 'ناامنی':{coh:-.15,sep:.15}, 'بی‌پناهی':{exp:-.12,lum:-.08},
  'گیجی':{turb:.1}, 'دوگانگی':{sep:.15,asym:.2}, 'پریشانی':{turb:.15,tens:.15},
};
export const tweak = (P, t: Record<string, number> = {}) => { const o = { ...P }; for (const k in t) o[k] = (k === 'dx' || k === 'dy') ? clamp(o[k] + t[k], -1, 1) : clamp(o[k] + t[k]); return o; };
export const LEX: Record<string, any> = {};
CORE_DEF.forEach(([key, angle, pal, P, emo]) => { LEX[key] = { key, angle, pal, P: { ...P0, ...P }, emo, core: true, parent: key }; });
export function addChild(k, par, i){ if (LEX[k]) return; const p = LEX[par]; LEX[k] = { key: k, angle: p.angle + (i - 1) * 9, pal: p.pal.map(h => labToHex(labRot(hexToLab(h), (i - 1) * 16 + 6, (i - 1) * .02))), P: tweak(p.P, TWEAK[k]), emo: p.emo, core: false, parent: par }; }
Object.entries(REFINE).forEach(([par, list]) => list.forEach((k, i) => addChild(k, par, i)));
Object.entries(EXTRA).forEach(([k, par]) => addChild(k, par, 2));
export function lex(key){
  if (LEX[key]) return LEX[key];
  if (key.startsWith('custom:')){
    const h = hashStr(key), rnd = mulberry32(h);
    const pal = NEUTRAL_PAL.map((x, i) => labToHex(labRot(hexToLab(x), (h % 360), 0, 1.9)));
    const P = { ...P0 }; ['coh','reg','exp','asym','turb','tens','energy','lum','sep'].forEach(k => P[k] = clamp(P[k] + (rnd() - .5) * .3));
    return (LEX[key] = { key, angle: (h % 360) - 180, pal, P, emo: '', core: false, parent: null, custom: true });
  }
  return { key, angle: 0, pal: NEUTRAL_PAL, P: { ...P0 }, emo: '', core: false, parent: null };
}
export const SWATCHES = {
  mist:{n:'مه', pal:['#e2ecf2','#9fb8cf','#6c8bab']}, sage:{n:'سبز خاکی', pal:['#e3ece0','#a3bba4','#6c8c76']},
  apricot:{n:'زردآلو', pal:['#fbe3cf','#f0b48c','#d4826a']}, gold:{n:'زعفرانی', pal:['#f6e6b8','#dcb565','#b48a3c']},
  rose:{n:'گلی', pal:['#f6d9dc','#d58f9c','#a35c71']}, lilac:{n:'یاسی', pal:['#ebe4f7','#b3a2dc','#7d6bb0']},
  indigo:{n:'نیلی', pal:['#cdd1ec','#6c76b5','#424a88']}, ember:{n:'اخگری', pal:['#f1c8b8','#c46a55','#8a3a4f']},
  graphite:{n:'گرافیتی', pal:['#dcdde4','#8c8f9e','#585b69']},
};
export const palFor = (key: string, color?: string | null): string[] => (color && SWATCHES[color]) ? SWATCHES[color].pal : lex(key).pal;
export const LABC = new Map();
export function labsFor(key: string, color?: string | null){ const k = key + '|' + (color || ''); if (!LABC.has(k)) LABC.set(k, palFor(key, color).map(hexToLab)); return LABC.get(k); }
export const NEU_LABS = NEUTRAL_PAL.map(hexToLab);
export const cvars = (key: string, color?: string | null) => { const p = palFor(key, color); return `--c0:${p[0]};--c1:${p[1]};--c2:${p[2]}`; };
