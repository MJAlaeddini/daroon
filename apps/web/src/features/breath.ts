import { reduced } from '../sculpture/engine';
import { Stage } from '../stage/stage';

/* A word breathed into the stone, and back out again (the feeling picker). The word lifts from its place in its own
   colour, is drawn into the middle of the stone and fades as it shrinks; the stone takes the feeling as it arrives.
   Taking a word out plays it backwards, a little faster. The flying copy lives outside #views, on its own layer, so it
   never counts as text over the sculpture and is never caught in a page change. */

const IN_MS = 640;
const OUT_MS = 480;
/** how far into the flight the stone takes the word: as it reaches the stone's middle, not after it has vanished */
export const ARRIVE = 0.62;

function flyer(from: HTMLElement, label: string, colour: string): { el: HTMLElement; fx: number; fy: number } {
  const r = from.getBoundingClientRect(),
    cs = getComputedStyle(from);
  const el = document.createElement('span');
  el.className = 'breath';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = label;
  el.style.cssText = `font-size:${cs.fontSize};font-family:${cs.fontFamily};color:${colour};text-shadow:0 0 18px ${colour}`;
  document.body.append(el);
  return { el, fx: r.left + r.width / 2, fy: r.top + r.height / 2 };
}
function stoneMiddle(): [number, number] | null {
  const s = Stage.rect;
  return s && Stage.shown ? [s.x + s.w / 2, s.y + s.h / 2] : null;
}
const at = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;

/** Breathes `from`'s word into the stone. `arrive` runs as it reaches the stone (at once without motion). */
export function breatheIn(from: HTMLElement, label: string, colour: string, arrive: () => void): void {
  const mid = stoneMiddle();
  if (reduced() || !mid) return arrive();
  const { el, fx, fy } = flyer(from, label, colour);
  const [tx, ty] = mid;
  const a = el.animate(
    [
      { transform: at(fx, fy, 1), opacity: 1, filter: 'blur(0px)', easing: 'cubic-bezier(0, 0, 0.2, 1)' },
      {
        transform: at(fx, fy - 12, 1.14),
        opacity: 1,
        filter: 'blur(0px)',
        offset: 0.24,
        easing: 'cubic-bezier(0.55, 0, 0.75, 0.1)',
      },
      { transform: at(tx, ty, 0.3), opacity: 0, filter: 'blur(3px)' },
    ],
    { duration: IN_MS, fill: 'forwards' },
  );
  let done = false;
  const land = () => {
    if (!done) ((done = true), arrive());
  };
  setTimeout(land, IN_MS * ARRIVE);
  a.finished.then(
    () => el.remove(),
    () => el.remove(),
  );
  a.finished.then(land, land);
}
/** Draws a word out of the stone back to `to`, which stays hidden until the word has landed on it. */
export function breatheOut(to: HTMLElement, label: string, colour: string): void {
  const mid = stoneMiddle();
  if (reduced() || !mid) return;
  const { el, fx, fy } = flyer(to, label, colour);
  const [tx, ty] = mid;
  to.classList.add('landing');
  const a = el.animate(
    [
      { transform: at(tx, ty, 0.3), opacity: 0, filter: 'blur(3px)' },
      { transform: at(fx, fy, 1), opacity: 1, filter: 'blur(0px)' },
    ],
    { duration: OUT_MS, easing: 'cubic-bezier(0, 0, 0.2, 1)', fill: 'forwards' },
  );
  const end = () => {
    to.classList.remove('landing');
    el.remove();
  };
  a.finished.then(end, end);
}
