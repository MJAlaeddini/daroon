import { describe, expect, it } from 'vitest';
import { localStory, normStory, storyPrompt } from '../src/story';
import { SyncedEntry, StoryRequest } from '../src/schemas';
import { familyOf, isKnownEmotion } from '../src/lexicon';

const entries = [
  {
    day: '2026-10-17',
    time: '09:10',
    emotions: [{ key: 'امید' }, { key: 'نگرانی' }],
    context: null,
    note: 'یه روز شلوغ',
  },
  { day: '2026-10-18', time: '22:40', emotions: [{ key: 'امید' }], context: { name: 'فکرها', value: 'کارها' } },
  { day: '2026-10-19', time: '13:00', emotions: [], context: null },
];

describe('story', () => {
  it('builds a prompt with the allowed words and the week range', () => {
    const p = storyPrompt('2026-10-17', entries, ['امید', 'نگرانی']);
    expect(p).toContain('["امید","نگرانی"]');
    expect(p).toContain('۲۵ مهر');
  });
  it('validates writer output and drops unknown labels', () => {
    const s = normStory(
      { title: 'هفته', pages: [{ emotion: 'امید', text: ' الف ' }, { emotion: 'x', text: 'ب' }, { text: '' }] },
      ['امید'],
    );
    expect(s.pages).toEqual([
      { label: 'امید', text: 'الف' },
      { label: null, text: 'ب' },
    ]);
    expect(() => normStory({ pages: [{ text: 'a' }] }, [])).toThrow();
  });
  it('writes a local fallback', () => {
    const s = localStory(entries);
    expect(s.title).toBe('هفته‌ای به رنگ امید');
    expect(s.pages.length).toBeGreaterThanOrEqual(3);
  });
});

describe('schemas', () => {
  it('accepts a saved entry and rejects unknown words', () => {
    const e = {
      id: 'mfx1abc23',
      day: '2026-10-23',
      time: '09:15',
      emotions: [{ key: 'رهایی', parent: 'آرامش' }],
      unnamed: false,
      createdAt: '2026-10-23T05:45:00.000Z',
      updatedAt: '2026-10-23T05:45:00.000Z',
    };
    expect(SyncedEntry.parse(e).emotions[0].color).toBeNull();
    expect(() => SyncedEntry.parse({ ...e, emotions: [{ key: 'nonsense' }] })).toThrow();
    expect(SyncedEntry.parse({ ...e, emotions: [{ key: 'custom:بی‌حس', custom: true }] }).emotions[0].custom).toBe(
      true,
    );
  });
  it('limits story requests', () => {
    expect(() => StoryRequest.parse({ week: '2026-10-17', entries: [], weekKeys: [] })).toThrow();
  });
  it('knows word families', () => {
    expect(familyOf('دلهره')).toBe('نگرانی');
    expect(familyOf('پشیمانی')).toBe('غم');
    expect(isKnownEmotion('custom:x')).toBe(false);
  });
});
