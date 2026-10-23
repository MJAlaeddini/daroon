import { $, hashStr, lerp } from '../core/util';
import { lex, palFor } from '../domain/lexicon';

/* glyphs: each emotion's mark is a still outline of its own sculpture form */
export const lobeJ = (x, s) => { const c = .5 + .5 * Math.cos(x), e = 1 + s * 5; return Math.pow(c, e) - 1 / (1 + e); };
export function shapeJ(th, P, seed, k, t = 0, rot = 0){
  const amp = lerp(.24, .025, P.reg), ph = seed * 6.2831 + k * 2.17, h = th + rot; let r = 1;
  r += amp * (1 - .35 * P.sharp) * lobeJ(2*h + t*.23 + ph, P.sharp) + amp * .8 * lobeJ(3*h - t*.19 + ph*1.37, P.sharp) + amp * (.18 + .55*P.tens + .5*P.sharp) * lobeJ(5*h + t*.31 + ph*.61, P.sharp);
  const dl = Math.hypot(P.dx, P.dy), dA = Math.atan2(P.dy, P.dx + 1e-4);
  r += P.asym * dl * (.3 * Math.cos(th - dA) + .08 * Math.cos(2 * (th - dA)));
  return r;
}
export function polyPath(cx, cy, R, P, seed, k, t = 0, rot = 0, n = 64){ let d = ''; for (let i = 0; i <= n; i++){ const th = i / n * Math.PI * 2, r = R * shapeJ(th, P, seed, k, t, rot); d += (i ? 'L' : 'M') + (cx + r * Math.cos(th)).toFixed(2) + ' ' + (cy - r * Math.sin(th)).toFixed(2); } return d + 'Z'; }
export const GLY = new Set();
export function glyph(key: string, color?: string | null){
  const id = 'g' + hashStr(key + '|' + (color || '')).toString(36);
  if (!GLY.has(id)){
    GLY.add(id); const L = lex(key), P = L.P, pal = palFor(key, color), seed = (hashStr(key) % 1000) / 1000;
    const R = 7.6 + 2.4 * P.exp, off = P.sep * 2.4 * (1 - .5 * P.coh), dl = Math.hypot(P.dx, P.dy) || 1;
    const outer = polyPath(16, 16, R, P, seed, 0);
    const inner = polyPath(16 + off * (P.dx / dl || .7), 16 - off * (P.dy / dl || .5), R * .62, P, seed, 1, 0, .63);
    const sym = `<symbol id="${id}" viewBox="0 0 32 32"><defs><radialGradient id="${id}r" cx=".4" cy=".36" r=".72"><stop offset="0" stop-color="${pal[0]}"/><stop offset=".55" stop-color="${pal[1]}"/><stop offset="1" stop-color="${pal[2]}"/></radialGradient></defs>`
      + `<path d="${outer}" fill="url(#${id}r)"/><path d="${inner}" fill="${pal[0]}" fill-opacity=".45" stroke="${pal[2]}" stroke-opacity=".35" stroke-width=".6"/>`
      + `<path d="${outer}" fill="none" stroke="${pal[2]}" stroke-opacity=".55" stroke-width=".7"/></symbol>`;
    $('#spriteDefs').insertAdjacentHTML('beforeend', sym);
  }
  return `<svg class="glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
}
