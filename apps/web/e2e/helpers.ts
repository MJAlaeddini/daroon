import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, BrowserContext } from '@playwright/test';

export const PROBES = readFileSync(fileURLToPath(new URL('./probes.js', import.meta.url)), 'utf8');

export async function open(page: Page, path = '/?e2e') {
  await page.addInitScript(PROBES);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/\/api\/|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(path);
  await page.waitForTimeout(900);
  return errors;
}

/** Records the sculpture and the views every ~35 ms while an action plays out. */
export async function watch(page: Page, act: () => Promise<unknown>, ms = 1800) {
  await act();
  const samples: any[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    samples.push(await page.evaluate('__acc.sample()'));
    await page.waitForTimeout(35);
  }
  const overlaps = samples.flatMap((s) => s.overlaps.map((o: any) => o.txt));
  // two pages counted as stacked only when it lasts more than one sample (~35 ms), which the eye can see
  let ghosts = 0,
    run = 0;
  for (const s of samples) {
    run = s.ghost ? run + 1 : 0;
    if (run >= 2) ghosts++;
  }
  const ghostDetail = samples.filter((s) => s.ghost).map((s) => s.ghost);
  const jumps: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].st,
      b = samples[i].st;
    if (!a || !b || a.op <= 0.5 || b.op <= 0.5 || a.op - b.op > 0.02) continue;
    const d = Math.hypot(b.x + b.w / 2 - a.x - a.w / 2, b.y + b.h / 2 - a.y - a.h / 2);
    if (d > 140) jumps.push(Math.round(d));
  }
  return { overlaps: [...new Set(overlaps)], ghosts, jumps, ghostDetail };
}

export const layout = (page: Page) => page.evaluate('__acc.layout()') as Promise<Record<string, any>>;
export const settle = (page: Page, ms = 1500) => page.waitForTimeout(ms);
export type { BrowserContext };
