import { describe, expect, it } from 'vitest';
import { jOfKey, keyOfJ, keyAdd, jMonthLen, wdIndex, weekStart, fmtDay } from '../src/jalali';

const intl = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});
function viaIntl(k: string) {
  const [y, m, d] = k.split('-').map(Number);
  const parts = Object.fromEntries(intl.formatToParts(new Date(Date.UTC(y, m - 1, d))).map((p) => [p.type, p.value]));
  return { jy: +parts.year, jm: +parts.month, jd: +parts.day };
}

describe('jalali', () => {
  it('matches Intl every 3 days from 1990 to 2060', () => {
    for (let k = '1990-01-01'; k < '2060-12-31'; k = keyAdd(k, 3)) expect(jOfKey(k), k).toEqual(viaIntl(k));
  });
  it('round-trips', () => {
    for (let k = '2020-01-01'; k < '2030-01-01'; k = keyAdd(k, 5)) {
      const j = jOfKey(k);
      expect(keyOfJ(j.jy, j.jm, j.jd)).toBe(k);
    }
  });
  it('knows month lengths and leap Esfand', () => {
    expect(jMonthLen(1403, 12)).toBe(30);
    expect(jMonthLen(1404, 12)).toBe(29);
    expect(jMonthLen(1404, 7)).toBe(30);
  });
  it('starts weeks on Saturday', () => {
    expect(wdIndex('2026-10-24')).toBe(0); // Saturday
    expect(weekStart('2026-10-23')).toBe('2026-10-17');
  });
  it('formats days in Persian', () => {
    expect(fmtDay('2025-03-21')).toBe('جمعه، ۱ فروردین ۱۴۰۴');
  });
});
