import { $$, hashStr } from '../core/util';
import { stillCanvasFor, stillZoom } from '../stone/stone';
import { isDark, isSpectrum, toFeelings } from './engine';

/* ═════════════════════════ traces: small stills of the stone for days & entries ═════════════════════════
   A trace is the canonical still of the stone for an entry's or a day's feelings (src/stone). The same feelings always
   give the same stone, so traces are cached by their feelings and the theme. Each is drawn at the zoom that gives every
   mark the same visual weight (a large stone a little further away, a small one closer). */
/** Marks show at up to ~60 CSS px; 192 keeps them sharp on 3× screens. */
export const TRACE_PX = 192;
export const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export const TR = new Map<string, string>(),
  TQ: [string, unknown][] = [],
  TQS = new Set<string>();
export const themeKey = () => (isSpectrum() ? 's' : isDark() ? 'd' : 'l');
export function traceKey(spec) {
  const ids = toFeelings(spec)
    .map((f) => f.id)
    .sort()
    .join(',');
  return 't' + hashStr(themeKey() + '|' + ids).toString(36);
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
/** The trace of a spec as a PNG data URL, or null while the stones' art is still loading. */
export function renderTraceNow(spec, size = TRACE_PX, fill = 0.6, dark = isDark()): string | null {
  const f = toFeelings(spec);
  const c = stillCanvasFor(f, size, dark ? 'dark' : 'light', stillZoom(f, fill));
  return c ? c.toDataURL('image/png') : null;
}
export function processTraces() {
  const t0 = performance.now();
  while (TQ.length && performance.now() - t0 < 6) {
    const [k, spec] = TQ[0];
    let url: string | null;
    try {
      url = renderTraceNow(spec);
    } catch (e) {
      url = BLANK;
    }
    if (!url) return; /* the art is still loading: try again next frame */
    TQ.shift();
    TQS.delete(k);
    TR.set(k, url);
    $$(`img[data-tk="${k}"]`).forEach((im) => ((im as HTMLImageElement).src = url));
  }
}
