import { and, eq, gt, sql } from 'drizzle-orm';
import type { InsightFeedback, SyncedEntry, SyncResponse } from '@daroon/shared';
import { entries, insightFeedback } from '../../db/schema';
import type { Deps } from '../../app';

type Row = typeof entries.$inferSelect;
const toWire = (r: Row): SyncedEntry => ({
  id: r.id,
  day: r.day,
  time: r.time,
  emotions: r.emotions,
  suggested: r.suggested,
  context: r.context,
  scenes: r.scenes ?? [],
  intensity: r.intensity ?? null,
  meaning: r.meaning ?? null,
  unnamed: r.unnamed,
  path: r.path as SyncedEntry['path'],
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
});

/**
 * Two-way sync. The device sends what changed since its last sync; the newer `updatedAt` wins per entry
 * (deletions are kept as tombstones so they travel too). The reply carries everything written after the
 * device's cursor. Syncs for one person are serialised with an advisory lock, so cursors never skip a row.
 */
export function entriesService(deps: Deps) {
  const { db } = deps.db;
  return {
    async sync(
      userId: string,
      since: number,
      changes: SyncedEntry[],
      feedback: InsightFeedback[] = [],
    ): Promise<SyncResponse> {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
        for (const c of changes) {
          const values = {
            userId,
            id: c.id,
            day: c.day,
            time: c.time,
            emotions: c.emotions,
            suggested: c.suggested,
            context: c.context,
            scenes: c.scenes,
            intensity: c.intensity,
            meaning: c.meaning,
            unnamed: c.unnamed,
            path: c.path,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
            seq: sql`nextval('entry_seq')`,
          };
          const { userId: _u, id: _i, createdAt: _c, ...update } = values;
          await tx
            .insert(entries)
            .values(values)
            .onConflictDoUpdate({
              target: [entries.userId, entries.id],
              set: update,
              setWhere: sql`${entries.updatedAt} < excluded.updated_at`,
            });
        }
        for (const f of feedback) {
          const values = {
            userId,
            id: f.id,
            verdict: f.verdict,
            groupSize: f.group,
            hits: f.hits,
            others: f.others,
            elsewhere: f.elsewhere,
            updatedAt: new Date(f.at),
          };
          const { userId: _u, id: _i, ...update } = values;
          await tx
            .insert(insightFeedback)
            .values(values)
            .onConflictDoUpdate({
              target: [insightFeedback.userId, insightFeedback.id],
              set: update,
              setWhere: sql`${insightFeedback.updatedAt} < excluded.updated_at`,
            });
        }
        const answers = await tx.select().from(insightFeedback).where(eq(insightFeedback.userId, userId));
        const rows = await tx
          .select()
          .from(entries)
          .where(and(eq(entries.userId, userId), gt(entries.seq, since)))
          .orderBy(entries.seq)
          .limit(5000);
        const [{ max }] = await tx
          .select({ max: sql<number>`coalesce(max(${entries.seq}), 0)::bigint` })
          .from(entries)
          .where(eq(entries.userId, userId));
        const cursor = rows.length === 5000 ? rows[rows.length - 1].seq : Math.max(Number(max), since);
        return {
          cursor,
          changes: rows.map(toWire),
          feedback: answers.map((a) => ({
            id: a.id,
            verdict: a.verdict,
            group: a.groupSize,
            hits: a.hits,
            others: a.others,
            elsewhere: a.elsewhere,
            at: a.updatedAt.toISOString(),
          })),
        };
      });
    },
  };
}
