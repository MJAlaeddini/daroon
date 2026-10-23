import { and, eq, sql } from 'drizzle-orm';
import { keyOf, labelOf, normStory, storyPrompt, type Story, type StoryRequest } from '@daroon/shared';
import { stories, storyUsage } from '../../db/schema';
import { randomToken } from '../../lib/crypto';
import { tooMany, unavailable } from '../../lib/errors';
import type { Deps } from '../../app';

type Row = typeof stories.$inferSelect;
const toWire = (r: Row): Story => ({
  id: r.id, week: r.week, title: r.title, pages: r.pages, weekKeys: r.weekKeys, source: r.source, createdAt: r.createdAt.toISOString(),
});

export function storiesService(deps: Deps) {
  const { db } = deps.db;
  return {
    async list(userId: string): Promise<Story[]> {
      const rows = await db.select().from(stories).where(eq(stories.userId, userId)).orderBy(stories.week);
      return rows.map(toWire);
    },

    /**
     * Has the writer tell a week's story and keeps it. The notes in `req.entries` are used for this one
     * prompt only and are never stored.
     */
    async write(userId: string, req: StoryRequest): Promise<Story> {
      if (!deps.writer) throw unavailable('writer_unavailable');
      const today = keyOf(new Date());
      const [usage] = await db
        .insert(storyUsage)
        .values({ userId, day: today, count: 1 })
        .onConflictDoUpdate({ target: [storyUsage.userId, storyUsage.day], set: { count: sql`${storyUsage.count} + 1` } })
        .returning();
      if (usage.count > deps.config.STORIES_PER_DAY) throw tooMany('story_limit');

      const keys = [...new Set(req.entries.flatMap((e) => e.emotions.map((x) => x.key)))];
      const allowed = keys.map(labelOf);
      let draft;
      try {
        draft = normStory(await deps.writer.write(storyPrompt(req.week, req.entries, allowed)), allowed);
      } catch (e) {
        deps.log.warn({ err: e }, 'story writer failed');
        throw unavailable('writer_failed');
      }
      const toKey = (l: string | null) => (l ? keys.find((k) => labelOf(k) === l) ?? null : null);
      const row = {
        userId, week: req.week, id: randomToken(9), title: draft.title,
        pages: draft.pages.map((p) => ({ key: toKey(p.label), text: p.text })),
        weekKeys: req.weekKeys, source: 'writer' as const, createdAt: new Date(),
      };
      const { userId: _u, week: _w, ...update } = row;
      const [saved] = await db
        .insert(stories)
        .values(row)
        .onConflictDoUpdate({ target: [stories.userId, stories.week], set: update })
        .returning();
      return toWire(saved);
    },

    async remove(userId: string, week: string) {
      await db.delete(stories).where(and(eq(stories.userId, userId), eq(stories.week, week)));
    },
  };
}
