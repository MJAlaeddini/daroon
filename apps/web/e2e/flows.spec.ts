import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { open, settle } from './helpers';

/** A DOM click: these tests check logic, not hit-testing (the acceptance suite covers that). */
async function tap(page: Page, sel: string) {
  const live = `#views .view:not(.leaving) ${sel}`;
  await page.waitForSelector(live, { state: 'attached' });
  await page.$eval(live, (el) => (el as HTMLElement).click());
}

test.use({ viewport: { width: 390, height: 844 } });

const Q2 = {
  event: ['person', 'expect', 'self', 'change', 'unsure'],
  thoughts: ['past', 'future', 'tasks', 'many', 'unsure'],
  body: ['heavy', 'tense', 'light', 'tired', 'unsure'],
  vague: ['pressure', 'missing', 'changing', 'between', 'neither'],
};

test('every guided path ends in suggestions, or the "no name yet" screen for unsure answers', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await page.click('[data-act=loginSkip]');
  for (const [q1, opts] of Object.entries(Q2)) {
    for (const q2 of opts) {
      await page.evaluate("__daroon.go('today', { push: false })");
      await settle(page, 700);
      await tap(page, '[data-act=startB]');
      await settle(page, 900);
      await tap(page, `.stone[data-id=${q1}]`);
      await settle(page, 900);
      await tap(page, `.stone[data-id=${q2}]`);
      await settle(page, 1100);
      const step = await page.evaluate('__daroon.S.guide.step');
      expect(step, `${q1}/${q2}`).toBe(q2 === 'unsure' || q2 === 'neither' ? 'ambig' : 'sug');
    }
  }
});

test('a saved entry with a note survives a reload; three words at most', async ({ page }) => {
  await open(page);
  await page.click('[data-act=loginSkip]');
  await settle(page, 900);
  await page.click('[data-act=startA]');
  await settle(page, 1300);
  for (const k of ['آرامش', 'امید', 'غم', 'خشم']) await tap(page, `.word[data-key="${k}"]`);
  expect(await page.evaluate('__daroon.S.draft.items.length')).toBe(3);
  await page.click('#xbar .primary');
  await settle(page, 1500);
  await page.fill('#noteInput', 'یه روز معمولی');
  await page.click('[data-act=save]');
  await settle(page, 2800);
  await page.reload();
  await settle(page, 1200);
  const own = await page.evaluate(
    '__daroon.DB.entries.filter(e => !e.demo).map(e => ({ n: e.emotions.length, note: e.note, u: !!e.updatedAt }))',
  );
  expect(own).toEqual([{ n: 3, note: 'یه روز معمولی', u: true }]);
});

test('a check-in can say who or what was around (two at most), and patterns take a yes or a no', async ({ page }) => {
  await open(page);
  await page.click('[data-act=loginSkip]');
  await settle(page, 900);
  await page.click('[data-act=startA]');
  await settle(page, 1300);
  await tap(page, '.word[data-key="امید"]');
  await page.click('#xbar .primary');
  await settle(page, 1500);
  // a third choice replaces the oldest
  for (const s of ['family', 'out', 'work']) await tap(page, `[data-act=scene][data-s=${s}]`);
  const pressed = () => page.$$eval('[data-act=scene][aria-pressed=true]', (b) => b.map((x) => x.dataset.s).sort());
  expect(await pressed()).toEqual(['out', 'work'].sort());
  await tap(page, '[data-act=scene][data-s=out]');
  expect(await pressed()).toEqual(['work']);
  await page.click('[data-act=save]');
  await settle(page, 2800);
  expect(await page.evaluate('__daroon.DB.entries.filter(e => !e.demo).map(e => e.scenes)')).toEqual([['work']]);

  // the samples lean worry towards work and missing towards being alone, so there is something to answer
  await page.evaluate("__daroon.go('patterns', { push: false })");
  await settle(page, 1500);
  const ids = () => page.$$eval('.ins', (l) => l.map((x) => (x as HTMLElement).dataset.id));
  const before = await ids();
  expect(before.length).toBeGreaterThan(0);
  await tap(page, `.ins[data-id="${before[0]}"] [data-v=yes]`);
  expect(await page.evaluate(`__daroon.DB.insights[${JSON.stringify(before[0])}].verdict`)).toBe('yes');
  await tap(page, `.ins[data-id="${before[0]}"] [data-v=no]`);
  await settle(page, 900);
  expect(await ids()).not.toContain(before[0]);
  const saved = (await page.evaluate(`__daroon.DB.insights[${JSON.stringify(before[0])}]`)) as {
    verdict: string;
    hits: number;
  };
  expect(saved).toMatchObject({ verdict: 'no' });
  expect(saved.hits).toBeGreaterThan(0);
});

