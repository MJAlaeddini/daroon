import { eq } from 'drizzle-orm';
import { keyOf, type Account } from '@daroon/shared';
import { entries, insightFeedback, stories, users } from '../../db/schema';
import { notFound } from '../../lib/errors';
import type { Deps } from '../../app';

export async function accountOf(deps: Deps, userId: string): Promise<Account> {
  const [u] = await deps.db.db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw notFound();
  return { id: u.id, name: u.name, email: u.email, provider: u.provider, since: keyOf(u.createdAt) };
}

export function accountService(deps: Deps) {
  const { db } = deps.db;
  return {
    async rename(userId: string, name: string) {
      await db.update(users).set({ name }).where(eq(users.id, userId));
      return accountOf(deps, userId);
    },
    /** Everything the server holds about a person, as one JSON document. */
    async exportAll(userId: string) {
      const account = await accountOf(deps, userId);
      const es = await db.select().from(entries).where(eq(entries.userId, userId));
      const ss = await db.select().from(stories).where(eq(stories.userId, userId));
      const fb = await db.select().from(insightFeedback).where(eq(insightFeedback.userId, userId));
      return {
        exportedAt: new Date().toISOString(),
        account,
        entries: es.filter((e) => !e.deletedAt).map(({ userId: _u, seq: _s, ...e }) => e),
        stories: ss.map(({ userId: _u, ...s }) => s),
        patternAnswers: fb.map(({ userId: _u, ...f }) => f),
        note: 'Notes are kept only on your devices and are not part of this export.',
      };
    },
    /** Deletes the account; entries, stories, pattern answers and sessions go with it (ON DELETE CASCADE). */
    async remove(userId: string) {
      await db.delete(users).where(eq(users.id, userId));
    },
  };
}
