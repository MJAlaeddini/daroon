import { $, $$, clamp, lerp } from '../core/util';
import { PK } from '../domain/lexicon';
import { Engine, buildU, habit, isSpectrum, reduced } from '../sculpture/engine';
import { Ctx2DRenderer, GLRenderer } from '../sculpture/renderers';
import { processTraces } from '../sculpture/traces';
import { S } from '../state/app';

/* ═════════════════════════ stage: one sculpture that travels between anchors ═════════════════════════ */
export const engine = new Engine();
export const stageEl = $('#stage'),
  canvas = $('#sculpt');
export let renderer,
  usingGL = true;
try {
  renderer = new GLRenderer(canvas);
} catch (e) {
  usingGL = false;
  renderer = new Ctx2DRenderer(canvas);
}
export const BLEED = 1.4; /* the canvas extends past its anchor so the halo can fade out completely */
export const grow = (r) => ({
  left: r.left - (r.width * (BLEED - 1)) / 2,
  top: r.top - (r.height * (BLEED - 1)) / 2,
  width: r.width * BLEED,
  height: r.height * BLEED,
});
export const Stage: any = {
  anchor: null,
  from: null,
  t0: 0,
  dur: 900,
  rect: null,
  cssW: 0,
  cssH: 0,
  q: 1,
  shown: false,
  settled: true,
  scale: 0.56,
};
export function sizeCanvas(w, h) {
  Stage.cssW = w;
  Stage.cssH = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6) * Stage.q;
  let pw = Math.round(w * dpr),
    ph = Math.round(h * dpr);
  const max = 860 * 860;
  if (pw * ph > max) {
    const s = Math.sqrt(max / (pw * ph));
    pw = Math.round(pw * s);
    ph = Math.round(ph * s);
  }
  canvas.width = Math.max(2, pw);
  canvas.height = Math.max(2, ph);
}
export function setShown(v) {
  if (Stage.shown === v) return;
  Stage.shown = v;
  stageEl.style.opacity = v ? 1 : 0;
}
export function pickAnchor() {
  const now = performance.now();
  /* during a tab hand-off the old sculpture leaves with its own page first; the new anchor is taken afterwards */
  if (now < (Stage.hold || 0)) {
    clearTimeout(Stage.holdT);
    Stage.holdT = setTimeout(pickAnchor, Stage.hold - now + 16);
    return;
  }
  const scope = $('#layer .sheet') || $('#views .view:not(.leaving)');
  const cands = scope ? $$('[data-anchor]', scope) : [];
  const a = cands.find((el) => el.getBoundingClientRect().width > 8) || null;
  if (a === Stage.anchor) return;
  const r = a ? grow(a.getBoundingClientRect()) : null;
  Stage.from = Stage.shown && Stage.rect ? { ...Stage.rect } : null;
  Stage.anchor = a;
  Stage.t0 = now;
  Stage.dur = reduced() ? 0 : 950 * (1 - 0.25 * habit());
  stageEl.classList.toggle('over', !!(a && a.hasAttribute('data-over')));
  Stage.scale = a && a.dataset.scale ? +a.dataset.scale : 0.56;
  if (r && r.width > 8) sizeCanvas(r.width, r.height);
  if (!Stage.from) {
    stageEl.style.opacity = 0;
    Stage.shown = false;
  }
  /* re-apply position and scale for the new canvas size in this same frame, and redraw, so no frame shows a wrong size */
  if (a) {
    positionStage(now, true);
    if (Stage.shown && Stage.cssW && !S.done && !S.story) {
      try {
        renderer.draw(buildU(engine, Stage.scale / BLEED, 1));
      } catch (e) {}
    }
  }
}
export const easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export function positionStage(now: number, noShow?: boolean) {
  const holding = now < (Stage.hold || 0);
  const a = Stage.anchor;
  if (!a || !a.isConnected) {
    setShown(false);
    return;
  }
  const r0 = a.getBoundingClientRect();
  if (r0.width < 8) {
    setShown(false);
    return;
  }
  const r = grow(r0);
  const p = Stage.dur > 0 ? clamp((now - Stage.t0) / Stage.dur) : 1;
  let x = r.left,
    y = r.top,
    w = r.width,
    h = r.height;
  if (Stage.from && p < 1) {
    const e = easeIO(p);
    x = lerp(Stage.from.x, x, e);
    y = lerp(Stage.from.y, y, e);
    w = lerp(Stage.from.w, w, e);
    h = lerp(Stage.from.h, h, e);
    Stage.settled = false;
  } else {
    Stage.settled = true;
    if (!holding && (Math.abs(r.width - Stage.cssW) > 1.5 || Math.abs(r.height - Stage.cssH) > 1.5))
      sizeCanvas(r.width, r.height);
  }
  Stage.rect = { x, y, w, h };
  stageEl.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${(w / Stage.cssW).toFixed(4)},${(h / Stage.cssH).toFixed(4)})`;
  if (!noShow) setShown(!holding && y < innerHeight && y + h > 0);
}
export let perfAcc = 0,
  perfN = 0;
export function perfWatch(dt) {
  perfAcc += dt;
  perfN++;
  if (perfN >= 90) {
    const avg = perfAcc / perfN;
    perfAcc = 0;
    perfN = 0;
    if (avg > 0.028 && Stage.q > 0.6) {
      Stage.q = Math.max(0.6, Stage.q - 0.14);
      sizeCanvas(Stage.cssW, Stage.cssH);
    }
  }
}
export let lastT = performance.now(),
  tintT = 0,
  frameN = 0,
  lastDraw = 0,
  traceHold = 0;
/** Pauses background trace rendering for a moment while a view is being built. */
export function holdTraces(ms: number) {
  traceHold = performance.now() + ms;
}
export function busy() {
  let v = Math.abs(engine.openV) + Math.abs(engine.nv);
  PK.forEach((k) => (v += Math.abs(engine.V[k])));
  engine.slots.forEach((s) => (v += Math.abs(s.v)));
  return (
    !Stage.settled ||
    engine.ripple.age < 2.5 ||
    v > 0.02 ||
    Math.abs(engine.pt[0] - engine.ptT[0]) + Math.abs(engine.pt[1] - engine.ptT[1]) > 0.01
  );
}
export function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  frameN++;
  engine.update(dt);
  positionStage(now);
  /* ambient motion is slow, so when nothing is changing the sculpture is drawn at ~30fps (15 with reduced motion) */
  const every = busy() ? 1 : reduced() ? 4 : 2;
  if (
    Stage.shown &&
    !S.done &&
    !S.story &&
    document.visibilityState === 'visible' &&
    Stage.cssW &&
    frameN % every === 0
  ) {
    try {
      renderer.draw(buildU(engine, Stage.scale / BLEED, 1));
      if (lastDraw && now - lastDraw < 500) perfWatch((now - lastDraw) / 1000 / every);
      lastDraw = now;
    } catch (e) {}
  }
  if (now > traceHold) processTraces();
  if (now - tintT > 250) {
    tintT = now;
    const hx = engine.dominantHex();
    const root = document.documentElement.style;
    root.setProperty('--nav-c', hx || '#b3a2dc');
    root.setProperty('--tint', isSpectrum() && hx ? hx + '30' : 'rgba(0,0,0,0)');
  }
  requestAnimationFrame(frame);
}
export function snapshot() {
  try {
    renderer.draw(buildU(engine, Stage.scale / BLEED, 1));
    return canvas.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}
addEventListener(
  'pointermove',
  (e) => {
    if (!Stage.rect || e.pointerType === 'touch') return;
    const r = Stage.rect;
    engine.ptT = [
      clamp((e.clientX - r.x - r.w / 2) / (r.w / 2), -1.5, 1.5),
      clamp(-(e.clientY - r.y - r.h / 2) / (r.h / 2), -1.5, 1.5),
    ];
  },
  { passive: true },
);
document.addEventListener('pointerleave', () => (engine.ptT = [0, 0]));
export function angleToward(el) {
  if (!Stage.rect || !el) return Math.PI / 2;
  const a = el.getBoundingClientRect(),
    r = Stage.rect;
  return Math.atan2(-(a.top + a.height / 2 - (r.y + r.h / 2)), a.left + a.width / 2 - (r.x + r.w / 2));
}
