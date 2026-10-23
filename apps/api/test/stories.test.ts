import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { harness, signInWithEmail, type Harness } from './helpers';

let h: Harness;
beforeAll(async () => { h = await harness(); });
afterAll(async () => { await h.close(); });

const week = {
  week: '2026-10-17',
  weekKeys: ['امید', 'دلشوره'],
  entries: [
    { day: '2026-10-17', time: '09:10', emotions: [{ key: 'امید', parent: 'امید' }, { key: 'دلشوره', parent: 'نگرانی' }], context: null, note: 'یادداشت خصوصی ۱۲۳' },
    { day: '2026-10-19', time: '22:00', emotions: [{ key: 'امید', parent: 'امید' }], context: null },
  ],
};

describe('weekly stories', () => {
  it('writes, maps page words back to keys, and keeps notes out of storage', async () => {
    const c = await signInWithEmail(h, 'story@example.com');
    h.writerReplies.push({ title: 'هفته‌ی امید', pages: [{ emotion: 'امید', text: 'صفحه‌ی اول' }, { emotion: 'ناشناس', text: 'صفحه‌ی دوم' }] });
    const r = await c.post('/api/stories', week);
    expect(r.statusCode).toBe(200);
    const st = r.json().story;
    expect(st).toMatchObject({ week: '2026-10-17', title: 'هفته‌ی امید', source: 'writer', weekKeys: ['امید', 'دلشوره'] });
    expect(st.pages).toEqual([{ key: 'امید', text: 'صفحه‌ی اول' }, { key: null, text: 'صفحه‌ی دوم' }]);
    expect(h.writerPrompts[0]).toContain('یادداشت خصوصی ۱۲۳');
    const dump = await h.db.db.execute(sql`select * from stories`);
    expect(JSON.stringify(dump.rows)).not.toContain('یادداشت خصوصی');
    expect((await c.get('/api/stories')).json().stories).toHaveLength(1);
  });

  it('tells the app when the writer fails, so it can use the local story', async () => {
    const c = await signInWithEmail(h, 'fail@example.com');
    h.writerReplies.push({ nonsense: true });
    const r = await c.post('/api/stories', week);
    expect(r.statusCode).toBe(503);
    expect(r.json().error).toBe('writer_failed');
  });

  it('caps writer calls per day', async () => {
    const c = await signInWithEmail(h, 'cap@example.com');
    const codes = [];
    for (let i = 0; i < 4; i++) {
      h.writerReplies.push({ title: 't', pages: [{ text: 'a' }, { text: 'b' }] });
      codes.push((await c.post('/api/stories', week)).statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 429]);
  });

  it('needs at least two entries', async () => {
    const c = await signInWithEmail(h, 'short@example.com');
    expect((await c.post('/api/stories', { ...week, entries: week.entries.slice(0, 1) })).statusCode).toBe(400);
  });
});

describe('without a writer', () => {
  it('answers writer_unavailable', async () => {
    const h2 = await harness({ writer: null });
    const c = await signInWithEmail(h2, 'nowriter@example.com');
    const r = await c.post('/api/stories', week);
    expect(r.json().error).toBe('writer_unavailable');
    expect((await c.get('/api/stories')).json().writer).toBe(false);
    await h2.close();
  });
});
