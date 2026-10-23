import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, entry, harness, signInWithEmail, type Harness } from './helpers';

let h: Harness;
beforeAll(async () => { h = await harness(); });
afterAll(async () => { await h.close(); });

describe('sync', () => {
  it('needs an account', async () => {
    expect((await client(h.app).post('/api/sync', { since: 0, changes: [] })).statusCode).toBe(401);
  });

  it('moves entries between two devices, newest edit wins, deletions travel', async () => {
    const phone = await signInWithEmail(h, 'two@example.com');
    const tablet = client(h.app);
    // second device of the same person
    await tablet.post('/api/auth/email/request', { email: 'two@example.com' });
    await tablet.post('/api/auth/email/verify', { email: 'two@example.com', code: h.codes.get('two@example.com') });

    const a = entry(), b = entry({ emotions: [], unnamed: true });
    const r1 = (await phone.post('/api/sync', { since: 0, changes: [a, b] })).json();
    expect(r1.changes).toHaveLength(2);

    const r2 = (await tablet.post('/api/sync', { since: 0, changes: [] })).json();
    expect(r2.changes.map((e: { id: string }) => e.id).sort()).toEqual([a.id, b.id].sort());
    expect(r2.cursor).toBe(r1.cursor);

    // tablet edits a; phone sends an older edit of a, which must lose
    const newer = { ...a, emotions: [{ key: 'آرامش', parent: 'آرامش' }], updatedAt: new Date(Date.parse(a.updatedAt) + 60_000).toISOString() };
    const older = { ...a, emotions: [{ key: 'خشم', parent: 'خشم' }], updatedAt: new Date(Date.parse(a.updatedAt) + 1_000).toISOString() };
    await tablet.post('/api/sync', { since: r2.cursor, changes: [newer] });
    const r3 = (await phone.post('/api/sync', { since: r1.cursor, changes: [older] })).json();
    const got = r3.changes.find((e: { id: string }) => e.id === a.id);
    expect(got.emotions[0].key).toBe('آرامش');

    // deletion as a tombstone
    const del = { ...b, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await phone.post('/api/sync', { since: r3.cursor, changes: [del] });
    const r4 = (await tablet.post('/api/sync', { since: r2.cursor, changes: [] })).json();
    expect(r4.changes.find((e: { id: string }) => e.id === b.id).deletedAt).not.toBeNull();

    // nothing new: empty reply, cursor unchanged
    const r5 = (await tablet.post('/api/sync', { since: r4.cursor, changes: [] })).json();
    expect(r5).toEqual({ cursor: r4.cursor, changes: [] });
  });

  it('keeps people apart', async () => {
    const x = await signInWithEmail(h, 'x@example.com');
    const y = await signInWithEmail(h, 'y@example.com');
    await x.post('/api/sync', { since: 0, changes: [entry({ id: 'shared-id-1' })] });
    await y.post('/api/sync', { since: 0, changes: [entry({ id: 'shared-id-1', emotions: [{ key: 'غم', parent: 'غم' }] })] });
    const rx = (await x.post('/api/sync', { since: 0, changes: [] })).json();
    expect(rx.changes).toHaveLength(1);
    expect(rx.changes[0].emotions[0].key).toBe('امید');
  });

  it('rejects unknown words and bad shapes', async () => {
    const c = await signInWithEmail(h, 'bad@example.com');
    const r = await c.post('/api/sync', { since: 0, changes: [entry({ emotions: [{ key: 'نامعلوم' }] })] });
    expect(r.statusCode).toBe(400);
    expect((await c.post('/api/sync', { since: 0, changes: [entry({ day: '1405/08/01' })] })).statusCode).toBe(400);
    expect((await c.post('/api/sync', { since: 0, changes: [entry({ emotions: [1, 2, 3, 4].map(() => ({ key: 'امید' })) })] })).statusCode).toBe(400);
  });

  it('accepts custom words and personal colours', async () => {
    const c = await signInWithEmail(h, 'custom@example.com');
    const e = entry({ emotions: [{ key: 'custom:بی‌حس', parent: null, custom: true, color: 'lilac' }] });
    const r = (await c.post('/api/sync', { since: 0, changes: [e] })).json();
    expect(r.changes[0].emotions[0]).toEqual({ key: 'custom:بی‌حس', parent: null, custom: true, color: 'lilac' });
  });
});
