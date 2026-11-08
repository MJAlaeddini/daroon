import { describe, expect, it } from 'vitest';
import { MEANING, MEANING_QS, SCENE_AT, SCENE_IDS, pickQuestion } from '../src';

describe('the small question', () => {
  it('asks whether one was heard only when other people were around, and then takes turns', () => {
    expect(pickQuestion([], 0)).toBe('control');
    expect(pickQuestion(['alone'], 0)).toBe('control');
    expect(pickQuestion(['body', 'out'], 1)).toBe('control');
    expect(pickQuestion(['friends'], 0)).toBe('heard');
    expect(pickQuestion(['friends'], 1)).toBe('control');
    expect(pickQuestion(['out', 'family'], 2)).toBe('heard');
  });
  it('has words for every question, answer and setting', () => {
    for (const q of MEANING_QS)
      for (const k of ['ask', 'yes', 'some', 'no'] as const) expect(MEANING[q][k]).toBeTruthy();
    for (const s of SCENE_IDS) expect(SCENE_AT[s]).toBeTruthy();
  });
});
