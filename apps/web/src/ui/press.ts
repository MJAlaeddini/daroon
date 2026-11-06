/**
 * Every press is seen: whatever can be pressed sinks a little under the finger or the mouse, and comes back with a
 * settle when let go. The sink is the same few pixels at the edges whatever the size, so a small chip and a wide
 * card feel alike (a 44 px button goes to 0.96, a wide card to about 0.98).
 *
 * Done with the Web Animations API on the `scale` property, so it adds to each element's own transitions instead of
 * replacing them. Quiet when the person asked for calm motion.
 */
import { reduced } from '../sculpture/engine';

const PRESSABLE = 'button, [role="button"], a.link, a.navrow, .chip, label.chip';
/** Opt out: something that already moves under the finger in its own way. */
const OWN = '[data-nopress]';
/** damping 25 / stiffness 250, sampled: arrives with 1.7 % overshoot (see .claude/skills/daroon-motion). */
const SETTLE = CSS.supports('transition-timing-function', 'linear(0, 1)')
  ? 'linear(0, 0.133, 0.378, 0.614, 0.791, 0.907, 0.972, 1.004, 1.015, 1.016, 1.013, 1.009, 1.005, 1.003, 1.001, 1)'
  : 'cubic-bezier(0.22, 0.8, 0.24, 1)';
const EDGE = 6; // px the edges travel inward
const SLOP = 10; // px of finger travel that turns a press into a swipe or a scroll

let held: { el: HTMLElement; anim: Animation; x: number; y: number; s: number } | null = null;

function target(e: PointerEvent): HTMLElement | null {
  const el = (e.target as Element | null)?.closest?.<HTMLElement>(PRESSABLE);
  if (!el || el.closest(OWN)) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null;
  return el;
}

function release() {
  if (!held) return;
  const { el, anim, s } = held;
  held = null;
  anim.cancel();
  el.animate([{ scale: String(s) }, { scale: '1' }], {
    duration: 260,
    easing: SETTLE,
  });
}

export function setupPress() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || reduced()) return;
      const el = target(e);
      if (!el) return;
      release();
      const r = el.getBoundingClientRect(),
        s = Math.max(0.96, 1 - EDGE / Math.max(r.width, r.height, 1));
      const anim = el.animate([{ scale: '1' }, { scale: String(s) }], {
        duration: 90,
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        fill: 'forwards',
      });
      held = { el, anim, x: e.clientX, y: e.clientY, s };
    },
    { passive: true },
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (held && Math.hypot(e.clientX - held.x, e.clientY - held.y) > SLOP) release();
    },
    { passive: true },
  );
  for (const t of ['pointerup', 'pointercancel', 'dragstart'] as const)
    document.addEventListener(t, release, { passive: true });
  window.addEventListener('blur', release);
}
