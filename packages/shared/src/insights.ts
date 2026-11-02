/**
 * Context of a check-in and the patterns read from it.
 *
 * A check-in can say who or what was around (at most two of a short list): the social setting, not a place on a
 * map. Patterns compare how often a feeling shows up in one setting against everywhere else, and only speak once
 * there is enough to count; the person then says whether it rings true. This is counting, not a cause.
 */
import { familyOf } from './lexicon';

export const SCENE_IDS = ['family', 'friends', 'partner', 'work', 'alone', 'out', 'online', 'body'] as const;
export type SceneId = (typeof SCENE_IDS)[number];
export const MAX_SCENES = 2;
/** How a setting reads in a list of chips. */
export const SCENES: Record<SceneId, string> = {
  family: 'خانواده',
  friends: 'دوستا',
  partner: 'رابطه',
  work: 'کار یا درس',
  alone: 'تنها',
  out: 'بیرون',
  online: 'فضای مجازی',
  body: 'بدن و خواب',
};
/** How a setting reads inside a sentence: «وقتی … بودی». */
export const SCENE_WHEN: Record<SceneId, string> = {
  family: 'با خانواده بودی',
  friends: 'با دوستات بودی',
  partner: 'پای رابطه‌ات وسط بود',
  work: 'سر کار یا درس بودی',
  alone: 'تنها بودی',
  out: 'بیرون بودی',
  online: 'توی فضای مجازی بودی',
  body: 'بدنت یا خوابت درگیر بود',
};
export const isScene = (s: string): s is SceneId => (SCENE_IDS as readonly string[]).includes(s);

/**
 * Thresholds, after the sociologist's draft: nothing before 20 check-ins over 8 days; a setting needs 5 check-ins
 * of its own and 8 elsewhere to compare with; the feeling must appear at least 4 times there and in a share at
 * least 25 points higher than elsewhere. A handful at most are shown, strongest first.
 */
export const PATTERN_RULES = { minEntries: 20, minDays: 8, minGroup: 5, minOther: 8, minHits: 4, minGap: 0.25, max: 3 };

export interface PatternEntry {
  day: string;
  emotions: { key: string }[];
  scenes?: readonly string[] | null;
  deletedAt?: string | null;
}
export interface Pattern {
  /** `${scene}|${feeling}`: stable across recounts, so a verdict stays with it. */
  id: string;
  scene: SceneId;
  /** The feeling's family (a refined word counts toward its family); custom words count as themselves. */
  key: string;
  /** Check-ins in this setting, and how many of them had the feeling. */
  group: number;
  hits: number;
  /** Check-ins without this setting, and how many of them had the feeling. */
  others: number;
  elsewhere: number;
}
export interface PatternReadiness {
  entries: number;
  days: number;
  /** Check-ins that say where or with whom. */
  tagged: number;
  ready: boolean;
}

export const patternId = (scene: SceneId, key: string): string => `${scene}|${key}`;
const feelingsOf = (e: PatternEntry): Set<string> => new Set(e.emotions.map((x) => familyOf(x.key) ?? x.key));
const scenesOf = (e: PatternEntry): SceneId[] => (e.scenes || []).filter(isScene);

export function patternReadiness(list: PatternEntry[]): PatternReadiness {
  const live = list.filter((e) => !e.deletedAt);
  const days = new Set(live.map((e) => e.day)).size;
  return {
    entries: live.length,
    days,
    tagged: live.filter((e) => scenesOf(e).length).length,
    ready: live.length >= PATTERN_RULES.minEntries && days >= PATTERN_RULES.minDays,
  };
}

export function findPatterns(list: PatternEntry[]): Pattern[] {
  const R = PATTERN_RULES;
  if (!patternReadiness(list).ready) return [];
  const live = list.filter((e) => !e.deletedAt).map((e) => ({ f: feelingsOf(e), s: scenesOf(e) }));
  const out: Pattern[] = [];
  for (const scene of SCENE_IDS) {
    const inside = live.filter((e) => e.s.includes(scene)),
      outside = live.filter((e) => !e.s.includes(scene));
    if (inside.length < R.minGroup || outside.length < R.minOther) continue;
    const keys = new Set(inside.flatMap((e) => [...e.f]));
    for (const key of keys) {
      const hits = inside.filter((e) => e.f.has(key)).length,
        elsewhere = outside.filter((e) => e.f.has(key)).length;
      if (hits < R.minHits || hits / inside.length - elsewhere / outside.length < R.minGap) continue;
      out.push({
        id: patternId(scene, key),
        scene,
        key,
        group: inside.length,
        hits,
        others: outside.length,
        elsewhere,
      });
    }
  }
  const gap = (p: Pattern) => p.hits / p.group - p.elsewhere / p.others;
  return out.sort((a, b) => gap(b) - gap(a) || b.hits - a.hits).slice(0, R.max);
}
