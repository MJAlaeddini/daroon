import { S } from '../state/app';

/* ═════════════════════════ guided discovery (deterministic, no AI) ═════════════════════════ */
export const Q1 = {
  q: 'از یه جای ساده شروع کنیم: الان کدوم بیشتر شبیه حالته؟',
  opts: [
    { id: 'event', t: 'یه اتفاق از ذهنم بیرون نمی‌ره', mod: { sep: 0.05 } },
    { id: 'thoughts', t: 'ذهنم شلوغه', mod: { tens: 0.2, freq: 0.2, turb: 0.1 } },
    { id: 'body', t: 'بیشتر توی تنم حسش می‌کنم', mod: { coh: 0.1, exp: -0.05 } },
    { id: 'vague', t: 'یه حالیه که نمی‌دونم چیه', mod: { diff: 0.15, sep: 0.1 } },
    { id: 'none', t: 'هیچ‌کدوم؛ نمی‌دونم', mod: {} },
  ],
};
export const Q2 = {
  event: {
    q: 'از اون اتفاق، چی بیشتر توی ذهنت مونده؟',
    opts: [
      { id: 'person', t: 'حرف یا رفتار یه نفر', sug: ['دلخوری', 'رنجش', 'خشم', 'قدردانی'], mod: { tens: 0.1 } },
      {
        id: 'expect',
        t: 'اون‌طور که انتظار داشتم نشد',
        sug: ['ناامیدی', 'دلخوری', 'غم', 'حسرت'],
        mod: { lum: -0.1 },
      },
      { id: 'self', t: 'کاری که کردم، یا نکردم', sug: ['پشیمانی', 'رضایت', 'دلشوره', 'کلافگی'], mod: { coh: 0.1 } },
      {
        id: 'change',
        t: 'یه چیزی عوض شد',
        sug: ['بلاتکلیفی', 'امید', 'دلتنگی', 'هیجان'],
        mod: { energy: 0.1, dx: 0.2 },
      },
      { id: 'unsure', t: 'دقیق نمی‌دونم', sug: [], mod: { sep: 0.1 }, vague: true },
    ],
  },
  thoughts: {
    q: 'فکرت بیشتر پیش چیه؟',
    opts: [
      { id: 'past', t: 'چیزی که گذشته', sug: ['حسرت', 'پشیمانی', 'دلتنگی', 'قدردانی'], mod: { dx: -0.2 } },
      {
        id: 'future',
        t: 'چیزی که ممکنه پیش بیاد',
        sug: ['نگرانی', 'امید', 'اشتیاق', 'بلاتکلیفی'],
        mod: { dy: 0.1, tens: 0.1 },
      },
      {
        id: 'tasks',
        t: 'کارهایی که روی دوشمه',
        sug: ['کلافگی', 'نگرانی', 'انگیزه', 'رضایت'],
        mod: { tens: 0.2, turb: 0.1 },
      },
      {
        id: 'many',
        t: 'همه‌چی با هم',
        sug: ['سردرگمی', 'کلافگی', 'دلشوره', 'کنجکاوی'],
        mod: { sep: 0.2, turb: 0.15 },
      },
      { id: 'unsure', t: 'نمی‌دونم', sug: [], mod: {}, vague: true },
    ],
  },
  body: {
    q: 'توی تنت، بیشتر شبیه کدومه؟',
    opts: [
      {
        id: 'heavy',
        t: 'سنگینی، یه جور گرفتگی',
        sug: ['غم', 'دلگیری', 'دلتنگی', 'بی‌حوصلگی'],
        mod: { dy: -0.3, exp: -0.08, lum: -0.1 },
      },
      { id: 'tense', t: 'تنش، بی‌قراری', sug: ['نگرانی', 'خشم', 'اشتیاق', 'کلافگی'], mod: { tens: 0.25, freq: 0.2 } },
      {
        id: 'light',
        t: 'سبکی، انگار باری برداشته شده',
        sug: ['آرامش', 'شادی', 'رهایی', 'سبکی'],
        mod: { exp: 0.1, lum: 0.15, dy: 0.2 },
      },
      {
        id: 'tired',
        t: 'خستگی، بی‌جونی',
        sug: ['بی‌حوصلگی', 'دلگیری', 'آرامش', 'کلافگی'],
        mod: { energy: -0.25, lum: -0.1 },
      },
      { id: 'unsure', t: 'نمی‌دونم', sug: [], mod: {}, vague: true },
    ],
  },
  vague: {
    q: 'بی‌آنکه اسمش رو بذاری، به کدوم نزدیک‌تره؟',
    opts: [
      {
        id: 'pressure',
        t: 'انگار یه چیزی فشارم می‌ده',
        sug: ['کلافگی', 'نگرانی', 'دلخوری', 'بلاتکلیفی'],
        mod: { coh: 0.15, exp: -0.1, tens: 0.2 },
      },
      {
        id: 'missing',
        t: 'انگار یه چیزی کمه',
        sug: ['دلتنگی', 'تنهایی', 'حسرت', 'انتظار'],
        mod: { asym: 0.2, sep: 0.1 },
      },
      {
        id: 'changing',
        t: 'انگار یه چیزی داره عوض می‌شه',
        sug: ['امید', 'بلاتکلیفی', 'کنجکاوی', 'دلشوره'],
        mod: { dy: 0.2, energy: 0.1 },
      },
      {
        id: 'between',
        t: 'انگار بین دو تا حالم',
        sug: ['دوگانگی', 'سردرگمی', 'امید', 'دلتنگی'],
        mod: { sep: 0.3 },
      },
      { id: 'neither', t: 'هیچ‌کدوم از این‌ها نیست', sug: [], mod: {}, vague: true },
    ],
  },
  none: {
    q: 'چطور ادامه بدیم؟',
    opts: [
      { id: 'words', t: 'چند تا کلمه ببینم', go: 'explore' },
      { id: 'write', t: 'یه جمله درباره‌ش بنویسم', go: 'write' },
      { id: 'keep', t: 'فعلاً همین «نمی‌دونم» رو ثبت کنم', go: 'unnamed' },
      { id: 'stop', t: 'الان نه؛ بعداً', go: 'exit' },
    ],
  },
};
export const CTX_NAME = { event: 'موقعیت', thoughts: 'فکرها', body: 'حس جسمی', vague: 'حال' };
export const CTX_KIND = { event: 'situation', thoughts: 'thoughts', body: 'body', vague: 'felt' };
export function ctxFor(q1: string, q2?: string | null) {
  if (!q1 || q1 === 'none') return null;
  const o1 = Q1.opts.find((o) => o.id === q1),
    o2 = q2 ? Q2[q1].opts.find((o) => o.id === q2) : null;
  const value = o2 && !o2.vague ? o2.t : o1.t;
  return { kind: CTX_KIND[q1], name: CTX_NAME[q1], q1, q2: q2 || null, value };
}
export function guideMods() {
  const g = S.guide;
  if (!g) return {};
  const m = {};
  const add = (o) => {
    for (const k in o || {}) m[k] = (m[k] || 0) + o[k];
  };
  if (g.q1) add(Q1.opts.find((o) => o.id === g.q1)?.mod);
  if (g.q1 && g.q2) add(Q2[g.q1].opts.find((o) => o.id === g.q2)?.mod);
  return m;
}
