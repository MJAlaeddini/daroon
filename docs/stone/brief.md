# DAROON — Emotion Stone Generative Design System

**Implementation handoff for a coding LLM**  
Version: 0.1 · UI language: Persian (RTL)

## Goal / هدف

The Daroon emotional check-in UI displays one continuously animated, translucent, organic 3D stone. Users may select **1–3 unique feelings** from the 12 feelings below. Every _single_ feeling must have an independent recognisable base stone. Any _unordered_ combination of 2 or 3 must produce **ONE NEW coherent stone** — not multiple stones overlaid, not a crossfade between PNGs, and not a mere average of colors.

There are 12 one-feeling presets + C(12,2)=66 pairs + C(12,3)=220 triples = **298 distinct categorical states**. We need a parameter-driven runtime system, **not 298 hand-authored assets**. Intensities can add continuous variants later.

## Visual north star

Use provided references for STYLE, not as sprites: delicate, translucent organic sculpture, very soft milky glass / resin, 3D depth, interleaved veil-like layers, restrained pink/blue/amber core, internal motion. A feeling's shape must be legible even if colors are reduced. Background `#100E1B`. Keep 35% **less** glare than bright concept images. No neon flames, hard geometry spikes, aggressive sparkles, starburst flares, excessive glow. Treat this object as an intimate emotional companion.

_Render ONE rock at a time._ A newly selected feeling contributes its unique visual grammar. A new combination becomes a **third design**, not a stack of images. Motion is calm and elegant, including for negative feelings.

## 12 emotion IDs

| id        | label   | sculptural signature                   | movement                           |
| --------- | ------- | -------------------------------------- | ---------------------------------- |
| joy       | خوشحالی | opens in rounded soft waves            | warm buoyant pulse                 |
| hope      | امید    | petals gently rise                     | core rises toward crown            |
| calm      | آرامش   | broad smooth membranes                 | slow breathing                     |
| longing   | اشتیاق  | elongated flowing ribbons              | upward/outward wave                |
| intimacy  | صمیمیت  | nested enveloping layers               | converge and gently hold           |
| missing   | دلتنگی  | crescent cavity and stretched fold     | distant returning wave             |
| sadness   | غم      | drooping weighted volume               | slow inward settling               |
| hurt      | دلخوری  | folding inward tighter shells          | pauses and contracts               |
| fear      | ترس     | compact vertically pinched shape       | tiny abrupt recoil                 |
| anxiety   | نگرانی  | many fine irregular ripples            | soft higher-frequency tremor       |
| confusion | سردرگمی | asymmetrical contradicting currents    | disoriented multi-directional flow |
| anger     | خشم     | angularer stress folds, contained heat | stronger pulse, not strobe         |

All numerical preset values, colors and renderer parameters are in `emotion_presets.json`, which is the **source of truth**. Interpret them as aesthetic targets, not precomputed geometry.

## Geometry / renderer

Suggested desktop/web stack: **Three.js + React Three Fiber + custom GLSL or TSL shaders**. On native platforms implement the same math in Metal, RealityKit, SceneKit, or a suitable GPU abstraction. Ask for the actual app stack if needed, but make the demo run without proprietary services.

