/**
 * On a phone an entry's card is swiped to the left to show what can be done with it underneath (delete at the outer
 * edge, edit next to it), the way a mail app does. The card follows the finger, stretches a little past the actions,
 * and settles open or closed by where and how fast it was let go. One card is open at a time; a tap anywhere else,
 * a scroll, or a tap on the open card closes it. The first time a day with entries is shown on a touch screen, the
 * first card leans aside for a moment to show that it can.
 */
import { reduced } from '../sculpture/engine';
import { haptic } from './haptics';

const EASE = 'cubic-bezier(.32,.72,0,1)';
const HINT_KEY = 'daroon.swipeHint';

interface Drag {
  ent: HTMLElement;
  card: HTMLElement;
  id: number;
  x: number;
  y: number;
  base: number;
  axis: 'x' | 'y' | null;
  pos: number;
  v: number;
  lastX: number;
  lastT: number;
}
let drag: Drag | null = null;
let opened: HTMLElement | null = null;
let hinted = false;

/** How far the card moves to uncover the actions: from the panel's outer edge to the inner side of the last button. */
function reach(ent: HTMLElement) {
  const panel = ent.querySelector<HTMLElement>('.ent-swipe'),
    last = panel?.lastElementChild;
  if (!panel || !last) return 150;
  const a = panel.getBoundingClientRect(),
    b = last.getBoundingClientRect();
  // right to left: the actions sit at the right edge, so measure from the panel's right
  return Math.round(a.right - b.left + 6);
}

function place(ent: HTMLElement, x: number, animate: boolean) {
  const card = ent.querySelector<HTMLElement>('.ent-card');
  if (!card) return;
  card.style.transition = animate && !reduced() ? `translate .42s ${EASE}` : 'none';
  card.style.translate = x ? `${x}px 0` : '';
  if (x) ent.classList.add('swiping');
  else if (animate && !reduced())
    setTimeout(
      () => ent.isConnected && !ent.classList.contains('open') && !drag && ent.classList.remove('swiping'),
      420,
    );
  else ent.classList.remove('swiping');
}

export function closeSwipe(animate = true) {
  const ent = opened;
  opened = null;
  if (!ent?.isConnected) return;
  ent.classList.remove('open');
  place(ent, 0, animate);
}

function open(ent: HTMLElement) {
  if (opened && opened !== ent) closeSwipe();
  opened = ent;
  ent.classList.add('open');
  place(ent, -reach(ent), true);
}

/** A swipe is not a tap: swallow the click that follows it. */
function swallowClick(card: HTMLElement) {
  const stop = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  card.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => card.removeEventListener('click', stop, { capture: true }), 350);
}

function hint(ent: HTMLElement) {
  hinted = true;
  let seen = '1';
  try {
    seen = localStorage.getItem(HINT_KEY) || '';
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* storage blocked: show the hint this once */
  }
  if (seen || reduced()) return;
  const card = ent.querySelector<HTMLElement>('.ent-card');
  if (!card) return;
  ent.classList.add('swiping');
  card.animate(
    [
      { translate: '0 0' },
      { translate: '-56px 0', offset: 0.4 },
      { translate: '-56px 0', offset: 0.6 },
      { translate: '0 0' },
    ],
    { duration: 1500, delay: 900, easing: 'ease-in-out' },
  ).onfinish = () => opened !== ent && ent.classList.remove('swiping');
}

export function setupEntrySwipe() {
  const touch = matchMedia('(hover: none)');
  document.addEventListener(
    'pointerdown',
    (e) => {
      const t = e.target as Element | null;
      if (opened && !opened.contains(t)) closeSwipe();
      if (e.pointerType === 'mouse' || drag) return;
      const card = t?.closest?.<HTMLElement>('.ent-card');
      const ent = card?.closest<HTMLElement>('.ent');
      if (!card || !ent || t?.closest('.ent-tools')) return;
      const now = performance.now();
      drag = {
        ent,
        card,
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        base: ent === opened ? -reach(ent) : 0,
        axis: null,
        pos: ent === opened ? -reach(ent) : 0,
        v: 0,
        lastX: e.clientX,
        lastT: now,
      };
    },
    { passive: true },
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (!drag.axis && Math.hypot(dx, dy) > 8) drag.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (drag.axis !== 'x') return;
      const now = performance.now();
      drag.v = (e.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
      drag.lastX = e.clientX;
      drag.lastT = now;
      const w = reach(drag.ent);
      let x = drag.base + dx;
      // past the actions, and back past closed, the card stretches instead of following
      if (x < -w) x = -w + (x + w) * 0.25;
      if (x > 0) x *= 0.2;
      // a light tick as the actions come fully into view
      if (drag.pos > -w * 0.55 && x <= -w * 0.55) haptic(6);
      drag.pos = x;
      place(drag.ent, x, false);
    },
    { passive: true },
  );
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.axis === null) {
      // a tap on the open card closes it rather than doing anything else
      if (opened === d.ent) {
        swallowClick(d.card);
        closeSwipe();
      }
      return;
    }
    if (d.axis !== 'x') return;
    swallowClick(d.card);
    const w = reach(d.ent);
    if (d.v < -0.35 || (d.v <= 0.35 && d.pos < -w * 0.4)) open(d.ent);
    else {
      if (opened === d.ent) opened = null;
      d.ent.classList.remove('open');
      place(d.ent, 0, true);
    }
  };
  document.addEventListener('pointerup', end, { passive: true });
  document.addEventListener('pointercancel', end, { passive: true });
  addEventListener('scroll', () => opened && !drag && closeSwipe(), { passive: true });

  // the one-time hint, when entries first appear on a touch screen
  let pending = 0;
  new MutationObserver(() => {
    if (hinted || !touch.matches || pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      const first = document.querySelector<HTMLElement>('.ents .ent');
      if (first) hint(first);
    });
  }).observe(document.body, { childList: true, subtree: true });
}
