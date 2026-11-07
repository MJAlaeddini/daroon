/* The emotion stone, ready to use: put it on a canvas, tell it which feelings were chosen, and it lives.
 *
 *   const stone = new Stone(canvas, { theme: 'light' });
 *   stone.set([{ id: 'sadness' }, { id: 'hope' }]);   // order does not matter
 *   const png = await stillPNG([{ id: 'anger' }], 256); // the same stone, every time
 */
import { describe as describeIds, type Feeling } from './resolve';
import { StoneMotion } from './motion';
import { createRenderer, type StoneRenderer, type Theme } from './renderer';
import type { V3 } from './field';

export interface StoneOptions {
  theme?: Theme;
  zoom?: number;
  initial?: Feeling[];
  /** follow the system's reduce-motion setting (default) or force it */
  reducedMotion?: boolean;
  /** mesh detail to start from (5 or 4); by default 4 on touch screens, 5 elsewhere. It only ever steps down. */
  detail?: number;
}

const mqReduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export class Stone {
  readonly canvas: HTMLCanvasElement;
  readonly motion: StoneMotion;
  theme: Theme;
  zoom: number;
  private r: StoneRenderer;
  private raf = 0;
  private last = 0;
  private dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  private times: number[] = [];
  private warm = 0;
  private step = 0;
  private skip = false;
  private odd = false;
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
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.r = createRenderer(canvas, false, o.detail ?? (coarse ? 4 : 5));
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
    this.loop();
  }

  /** Choose 0..3 feelings. `touch` is the direction (in the stone's frame) the press came from, if known. */
  set(feelings: Feeling[], touch?: V3): void {
    this.motion.set(feelings, touch);
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
    this.r.draw(this.motion.frame(), { theme: this.theme, zoom: this.zoom });
  }

  /** Runs while visible; with reduced motion it stops once a morph has settled, and restarts on the next change. */
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
      if (!this.skip || this.odd) this.paint();
      if (!this.motion.reduced || this.motion.morphing) this.raf = requestAnimationFrame(tick);
      else this.paint();
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Keep 60 fps where possible. Every ten frames that are mostly slow take one step down: a lower pixel ratio, then
      a lighter mesh, then every other frame (30 fps). The first frames after a start are skipped (shaders warming up). */
  private adapt(dt: number): void {
    if (++this.warm <= 3) return;
    this.times.push(dt);
    if (this.times.length < 10) return;
    const sorted = [...this.times].sort((a, b) => a - b);
    this.times = [];
    if (sorted[5] < 0.024) return;
    const steps = [
      () => (this.dpr > 1.5 ? ((this.dpr = 1.5), true) : false),
      () => (this.r.detail > 4 ? (this.r.setDetail(4), true) : false),
      () => (this.dpr > 1 ? ((this.dpr = 1), true) : false),
      () => (this.r.detail > 3 ? (this.r.setDetail(3), true) : false),
      () => ((this.skip = true), true),
    ];
    while (this.step < steps.length && !steps[this.step++]()) {
      /* that step had nothing left to give; try the next */
    }
    this.resize();
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

/** Draw the canonical still of a choice (every clock at zero) and return the canvas it is on. Copy it out at once
    (drawImage, toDataURL): the next still reuses the same canvas. */
export function stillCanvasFor(feelings: Feeling[], size = 256, theme: Theme = 'dark', zoom = 1): HTMLCanvasElement {
  if (!stillCanvas) {
    stillCanvas = document.createElement('canvas');
    /* stills are small: the lighter mesh is enough, except for large exports */
    stillR = createRenderer(stillCanvas, true, 4);
  }
  stillR!.setDetail(size > 400 ? 5 : 4);
  stillCanvas.width = stillCanvas.height = size;
  stillMotion.snap(feelings);
  stillR!.draw(stillMotion.frame(), { theme, zoom });
  return stillCanvas;
}
/** The canonical still as a transparent PNG data URL: for history and calendars. */
export function stillPNG(feelings: Feeling[], size = 256, theme: Theme = 'dark', zoom = 1): string {
  return stillCanvasFor(feelings, size, theme, zoom).toDataURL('image/png');
}
export async function stillBlob(feelings: Feeling[], size = 1024, theme: Theme = 'dark'): Promise<Blob> {
  const url = stillPNG(feelings, size, theme);
  return (await fetch(url)).blob();
}

export { describeIds as describe };
export type { Feeling };
