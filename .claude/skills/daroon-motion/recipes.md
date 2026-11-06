# Motion recipes for Daroon

Plain CSS and TypeScript for `apps/web`. Values follow the timing table in [SKILL.md](SKILL.md).

## Tokens

Daroon already has `--ease` (a soft decelerate), `--ease-in` (for exits) and `PAGER_EASE` in `ui/render.ts`. The
springs below were simulated from mass 1 with the given damping and stiffness and sampled into CSS `linear()`. The
shape is the spring's; take the duration from the table. Add them to `:root` in `app.css` when the first component
uses them:

```css
:root {
  --ease: cubic-bezier(0.22, 0.8, 0.24, 1); /* existing: decelerate, for most movement */
  --ease-in: cubic-bezier(0.55, 0, 0.75, 0.1); /* existing: for leaving */
  --ease-out: cubic-bezier(0, 0, 0.2, 1); /* press down, quick answers */
  --spring-settle: var(--ease); /* fallback where linear() is missing */
  --spring-lift: var(--ease);
}
@supports (transition-timing-function: linear(0, 1)) {
  :root {
    /* damping 25, stiffness 250: arrives, overshoots 1.7 %, settles. The default for things that move. */
    --spring-settle: linear(
      0,
      0.133,
      0.378,
      0.614,
      0.791,
      0.907,
      0.972,
      1.004,
      1.015,
      1.016,
      1.013,
      1.009,
      1.005,
      1.003,
      1.001,
      1
    );
    /* damping 24, stiffness 320: overshoots 5.7 %. Only for small celebrations (saved, «آره»). */
    --spring-lift: linear(
      0,
      0.193,
      0.526,
      0.807,
      0.973,
      1.045,
      1.057,
      1.043,
      1.023,
      1.009,
      1,
      0.997,
      0.997,
      0.998,
      0.999,
      1
    );
  }
}
```

Avoid the common "snappy" spring (damping 15, stiffness 400): it overshoots 28 % and feels like a toy.

## Press

```css
.thing {
  transition:
    scale 180ms var(--spring-settle),
    background-color 160ms ease;
}
.thing:active {
  scale: 0.96;
  transition-duration: 90ms;
  transition-timing-function: var(--ease-out);
}
```

Down is fast and plain, release is the spring. Use `scale` (the individual property), not `transform`, so it
composes with whatever transform the element already has. Add the element's selector to `TICK` in
`ui/haptics.ts` if the press is one that matters.

## Hover, on desktop only

```css
@media (hover: hover) {
  .card:hover,
  .card:focus-visible {
    translate: 0 -2px;
    background-color: var(--surface-2);
  }
}
.card {
  transition:
    translate 200ms var(--spring-settle),
    background-color 200ms ease;
}
```

Lift by tone, not by shadow: Daroon's surfaces are glass.

## Entrance and exit of a small element (toast, pill, chip)

```css
.pill {
  transition:
    opacity 260ms var(--ease),
    translate 300ms var(--spring-settle);
  @starting-style {
    opacity: 0;
    translate: 0 10px;
  }
}
.pill.leaving {
  opacity: 0;
  translate: 0 -6px;
  transition-duration: 200ms;
  transition-timing-function: var(--ease-in);
}
```

Remove the element on `transitionend` of `opacity`, or after the duration with a timeout as `renderView` does.
Where `@starting-style` is missing, the element simply appears, which is an acceptable fallback.

## Staggered list

```ts
import { reduced } from '../sculpture/engine';

// After the list is in the DOM. Up to six items cascade; the rest arrive with the sixth.
export function stagger(items: HTMLElement[], step = 50) {
  if (reduced()) return;
  // animate() doesn't read CSS variables, so take the curve from the token once
  const easing = getComputedStyle(document.documentElement).getPropertyValue('--spring-settle').trim() || 'ease-out';
  items.forEach((el, i) =>
    el.animate(
      [
        { opacity: 0, translate: '0 12px' },
        { opacity: 1, translate: '0 0' },
      ],
      { duration: 320, delay: Math.min(i, 5) * step, easing, fill: 'backwards' },
    ),
  );
}
```

A CSS-only version: give each item `--i` and use `animation-delay: calc(min(var(--i), 5) * 50ms)`. Run it once per visit, not on every re-render.

## Sheet

```css
.sheet-backdrop {
  transition: opacity 200ms ease;
}
.sheet-backdrop.leaving {
  transition-duration: 150ms;
}
.sheet-panel {
  transition:
    translate 380ms var(--spring-settle),
    opacity 240ms var(--ease);
  @starting-style {
    translate: 0 24px;
    opacity: 0;
  }
}
.sheet-panel.leaving {
  translate: 0 12px;
  opacity: 0;
  transition-duration: 220ms;
  transition-timing-function: var(--ease-in);
}
```

The sculpture stays visible behind sheets (see `pickAnchor` in `stage/stage.ts`); don't fade it.

## Liquid segmented control (week / month)

One pill moves under the labels. While it travels it stretches toward the target, then settles.

```css
.seg {
  position: relative;
}
.seg .thumb {
  position: absolute;
  inset-block: 3px;
  inset-inline-start: 3px;
  inline-size: calc(50% - 3px);
  border-radius: 999px;
  background: var(--surface-2);
  translate: calc(var(--at, 0) * -100%) 0; /* RTL: the second option sits to the left */
  transition: translate 340ms var(--spring-settle);
}
.seg .thumb.moving {
  animation: seg-stretch 340ms var(--ease);
}
@keyframes seg-stretch {
  40% {
    scale: 1.18 0.92;
  }
}
```

Set `--at` to the chosen index and add `.moving` for one run (remove it on `animationend`). Keep the labels' colour
change at 160 ms so the text settles before the pill does.

## Icon, once, when a tab becomes active

```css
.bottomnav button[aria-current='page'] svg {
  animation: tab-nudge 420ms var(--spring-settle);
}
@keyframes tab-nudge {
  0% {
    translate: 0 0;
  }
  35% {
    translate: 0 -3px;
    scale: 1.08;
  }
  100% {
    translate: 0 0;
    scale: 1;
  }
}
```

For a line icon, redraw its stroke instead: put `pathLength="1"` on each path, animate `stroke-dashoffset` from 1 to 0
over 500 ms. Either effect plays once, never loops, and is disabled by the reduced-motion block.

## Waiting: a breathing orb

```css
.wait-orb {
  inline-size: 56px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--orb);
  box-shadow: 0 0 32px var(--orb-glow);
  animation: breathe 2.4s ease-in-out infinite;
}
@keyframes breathe {
  50% {
    scale: 0.96;
    opacity: 0.6;
  }
}
```

Pair it with one line of colloquial text that changes every few seconds («داره نوشته می‌شه…»). No spinners, no
progress percentages, and never the word "AI".

## Reduced motion

The global block in `app.css` (`[data-motion='reduced'] *`) already shortens transitions to 150 ms and stops
animations. For anything driven by `element.animate()`, check `reduced()` first and skip the movement, keeping
only the opacity change. Haptics already go quiet in calm mode.
