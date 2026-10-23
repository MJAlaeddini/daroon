import { describe, expect, it } from 'vitest';
import { CORE_KEYS, EXTRA, REFINE } from '@daroon/shared';
import { CORE_DEF, LEX, lex, palFor } from '../src/domain/lexicon';

describe('lexicon', () => {
  it('draws the same twelve core words the server accepts', () => {
    expect(CORE_DEF.map((d) => d[0])).toEqual([...CORE_KEYS]);
  });
  it('gives every known word a form and a three-colour palette', () => {
    for (const k of [...CORE_KEYS, ...Object.values(REFINE).flat(), ...Object.keys(EXTRA)]) {
      expect(LEX[k], k).toBeTruthy();
      expect(palFor(k)).toHaveLength(3);
    }
  });
  it('makes a stable form for a word of the person’s own', () => {
    const a = lex('custom:بی‌حس'),
      b = lex('custom:بی‌حس');
    expect(a).toBe(b);
    expect(a.custom).toBe(true);
  });
});
