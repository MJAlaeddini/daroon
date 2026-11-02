import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entry, harness, signInWithEmail, type Harness } from './helpers';

let h: Harness;
beforeAll(async () => {
  h = await harness();
});
afterAll(async () => {
  await h.close();
});

describe('account', () => {
  it('renames, exports and deletes everything', async () => {
    const c = await signInWithEmail(h, 'me@example.com', 'مینا');
    expect((await c.patch('/api/me', { name: 'مینو' })).json().account.name).toBe('مینو');
    const answer = {
      id: 'family|نگرانی',
      verdict: 'yes',
      group: 6,
      hits: 5,
      others: 18,
      elsewhere: 2,
      at: new Date().toISOString(),
    };
    await c.post('/api/sync', {
      since: 0,
      changes: [entry({ scenes: ['family'] }), entry({ deletedAt: new Date().toISOString() })],
      feedback: [answer],
    });
    const ex = (await c.get('/api/me/export')).json();
    expect(ex.account.email).toBe('me@example.com');
    expect(ex.entries).toHaveLength(1);
    expect(ex.entries[0].scenes).toEqual(['family']);
    expect(ex.patternAnswers).toMatchObject([{ id: answer.id, verdict: 'yes' }]);

    expect((await c.del('/api/me')).statusCode).toBe(204);
    expect((await c.get('/api/me')).statusCode).toBe(401);
    const left = await h.db.db.execute(
      sql`select (select count(*) from users)::int u, (select count(*) from entries)::int e, (select count(*) from sessions)::int s, (select count(*) from insight_feedback)::int f`,
    );
    expect(left.rows[0]).toEqual({ u: 0, e: 0, s: 0, f: 0 });
  });

  it('rejects empty names', async () => {
    const c = await signInWithEmail(h, 'n@example.com');
    expect((await c.patch('/api/me', { name: '  ' })).statusCode).toBe(400);
  });
});
