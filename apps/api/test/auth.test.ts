import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, harness, signInWithEmail, type Harness } from './helpers';

let h: Harness;
beforeAll(async () => {
  h = await harness();
});
afterAll(async () => {
  await h.close();
});

describe('health', () => {
  it('reports the database is reachable', async () => {
    const res = await client(h.app).get('/api/health');
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('email sign-in', () => {
  it('signs in with a mailed code and keeps a session', async () => {
    const c = client(h.app);
    expect((await c.post('/api/auth/email/request', { email: ' Ali@Example.com ' })).statusCode).toBe(204);
    const code = h.codes.get('ali@example.com')!;
    expect(code).toMatch(/^\d{6}$/);
    const wrong = await c.post('/api/auth/email/verify', {
      email: 'ali@example.com',
      code: code === '000000' ? '111111' : '000000',
    });
    expect(wrong.json().error).toBe('code_wrong');
    const ok = await c.post('/api/auth/email/verify', { email: 'ali@example.com', code, name: 'علی' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().account).toMatchObject({ name: 'علی', email: 'ali@example.com', provider: 'email' });
    expect((await c.get('/api/me')).json().account.name).toBe('علی');
    // a used code cannot be used again
    const again = await client(h.app).post('/api/auth/email/verify', { email: 'ali@example.com', code });
    expect(again.json().error).toBe('code_expired');
  });

  it('stops guessing after five wrong codes', async () => {
    const c = client(h.app);
    await c.post('/api/auth/email/request', { email: 'g@example.com' });
    const code = h.codes.get('g@example.com')!;
    const bad = code === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) await c.post('/api/auth/email/verify', { email: 'g@example.com', code: bad });
    expect((await c.post('/api/auth/email/verify', { email: 'g@example.com', code })).json().error).toBe(
      'code_expired',
    );
  });

  it('limits codes per address', async () => {
    const c = client(h.app);
    const codes = [];
    for (let i = 0; i < 6; i++)
      codes.push(
        (await c.post('/api/auth/email/request', { email: 'spam@example.com' }, { 'x-forwarded-for': `10.0.0.${i}` }))
          .statusCode,
      );
    expect(codes.slice(0, 5).every((s) => s === 204)).toBe(true);
    expect(codes[5]).toBe(429);
  });

  it('rejects bad input', async () => {
    expect((await client(h.app).post('/api/auth/email/request', { email: 'not-an-email' })).json().error).toBe(
      'invalid_input',
    );
  });

  it('signs out', async () => {
    const c = await signInWithEmail(h, 'out@example.com');
    expect((await c.post('/api/auth/logout')).statusCode).toBe(204);
    expect((await c.get('/api/me')).statusCode).toBe(401);
  });
});

describe('username and password', () => {
  it('signs up, signs in again, and keeps the session', async () => {
    const c = client(h.app);
    const up = await c.post('/api/auth/signup', { username: ' Sara.K ', password: 'a quiet river', name: 'سارا' });
    expect(up.statusCode).toBe(200);
    expect(up.json().account).toMatchObject({ name: 'سارا', username: 'sara.k', email: null, provider: 'password' });
    expect((await c.get('/api/me')).json().account.username).toBe('sara.k');

    const other = client(h.app);
    const login = await other.post('/api/auth/login', { username: 'SARA.K', password: 'a quiet river' });
    expect(login.statusCode).toBe(200);
    expect(login.json().account.id).toBe(up.json().account.id);
    expect((await other.get('/api/me')).statusCode).toBe(200);
  });

  it('keeps usernames unique', async () => {
    await client(h.app).post('/api/auth/signup', { username: 'taken_one', password: '12345678' });
    const again = await client(h.app).post('/api/auth/signup', { username: 'Taken_One', password: '87654321' });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('username_taken');
  });

  it('answers the same for a wrong password and an unknown username', async () => {
    await client(h.app).post('/api/auth/signup', { username: 'mina', password: 'right password' });
    const wrong = await client(h.app).post('/api/auth/login', { username: 'mina', password: 'wrong password' });
    const unknown = await client(h.app).post('/api/auth/login', { username: 'nobody_here', password: 'whatever1' });
    expect([wrong.statusCode, wrong.json().error]).toEqual([401, 'login_wrong']);
    expect([unknown.statusCode, unknown.json().error]).toEqual([401, 'login_wrong']);
  });

  it('rejects short passwords and odd usernames', async () => {
    const c = client(h.app);
    expect((await c.post('/api/auth/signup', { username: 'ok_name', password: 'short' })).json().error).toBe(
      'invalid_input',
    );
    expect((await c.post('/api/auth/signup', { username: 'سارا', password: '12345678' })).json().error).toBe(
      'invalid_input',
    );
    expect((await c.post('/api/auth/signup', { username: 'ab', password: '12345678' })).json().error).toBe(
      'invalid_input',
    );
  });

  it('tells whether a username is free, and offers free ones when it is not', async () => {
    const c = client(h.app);
    expect((await c.get('/api/auth/username?u=Yahya')).json()).toEqual({ available: true, suggestions: [] });
    await c.post('/api/auth/signup', { username: 'yahya', password: '12345678', name: 'یحیی' });
    const taken = (await client(h.app).get('/api/auth/username?u=yahya')).json();
    expect(taken.available).toBe(false);
    expect(taken.suggestions.length).toBeGreaterThan(0);
    for (const s of taken.suggestions) {
      expect(s).toMatch(/^yahya[._]?\d{2}$/);
      expect((await client(h.app).get(`/api/auth/username?u=${s}`)).json().available).toBe(true);
    }
    expect((await c.get(`/api/auth/username?u=${encodeURIComponent('یحیی')}`)).json().error).toBe('invalid_input');
  });

  it('never stores the password itself', async () => {
    await client(h.app).post('/api/auth/signup', { username: 'hash_check', password: 'plain secret' });
    const { rows } = await h.db.pool.query("select password_hash from users where username = 'hash_check'");
    expect(rows[0].password_hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(rows[0].password_hash).not.toContain('plain secret');
  });

  it('says which ways in are offered', async () => {
    expect((await client(h.app).get('/api/auth/config')).json()).toMatchObject({ password: true, email: true });
  });
});

describe('google sign-in', () => {
  it('creates an account, and links to an existing email account', async () => {
    h.google.set('tok-new-user-000000000000', {
      sub: 'g1',
      email: 'new@example.com',
      emailVerified: true,
      name: 'Neda',
    });
    const a = client(h.app);
    const r = await a.post('/api/auth/google', { credential: 'tok-new-user-000000000000' });
    expect(r.json().account).toMatchObject({ provider: 'google', email: 'new@example.com', name: 'Neda' });

    const byEmail = await signInWithEmail(h, 'link@example.com', 'لیلا');
    const id = (await byEmail.get('/api/me')).json().account.id;
    h.google.set('tok-link-user-00000000000', {
      sub: 'g2',
      email: 'LINK@example.com',
      emailVerified: true,
      name: 'Leila',
    });
    const b = client(h.app);
    const linked = await b.post('/api/auth/google', { credential: 'tok-link-user-00000000000' });
    expect(linked.json().account.id).toBe(id);
    expect(linked.json().account.name).toBe('لیلا');
  });

  it('rejects invalid tokens', async () => {
    expect((await client(h.app).post('/api/auth/google', { credential: 'tok-unknown-0000000000000' })).statusCode).toBe(
      401,
    );
  });
});

describe('request safety', () => {
  it('refuses writes from another origin', async () => {
    const res = await client(h.app).post(
      '/api/auth/email/request',
      { email: 'x@example.com' },
      { origin: 'https://evil.example' },
    );
    expect(res.statusCode).toBe(403);
  });
  it('refuses form posts', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { origin: 'http://app.test', 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'a=1',
    });
    expect(res.statusCode).toBe(403);
  });
  it('keeps the session cookie httpOnly and scoped to the API', async () => {
    const c = client(h.app);
    await c.post('/api/auth/email/request', { email: 'cookie@example.com' });
    const res = await c.post('/api/auth/email/verify', {
      email: 'cookie@example.com',
      code: h.codes.get('cookie@example.com'),
    });
    const ck = res.cookies.find((x) => x.name === 'daroon_sid')!;
    expect(ck.httpOnly).toBe(true);
    expect(ck.path).toBe('/api');
    expect(ck.sameSite).toBe('Lax');
  });
});

describe('per-address rate limit', () => {
  it('slows down repeated sign-in attempts from one address', async () => {
    const h2 = await harness({}, { AUTH_RATE_LIMIT: '3' });
    const c = client(h2.app);
    const codes = [];
    for (let i = 0; i < 4; i++)
      codes.push((await c.post('/api/auth/email/verify', { email: 'r@example.com', code: '000000' })).statusCode);
    expect(codes).toEqual([400, 400, 400, 429]);
    await h2.close();
  });
});
