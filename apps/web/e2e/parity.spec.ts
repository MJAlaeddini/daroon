import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { expect, test, type Page } from '@playwright/test';

/**
 * The web app must look like the prototype it came from. Both are driven through the same screens and
 * compared pixel by pixel, with the (always moving) sculpture hidden. Screens redesigned since the port
 * (today, archive, patterns) are left out.
 */
const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
function prototypeUrl(): string {
  let src = readFileSync(path.join(ROOT, 'docs/prototype/daroon.html'), 'utf8');
  src = src.replace(
    '/* compile the trace shader before the first calendar needs it */',
    'window.__daroon={S,DB,go,ACT};',
  );
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' +
    src +
    '</body></html>';
  const dir = fileURLToPath(new URL('../test-results', import.meta.url));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'prototype.html'), html);
  return 'file://' + path.join(dir, 'prototype.html');
}

async function screens(page: Page, url: string) {
  await page.goto(url);
  await page.waitForTimeout(1500);
  const shots: Record<string, Buffer> = {};
  const snap = async (name: string) => {
    await page.waitForTimeout(2600);
    // on a slow machine the entrance animations can still be running after the fixed wait; compare only once every
    // finite one has finished (the sculpture's breathing and other endless loops are hidden or ignored)
    await page.waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      undefined,
      { timeout: 15_000, polling: 100 },
    );
    await page.evaluate(() => {
      (document.getElementById('stage') as HTMLElement).style.visibility = 'hidden';
      document.querySelectorAll('#toast > *').forEach((t) => t.remove());
    });
    shots[name] = await page.screenshot();
    await page.evaluate(() => {
      (document.getElementById('stage') as HTMLElement).style.visibility = '';
    });
  };
  await page.click('[data-act=loginSkip]');
  await page.waitForTimeout(2600);
  await page.click('[data-act=startA]');
  await page.waitForTimeout(1500);
  await page.click('.word[data-key="امید"]');
  await page.click('.word[data-key="نگرانی"]');
  await snap('explore');
  await page.evaluate("__daroon.go('today', { push: false })");
  await page.waitForTimeout(1200);
  await page.click('[data-act=startB]');
  await snap('guide');
  await page.click('.stone[data-id=thoughts]');
  await page.waitForTimeout(1200);
  await page.click('.stone[data-id=future]');
  await snap('suggestions');
  // today, the archive and patterns have been redesigned past the prototype (glass cards, day tiles, the day
  // page); the acceptance suite guards their layout and motion instead
  return shots;
}

for (const v of [
  { width: 390, height: 844, scheme: 'light' as const },
  { width: 1440, height: 900, scheme: 'dark' as const },
]) {
  test(`looks like the prototype at ${v.width}px ${v.scheme}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const ctx = () =>
      browser.newContext({
        viewport: { width: v.width, height: v.height },
        colorScheme: v.scheme,
        deviceScaleFactor: 1,
      });
    const a = await screens(await (await ctx()).newPage(), prototypeUrl());
    const b = await screens(await (await ctx()).newPage(), '/?e2e');
    const diffs: Record<string, number> = {};
    for (const k of Object.keys(a)) {
      const ia = PNG.sync.read(a[k]),
        ib = PNG.sync.read(b[k]);
      const n = pixelmatch(ia.data, ib.data, null, ia.width, ia.height, { threshold: 0.1 });
      diffs[k] = Math.round((n / (ia.width * ia.height)) * 10000) / 100;
    }
    for (const [k, pct] of Object.entries(diffs)) expect(pct, `${k} differs by ${pct}%`).toBeLessThan(1);
  });
}
