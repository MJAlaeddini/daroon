# Emotion stone

A real-time, parameter-driven stone for Daroon's check-in: twelve base feelings, and any two or three of them combine
into one new stone (12 + 66 + 220 = 298 deterministic states). The design handoff is in [`brief.md`](./brief.md);
its tokens are `apps/web/src/stone/presets.json`, kept exactly as delivered. The reference images are in
`references/` (concepts only, not textures).

Try it at `/stone.html` (`pnpm --filter @daroon/web dev`, then open http://localhost:5173/stone.html).

## Architecture

The app is vanilla TypeScript with its own WebGL2 renderer, so the stone is too: no Three.js or React. The whole
engine is about 40 KB minified, it is one program and one mesh, and premultiplied compositing stays under our control.

```
presets.json ─┐
presets.ts ───┴─► resolve.ts ──► motion.ts ──► renderer.ts ──► <canvas>
 tokens +        set → target    time, morph,   WebGL2: 4 shells × (back, front)
 SCULPT          (deterministic) clocks         Canvas 2D fallback
                                    │
                         field.ts ◄─┘  (CPU reference of the shape; glsl.ts is its port)
                                    │
                         stone.ts:  Stone (canvas + RAF loop), stillPNG (export)
```

| File          | Role                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presets.ts`  | Loads the JSON and adds `SCULPT`: small extra tokens for each feeling's sculptural signature (a crescent hollow for _missing_, a pinched body for _fear_, counter-currents for _confusion_…), plus the neutral resting stone.                                                         |
| `resolve.ts`  | `resolveState(feelings)`: sorts the ids, hashes them (FNV-1a) to a seed and derives weights, each feeling's region on the surface, lobe phases, pose and tension. Same set → same target, in any order, on any device.                                                                |
| `field.ts`    | The radial field `R(n)`, documented in the file. Each feeling adds a broad silhouette `G_i` and a surface character `L_i`, weighted partly by its weight and partly by a soft spatial mask, so a mix keeps every feeling's features in its own region instead of averaging them away. |
| `motion.ts`   | Tracks for every feeling; a 1.3 s smoothstep from wherever the stone is to the new target (interruptible); breath, pulse, drift and tremor integrated as phases so frequencies never jump; reduced motion freezes the clocks but keeps the morph.                                     |
| `glsl.ts`     | Vertex shader = `field.ts` on the GPU (shape and normals from uniforms only); fragment shader = palettes mixed in OKLab by region, a softly lit core, translucent veils with thin rims and silk lines; a small halo.                                                                  |
| `renderer.ts` | One icosphere (10 242 vertices) drawn 8 times: back faces outer → inner, then front faces inner → outer. No depth buffer, no sorting, no additive blending, so it works on the light page too. Canvas 2D fallback traces the same field.                                              |
| `stone.ts`    | `Stone` binds a canvas: RAF loop that pauses when hidden, pixel ratio 1–2 lowered under load, then 30 fps. `stillPNG()` renders the canonical still (all clocks at zero) for history and calendar marks.                                                                              |

## Using it

```ts
import { Stone, stillPNG } from './stone/stone';
import { ID_BY_LABEL } from './stone/presets';

const stone = new Stone(canvas, { theme: 'light' }); // follows prefers-reduced-motion unless told otherwise
stone.set([{ id: 'sadness' }, { id: 'hope' }]); // 0..3 feelings; order does not matter
stone.set([{ id: ID_BY_LABEL['خشم'], intensity: 0.4 }, { id: 'calm' }]); // optional intensities, 0..1
const png = stillPNG([{ id: 'anger' }], 192, 'light'); // data URL, transparent
```

The canvas gets an `aria-label` such as «سنگ ترکیبی: غم، خشم، امید».

## Tuning

Everything that shapes a stone is in two tables: `presets.json` (the handoff) and `SCULPT` in `presets.ts`. A change to
the field must be made in both `field.ts` and `glsl.ts`. `pnpm --filter @daroon/web test` checks the 298 states (counts,
order independence, uniqueness), bounds (`0.72 ≤ R ≤ 1.27`), that every single and the brief's triple have their own
silhouette, that each feeling in a mix owns a region, and that a morph never moves the surface more than 0.02 per frame.

## Not yet in the app

The check-in still uses `src/sculpture`. Moving it over is a separate step: the stage flights and the trace marks
would call `Stone` and `stillPNG` instead of the old engine.
