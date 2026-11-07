/* Emotion stone presets.
 *
 * `presets.json` is the design handoff's source of truth (docs/stone/brief.md) and is kept byte-for-byte as delivered.
 * The handoff's tokens (lobes, uplift, compression…) describe a stone's character but not the sculptural signature
 * the brief's table asks for (a crescent cavity for missing, a pinched waist for fear, counter-currents for confusion).
 * Those signatures live here in SCULPT, as small extra tokens on the same 0..1 scale, so the JSON stays untouched and
 * every number that shapes a stone is still in one of two plain tables. */
import raw from './presets.json';

export const EMOTION_IDS = [
  'joy',
  'hope',
  'calm',
  'longing',
  'intimacy',
  'missing',
  'sadness',
  'hurt',
  'fear',
  'anxiety',
  'confusion',
  'anger',
] as const;
export type EmotionId = (typeof EMOTION_IDS)[number];

export interface Palette {
  outer: string;
  middle: string;
  core: string;
}
export interface ShapeTokens {
  lobes: number;
  asymmetry: number;
  sharpness: number;
  uplift: number;
  compression: number;
  turbulence: number;
}
export interface MotionTokens {
  drift: number;
  tremor: number;
  breathHz: number;
  pulseHz: number;
}
/** Sculptural signature: the extra geometry and movement that make a feeling recognisable without its colour. */
export interface SculptTokens {
  /** the body's proportions: wider (+) or narrower (−), taller (+) or shorter (−), as fractions */
  wide: number;
  tall: number;
  /** stretch along a tilted axis (ribbons) */
  elong: number;
  /** tilt of that axis from vertical, radians */
  tilt: number;
  /** depth of a crescent-shaped hollow on one side */
  cavity: number;
  /** how far lobes wind around the vertical axis from bottom to top */
  twist: number;
  /** upper and lower halves winding in opposite directions */
  counter: number;
  /** oblate flattening into broad membranes */
  flat: number;
  /** inward creases between lobes (shells folding in) */
  fold: number;
  /** shells drawn closer together, enveloping one another */
  nest: number;
  /** a soft opening at the crown */
  open: number;
  /** lobes favour the upper hemisphere, like petals */
  petal: number;
  /** fine, irregular surface ripples */
  ripple: number;
  /** a slow wave travelling upward through the form */
  rise: number;
  /** a wave that travels around the form and returns */
  wave: number;
  /** slow downward settling with each breath */
  settle: number;
  /** a small, quick contraction now and then */
  recoil: number;
  /** extra strength of the pulse that travels out from the core */
  pulse: number;
}
export interface Emotion {
  id: EmotionId;
  label: string;
  palette: Palette;
  shape: ShapeTokens;
  motion: MotionTokens;
  glow: number;
  sculpt: SculptTokens;
}

const Z: SculptTokens = {
  wide: 0,
  tall: 0,
  elong: 0,
  tilt: 0,
  cavity: 0,
  twist: 0,
  counter: 0,
  flat: 0,
  fold: 0,
  nest: 0,
  open: 0,
  petal: 0,
  ripple: 0,
  rise: 0,
  wave: 0,
  settle: 0,
  recoil: 0,
  pulse: 0,
};
export const SCULPT: Record<EmotionId, SculptTokens> = {
  joy: { ...Z, wide: 0.07, tall: -0.03, open: 0.55, petal: 0.25, flat: 0.15, pulse: 0.35, rise: 0.2 },
  hope: { ...Z, wide: -0.06, tall: 0.08, petal: 1, open: 0.35, rise: 0.8, twist: 0.25 },
  calm: { ...Z, wide: 0.16, tall: -0.16, flat: 0.75, nest: 0.15 },
  longing: { ...Z, wide: -0.08, elong: 0.85, tilt: 0.55, twist: 0.9, rise: 0.55, wave: 0.3 },
  intimacy: { ...Z, wide: 0.03, tall: -0.03, nest: 1, flat: 0.2, pulse: 0.15 },
  missing: { ...Z, wide: 0.06, cavity: 1, elong: 0.35, tilt: -0.9, wave: 0.8 },
  sadness: { ...Z, wide: 0.1, tall: -0.12, settle: 1, flat: 0.25, nest: 0.2 },
  hurt: { ...Z, wide: -0.07, tall: -0.07, fold: 1, nest: 0.65, recoil: 0.35 },
  fear: { ...Z, wide: -0.22, tall: 0.05, elong: 0.45, tilt: 0, nest: 0.35, recoil: 1, ripple: 0.3 },
  anxiety: { ...Z, wide: -0.06, tall: -0.04, ripple: 1, recoil: 0.15 },
  confusion: { ...Z, wide: 0.05, counter: 1, twist: 0.4, wave: 0.35 },
  anger: { ...Z, wide: 0.05, tall: -0.05, fold: 0.35, pulse: 1, twist: 0.6 },
};

/** The resting stone shown before anything is chosen: round, quiet, pale lilac. */
export const NEUTRAL: Emotion = {
  id: 'neutral' as EmotionId,
  label: '',
  palette: { outer: '#9AA3C8', middle: '#B9AACF', core: '#EBD9D6' },
  shape: { lobes: 3, asymmetry: 0.3, sharpness: 0.01, uplift: 0.1, compression: 0.04, turbulence: 0.06 },
  motion: { drift: 0.06, tremor: 0.01, breathHz: 0.1, pulseHz: 0.1 },
  glow: 0.01,
  sculpt: { ...Z, flat: 0.2, nest: 0.1 },
};

type RawEmotion = {
  label_fa: string;
  palette: Palette;
  shape: ShapeTokens;
  motion: MotionTokens;
  light: { glow: number };
};
const rawEmotions = raw.emotions as Record<EmotionId, RawEmotion>;

export const EMOTIONS: Record<EmotionId, Emotion> = Object.fromEntries(
  EMOTION_IDS.map((id) => {
    const r = rawEmotions[id];
    return [
      id,
      {
        id,
        label: r.label_fa,
        palette: r.palette,
        shape: r.shape,
        motion: r.motion,
        glow: r.light.glow,
        sculpt: SCULPT[id],
      },
    ];
  }),
) as Record<EmotionId, Emotion>;

export const RENDERER = raw.renderer;
export const EXAMPLES: { ids: EmotionId[]; description: string }[] = raw.exampleStates as {
  ids: EmotionId[];
  description: string;
}[];

/** The app speaks in Persian words; the stone speaks in ids. */
export const ID_BY_LABEL: Record<string, EmotionId> = Object.fromEntries(
  EMOTION_IDS.map((id) => [EMOTIONS[id].label, id]),
);
