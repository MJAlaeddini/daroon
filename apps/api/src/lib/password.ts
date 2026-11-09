/* Passwords are stored as scrypt hashes with their own salt and cost, so the cost can rise later without breaking
 * old hashes. */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384,
  R = 8,
  P = 1,
  LEN = 32;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((ok, fail) =>
    scrypt(password.normalize('NFKC'), salt, LEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, key) =>
      e ? fail(e) : ok(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const got = await derive(password, Buffer.from(salt, 'base64'), +n, +r, +p);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** A real hash of nothing, checked when a username does not exist, so a miss takes as long as a wrong password. */
let dummy: Promise<string> | null = null;
export const dummyHash = (): Promise<string> => (dummy ??= hashPassword(randomBytes(12).toString('base64')));
