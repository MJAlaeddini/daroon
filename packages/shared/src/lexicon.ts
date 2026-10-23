/**
 * The emotion vocabulary. The twelve core words sit on a semantic ring; each has three finer words.
 * The visual side (palettes, form parameters) lives in the web app; this is only the words.
 */
export const CORE_KEYS = [
  'آرامش', 'امید', 'خوشحالی', 'اشتیاق', 'سردرگمی', 'نگرانی', 'ترس', 'خشم', 'دلخوری', 'غم', 'دلتنگی', 'صمیمیت',
] as const;
export type CoreKey = (typeof CORE_KEYS)[number];

export const REFINE: Record<CoreKey, string[]> = {
  'خوشحالی': ['شادی', 'رضایت', 'سرخوشی'], 'آرامش': ['آسودگی', 'سبکی', 'رهایی'], 'صمیمیت': ['نزدیکی', 'قدردانی', 'محبت'],
  'امید': ['خوش‌بینی', 'انتظار', 'انگیزه'], 'اشتیاق': ['هیجان', 'کنجکاوی', 'بی‌تابی'], 'دلتنگی': ['حسرت', 'دلگیری', 'تنهایی'],
  'غم': ['اندوه', 'دلشکستگی', 'بی‌حوصلگی'], 'دلخوری': ['رنجش', 'کلافگی', 'ناامیدی'], 'خشم': ['عصبانیت', 'حرص', 'بیزاری'],
  'نگرانی': ['دلشوره', 'دلهره', 'بلاتکلیفی'], 'ترس': ['هراس', 'ناامنی', 'بی‌پناهی'], 'سردرگمی': ['گیجی', 'دوگانگی', 'پریشانی'],
};
/** Words that are not a refinement of their family but still belong to it. */
export const EXTRA: Record<string, CoreKey> = { 'پشیمانی': 'غم' };

export const CUSTOM_PREFIX = 'custom:';
export const MAX_EMOTIONS = 3;
export const MAX_CUSTOM_LEN = 24;

const ALL = new Set<string>([...CORE_KEYS, ...Object.values(REFINE).flat(), ...Object.keys(EXTRA)]);
export const isKnownEmotion = (k: string): boolean => ALL.has(k);
export const isCustomEmotion = (k: string): boolean => k.startsWith(CUSTOM_PREFIX) && k.length > CUSTOM_PREFIX.length;
export const labelOf = (k: string): string => (k.startsWith(CUSTOM_PREFIX) ? k.slice(CUSTOM_PREFIX.length) : k);
/** The core family a word belongs to, or null for custom words. */
export function familyOf(k: string): CoreKey | null {
  if ((CORE_KEYS as readonly string[]).includes(k)) return k as CoreKey;
  for (const [par, list] of Object.entries(REFINE)) if (list.includes(k)) return par as CoreKey;
  return EXTRA[k] ?? null;
}
