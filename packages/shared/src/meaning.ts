/**
 * The layer of meaning in a check-in, after the sociologist's draft: «حال، فقط از درون ما نمی‌آد». Besides the words,
 * a check-in can say how strong the feeling was and answer one small question about what was going on around it
 * (were you heard? was it in your hands?). One question at a time, so a check-in stays light; over weeks the answers
 * add up to a picture the counts alone can't give.
 */
import type { SceneId } from './insights';

/** How strong it was: 1 = a little, 2 = medium, 3 = a lot. */
export const INTENSITIES = [1, 2, 3] as const;
export type Intensity = (typeof INTENSITIES)[number];
export const INTENSITY_LABEL: Record<Intensity, string> = { 1: 'کم', 2: 'متوسط', 3: 'زیاد' };

export const MEANING_QS = ['heard', 'control'] as const;
export type MeaningQ = (typeof MEANING_QS)[number];
export const MEANING_AS = ['yes', 'some', 'no'] as const;
export type MeaningA = (typeof MEANING_AS)[number];

/** Each question: how it is asked, and how its answers read inside a sentence («وقتی … ،»). */
export const MEANING: Record<MeaningQ, { ask: string; yes: string; some: string; no: string }> = {
  heard: { ask: 'حس کردی شنیده شدی؟', yes: 'حس کردی شنیده شدی', some: 'کمی شنیده شدی', no: 'حس کردی شنیده نشدی' },
  control: {
    ask: 'اختیارش دست خودت بود؟',
    yes: 'اختیارش دست خودت بود',
    some: 'اختیارش کمی دستت بود',
    no: 'اختیارش دست خودت نبود',
  },
};
export const ANSWER_LABEL: Record<MeaningA, string> = { yes: 'آره', some: 'یه کم', no: 'نه' };

/** Settings with other people in them, where «were you heard?» makes sense. */
export const SOCIAL_SCENES: readonly SceneId[] = ['family', 'friends', 'partner', 'work', 'online'];
/** How a setting opens the question: «پیش دوستا، حس کردی شنیده شدی؟». */
export const SCENE_AT: Record<SceneId, string> = {
  family: 'با خانواده',
  friends: 'پیش دوستا',
  partner: 'توی رابطه',
  work: 'سر کار یا درس',
  alone: 'وقتی تنها بودی',
  out: 'بیرون',
  online: 'توی فضای مجازی',
  body: 'با این حال بدن',
};

/**
 * Which question to ask: «were you heard?» needs other people, so it comes only when a social setting was chosen,
 * and then takes turns with «was it in your hands?» (by how many questions were answered before).
 */
export function pickQuestion(scenes: readonly string[], answeredBefore: number): MeaningQ {
  const social = scenes.some((s) => (SOCIAL_SCENES as readonly string[]).includes(s));
  if (!social) return 'control';
  return answeredBefore % 2 === 0 ? 'heard' : 'control';
}
