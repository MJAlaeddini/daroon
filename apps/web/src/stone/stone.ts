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
  private slow = 0;
  private skip = false;
  private odd = false;
  private ro: ResizeObserver;
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
    if (this.raf || document.hidden) return;
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = 0;
      if (document.hidden) return;
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

  /** Keep 60 fps where possible: first lower the pixel ratio, then draw every other frame (30 fps). */
  private adapt(dt: number): void {
    if (dt > 0.5) return;
    this.slow = this.slow * 0.95 + (dt > 0.024 ? 1 : 0) * 0.05;
    if (this.slow > 0.6) {
      this.slow = 0;
      if (this.dpr > 1.01) {
        this.dpr = Math.max(1, this.dpr * 0.75);
        this.resize();
      } else this.skip = true;
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.r.dispose();
  }
}

/* ── stills ─────────────────────────────────────────────────────────── */
let stillCanvas: HTMLCanvasElement | null = null;
let stillR: StoneRenderer | null = null;
const stillMotion = new StoneMotion();
stillMotion.reduced = true;

/** The canonical still of a choice (every clock at zero) as a transparent PNG data URL: for history and calendars. */
export function stillPNG(feelings: Feeling[], size = 256, theme: Theme = 'dark', zoom = 1): string {
  if (!stillCanvas) {
    stillCanvas = document.createElement('canvas');
    stillR = createRenderer(stillCanvas, true);
  }
  stillCanvas.width = stillCanvas.height = size;
  stillMotion.snap(feelings);
  stillR!.draw(stillMotion.frame(), { theme, zoom });
  return stillCanvas.toDataURL('image/png');
}
export async function stillBlob(feelings: Feeling[], size = 1024, theme: Theme = 'dark'): Promise<Blob> {
  const url = stillPNG(feelings, size, theme);
  return (await fetch(url)).blob();
}

export { describeIds as describe };
export type { Feeling };
