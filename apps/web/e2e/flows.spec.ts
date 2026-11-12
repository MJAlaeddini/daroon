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

test("a word is breathed into the stone and shows it in the verse; its finer words and a word of one's own", async ({
  page,
}) => {
  await open(page);
  await page.click('[data-act=loginSkip]');
  await settle(page, 900);
  await page.click('[data-act=startA]');
  await settle(page, 1300);
  await expect(page.locator('#xbar .primary')).toBeDisabled();
  await page.click('.word[data-key="دلتنگی"]');
  // the word itself shows it is chosen; its name is not repeated anywhere else
  await expect(page.locator('.word[data-key="دلتنگی"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#xfine .rf')).toHaveText(['حسرت', 'دلگیری', 'تنهایی']);
  await expect(page.locator('#views .view:not(.leaving)').getByText('دلتنگی', { exact: true })).toHaveCount(1);
  await expect(page.locator('.breath')).toHaveCount(0);
  // a finer word takes the word's place in the verse
  await page.click('#xfine .rf >> text=حسرت');
  await expect(page.locator('.word[data-key="دلتنگی"]')).toHaveText('حسرت');
  expect(await page.evaluate('__daroon.S.draft.items[0].key')).toBe('حسرت');
  // three at most: the rest of the verse steps back, and the finer words follow the word touched last
  await page.click('.word[data-key="امید"]');
  await expect(page.locator('#xfine .rf')).toHaveText(['خوش‌بینی', 'انتظار', 'انگیزه']);
  await page.click('.word[data-key="آرامش"]');
  await expect(page.locator('.word[data-key="غم"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#tray [data-act=openCustom]')).toHaveCount(0);
  // touching a chosen word draws it back out, and its finer word goes with it
  await page.click('.word[data-key="آرامش"]');
  await expect(page.locator('.word[data-key="آرامش"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#xbar .primary small')).toHaveText('۲ کلمه');
  await page.click('.word[data-key="دلتنگی"]');
  await expect(page.locator('.word[data-key="دلتنگی"]')).toHaveText('دلتنگی');
  await page.click('.word[data-key="دلتنگی"]');
  // a word of one's own goes in from where it was written and is worn on the line under the verse
  await page.click('[data-act=openCustom]');
  await page.fill('#customInput', 'خستگی');
  await page.click('.addbtn');
  await expect(page.locator('#tray .word')).toHaveText(['خستگی']);
  await expect(page.locator('#tray .word')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate('__daroon.S.draft.items.length')).toBe(3);
  await page.click('#tray .word');
  await expect(page.locator('#tray .word')).toHaveCount(0);
  // «I don't know» leads to the guide and keeps what was chosen
  await page.click('#xbar [data-act=toGuide]');
  await settle(page, 900);
  expect(await page.evaluate('__daroon.S.view')).toBe('guide');
  expect(await page.evaluate('__daroon.S.draft.items.length')).toBe(2);
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
  // strength, where, the small question (skipped), then the line of one's own
  await page.click('[data-act=rNext]');
  await settle(page, 700);
  await page.click('[data-act=rNext]');
  await settle(page, 700);
  await page.click('[data-act=rSkip]');
  await settle(page, 700);
  await page.fill('#noteInput', 'یه روز معمولی');
  await page.click('.r-acts .primary');
  await settle(page, 2800);
  await page.reload();
  await settle(page, 1200);
  const own = await page.evaluate(
    '__daroon.DB.entries.filter(e => !e.demo).map(e => ({ n: e.emotions.length, note: e.note, u: !!e.updatedAt }))',
  );
  expect(own).toEqual([{ n: 3, note: 'یه روز معمولی', u: true }]);
});

