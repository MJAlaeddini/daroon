/* «یه چیز کوچیک»: what the app gives back right after a check-in, from the first day on. Only counting, said
 * plainly (no advice, no reading into it), and how far the first pattern still is. */
import { PATTERN_RULES, SCENE_AT, familyOf, fa, isScene, keyAdd, patternReadiness, weekStart } from '@daroon/shared';

interface Entry {
  id: string;
  day: string;
  emotions: { key: string }[];
  scenes?: readonly string[] | null;
  deletedAt?: string | null;
}

const ORDINAL = ['اولین', 'دومین', 'سومین', 'چهارمین', 'پنجمین', 'ششمین', 'هفتمین', 'هشتمین', 'نهمین', 'دهمین'];
const ordinal = (n: number) => ORDINAL[n - 1] ?? `${fa(n)}مین`;
const family = (k: string) => familyOf(k) ?? k.replace(/^custom:/, '');

/** One honest sentence about this check-in within its week. */
export function smallThing(entry: Entry, all: Entry[]): string {
  const ws = weekStart(entry.day),
    we = keyAdd(ws, 6);
  const week = all.filter((e) => !e.deletedAt && e.day >= ws && e.day <= we);
  const f = entry.emotions[0] ? family(entry.emotions[0].key) : null;
  const scene = (entry.scenes || []).find(isScene);
  if (f && scene) {
    const n = week.filter(
      (e) => (e.scenes || []).includes(scene) && e.emotions.some((x) => family(x.key) === f),
    ).length;
    if (n >= 2) return `این ${ordinal(n)} باره این هفته که ${SCENE_AT[scene]}، «${f}» اومده.`;
  }
  if (f) {
    const n = week.filter((e) => e.emotions.some((x) => family(x.key) === f)).length;
    return n >= 2 ? `این ${ordinal(n)} باره این هفته که «${f}» اومده.` : `این هفته اولین باره که «${f}» اومده.`;
  }
  return `این ${ordinal(week.length)} ردپای این هفته‌ست.`;
}

/** How far the first pattern is: check-ins still needed, or days still needed; null once patterns can show. */
export function untilFirstPattern(all: Entry[]): { left: number; unit: 'entries' | 'days'; share: number } | null {
  const r = patternReadiness(all);
  if (r.ready) return null;
  const share =
    Math.min(1, r.entries / PATTERN_RULES.minEntries) * 0.7 + Math.min(1, r.days / PATTERN_RULES.minDays) * 0.3;
  if (r.entries < PATTERN_RULES.minEntries)
    return { left: PATTERN_RULES.minEntries - r.entries, unit: 'entries', share };
  return { left: PATTERN_RULES.minDays - r.days, unit: 'days', share };
}