1. A single center object composed of 4 coherent soft shells (`radii=[0.58,0.78,0.94,1.06]`). They are NOT one per feeling. They are layers of the one stone. Shared, related shape field at each radius; slightly varied phase to suggest translucency and depth.
2. Use a high-quality ico/UV sphere mesh with displaced vertices, smooth normals and a consistent view angle; no geometry reconstruction on a state change. Prefer a vertex shader and fresnel/gradient fragment shader.
3. Abstract radial field at unit direction `n`: `R(n,t,w) = R0 * clamp(1 + 0.055*Nbase(n) + Σ_i w_i*F_i(n,t) + 0.02*Fcross(n,w), 0.72, 1.27)`. `F_i` is a continuous lobe/ripple/bending field driven by that emotion's `shape` and `motion` attributes; keep field amplitudes bounded (roughly <=0.14). Do not make this polygonal or star-like.
4. Each `F_i` should have emotion-unique harmonic modes, e.g. `sin(lobes_i * azimuth + 1.7*elevation + seedPhase_i + t*drift_i)` plus a second lower-frequency warped wave. `uplift` favors the upper hemisphere and `compression` pinches the lower silhouette; `sharpness` affects ridge falloff with continuous smoothing. `asymmetry` alters amplitude or phase. Smoothly layer another low-frequency noise field. Distinct frequencies are required; averaging exact meshes leads to blandness.
5. Preserve distinctive features in a mix: (a) shared smooth weighted global form, **plus** (b) a bounded localized nonlinear dominant feature for each emotion (softmax envelope), avoiding averaging away features from opposite poles (anger vs calm, hope vs sadness). Morph must never snap or self-intersect.
6. Core is softly luminous, outer shells translucent and restrained. Fresnel rims are thin, not bright bands. Favor painterly internal lighting and subtle depth over bloom. Avoid too many alpha layers and transparency sorting artifacts. Good target: premultiplied alpha, consistent front/back order, no additive blending for every shell.

## Color blending: no muddy averaging

Do **not** take a weighted RGB average of two or three palettes (which makes generic grey/brown objects). Each selected emotion contributes color to **regions of one surface**. Soft angular/perlin masks `M_i(position, seed)` create fluid overlapping bands. Compute:

`color(p) = Σ_i (w_i * M_i(p)) * palette_i(p) / max(epsilon, Σ_i w_i*M_i(p))`

Masks must be smooth, spatially warped and soft-edged, not sharply segregated flag stripes. Mix in a perceptual color space if possible, apply lighting in linear color space. Favor different palette roles: outer veils cooler/quieter, mid layer colored, inner core warmer, unless a cold state dominates. Do not increase peak emissive just because more feelings are selected.

## Combining 2 or 3 / API behavior

- Selection is a **set**, not an ordered sequence: `[joy,anger]` and `[anger,joy]` MUST yield the same final appearance. For a given selection, sort IDs before hashing to a stable seed. This excludes random arbitrary appearance changes on reload.
- If intensities do not exist, set `w_i=1/N`. Otherwise clamp intensity to `[0,1]`, normalize to sum 1, and apply smooth temporal interpolation of the weights.
- If 2 emotions: neither is only a tint; both must influence shape, motion, and internal color. A 2-state mix gets 2 broad interweaving streams and one shared center.
- If 3 emotions: 3 distinct currents weave into **one** coherent sculpture; not 3 blobs or disconnected shells. Avoid pure tri-color partitions.
- On add/remove/change, transition from _current_ weights to _target_ weights over `1.3s` using `smoothstep`, smoothly interpolate morph fields, color bands, shell deformation, movement amplitude. Continue the global clock: the stone should feel like one living organism, not reappear or restart.
- When crossing opposing energies, permit a little more inner tension/ripple but keep stone readable and never take a sum of sharpness values unrestricted.

Pseudocode:

```ts
type EmotionId = keyof typeof presets.emotions;
interface Feeling {
  id: EmotionId;
  intensity?: number;
}

function resolveState(selected: Feeling[]): ResolvedEmotionState {
  if (selected.length < 1 || selected.length > 3) throw new Error('select 1..3');
  if (new Set(selected.map((s) => s.id)).size !== selected.length) throw new Error('duplicate');
  const ordered = [...selected].sort((a, b) => a.id.localeCompare(b.id));
  const raw = ordered.map((x) => Math.max(0, Math.min(1, x.intensity ?? 1)));
  const sum = raw.reduce((a, b) => a + b, 0);
  const weights = sum > 0 ? raw.map((x) => x / sum) : raw.map(() => 1 / raw.length);
  return { ordered, weights, seed: stableHash(ordered.map((x) => x.id).join('|')) };
}

// In each animation frame: weight uniforms lerp current -> resolved target with smoothstep.
// Shader resolves geometry and material from SAME weights; time never resets.
```