test('deleting can be undone, and works without an account', async ({ page }) => {
  await open(page);
  await page.click('[data-act=loginSkip]');
  await settle(page, 900);
  const id = await page.evaluate('__daroon.DB.entries.find(e => e.demo && e.day === __daroon.todayKey())?.id');
  test.skip(!id, 'no sample entry today');
  // the archive opens in month view after the first week of a month; the day's entries are listed in week view
  await page.evaluate("__daroon.S.arch.mode = 'week'; __daroon.go('archive')");
  await settle(page, 1500);
  await page.click(`[data-act=entMore][data-id="${id}"]`);
  await page.click(`[data-act=askDel][data-id="${id}"]`);
  await page.click(`[data-act=delYes][data-id="${id}"]`);
  await settle(page, 400);
  expect(await page.evaluate(`!!__daroon.DB.entries.find(e => e.id === '${id}').deletedAt`)).toBe(true);
  await page.click('[data-act=toastAct]');
  await settle(page, 400);
  expect(await page.evaluate(`__daroon.DB.entries.find(e => e.id === '${id}').deletedAt`)).toBeNull();
});

test('the email sign-in sheet validates the address before asking the server', async ({ page }) => {
  await open(page);
  await page.click('.login-acts [data-act=loginEmail]');
  await settle(page, 600);
  await page.fill('#loginEmailInput', 'نه-ایمیل');
  await page.click('[data-form=loginEmail] .primary');
  await expect(page.locator('.auth-err')).toHaveText('این نشونی ایمیل درست به نظر نمی‌رسه.');
});

test('works offline after the first visit', async ({ page, context }) => {
  await open(page, '/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await settle(page, 1200);
  await context.setOffline(true);
  await page.reload();
  await settle(page, 1200);
  await expect(page.locator('.login-acts')).toBeVisible();
});

test.describe('swiping', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('a sideways swipe moves between the tabs; a short one springs back', async ({ page }) => {
    await open(page);
    await page.click('[data-act=loginSkip]');
    await settle(page, 1500);
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (dx: number, ms = 220) => {
      const x0 = 195 - dx / 2,
        y = 560,
        steps = 8;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x0 + (dx * i) / steps, y: y + i }],
        });
        await page.waitForTimeout(ms / steps);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await settle(page, 900);
    };
    const view = () => page.evaluate('__daroon.S.view');
    // the archive opens in week view here, so the swipe lands on the day (y 560), not on the calendar
    await page.evaluate("__daroon.S.arch.mode = 'week'");
    await swipe(160);
    expect(await view()).toBe('archive');
    await swipe(160);
    expect(await view()).toBe('patterns');
    await swipe(160);
    expect(await view()).toBe('patterns');
    await swipe(-160);
    expect(await view()).toBe('archive');
    await swipe(40, 600);
    expect(await view()).toBe('archive');
    expect(await page.$eval('#views .view:not(.leaving)', (v) => (v as HTMLElement).style.transform)).toBe('');
  });

  test('on the calendar a sideways swipe changes the month instead of the tab', async ({ page }) => {
    await open(page);
    await page.click('[data-act=loginSkip]');
    await settle(page, 1200);
    await page.evaluate("__daroon.S.arch.mode = 'month'; __daroon.go('archive', { push: false })");
    await settle(page, 1500);
    const box = (await page.$eval('#calGrid', (g) => {
      const r = g.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })) as { x: number; y: number };
    const cdp = await page.context().newCDPSession(page);
    const month = () => page.evaluate('__daroon.S.arch.cursor.slice(0, 7)');
    const before = await month();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 80, y: box.y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: box.x + 80 - 20 * i, y: box.y + i }],
      });
      await page.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle(page, 900);
    expect(await page.evaluate('__daroon.S.view')).toBe('archive');
    expect(await month()).not.toBe(before);
  });
});
