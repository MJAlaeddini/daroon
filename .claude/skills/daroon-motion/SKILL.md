---
name: daroon-motion
description: How things move and respond in Daroon's web app (apps/web). Use before adding or changing any transition,
  animation, press or hover state, page or sheet entrance, list reveal, loading state or haptic, and when the owner
  says a screen feels static, cheap, jumpy or cluttered. Gives the timing table, the curves, the choreography rules
  and a checklist to run before committing.
---

# Motion in Daroon

Distilled from the ui_motion_prompts material (uimotionprompts.com) and adapted to Daroon: vanilla TypeScript and CSS
(no React, no Framer Motion), Persian RTL, a calm journal for feelings, a WebGL sculpture that is the centre of
every screen. The owner is very sensitive to choreography, clutter and typography; `e2e/acceptance` guards the
choreography. Ready-made CSS is in [recipes.md](recipes.md).

## The principles

1. **Motion explains, it doesn't decorate.** Every movement answers one question: where did this come from, what
   did my touch do, what changed, where did it go. If a movement answers none of them, remove it.
2. **Motion follows hierarchy.** The most important thing moves first and most; supporting things follow, smaller
   and quieter. Only one thing on screen should be clearly moving at a time. In Daroon that is usually the
   sculpture; the UI waits for it.
3. **Leaving is faster than arriving.** An exit takes 20–30% less time than the matching entrance, and the old thing
   is gone before the new thing arrives (`renderView` in `ui/render.ts` already does this with `.veil` and `--d0`).
   Never cross-fade two pages of text over each other.
4. **A press is felt and seen within 100 ms.** It needs a visible change (scale, tone) and, on Android, a haptic tick
   (`ui/haptics.ts`). A slow animation after a tap reads as lag.
5. **Physical, not mechanical.** No `linear` easing and no `ease` / `ease-in-out` defaults on anything that moves.
   Position, scale and rotation follow a decelerating curve or a spring. Colour and opacity can use a plain ease.
6. **Calm is the house style.** Daroon is a quiet place for difficult feelings. Use springs with almost no
   overshoot (under 3%), short distances (8–20 px, scale 0.96–1.04) and no bounce on anything that carries
   meaning. A little overshoot is allowed only on small celebratory moments (saving a check-in, a pattern answer).
7. **Consistent or it feels cheap.** Durations and curves come from the tokens (see recipes.md), not invented per
   component. If a value isn't in the table, the component is probably doing something it shouldn't.
8. **Only compositor properties.** Animate `transform`/`translate`/`scale`/`rotate`, `opacity` and `filter` (sparingly).
   Never `width`, `height`, `top`, `left`, `margin` or `padding`. Never `transition: all`.
9. **Reduced motion is a real version, not an off switch.** Under `prefers-reduced-motion` or the app's calm setting
   (`[data-motion='reduced']`, `reduced()` in `sculpture/engine.ts`), movement becomes a 150 ms opacity change,
   nothing slides, nothing scales, haptics stay off. The meaning must survive.
10. **Fewer, better.** About three to five micro-interactions per screen. Clutter in motion is still clutter.

## Timing table

| What                                  | Duration            | Curve                         |
| ------------------------------------- | ------------------- | ----------------------------- |
| Press feedback (down)                 | 80–120 ms           | `--ease-out`                  |
| Press release / hover / focus         | 150–200 ms          | `--spring-settle` or `--ease` |
| Small element in (chip, toast, pill)  | 220–300 ms          | `--spring-settle`             |
| Card, sheet, panel in                 | 300–450 ms          | `--spring-settle` / `--ease`  |
| Same thing out                        | 200–320 ms (≈ 0.7×) | `--ease-in`                   |
| Page change (tab pager)               | 560 ms (existing)   | `PAGER_EASE`                  |
| Page change with the sculpture flying | set by `renderView` | don't hand-tune               |
| Stagger between list items            | 40–60 ms            | max 6 items, then all at once |
| Stagger between sections              | 90–120 ms           |                               |
| Ambient loops (breathing, loading)    | 2.4–7 s             | `ease-in-out`, sine-like      |

