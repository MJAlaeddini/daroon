/**
 * Swiping sideways on a phone moves between the three tabs, like tapping them in the bottom bar. The bar reads right
 * to left (today, archive, patterns), so a finger moving right brings the next tab in from the left. The page leans a
 * little with the finger; a short or slow swipe springs back.
 */
import { $ } from '../core/util';
import { reduced } from '../sculpture/engine';
import { S } from '../state/app';

const TABS = ['today', 'archive', 'patterns'] as const;
const EDGE = 24; // leave the screen edges to the system's own back gesture
const LEAN = 0.22; // how much of the finger's travel the page follows
const MAX_LEAN = 36;

interface Track {
  x: number;
  y: number;
  t: number;
  dx: number;
  axis: 'x' | 'y' | null;
  view: HTMLElement | null;
}
let tr: Track | null = null;

function blocked(target: EventTarget | null): boolean {
  if (S.sheet || S.story || S.done || !(TABS as readonly string[]).includes(S.view)) return true;
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  if (el.closest('input, textarea, select, [contenteditable], [data-noswipe], .srow, .jump')) return true;
  // anything that scrolls sideways keeps the gesture for itself
  for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
}

function lean(dx: number) {
  if (!tr?.view || reduced()) return;
  const d = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, dx * LEAN));
  tr.view.style.transition = 'none';
  tr.view.style.transform = `translateX(${d}px)`;
}

function settle(view: HTMLElement | null) {
  if (!view || !view.style.transform) return;
  view.style.transition = 'transform .32s cubic-bezier(.32,.72,0,1)';
  view.style.transform = '';
  setTimeout(() => (view.style.transition = ''), 340);
}

export function setupSwipe() {
  const host: HTMLElement | null = $('#views');
  if (!host) return;
  host.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      tr = null;
      if (e.touches.length !== 1) return;
      const p = e.touches[0];
      if (p.clientX < EDGE || p.clientX > innerWidth - EDGE || blocked(e.target)) return;
      tr = {
        x: p.clientX,
        y: p.clientY,
        t: performance.now(),
        dx: 0,
        axis: null,
        view: host.querySelector<HTMLElement>('.view:not(.leaving)'),
      };
    },
    { passive: true },
  );
  host.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (!tr || e.touches.length !== 1) return;
      const p = e.touches[0],
        dx = p.clientX - tr.x,
        dy = p.clientY - tr.y;
      if (!tr.axis && Math.hypot(dx, dy) > 10) tr.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (tr.axis !== 'x') return;
      tr.dx = dx;
      lean(dx);
    },
    { passive: true },
  );
  const end = () => {
    const t = tr;
    tr = null;
    if (!t || t.axis !== 'x') return;
    const dt = performance.now() - t.t,
      far = Math.abs(t.dx) > 70,
      flick = Math.abs(t.dx) > 34 && dt < 260,
      i = TABS.indexOf(S.view as (typeof TABS)[number]),
      next = TABS[i + (t.dx > 0 ? 1 : -1)];
    if (!(far || flick) || !next) return settle(t.view);
    // the page goes on from where the finger left it; the tab change slides it the rest of the way
    const btn = $(`.bottomnav [data-go="${next}"]`) || $(`.topnav [data-go="${next}"]`);
    if (btn) btn.click();
    else settle(t.view);
  };
  host.addEventListener('touchend', end, { passive: true });
  host.addEventListener('touchcancel', () => {
    const t = tr;
    tr = null;
    settle(t?.view ?? null);
  });
}
