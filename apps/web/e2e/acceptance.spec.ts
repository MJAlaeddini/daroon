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
      // night is the default look; the light sizes follow the device instead, so both themes stay covered
      if (size.scheme === 'light')
        await page.addInitScript(() => {
          if (!localStorage.getItem('daroon.v1'))
            localStorage.setItem(
              'daroon.v1',
              JSON.stringify({ entries: [], settings: { direction: 'auto' }, nightDefault: true }),
            );
        });
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
    // the pointer is moved off afterwards: left where it clicked, it would rest on a word of the ring and its
    // hover fade (motion the test started, not the app) could still be running when we look
    const r = await watch(
      page,
      async () => {
        await page.click('[data-act=startA]');
        await page.mouse.move(1, 1);
      },
      1200,
    );
    expect({ overlaps: r.overlaps, ghosts: r.ghosts, jumps: r.jumps }).toEqual({ overlaps: [], ghosts: 0, jumps: [] });
    // name what is still moving, so a failure says which animation ignored reduced motion
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => {
          const t = a.effect!.getTiming();
          return ((t.duration as number) > 50 || (t.delay as number) > 50) && t.iterations !== Infinity;
        })
        .map((a) => {
          const el = (a.effect as KeyframeEffect).target as Element | null;
          const name = (a as CSSAnimation).animationName || (a as CSSTransition).transitionProperty || a.id || 'script';
          return `${name} on ${el ? el.tagName.toLowerCase() + '.' + el.className : '?'}`;
        }),
    );
    expect(long).toEqual([]);
  });
});

test.describe('keyboard', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('every stop on today shows a visible focus ring', async ({ page }) => {
    await open(page);
    await page.click('[data-act=loginSkip]');
    await settle(page, 1200);
    // Focus rings are what this checks. The sculpture is drawn in software on CI runners (a few hundred ms a draw, and
    // focusing a path or a day sets it moving), so every Tab would wait behind draws; 18 of them outran the timeout.
    // A hidden canvas is not composited, so the page answers at once.
    await page.addStyleTag({ content: '#stage canvas { display: none !important }' });
    // a Tab that never returns means the page stopped answering; say where focus was and what the page reported
    let crashed = false;
    const logs: string[] = [];
    page.on('crash', () => (crashed = true));
    page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`.slice(0, 200)));
    let at = 'start';
    const bounded = <T>(what: string, p: Promise<T>): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const hung = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `${what} did not return within 15 s; focus was on ${at}; crashed: ${crashed}; ` +
                  `last console: ${logs.slice(-5).join(' | ') || 'none'}`,
              ),
            ),
          15_000,
        );
      });
      return Promise.race([p, hung]).finally(() => clearTimeout(timer));
    };
    for (let i = 0; i < 18; i++) {
      await bounded(`Tab #${i + 1}`, page.keyboard.press('Tab'));
      const r = await bounded(
        `reading focus after Tab #${i + 1}`,
        page.evaluate(() => {
          const a = document.activeElement as HTMLElement | null;
          if (!a || a === document.body) return { ok: null, at: 'body' };
          const cs = getComputedStyle(a);
          const label =
            a.getAttribute('aria-label') || a.dataset.act || a.dataset.go || a.textContent?.trim().slice(0, 24);
          return {
            ok: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none',
            at: `${a.tagName.toLowerCase()}.${a.className} «${label}»`,
          };
        }),
      );
      at = r.at;
      if (r.ok !== null) expect(r.ok, `focus ring on ${r.at}`).toBe(true);
    }
  });
});
