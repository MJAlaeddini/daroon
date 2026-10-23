import { clamp } from './util';

/* ═════════════════════════ colour (OKLab) ═════════════════════════ */
export const toLin = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
export const toGam = c => c <= .0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - .055;
export function hexToLab(h: string): number[] { h = h.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => toLin(parseInt(h.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b), m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b), s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
  return [.2104542553*l + .7936177850*m - .0040720468*s, 1.9779984951*l - 2.4285922050*m + .4505937099*s, .0259040371*l + .7827717662*m - .8086757660*s]; }
export function labToHex([L, a, b]: number[]): string { const l_ = L + .3963377774*a + .2158037573*b, m_ = L - .1055613458*a - .0638541728*b, s_ = L - .0894841775*a - 1.2914855480*b;
  const l = l_**3, m = m_**3, s = s_**3; const rgb = [4.0767416621*l - 3.3077115913*m + .2309699292*s, -1.2684380046*l + 2.6097574011*m - .3413193965*s, -.0041960863*l - .7034186147*m + 1.7076147010*s];
  return '#' + rgb.map(v => Math.round(clamp(toGam(clamp(v))) * 255).toString(16).padStart(2, '0')).join(''); }
export const labRot = (L: number[], deg: number, dl = 0, cs = 1): number[] => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [L[0] + dl, (L[1]*c - L[2]*s)*cs, (L[1]*s + L[2]*c)*cs]; };
