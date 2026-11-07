import { $$, hashStr } from '../core/util';
import { buildU, isDark, isSpectrum, staticState } from './engine';
import { Ctx2DRenderer, GLRenderer } from './renderers';

/* ═════════════════════════ traces: miniature sculptures for days & entries ═════════════════════════ */
/** Marks show at up to ~60 CSS px; 192 keeps them sharp on 3× screens. */
export const TRACE_PX = 192;
export const miniCanvas = document.createElement('canvas');
miniCanvas.width = miniCanvas.height = TRACE_PX;
export let mini = null;
try {
  mini = new GLRenderer(miniCanvas, true);
} catch (e) {
  mini = new Ctx2DRenderer(miniCanvas);
}
export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export const TR = new Map(),
  TQ = [],
  TQS = new Set();
export const themeKey = () => (isSpectrum() ? 's' : isDark() ? 'd' : 'l');
export function traceKey(spec) {
  return (
    't' +
    hashStr(
      themeKey() +
        '|' +
        spec.items.map((i) => i.key + (i.color || '')).join(',') +
        '|' +
        (spec.neutral || 0).toFixed(2) +
        '|' +
        (spec.seed || 0).toFixed(4),
    ).toString(36)
  );
}
export function traceImg(spec) {
  const k = traceKey(spec);
  let src = TR.get(k);
  if (!src) {
    src = BLANK;
    if (!TQS.has(k)) {
      TQS.add(k);
      TQ.push([k, spec]);
    }
  }
  return `<img class="tr" alt="" data-tk="${k}" src="${src}" draggable="false">`;
}
/* Every mark is drawn at the same visual weight: a bloom spreads and a sag shrinks inside the shader, so a row of
   raw marks looks uneven. A first pass measures the body (its area and how far it reaches around its centre of
   mass); the second pass draws it again at the scale that gives every mark the same weight. Drawing at the right
   size in the shader keeps the mark sharp and its halo whole (scaling a finished bitmap blurred it and cut the halo
   at the square's edge); the only adjustment afterwards is a whole-pixel shift that centres it optically. */
const fitCanvas = document.createElement('canvas');
fitCanvas.width = fitCanvas.height = TRACE_PX;
const fitCtx = fitCanvas.getContext('2d', { willReadFrequently: true });
/** The share of the square the body should cover, how far from the centre it may reach (leaving the halo room). */
const BODY = 0.38,
  REACH = 0.7,
  ALPHA = 48;
function measure() {
  const n = miniCanvas.width;
  if (!fitCtx) return null;
  fitCtx.clearRect(0, 0, n, n);
  fitCtx.drawImage(miniCanvas, 0, 0);
  const px = fitCtx.getImageData(0, 0, n, n).data;
  let mass = 0,
    cx = 0,
    cy = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = px[(y * n + x) * 4 + 3];
      if (a < ALPHA) continue;
      const w = a / 255;
      mass += w;
      cx += x * w;
      cy += y * w;
    }
  if (mass < 20) return null;
  cx /= mass;
  cy /= mass;
  let reach = 0;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (px[(y * n + x) * 4 + 3] >= ALPHA) reach = Math.max(reach, Math.hypot(x - cx, y - cy));
  return { mass, cx, cy, reach: reach + 1 };
}
export function renderTraceNow(spec) {
  const st = staticState(spec),
    n = miniCanvas.width,
    c = n / 2;
  mini.draw(buildU(st, 0.5, 0.7));
  const m = measure();
  if (!m || !fitCtx) return miniCanvas.toDataURL('image/png');
  const s = Math.max(0.6, Math.min(1.7, Math.sqrt((BODY * n * n) / m.mass), (REACH * c) / m.reach));
  mini.draw(buildU(st, 0.5 * s, 0.7));
  fitCtx.clearRect(0, 0, n, n);
  fitCtx.drawImage(miniCanvas, Math.round((c - m.cx) * s), Math.round((c - m.cy) * s));
  return fitCanvas.toDataURL('image/png');
}
export function processTraces() {
  const t0 = performance.now();
  while (TQ.length && performance.now() - t0 < 6) {
    const [k, spec] = TQ.shift();
    TQS.delete(k);
    try {
      const url = renderTraceNow(spec);
      TR.set(k, url);
      $$(`img[data-tk="${k}"]`).forEach((im) => (im.src = url));
    } catch (e) {}
  }
}
