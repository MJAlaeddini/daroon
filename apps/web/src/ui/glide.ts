/**
 * The chosen one of a group glides to its new place instead of jumping there: the thumb of a segmented control, the
 * bottom nav's capsule, the chosen day's capsule in the week. On the way it stretches a little toward where it is
 * going and then settles, like a drop of liquid.
 *
 * The capsule is the chosen item's `::before`. Positions are remembered relative to the group, so the glide also
 * works when the group was rendered again (same key), not only when an attribute changed in place. Nothing moves
 * when the person asked for calm motion, or when the browser can't animate a pseudo-element.
 */
import { reduced } from '../sculpture/engine';

interface Group {
  group: string;
  item: string;
  /** Groups with the same key are the same control, even across renders. */
  key: (g: Element) => string;
  /** Something small that follows the glide (the chosen tab's icon nudges, the day's entries arrive). */
  then?: (item: HTMLElement, g: Element) => void;
}
interface Spot {
  el: Element;
  at: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Decelerates hard and lands without overshoot: calm, like the tab pager. */
const EASE = 'cubic-bezier(.32,.72,0,1)';
const DUR = 420;

const GROUPS: Group[] = [
  {
    group: '.seg',
    item: '[aria-pressed="true"]',
    key: (g) =>
      'seg:' +
      (g.getAttribute('aria-label') || g.closest('[aria-label]')?.getAttribute('aria-label') || '') +
      ':' +
      ((g.firstElementChild as HTMLElement | null)?.dataset.id || ''),
  },
  { group: '.bn-in', item: '[aria-current="page"]', key: () => 'nav', then: nudgeIcon },
  {
    group: '.wribbon',
    item: '.is-sel',
    // a new week is a new control: changing week has its own swipe
    key: (g) => 'week:' + ((g.querySelector('[data-day]') as HTMLElement | null)?.dataset.day || ''),
    then: (_, g) => arrive(g.closest('.wk2')),
  },
];

const spots = new Map<string, Spot>();
const canGlide = typeof KeyframeEffect !== 'undefined' && 'pseudoElement' in KeyframeEffect.prototype;

function spot(g: Element, it: Element): Spot | null {
  const a = g.getBoundingClientRect(),
    b = it.getBoundingClientRect();
  if (!b.width || !a.width) return null;
  return { el: g, at: [...g.children].indexOf(it), x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
}

function visit(G: Group, g: Element, quiet: boolean, replaced: Set<string>) {
  const k = G.key(g),
    it = g.querySelector<HTMLElement>(G.item);
  if (!it) return void spots.delete(k);
  const now = spot(g, it);
  if (!now) return;
  const was = spots.get(k);
  spots.set(k, now);
  // a move is a different item chosen in the same control: changed in place, or rendered again in this same step.
  // The same item staying chosen (a resize) is not a move, nor is a control coming back after being away.
  if (quiet || !was || was.at === now.at || reduced() || !canGlide) return;
  if (was.el !== g && !replaced.has(k)) return;
  const dx = was.x + was.w / 2 - (now.x + now.w / 2),
    dy = was.y + was.h / 2 - (now.y + now.h / 2),
    // stretch with the distance travelled, never more than a seventh
    s = 1 + Math.min(0.14, (Math.hypot(dx, dy) / now.w) * 0.07);
  it.animate(
    [
      { translate: `${dx}px ${dy}px`, scale: `${was.w / now.w} ${was.h / now.h}` },
      { scale: `${s} ${2 - s}`, offset: 0.45 },
      { translate: '0 0', scale: '1 1' },
    ],
    { duration: DUR, easing: EASE, pseudoElement: '::before' },
  );
  G.then?.(it, g);
}

function scan(quiet = false, replaced = new Set<string>()) {
  for (const G of GROUPS)
    document.querySelectorAll(G.group).forEach((g) => g.closest('.leaving') || visit(G, g, quiet, replaced));
}

/** Keys of the controls inside a node: for removed nodes, the controls being rendered again. */
function keysIn(n: Node, out: Set<string>) {
  if (!(n instanceof Element)) return out;
  for (const G of GROUPS) {
    if (n.matches(G.group)) out.add(G.key(n));
    n.querySelectorAll(G.group).forEach((g) => out.add(G.key(g)));
  }
  return out;
}

/** The chosen tab's icon makes one small lift as the capsule arrives. */
function nudgeIcon(it: HTMLElement) {
  it.querySelector('.ic')?.animate(
    [{ translate: '0 0' }, { translate: '0 -3px', scale: '1.08', offset: 0.35 }, { translate: '0 0', scale: '1' }],
    { duration: 460, easing: EASE, delay: 80 },
  );
}

/** A newly chosen day's entries arrive one after another, after its words. */
function arrive(box: Element | null) {
  box?.querySelectorAll<HTMLElement>('.wk2-list .ent, .wk2-list .dd-empty').forEach((el, i) =>
    el.animate(
      [
        { opacity: 0, translate: '0 10px' },
        { opacity: 1, translate: '0 0' },
      ],
      { duration: 360, delay: 140 + Math.min(i, 5) * 55, easing: EASE, fill: 'backwards' },
    ),
  );
}

const inGroup = (n: Node) => n instanceof Element && GROUPS.some((G) => n.closest(G.group));

export function setupGlide() {
  scan(true);
  // runs before the next paint, so the capsule never shows at its new place before it starts gliding
  new MutationObserver((ms) => {
    const replaced = new Set<string>(),
      added = new Set<string>();
    let hit = false;
    for (const m of ms)
      if (m.type === 'attributes') hit ||= inGroup(m.target);
      else {
        m.removedNodes.forEach((n) => keysIn(n, replaced));
        m.addedNodes.forEach((n) => keysIn(n, added));
      }
    if (hit || added.size) scan(false, replaced);
  }).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'aria-current', 'class'],
  });
}
