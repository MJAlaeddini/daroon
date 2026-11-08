/* Emotion stone presets: the twelve feelings with their Persian names, palettes and motion tokens.
 * `presets.json` is the design handoff (docs/stone/brief.md), kept byte-for-byte as delivered. How each stone looks
 * comes from the owner's art (art.ts); how it moves is designed in choreo.ts. */
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
export interface Emotion {
  id: EmotionId;
  label: string;
  palette: Palette;
  shape: ShapeTokens;
  motion: MotionTokens;
  glow: number;
}

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
