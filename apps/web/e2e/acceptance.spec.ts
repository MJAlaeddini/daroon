import { expect, test } from '@playwright/test';
import { layout, open, settle, watch } from './helpers';

const SIZES = [
  { name: 'phone', width: 390, height: 844, scheme: 'light' as const },
  { name: 'small phone', width: 360, height: 740, scheme: 'dark' as const },
  { name: 'tablet', width: 768, height: 1024, scheme: 'light' as const },
  { name: 'desktop', width: 1440, height: 900, scheme: 'dark' as const },
];

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}×${size.height} ${size.scheme}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, colorScheme: size.scheme });

    test('every screen lays out cleanly and the sculpture never sits under text', async ({ page }) => {
      test.setTimeout(300_000);
      const errors = await open(page);
      const nav = size.width < 700 ? '.bottomnav' : '.topnav';
      const problems: string[] = [];
      const check = async (name: string) => {
        await settle(page);
        const l = await layout(page);
        for (const k of ['offscreen', 'clipped', 'smallTargets', 'overlapsBtn', 'lowContrast', 'tinyText'])
          if (l[k].length) problems.push(`${name} ${k}: ${l[k].slice(0, 3).join(' | ')}`);
        if (l.hscroll) problems.push(`${name}: horizontal scroll`);
      };
      const move = async (name: string, act: () => Promise<unknown>, ms?: number) => {
        const r = await watch(page, act, ms);
        if (r.overlaps.length) problems.push(`${name} text over sculpture: ${r.overlaps.join(', ')}`);
        if (r.jumps.length) problems.push(`${name} sculpture jumps: ${r.jumps.join(', ')}px`);
        if (r.ghosts)
          problems.push(
            `${name}: two pages on top of each other for ${r.ghosts} frames ${JSON.stringify(r.ghostDetail)}`,
          );
      };

      await check('login');
      await move('login→today', () => page.click('[data-act=loginSkip]'));
      await check('today');
      await move('today→explore', () => page.click('[data-act=startA]'));
      await page.click('.word[data-key="امید"]');
      await page.click('.word[data-key="نگرانی"]');
      await check('explore');
      await move('explore→today', () => page.click('.flow-head .back'));
      await move('today→guide', () => page.click('[data-act=startB]'));
      await move('guide q1→q2', () => page.click('.stone[data-id=thoughts]'));
      await move('guide q2→suggestions', () => page.click('.stone[data-id=future]'), 2200);
      await page.click('.sug[data-key="امید"]');
      await check('suggestions');
      await move('suggestions→reflect', () => page.click('#gbody .acts .primary'));
      await check('reflect');
      await move('reflect→save', () => page.click('[data-act=save]'), 2600);
      await move('done→today', () => page.click('[data-act=doneClose]'));
      await move('tab today→archive', () => page.click(`${nav} [data-go=archive]`));
      await check('archive week');
      await page.click('[data-act=mode][data-m=month]');
      await check('archive month');
      await page.click('[data-act=mode][data-m=week]');
      await move('tab archive→patterns', () => page.click(`${nav} [data-go=patterns]`));
      await check('patterns');
      await move('tab patterns→today', () => page.click(`${nav} [data-go=today]`));
      await page.click('#avatarBtn');
      await check('account');

      expect(problems).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  test('moves without flights, long animations or overlapping pages', async ({ page }) => {
    await open(page);
    await page.click('[data-act=loginSkip]');
    await settle(page, 900);
    const r = await watch(page, () => page.click('[data-act=startA]'), 1200);
    expect({ overlaps: r.overlaps, ghosts: r.ghosts, jumps: r.jumps }).toEqual({ overlaps: [], ghosts: 0, jumps: [] });
    const long = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => {
          const t = a.effect!.getTiming();
          return ((t.duration as number) > 50 || (t.delay as number) > 50) && t.iterations !== Infinity;
        }).length,
    );
    expect(long).toBe(0);
  });
});

test.describe('keyboard', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('every stop on today shows a visible focus ring', async ({ page }) => {
    await open(page);
    await page.click('[data-act=loginSkip]');
    await settle(page, 1200);
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || a === document.body) return null;
        const cs = getComputedStyle(a);
        return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      });
      if (r !== null) expect(r).toBe(true);
    }
  });
});
