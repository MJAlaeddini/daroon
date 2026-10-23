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

test('deleting can be undone, and works without an account', async ({ page }) => {
  await open(page);
  await page.click('[data-act=loginSkip]');
  await settle(page, 900);
  const id = await page.evaluate('__daroon.DB.entries.find(e => e.demo && e.day === __daroon.todayKey())?.id');
  test.skip(!id, 'no sample entry today');
  await page.evaluate("__daroon.go('archive')");
  await settle(page, 1500);
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
