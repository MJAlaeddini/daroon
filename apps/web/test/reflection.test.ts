import { describe, expect, it } from 'vitest';
import { smallThing, untilFirstPattern } from '../src/domain/reflection';

const e = (id: string, day: string, keys: string[], scenes: string[] = []) => ({
  id,
  day,
  emotions: keys.map((key) => ({ key })),
  scenes,
});

describe('«یه چیز کوچیک»', () => {
  it('counts the feeling within its week, with the setting when there is one', () => {
    const a = e('a', '1405-08-17', ['دلتنگی'], ['friends']),
      b = e('b', '1405-08-18', ['دلتنگی'], ['friends']),
      c = e('c', '1405-08-18', ['آرامش']);
    expect(smallThing(b, [a, b, c])).toBe('این دومین باره این هفته که پیش دوستا، «دلتنگی» اومده.');
    expect(smallThing(c, [a, b, c])).toBe('این هفته اولین باره که «آرامش» اومده.');
    expect(smallThing(e('d', '1405-08-18', []), [a, b, c, e('d', '1405-08-18', [])])).toBe(
      'این چهارمین ردپای این هفته‌ست.',
    );
  });
  it('counts a refined word toward its family, and leaves other weeks out', () => {
    const old = e('o', '1405-07-01', ['دلتنگی']),
      a = e('a', '1405-08-17', ['دلتنگی']),
      b = e('b', '1405-08-18', ['حسرت']);
    expect(smallThing(b, [old, a, b])).toMatch(/دومین باره این هفته که «/);
  });
  it('says how far the first pattern is, and nothing once patterns can show', () => {
    const few = Array.from({ length: 5 }, (_, i) => e(String(i), `1405-08-1${i}`, ['امید']));
    expect(untilFirstPattern(few)).toMatchObject({ left: 15, unit: 'entries' });
    const many = Array.from({ length: 20 }, (_, i) => e(String(i), `1405-08-0${1 + (i % 3)}`, ['امید']));
    expect(untilFirstPattern(many)).toMatchObject({ left: 5, unit: 'days' });
    const ready = Array.from({ length: 20 }, (_, i) =>
      e(String(i), `1405-08-${String(1 + (i % 9)).padStart(2, '0')}`, ['امید']),
    );
    expect(untilFirstPattern(ready)).toBeNull();
  });
});
