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
    await c.post('/api/sync', { since: 0, changes: [entry(), entry({ deletedAt: new Date().toISOString() })] });
    const ex = (await c.get('/api/me/export')).json();
    expect(ex.account.email).toBe('me@example.com');
    expect(ex.entries).toHaveLength(1);

    expect((await c.del('/api/me')).statusCode).toBe(204);
    expect((await c.get('/api/me')).statusCode).toBe(401);
    const left = await h.db.db.execute(
      sql`select (select count(*) from users)::int u, (select count(*) from entries)::int e, (select count(*) from sessions)::int s`,
    );
    expect(left.rows[0]).toEqual({ u: 0, e: 0, s: 0 });
  });

  it('rejects empty names', async () => {
    const c = await signInWithEmail(h, 'n@example.com');
    expect((await c.patch('/api/me', { name: '  ' })).statusCode).toBe(400);
  });
});
