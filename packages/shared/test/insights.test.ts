import { describe, expect, it } from 'vitest';
import { PATTERN_RULES, findPatterns, patternReadiness, type PatternEntry } from '../src/insights';
import { InsightFeedback, SyncRequest, SyncedEntry } from '../src/schemas';

const day = (i: number) => `2026-10-${String(1 + (i % 10)).padStart(2, '0')}`;
const e = (i: number, keys: string[], scenes: string[] = []): PatternEntry => ({
  day: day(i),
  emotions: keys.map((key) => ({ key })),
  scenes,
});

/** 6 check-ins with family, 5 of them worried; 18 elsewhere, 2 of them worried. */
function sample(): PatternEntry[] {
  const list: PatternEntry[] = [];
  for (let i = 0; i < 6; i++) list.push(e(i, i < 5 ? ['دلشوره'] : ['آرامش'], ['family']));
  for (let i = 0; i < 18; i++) list.push(e(i + 6, i < 2 ? ['نگرانی'] : ['امید'], i % 2 ? ['work'] : []));
  return list;
}

describe('patterns', () => {
  it('stays quiet until there are enough check-ins over enough days', () => {
    const few = sample().slice(0, PATTERN_RULES.minEntries - 1);
    expect(findPatterns(few)).toEqual([]);
    const oneDay = sample().map((x) => ({ ...x, day: '2026-10-01' }));
    expect(patternReadiness(oneDay).ready).toBe(false);
    expect(findPatterns(oneDay)).toEqual([]);
  });

  it('finds a feeling that comes up far more often in one setting, counting refined words in their family', () => {
    const [p, ...rest] = findPatterns(sample());
    expect(p).toEqual({
      id: 'family|نگرانی',
      scene: 'family',
      key: 'نگرانی',
      group: 6,
      hits: 5,
      others: 18,
      elsewhere: 2,
    });
    for (const x of rest)
      expect(x.hits / x.group - x.elsewhere / x.others).toBeGreaterThanOrEqual(PATTERN_RULES.minGap);
  });

  it('says nothing about a feeling that is as common in a setting as everywhere else', () => {
    const even = sample().map((x) => ({ ...x, emotions: [{ key: 'امید' }] }));
    expect(findPatterns(even)).toEqual([]);
  });

  it('ignores deleted check-ins and small settings', () => {
    const list = sample().map((x, i) => (i < 2 ? { ...x, deletedAt: '2026-10-20T10:00:00Z' } : x));
    expect(findPatterns(list).find((x) => x.scene === 'family')).toBeUndefined();
  });

  it('reports readiness', () => {
    expect(patternReadiness(sample())).toEqual({ entries: 24, days: 10, tagged: 15, ready: true });
  });
});

describe('scenes on the wire', () => {
  const base = {
    id: 'abc123',
    day: '2026-10-01',
    time: '10:00',
    emotions: [],
    unnamed: true,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  };
  it('defaults to none and accepts up to two known settings', () => {
    expect(SyncedEntry.parse(base).scenes).toEqual([]);
    expect(SyncedEntry.parse({ ...base, scenes: ['family', 'out'] }).scenes).toEqual(['family', 'out']);
    expect(SyncedEntry.safeParse({ ...base, scenes: ['family', 'out', 'work'] }).success).toBe(false);
    expect(SyncedEntry.safeParse({ ...base, scenes: ['family', 'family'] }).success).toBe(false);
    expect(SyncedEntry.safeParse({ ...base, scenes: ['mars'] }).success).toBe(false);
  });
  it('validates pattern feedback', () => {
    const fb = {
      id: 'family|نگرانی',
      verdict: 'partly',
      group: 6,
      hits: 5,
      others: 18,
      elsewhere: 2,
      at: base.createdAt,
    };
    expect(InsightFeedback.parse(fb).verdict).toBe('partly');
    expect(InsightFeedback.safeParse({ ...fb, id: 'mars|نگرانی' }).success).toBe(false);
    expect(InsightFeedback.safeParse({ ...fb, verdict: 'maybe' }).success).toBe(false);
    expect(SyncRequest.parse({ since: 0, changes: [] }).feedback).toEqual([]);
  });
});