test('a check-in goes step by step: strength, where, one small question, a line; it can save at any step', async ({
  page,
}) => {
  await open(page);
  await page.click('[data-act=loginSkip]');
  await settle(page, 900);
  await page.click('[data-act=startA]');
  await settle(page, 1300);
  await tap(page, '.word[data-key="دلتنگی"]');
  await page.click('#xbar .primary');
  await settle(page, 1500);
  expect(await page.getAttribute('.r-grid', 'data-step')).toBe('strength');
  // dragging along the meter (right to left, like the text) passes through to «a lot»
  const tr = (await page.locator('.r-meter .r-track').boundingBox())!;
  await page.mouse.move(tr.x + tr.width - 4, tr.y + tr.height / 2);
  await page.mouse.down();
  await page.mouse.move(tr.x + 2, tr.y + tr.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate('__daroon.S.draft.intensity')).toBe(3);
  await tap(page, '[data-act=rIntensity][data-n="1"]');
  expect(await page.getAttribute('[data-act=rIntensity][data-n="1"]', 'aria-checked')).toBe('true');
  await tap(page, '[data-act=rIntensity][data-n="3"]');
  await page.click('[data-act=rNext]');
  await settle(page, 700);
  expect(await page.getAttribute('.r-grid', 'data-step')).toBe('where');
  await tap(page, '[data-act=scene][data-s=friends]');
  await page.click('[data-act=rNext]');
  await settle(page, 700);
  // with friends around, the question is whether one was heard; one touch answers and moves on
  expect(await page.getAttribute('[data-act=rAnswer][data-a=no]', 'data-q')).toBe('heard');
  await tap(page, '[data-act=rAnswer][data-a=no]');
  await settle(page, 900);
  expect(await page.getAttribute('.r-grid', 'data-step')).toBe('note');
  // back goes one step back and keeps the answer
  await page.click('[data-act=rBack]');
  await settle(page, 700);
  expect(await page.getAttribute('[data-act=rAnswer][data-a=no]', 'aria-checked')).toBe('true');
  await page.click('.r-acts [data-act=save]');
  await settle(page, 2800);
  expect(
    await page.evaluate(
      '__daroon.DB.entries.filter(e => !e.demo).map(e => ({ i: e.intensity, m: e.meaning, s: e.scenes }))',
    ),
  ).toEqual([{ i: 3, m: { q: 'heard', a: 'no' }, s: ['friends'] }]);
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
  await page.click('[data-act=rNext]');
  await settle(page, 700);
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
  await page.click(`.ent-tools [data-act=delYes][data-id="${id}"]`);
  await settle(page, 400);
  expect(await page.evaluate(`!!__daroon.DB.entries.find(e => e.id === '${id}').deletedAt`)).toBe(true);
  await page.click('[data-act=toastAct]');
  await settle(page, 400);
  expect(await page.evaluate(`__daroon.DB.entries.find(e => e.id === '${id}').deletedAt`)).toBeNull();
});

