# Emotion stone

The stone in Daroon's check-in: twelve base stones, and any two or three of them combine into one new stone
(12 + 66 + 220 = 298 deterministic states). The design handoff is in [`brief.md`](./brief.md) and its tokens in
`apps/web/src/stone/presets.json`; the twelve stones themselves are the owner's designs in [`base/`](./base).

Try it at `/stone.html` (`pnpm --filter @daroon/web dev`, then open http://localhost:5173/stone.html).

## How it works

The stones are not re-created procedurally: the owner's art is the material, and a shader moves and combines it.

```
docs/stone/base/*.jpg ──(scripts/extract-stones.py)──► src/stone/art/<id>.webp   the stone's light on black
                                                       src/stone/art/outlines.json centre + outline in 256 directions

resolve.ts   choice → target: weights, which feeling forms the envelope / the middle / the core, a turn per feeling
choreo.ts    how each stone moves: hand-timed curves over a few motion primitives
compose.ts   time: 1.3 s smoothstep morphs between targets, a clock that never restarts
glsl.ts      one full-screen pass: motion → shared outline → each stone fitted into it → layers → dark or light ground
renderer.ts  WebGL2 (and a plain 2D fallback that shows the strongest stone)
stone.ts     Stone (canvas loop, pauses when hidden or off screen, adapts its resolution) and stills
```

- **A single stone** is drawn exactly as designed: its art, its outline, no turn.
- **A mix** gets one new outline: a soft maximum of the stones' outlines, (Σ wᵢ·rᵢ(θ)³)^⅓, so points and tips survive.
  Each stone's art is fitted into that outline at the same relative depth. The heaviest feeling (lowest uplift) forms
  the envelope and the lightest the core, the way the brief describes its examples: «a heavy blue envelope, a crimson
  fold inside, an amber core».
- **Motion** is designed per feeling in `choreo.ts`. Examples: the flames of longing sway upward every 3.2 s; anger
  beats every 2.6 s; hurt draws in, holds and lets go; fear recoils now and then. A mix blends the motions by weight.
  Reduced motion holds the stone still but keeps the morph.
- **Ground:** on a dark ground the light is added as it is. On a light ground it becomes tinted glass: the bright
  edges turn into the deepest colour and the pale core stays clear.

## Using it

```ts
import { Stone, stillPNG, stoneReady } from './stone/stone';
import { ID_BY_LABEL } from './stone/presets';

await stoneReady(); // the twelve stones’ art, about 520 KB, once
const stone = new Stone(canvas, { theme: 'light' });
stone.set([{ id: 'sadness' }, { id: 'hope' }]); // 0..3 feelings; order does not matter
stone.set([{ id: ID_BY_LABEL['خشم'], intensity: 0.4 }, { id: 'calm' }]); // optional intensities, 0..1
const png = stillPNG([{ id: 'anger' }], 192, 'light'); // transparent data URL
```

The canvas gets an `aria-label` such as «سنگ ترکیبی: غم، خشم، امید».

## Changing a stone

- **Its look:** replace its image in `docs/stone/base/` (1024², dark ground), then run
  `python3 apps/web/scripts/extract-stones.py <folder of the 1024² PNGs> <out>` and copy the WebPs and
  `outlines.json` into `src/stone/art/`.
- **Its motion:** edit its line in `choreo.ts`.

`pnpm --filter @daroon/web test` checks the following:

- the 298 states (counts, order independence, uniqueness)
- that a single stone is drawn untouched
- the envelope-to-core order
- that mixes keep points
- that morphs never jump
- that motion stays small and starts at rest

## Not yet in the app

The check-in still uses `src/sculpture`. Moving it over is a separate step: the stage flights and the trace marks
would call `Stone` and `stillPNG` instead of the old engine.
