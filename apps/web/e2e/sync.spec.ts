import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { OUTBOX } from '../playwright.config';
import { open, settle } from './helpers';

/** Reads the newest login code the API wrote to its outbox for this address. */
function codeFor(email: string): string {
  const files = readdirSync(OUTBOX)
    .filter((f) => f.endsWith(`-${email}.json`))
    .sort();
  return JSON.parse(readFileSync(path.join(OUTBOX, files[files.length - 1]), 'utf8')).code;
}
async function signIn(page: Page, email: string, name = '') {
  await page.click('.login-acts [data-act=loginEmail]');
  await settle(page, 600);
  await page.fill('#loginEmailInput', email);
  await page.click('[data-form=loginEmail] .primary');
  await expect(page.locator('#loginCode')).toBeVisible();
  await page.fill('#loginCode', codeFor(email));
  if (name) await page.fill('#loginName', name);
  await page.click('[data-form=loginCode] .primary');
  await expect.poll(() => page.evaluate('__daroon.S.view')).toBe('today');
}

test('an entry travels between two devices without its note, and so does its deletion', async ({ browser }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const tablet = await (await browser.newContext({ viewport: { width: 1024, height: 768 } })).newPage();

  await open(phone);
  await signIn(phone, email, 'سارا');
  await phone.click('[data-act=startA]');
  await settle(phone, 1300);
  await phone.click('.word[data-key="امید"]');
  await phone.click('#xbar .primary');
  await settle(phone, 1400);
  await phone.click('[data-act=rIntensity][data-n="1"]');
  await phone.click('[data-act=rNext]');
  await settle(phone, 700);
  await phone.click('[data-act=rNext]');
  await settle(phone, 700);
  await phone.click('[data-act=rAnswer][data-a=some]');
  await settle(phone, 900);
  await phone.fill('#noteInput', 'فقط برای همین گوشی');
  await phone.click('.r-acts .primary');
  await expect
    .poll(() => phone.evaluate('__daroon.DB.entries.filter(e => !e.demo && e.syncedAt === e.updatedAt).length'), {
      timeout: 15_000,
    })
    .toBe(1);

  await open(tablet);
  await signIn(tablet, email);
  await expect
    .poll(() => tablet.evaluate('__daroon.DB.entries.filter(e => !e.demo && !e.deletedAt).length'), { timeout: 15_000 })
    .toBe(1);
  const got: any = await tablet.evaluate('__daroon.DB.entries.find(e => !e.demo)');
  expect(got.emotions[0].key).toBe('امید');
  expect(got.note).toBe('');
  // strength and the small question travel with the entry; the note does not
  expect(got.intensity).toBe(1);
  expect(got.meaning).toEqual({ q: 'control', a: 'some' });
  expect(await tablet.evaluate('__daroon.DB.account.name')).toBe('سارا');

  await tablet.evaluate("__daroon.go('archive')");
  await settle(tablet, 1400);
  await tablet.click(`[data-act=entMore][data-id="${got.id}"]`);
  await tablet.click(`[data-act=askDel][data-id="${got.id}"]`);
  await tablet.click(`.ent-tools [data-act=delYes][data-id="${got.id}"]`);
  await settle(tablet, 2500);
  await phone.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  await expect
    .poll(() => phone.evaluate(`!!__daroon.DB.entries.find(e => e.id === '${got.id}').deletedAt`), { timeout: 15_000 })
    .toBe(true);
});
