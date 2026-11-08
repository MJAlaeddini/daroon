/* How each stone moves: a small set of motion primitives, timed by hand for each feeling.
 *
 * The shader knows only these primitives (all in units of the stone's radius, angles in radians):
 *   scale   the whole stone grows (+) or draws in (−)
 *   inner   the centre grows or draws in, the rim stays (a heartbeat, a contraction)
 *   swirl   the centre turns, the rim stays
 *   counter the inner half turns one way and the outer half the other
 *   rise    the centre lifts (+) or sinks (−)
 *   sway    a wave that travels up the body, bending it sideways (sway amplitude and its phase)
 *   ripple  rings that travel outward through the layers (amplitude and phase)
 *   tremor  a fine, quick shiver (amplitude and phase)
 *   glow    the inner light brightens (+) or dims (−)
 * A mix of feelings is the weighted sum of their primitives, so motion blends like everything else.
 * Every curve starts at rest (t = 0), and the canonical still uses no motion at all, so a still is each stone exactly
 * as designed. */
import type { EmotionId } from './presets';

export interface Moves {
  scale: number;
  inner: number;
  swirl: number;
  counter: number;
  rise: number;
  sway: number;
  swayPh: number;
  ripple: number;
  ripplePh: number;
  tremor: number;
  tremorPh: number;
  glow: number;
}
export const STILL: Moves = {
  scale: 0,
  inner: 0,
  swirl: 0,
  counter: 0,
  rise: 0,
  sway: 0,
  swayPh: 0,
  ripple: 0,
  ripplePh: 0,
  tremor: 0,
  tremorPh: 0,
  glow: 0,
};

const TAU = Math.PI * 2;
/** a plain sine with period T seconds */
const wave = (t: number, T: number, ph = 0) => Math.sin((TAU * t) / T + ph);
/** in and out, 0 → 1 → 0, eased at both ends (a breath) */
const swell = (t: number, T: number) => 0.5 - 0.5 * Math.cos((TAU * t) / T);
/** a beat: quick rise over `a` seconds, slow fall over `r`, repeating every T seconds */
function beat(t: number, T: number, a: number, r: number): number {
  const u = t % T;
  if (u < a) {
    const x = u / a;
    return x * x * (3 - 2 * x);
  }
  return Math.exp(-(u - a) / r) * (u < a + 5 * r ? 1 : 0);
}
/** two soft beats close together, then rest (lub-dub) */
const heartbeat = (t: number, T: number) => beat(t, T, 0.18, 0.28) + 0.6 * beat(Math.max(0, t - 0.42), T, 0.16, 0.32);
/** draw in, hold, let go, rest: the shape of being hurt */
function clench(t: number, T: number): number {
  const u = t % T;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (u < 0.7) return ease(u / 0.7);
  if (u < 1.9) return 1;
  if (u < 3.6) return 1 - ease((u - 1.9) / 1.7);
  return 0;
}

export const CHOREO: Record<EmotionId | 'neutral', (t: number) => Partial<Moves>> = {
  /* slow, even breath; the inner orb drifts a little */
  calm: (t) => ({ scale: 0.016 * wave(t, 7), swirl: 0.04 * wave(t, 11), glow: 0.06 * wave(t, 7) }),
  /* the core gathers light and lifts toward the crown, then settles */
  hope: (t) => ({
    rise: 0.035 * swell(t, 5),
    inner: 0.02 * swell(t, 5),
    glow: 0.18 * swell(t, 5),
    scale: 0.01 * wave(t, 5),
  }),
  /* a buoyant beat, and the ruffles of the bloom ripple outward */
  joy: (t) => ({
    scale: 0.022 * beat(t, 4.2, 0.35, 0.6),
    ripple: 0.006,
    ripplePh: (TAU * t) / 3,
    glow: 0.15 * beat(t, 4.2, 0.35, 0.6),
  }),
  /* flames: a sway that climbs the body, a quicker flicker of height and light */
  longing: (t) => ({
    sway: 0.045,
    swayPh: (TAU * t) / 3.2,
    scale: 0.012 * wave(t, 1.7),
    glow: 0.12 * swell(t, 1.6),
  }),
  /* the layers draw together on a soft lub-dub and hold each other */
  intimacy: (t) => ({ inner: -0.03 * heartbeat(t, 4.5), glow: 0.12 * heartbeat(t, 4.5), scale: 0.01 * wave(t, 9) }),
  /* the swirl turns in and comes back, like something that keeps returning */
  missing: (t) => ({ swirl: 0.16 * wave(t, 8), scale: -0.012 * wave(t, 8), glow: 0.05 * wave(t, 8) }),
  /* a slow sinking with each long breath; the light dims as it settles */
  sadness: (t) => ({ rise: -0.03 * swell(t, 9), scale: 0.012 * wave(t, 9), glow: -0.06 * swell(t, 9) }),
  /* it draws in, holds, slowly lets go, and rests */
  hurt: (t) => ({ inner: -0.04 * clench(t, 5.5), scale: -0.012 * clench(t, 5.5), glow: -0.05 * clench(t, 5.5) }),
  /* still, with a fine shiver, and now and then a small quick recoil */
  fear: (t) => ({
    scale: -0.03 * beat(t, 3.6, 0.07, 0.45),
    tremor: 0.0025,
    tremorPh: t * 14,
    glow: 0.1 * beat(t, 3.6, 0.07, 0.45),
  }),
  /* fine ripples that never quite stop, a soft high tremor */
  anxiety: (t) => ({
    ripple: 0.008,
    ripplePh: (TAU * t) / 1.3,
    tremor: 0.0018,
    tremorPh: t * 11,
    scale: 0.01 * wave(t, 2.6),
  }),
  /* the inside turns one way while the outside turns the other */
  confusion: (t) => ({ counter: 0.09 * wave(t, 6), scale: -0.012 * wave(t, 6) }),
  /* a strong, contained pulse; the heat flares with each beat and the centre twists a little */
  anger: (t) => ({
    scale: 0.028 * beat(t, 2.6, 0.12, 0.45),
    swirl: 0.06 * wave(t, 7),
    glow: 0.22 * beat(t, 2.6, 0.12, 0.45),
  }),
  /* the resting stone just breathes */
  neutral: (t) => ({ scale: 0.014 * wave(t, 8), glow: 0.05 * wave(t, 8) }),
};

export function movesAt(id: EmotionId | 'neutral', t: number): Moves {
  return { ...STILL, ...CHOREO[id](t) };
}