test('a check-in opens in its own sheet, steps through its day, and leads to editing', async ({ page }) => {
  await open(page);
  await page.click('[data-act=loginSkip]');
  await settle(page, 900);
  // the past day with the most sample check-ins
  const day = await page.evaluate(() => {
    const D = (window as any).__daroon,
      c = new Map<string, number>();
    for (const e of D.DB.entries) if (!e.deletedAt && e.day <= D.todayKey()) c.set(e.day, (c.get(e.day) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0];
  });
  test.skip(!day || day[1] < 2, 'no day with two sample entries');
  await page.evaluate((d) => {
    const D = (window as any).__daroon;
    D.S.arch.mode = 'week';
    D.S.arch.sel = d;
    D.S.arch.cursor = d;
    D.go('archive', { push: false });
  }, day[0]);
  await settle(page, 1500);
  await page.click('.wk2-list .ent-card >> nth=0', { position: { x: 120, y: 20 } });
  await settle(page, 900);
  const first = await page.evaluate('__daroon.S.entry');
  expect(await page.evaluate('__daroon.S.sheet')).toBe('entry');
  expect(await page.locator('#layer .ed-title').count()).toBe(1);
  await page.click('#layer [data-act=entGo][data-d="1"]');
  await settle(page, 600);
  expect(await page.evaluate('__daroon.S.entry')).not.toBe(first);
  await page.click('#layer [data-act=edit]');
  await settle(page, 900);
  expect(await page.evaluate('__daroon.S.view')).toBe('reflect');
  expect(await page.evaluate('__daroon.S.sheet')).toBeNull();
});

test('the email sign-in sheet validates the address before asking the server', async ({ page }) => {
  await open(page);
  await page.click('.login-acts [data-act=loginPassword]');
  await settle(page, 600);
  await page.click('.auth-alt [data-act=loginEmail]');
  await settle(page, 300);
  await page.fill('#loginEmailInput', 'نه-ایمیل');
  await page.click('[data-form=loginEmail] .primary');
  await expect(page.locator('.auth-err')).toHaveText('این نشونی ایمیل درست به نظر نمی‌رسه.');
});

test('the account fields answer while they are typed, and nothing typed is lost', async ({ page }) => {
  await open(page);
  await page.click('.login-acts [data-act=loginPassword]');
  await settle(page, 600);
  // signing in: two fields, a Persian hint that reads from the right
  await expect(page.locator('#loginName')).toHaveCount(0);
  expect(await page.locator('#loginUser').evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
  await page.click('.auth-more [data-act=loginSignup]');
  await settle(page, 300);
  // a Persian keyboard in the username is noticed at once
  await page.fill('#loginName', 'یحیی');
  await page.locator('#loginUser').pressSequentially('یحیی');
  await expect(page.locator('#userMsg')).toContainText('حروف انگلیسی');
  // Latin runs left to right, still against the right edge
  await page.fill('#loginUser', '');
  await page.locator('#loginUser').pressSequentially('yahya_n');
  await expect(page.locator('#userMsg')).toHaveText('');
  const box = await page
    .locator('#loginUser')
    .evaluate((el) => [getComputedStyle(el).direction, getComputedStyle(el).textAlign]);
  expect(box).toEqual(['ltr', 'right']);
  // a short password says how much is missing, under its own field, and the form is not drawn again
  await page.locator('#loginPw').pressSequentially('short');
  await expect(page.locator('#pwMsg')).toContainText('۳ تا دیگه');
  await page.click('[data-form=loginPassword] .primary');
  await expect(page.locator('#pwMsg')).toContainText('رمز دست‌کم ۸ حرفه');
  await expect(page.locator('#loginPw')).toHaveValue('short');
  await expect(page.locator('#loginName')).toHaveValue('یحیی');
  // the eye shows and hides the password
  await page.click('[data-act=pwToggle]');
  expect(await page.getAttribute('#loginPw', 'type')).toBe('text');
  // back to signing in keeps the username that was typed
  await page.click('.auth-more [data-act=loginPassword]');
  await expect(page.locator('#loginUser')).toHaveValue('yahya_n');
});

test('after the first check-in a sheet offers to keep the traces, once', async ({ page }) => {
  await page.route('**/api/auth/config', (r) => r.fulfill({ json: { google: null, email: false, password: true } }));
  await page.route('**/api/auth/username**', (r) =>
    r.fulfill({
      json: r.request().url().endsWith('u=yahya')
        ? { available: false, suggestions: ['yahya78', 'yahya_41'] }
        : { available: true, suggestions: [] },
    }),
  );
  await open(page);
  // the welcome page asks for nothing: one touch and the app is open
  await page.click('[data-act=loginSkip]');
  await settle(page, 900);
  expect(await page.evaluate('__daroon.S.sheet')).toBeNull();
  await page.click('[data-act=startA]');
  await settle(page, 1300);
  await tap(page, '.word[data-key="دلتنگی"]');
  await page.click('#xbar .primary');
  await settle(page, 1500);
  await page.click('.r-acts [data-act=save]');
  await settle(page, 2800);
  await page.click('[data-act=doneClose]');
  await settle(page, 2200);
  expect(await page.evaluate('__daroon.S.sheet')).toBe('login');
  await expect(page.locator('.sheet h2')).toHaveText('نگهش داریم؟');
  // a taken username comes with free ones; one touch takes one
  await page.locator('#loginUser').pressSequentially('yahya');
  await expect(page.locator('#userSug .chip')).toHaveCount(2);
  await page.click('#userSug .chip >> nth=0');
  await expect(page.locator('#loginUser')).toHaveValue('yahya78');
  await expect(page.locator('#userMsg')).toHaveText('این نام کاربری آزاده.');
  // «بعداً» closes it, and it does not come back on its own
  await page.click('.auth-more [data-act=closeSheet]');
  await settle(page, 600);
  expect(await page.evaluate('__daroon.DB.keepAsked')).toBe(true);
  expect(await page.evaluate('__daroon.S.sheet')).toBeNull();
});

test('night is the default, from the first frame, and the browser is told not to darken the page itself', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/?e2e');
  // theme-boot.js has run before anything else: the very first look is night
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await expect(page.locator('meta[name=color-scheme]')).toHaveAttribute('content', 'dark light');
  await settle(page, 900);
  expect(await page.evaluate('__daroon.DB.settings.direction')).toBe('night');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(17, 14, 24)');
  // someone who had «like the device» stored from before moves to night once; choosing it again later sticks
  await page.evaluate(() =>
    localStorage.setItem('daroon.v1', JSON.stringify({ entries: [], settings: { direction: 'auto' } })),
  );
  await page.reload();
  await settle(page, 900);
  expect(await page.evaluate('__daroon.DB.settings.direction')).toBe('night');
  await page.evaluate(() =>
    localStorage.setItem(
      'daroon.v1',
      JSON.stringify({ entries: [], settings: { direction: 'auto' }, nightDefault: true }),
    ),
  );
  await page.reload();
  await settle(page, 900);
  expect(await page.evaluate('__daroon.DB.settings.direction')).toBe('auto');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
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

  test('an entry swiped to the left shows its actions; delete removes it and the tab stays', async ({ page }) => {
    await open(page);
    await page.click('[data-act=loginSkip]');
    await settle(page, 1200);
    const id = await page.evaluate('__daroon.DB.entries.find(e => e.demo && e.day === __daroon.todayKey())?.id');
    test.skip(!id, 'no sample entry today');
    await page.evaluate("__daroon.S.arch.mode = 'week'; __daroon.go('archive', { push: false })");
    await settle(page, 1500);
    const card = `.ent[data-id="${id}"] .ent-card`;
    await page.$eval(card, (c) => c.scrollIntoView({ block: 'center' }));
    await settle(page, 400);
    const box = (await page.$eval(card, (c) => {
      const r = c.getBoundingClientRect();
      return { x: r.right - 40, y: r.y + r.height / 2 };
    })) as { x: number; y: number };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x - 19 * i, y: box.y }] });
      await page.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle(page, 700);
    expect(await page.evaluate('__daroon.S.view')).toBe('archive');
    expect(await page.$eval(`.ent[data-id="${id}"]`, (e) => e.classList.contains('open'))).toBe(true);
    await page.tap(`.ent[data-id="${id}"] .sw-del`);
    await settle(page, 700);
    expect(await page.evaluate(`!!__daroon.DB.entries.find(e => e.id === '${id}').deletedAt`)).toBe(true);
  });
});
