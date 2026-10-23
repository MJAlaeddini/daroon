/**
 * Jalali (Solar Hijri) calendar, after the jalaali-js algorithm.
 * Verified against Intl's Persian calendar for 1990–2060 (see test/jalali.test.ts).
 *
 * Days are identified by a "day key": the local Gregorian date as YYYY-MM-DD.
 */
import { fa, pad } from './digits';

export interface JDate { jy: number; jm: number; jd: number }
export interface GDate { gy: number; gm: number; gd: number }

export const jdiv = (a: number, b: number): number => ~~(a / b);
export const jmod = (a: number, b: number): number => a - ~~(a / b) * b;
const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy: number, withoutLeap: boolean): { gy: number; march: number; leap: number } {
  const gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jm = 0, jump = 0, i: number;
  for (i = 1; i < BREAKS.length; i++) {
    jm = BREAKS[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ += jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4); jp = jm;
  }
  let n = jy - jp;
  leapJ += jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4);
  if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (withoutLeap) return { gy, march, leap: -1 };
  if (jump - n < 6) n = n - jump + jdiv(jump + 4, 33) * 33;
  let leap = jmod(jmod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
export function g2d(gy: number, gm: number, gd: number): number {
  const d = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4) + jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408;
  return d - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752;
}
export function d2g(jdn: number): GDate {
  let j = 4 * jdn + 139361631;
  j = j + jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = jdiv(jmod(j, 1461), 4) * 5 + 308;
  const gd = jdiv(jmod(i, 153), 5) + 1, gm = jmod(jdiv(i, 153), 12) + 1, gy = jdiv(j, 1461) - 100100 + jdiv(8 - gm, 6);
  return { gy, gm, gd };
}
export function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy, true);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1;
}
export function d2j(jdn: number): JDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy, false);
  const f = g2d(gy, 3, r.march);
  let k = jdn - f;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + jdiv(k, 31), jd: jmod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + jdiv(k, 30), jd: jmod(k, 30) + 1 };
}
export const isLeapJ = (jy: number): boolean => jalCal(jy, false).leap === 0;
export const jMonthLen = (jy: number, jm: number): number => (jm <= 6 ? 31 : jm <= 11 ? 30 : isLeapJ(jy) ? 30 : 29);

export const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WD = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
export const WD_S = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/* day keys */
export const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
export const keyOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateOfKey = (k: string): Date => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const keyAdd = (k: string, n: number): string => { const d = dateOfKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
export const jOfKey = (k: string): JDate => { const [y, m, d] = k.split('-').map(Number); return d2j(g2d(y, m, d)); };
export const keyOfJ = (jy: number, jm: number, jd: number): string => { const g = d2g(j2d(jy, jm, jd)); return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`; };
/** Weekday index with Saturday = 0. */
export const wdIndex = (k: string): number => (dateOfKey(k).getDay() + 1) % 7;
export const todayKey = (): string => keyOf(new Date());
export const weekStart = (k: string): string => keyAdd(k, -wdIndex(k));
export const weekDays = (ws: string): string[] => [...Array(7)].map((_, i) => keyAdd(ws, i));

export function fmtDay(k: string, { weekday = true, year = true }: { weekday?: boolean; year?: boolean } = {}): string {
  const j = jOfKey(k);
  let s = `${fa(j.jd)} ${J_MONTHS[j.jm - 1]}`;
  if (year) s += ` ${fa(j.jy)}`;
  return weekday ? `${WD[wdIndex(k)]}، ${s}` : s;
}
export const weekRange = (ws: string): string =>
  `${fmtDay(ws, { weekday: false, year: false })} تا ${fmtDay(keyAdd(ws, 6), { weekday: false })}`;