## Reference pair/triple designs

- `anger + sadness`: heavy cobalt/violet outer volume, enclosed burnt-coral crease. Two signatures visible even without color.
- `calm + joy`: gently open soft bowl, sea-glass translucent veils, peach light in the center.
- `anger + sadness + hope`: heavy blue envelope; tense crimson internal fold; ascending ivory-amber core peeking through a curved opening. Distinct from every pair.
- `fear + anxiety + confusion`: compact asymmetry, subtle rapid tiny ridges, cool lilac core (no strobe).
- `joy + longing + hope`: raised blooming silhouette, peach-pink and delicate amber, restrained positive energy.

## Motion and interaction

- Initial state: neutral resting stone or initially selected emotion (follow product state). Pulse/breath always continuous at modest amplitude.
- On press of an emotion chip, immediately interpolate target weights: 0–250ms stone registers touch as a small wave; 250–1300ms global form and material morph; afterwards autonomous living motion continues.
- Physical amplitude should respond to emotion but remain on an intentional compact visual scale suitable for mobile. Easing `smoothstep` or damped spring, no overshoot for fear/anxiety unless very subtle.
- Reduced Motion mode: static pose with minimal/no oscillation; state change cross-morph persists, with shorter duration; still meaningful distinction via geometry and color.
- Mobile: scale device pixel ratio to 1–2, target 60fps (30fps graceful fallback), minimize draw calls/transparency overdraw. Pause/slow when app backgrounded. Never require remote inference to animate locally.

## UX

Persian RTL emotion picker displays the 12 labels. Max 3 simultaneous choices; explain when at capacity instead of silently dropping one. Selected IDs are stored as an **unordered set**. Each time the user makes a selection, the center stone visibly reacts. Provide an accessible textual label like `سنگ ترکیبی: غم، خشم، امید` and do not rely on color alone. Export a deterministic still (`PNG with alpha`) of any resolved state for history/calendar thumbnails. If initial platform uses SVG/Canvas2D, it may be used for a low-fidelity prototype; primary target is shader-based depth and coherence.

## Deliverables for implementation LLM

1. Build an interactive real-time demo that can select any 1, 2 or 3 of the 12 emotion IDs.
2. Load `emotion_presets.json`, use the renderer contract and compositing rules. Ensure **298** unique deterministic combination targets; don't prebuild 298 meshes.
3. Render all 12 single states in a comparison sheet (thumbnails) and also the 5 specified example mixes.
4. Implement animation/morph when adding/removing feelings, responsive mobile layout, RTL labels, reduced-motion support.
5. Provide readable editable source code, setup/build commands, and an export-still function.
6. Audit with screenshots for reference-style match. The supplied contact-sheet images are **concepts**, not literal source texture maps or implementation assets.

## Acceptance criteria

- Exactly 12 base presets, C(12,2)=66 pair targets and C(12,3)=220 triple targets.
- `resolve([A,B]) == resolve([B,A])`; same for any triple permutation, across reloads.
- Stone for `[anger,sadness,hope]` recognisably differs from each single and each selected pair, in silhouette and layered flow, not just hue.
- Morph seamless on add/remove. One coherent sculpture centered; no stacked separate objects.
- Reduced glow vs latest concept sheet; subdued and intimate rather than dazzling.
- Accessibility and performance requirements met.

## Files in this package

- `emotion_presets.json` — palette + geometry + motion tokens, intended for direct runtime ingestion
- `references/01_base_stone_art_direction.png` — preferred first concept's core aesthetic
- `references/02_base_emotion_contact_sheet.png` — rough ideation for 12 individual states
- `references/03_pair_and_triple_concepts.png` — rough ideation for combinations

**IMPORTANT:** Ignore printed words in concept images for programmatic extraction; map feelings by ID from `emotion_presets.json`. Avoid sampling exact values from images. Make the design more restrained than concept renders and integrate art direction by eye.
