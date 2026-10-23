import { $$, hashStr } from '../core/util';
import { buildU, isDark, isSpectrum, staticState } from './engine';
import { Ctx2DRenderer, GLRenderer } from './renderers';

/* ═════════════════════════ traces: miniature sculptures for days & entries ═════════════════════════ */
export const miniCanvas = document.createElement('canvas'); miniCanvas.width = miniCanvas.height = 144;
export let mini = null; try { mini = new GLRenderer(miniCanvas, true); } catch (e){ mini = new Ctx2DRenderer(miniCanvas); }
export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export const TR = new Map(), TQ = [], TQS = new Set();
export const themeKey = () => isSpectrum() ? 's' : (isDark() ? 'd' : 'l');
export function traceKey(spec){ return 't' + hashStr(themeKey() + '|' + spec.items.map(i => i.key + (i.color || '')).join(',') + '|' + (spec.neutral || 0).toFixed(2) + '|' + (spec.seed || 0).toFixed(4)).toString(36); }
export function traceImg(spec){ const k = traceKey(spec); let src = TR.get(k); if (!src){ src = BLANK; if (!TQS.has(k)){ TQS.add(k); TQ.push([k, spec]); } } return `<img class="tr" alt="" data-tk="${k}" src="${src}" draggable="false">`; }
export function renderTraceNow(spec){ mini.draw(buildU(staticState(spec), .5, .7)); return miniCanvas.toDataURL('image/png'); }
export function processTraces(){ const t0 = performance.now(); while (TQ.length && performance.now() - t0 < 6){ const [k, spec] = TQ.shift(); TQS.delete(k);
  try { const url = renderTraceNow(spec); TR.set(k, url); $$(`img[data-tk="${k}"]`).forEach(im => im.src = url); } catch (e){} } }