Under 50 ms a stagger can't be seen; above 100 ms per item a list feels slow. A list never takes longer than
about 400 ms in total to finish arriving.

## Step by step: adding motion to a screen

1. **Write the story in one line.** "The card rises from where the finger was, then its two buttons follow." If you
   can't, the motion isn't needed.
2. **List states, not animations.** For each element: hidden → entering → resting → pressed → leaving. Which states
   exist, and what triggers each? Sheets and toasts have all five; a label may have only resting.
3. **Pick values from the table.** Duration by size and role, curve by property. Big things move slower and less
   far; small things faster.
4. **Order the choreography.** Who leaves first, what moves during the pause, who arrives and in what order. Respect
   the sculpture: UI text never arrives while the sculpture is still travelling, and never sits over it.
5. **Implement with CSS first.** Transitions for state changes, `@starting-style` or a class for entrances,
   `element.animate()` only when JS must know when it ends (removing the old page, for example). Use `:active` for
   presses and `:focus-visible` wherever there's `:hover`.
6. **Write the reduced version.** Check it under `[data-motion='reduced']`: still understandable, nothing slides.
7. **Test on a phone-sized viewport.** Throttle the CPU 4× in DevTools. Anything that stutters there is animating
   the wrong property or doing too much at once.
8. **Run the guards.** `pnpm --filter @daroon/web exec playwright test e2e/acceptance` (no jumps, no text over the
   sculpture, the old page leaves before the new one arrives, reduced motion respected), then lint, typecheck and
   prettier.

## Patterns worth bringing into Daroon

Taken from the catalog and adapted to Daroon; each has a recipe:

- **Press (built: `ui/press.ts`):** everything pressable sinks under the finger or mouse in 90 ms and settles back
  when let go. The edges travel about 6 px whatever the size (0.96 for a small button, about 0.98 for a wide card). It
  runs on `scale` through the Web Animations API, so it adds to a component's own transitions. Opt out with
  `data-nopress`.
- **Gliding choice (built: `ui/glide.ts`):** the chosen item's surface is its `::before`, and it glides from the last
  choice with a slight stretch instead of jumping. Segmented controls, the bottom nav and the week strip use it; the
  nav icon nudges and the day's entries arrive after it. A new control that should glide: style its chosen state on
  `::before` and add a line to `GROUPS`.
- **Staggered reveal:** day entries, stories and insights arrive 50 ms apart, rising 12 px, once per visit.
- **Breathing orb for waiting:** while a story is being written, a soft orb breathes (scale 0.96 ↔ 1, opacity
  0.6 ↔ 1, 2.4 s) instead of a spinner, with a line of colloquial text that changes slowly.
- **A little celebration (built: `landed()` in `ui/done.ts`):** when the saved check-in's seed becomes today's mark,
  today lifts 8 px and settles with a slight overshoot, and the phone ticks for 14 ms. Nothing else in the app bounces.
- **Sheet entrance:** the backdrop fades in over 200 ms while the panel rises 24 px with the settle spring. On exit
  the panel drops 12 px and fades in 220 ms; the backdrop follows in 150 ms.

## Things that don't fit Daroon

- Hover lift with deep shadows on cards (Daroon's cards are glass and flat; lift by tone, not shadow).
- Bouncy press springs (the common 15/400 default overshoots by 28%).
- Scroll-triggered reveals on every section (pages are short; the sculpture already draws the eye).
- Confetti, sparkles, rockets, wobbling bells: wrong tone for feelings.
- Motion on text that is being read (stories, notes): text arrives once and then stays still.

## Before committing

- [ ] Every animated property is transform, opacity or filter; no `transition: all`.
- [ ] Durations and curves come from the tokens.
- [ ] Exit is shorter than entrance; old content is gone before new content arrives.
- [ ] Every press has visible feedback within 100 ms; touch targets are at least 44 px.
- [ ] `:hover` effects also apply on `:focus-visible`.
- [ ] Reduced and calm modes: opacity only, about 150 ms, no haptics.
- [ ] Nothing new appears over the sculpture or makes the layout jump.
- [ ] Acceptance tests, lint, typecheck and prettier pass.
