/* The emotion stone, ready to use: put it on a canvas, tell it which feelings were chosen, and it lives.
 *
 *   await stoneReady();                                 // the twelve stones' art (about 520 KB, once)
 *   const stone = new Stone(canvas, { theme: 'light' });
 *   stone.set([{ id: 'sadness' }, { id: 'hope' }]);     // order does not matter
 *   const png = stillPNG([{ id: 'anger' }], 256);        // the same stone, every time
 */
import { loadArt } from './art';
import { outlineOf, StoneMotion } from './compose';
import { createRenderer, type StoneRenderer, type Theme } from './renderer';
import { describe as describeIds, type Feeling } from './resolve';

export interface StoneOptions {
  theme?: Theme;
  zoom?: number;
  initial?: Feeling[];
  /** follow the system's reduce-motion setting (default) or force it */
  reducedMotion?: boolean;
}

const mqReduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Resolves when every stone's art can be drawn; safe to call many times. */
export const stoneReady = loadArt;

export class Stone {
  readonly canvas: HTMLCanvasElement;
  readonly motion: StoneMotion;
  theme: Theme;
  zoom: number;
  private r: StoneRenderer;
  private raf = 0;
  private last = 0;
  private dpr = Math.min(3, globalThis.devicePixelRatio || 1);
  private times: number[] = [];
  private warm = 0;
  private skip = false;
  private odd = false;
  private drawn = false;
  private onScreen = true;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private onVis = () => this.loop();
  private forced: boolean | undefined;

  constructor(canvas: HTMLCanvasElement, o: StoneOptions = {}) {
    this.canvas = canvas;
    this.theme = o.theme ?? 'dark';
    this.zoom = o.zoom ?? 1;
    this.motion = new StoneMotion(o.initial ?? []);
    this.forced = o.reducedMotion;
    this.motion.reduced = this.forced ?? !!mqReduce?.matches;
    mqReduce?.addEventListener('change', () => this.setReducedMotion(this.forced));
    this.r = createRenderer(canvas);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    /* nothing to animate while the stone is scrolled out of view */
    this.io = new IntersectionObserver(([e]) => {
      this.onScreen = e.isIntersecting;
      this.loop();
    });
    this.io.observe(canvas);
    this.resize();
    document.addEventListener('visibilitychange', this.onVis);
    void loadArt().then(() => {
      this.paint();
      this.loop();
    });
    this.loop();
  }

  /** Choose 0..3 feelings. */
  set(feelings: Feeling[]): void {
    this.motion.set(feelings);
    this.canvas.setAttribute('aria-label', describeIds(feelings.map((f) => f.id)));
    this.loop();
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.paint();
    this.loop();
  }

  setReducedMotion(on: boolean | undefined): void {
    this.forced = on;
    this.motion.reduced = on ?? !!mqReduce?.matches;
    this.loop();
  }

  private resize(): void {
    const b = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(b.width * this.dpr)),
      h = Math.max(1, Math.round(b.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.paint();
  }

  private paint(): void {
    this.drawn = this.r.draw(this.motion.frame(), { theme: this.theme, zoom: this.zoom });
  }

  /** Runs while visible; with reduced motion it stops once a change has settled, and restarts on the next one. */
  private loop(): void {
    if (this.raf || document.hidden || !this.onScreen) return;
    this.last = performance.now();
    this.warm = 0;
    const tick = (now: number) => {
      this.raf = 0;
      if (document.hidden || !this.onScreen) return;
      const dt = (now - this.last) / 1000;
      this.last = now;
      this.adapt(dt);
      this.motion.update(dt);
      this.odd = !this.odd;
      if (!this.skip || this.odd || !this.drawn) this.paint();
      if (!this.motion.reduced || this.motion.morphing || !this.drawn) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Keep 60 fps where possible: every ten mostly slow frames take one step down (a lower pixel ratio, then 30 fps). */
  private adapt(dt: number): void {
    if (++this.warm <= 3) return;
    this.times.push(dt);
    if (this.times.length < 10) return;
    const median = [...this.times].sort((a, b) => a - b)[5];
    this.times = [];
    if (median < 0.024) return;
    if (this.dpr > 1.01) {
      this.dpr = Math.max(1, this.dpr - 0.5);
      this.resize();
    } else this.skip = true;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.r.dispose();
  }
}

/* ── stills ─────────────────────────────────────────────────────────── */
let stillCanvas: HTMLCanvasElement | null = null;
let stillR: StoneRenderer | null = null;
const stillMotion = new StoneMotion();
stillMotion.reduced = true;

/** Draw the canonical still of a choice (nothing moving) and return the canvas it is on, or null while the art is
    still loading (await stoneReady() first). Copy it out at once: the next still reuses the same canvas. */
export function stillCanvasFor(
  feelings: Feeling[],
  size = 256,
  theme: Theme = 'dark',
  zoom = 1,
): HTMLCanvasElement | null {
  if (!stillCanvas) {
    stillCanvas = document.createElement('canvas');
    stillR = createRenderer(stillCanvas, true);
  }
  stillCanvas.width = stillCanvas.height = size;
  stillMotion.snap(feelings);
  return stillR!.draw(stillMotion.frame(), { theme, zoom }) ? stillCanvas : null;
}
/** The zoom at which a choice's body fills `fill` of a still's half-width by its average reach, so stills of different
    stones carry the same visual weight; never so close that its farthest point leaves the frame. */
export function stillZoom(feelings: Feeling[], fill = 0.6): number {
  stillMotion.snap(feelings);
  const fr = stillMotion.frame();
  let mean = 0,
    max = 0;
  for (let i = 0; i < 64; i++) {
    const r = outlineOf(fr, (i / 64) * Math.PI * 2);
    mean += r / 64;
    max = Math.max(max, r);
  }
  return Math.min(fill / mean, 0.92 / max);
}
/** The canonical still as a transparent PNG data URL (empty while the art is loading). */
export function stillPNG(feelings: Feeling[], size = 256, theme: Theme = 'dark', zoom = 1): string {
  return stillCanvasFor(feelings, size, theme, zoom)?.toDataURL('image/png') ?? '';
}

export { describeIds as describe };
export type { Feeling };
