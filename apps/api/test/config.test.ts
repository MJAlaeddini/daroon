import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const base = { DATABASE_URL: 'postgres://x@localhost/x', AUTH_SECRET: 'x'.repeat(40), SMTP_URL: 'smtp://localhost' };

describe('config', () => {
  it('marks the session cookie Secure in production unless told otherwise', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(true);
    expect(loadConfig({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
    expect(loadConfig({ ...base, NODE_ENV: 'development' }).COOKIE_SECURE).toBe(false);
  });
  it('reads booleans literally', () => {
    expect(loadConfig({ ...base, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
    expect(loadConfig({ ...base, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
  });
  it('starts in production without mail (codes go to the log)', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production', SMTP_URL: '' }).SMTP_URL).toBe('');
  });
});
