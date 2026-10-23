import { sql } from 'drizzle-orm';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp, type Deps } from '../src/app';
import { loadConfig } from '../src/config';
import { connect, type Database } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import type { GoogleProfile } from '../src/modules/auth/google';

export const ORIGIN = 'http://app.test';
const DB_URL = process.env.TEST_DATABASE_URL ?? 'postgres://daroon:daroon@localhost:5433/daroon_test';

export interface Harness {
  app: FastifyInstance;
  db: Database;
  codes: Map<string, string>;
  google: Map<string, GoogleProfile>;
  writerReplies: unknown[];
  writerPrompts: string[];
  close(): Promise<void>;
}

/** A fresh database and an app wired with fake mail, Google and writer. */
export async function harness(overrides: Partial<Deps> = {}, env: Record<string, string> = {}): Promise<Harness> {
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: DB_URL, APP_ORIGIN: ORIGIN, AUTH_SECRET: 'x'.repeat(40), STORIES_PER_DAY: '3', AUTH_RATE_LIMIT: '1000', ...env });
  const db = connect(DB_URL);
  await db.db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
  await runMigrations(db.db);
  const codes = new Map<string, string>(), google = new Map<string, GoogleProfile>();
  const writerReplies: unknown[] = [], writerPrompts: string[] = [];
  const quiet = { info: () => {}, warn: () => {} };
  const app = await buildApp({
    config, db, log: quiet,
    mailer: { async sendLoginCode(to, code) { codes.set(to, code); } },
    google: { async verify(c) { const p = google.get(c); if (!p) throw new Error('bad'); return p; } },
    writer: { async write(prompt) { writerPrompts.push(prompt); const r = writerReplies.shift(); if (r instanceof Error) throw r; return r; } },
    ...overrides,
  });
  return { app, db, codes, google, writerReplies, writerPrompts, close: async () => { await app.close(); await db.close(); } };
}

/** A small client that keeps the session cookie between calls, like a browser would. */
export function client(app: FastifyInstance) {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> => {
    const res = await app.inject({
      method: method as 'GET', url,
      headers: { origin: ORIGIN, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      payload: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.cookies.find((c) => c.name === 'daroon_sid');
    if (set) cookie = set.value ? `daroon_sid=${set.value}` : '';
    return res;
  };
  return {
    get: (u: string, h?: Record<string, string>) => call('GET', u, undefined, h),
    post: (u: string, b: unknown = {}, h?: Record<string, string>) => call('POST', u, b, h),
    patch: (u: string, b: unknown) => call('PATCH', u, b),
    del: (u: string) => call('DELETE', u),
    get cookie() { return cookie; },
  };
}

export async function signInWithEmail(h: Harness, email = 'sara@example.com', name = 'سارا') {
  const c = client(h.app);
  await c.post('/api/auth/email/request', { email });
  const res = await c.post('/api/auth/email/verify', { email, code: h.codes.get(email), name });
  if (res.statusCode !== 200) throw new Error(res.body);
  return c;
}

let n = 0;
export function entry(over: Record<string, unknown> = {}) {
  const t = new Date(Date.UTC(2026, 9, 20, 8, 0, n++)).toISOString();
  return { id: `e${String(n).padStart(6, '0')}`, day: '2026-10-20', time: '11:30', emotions: [{ key: 'امید', parent: 'امید' }], unnamed: false,
    path: 'explore', createdAt: t, updatedAt: t, ...over };
}
