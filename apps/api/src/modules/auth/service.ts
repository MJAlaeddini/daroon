import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { authCodes, users } from '../../db/schema';
import { randomInt } from 'node:crypto';
import { hmac, safeEqual, sixDigits } from '../../lib/crypto';
import { AppError, tooMany } from '../../lib/errors';
import type { Deps } from '../../app';
import type { UsernameStatus } from '@daroon/shared';
import type { GoogleProfile } from './google';
import { dummyHash, hashPassword, verifyPassword } from '../../lib/password';

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

export function authService(deps: Deps) {
  const { db } = deps.db;
  const hashCode = (email: string, code: string) => hmac(deps.config.AUTH_SECRET, `${email}:${code}`);

  return {
    /** Creates and mails a 6-digit code. Silent about whether the address has an account. */
    async requestCode(email: string): Promise<void> {
      const hourAgo = new Date(Date.now() - 3_600_000);
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(authCodes)
        .where(and(eq(authCodes.email, email), gt(authCodes.createdAt, hourAgo)));
      if (n >= MAX_CODES_PER_HOUR) throw tooMany('too_many_codes');
      const code = sixDigits();
      await db
        .insert(authCodes)
        .values({ email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
      await deps.mailer.sendLoginCode(email, code);
    },

    /** Checks the newest live code for the address and returns the (possibly new) user id. */
    async verifyCode(email: string, code: string, name?: string): Promise<string> {
      const [row] = await db
        .select()
        .from(authCodes)
        .where(and(eq(authCodes.email, email), isNull(authCodes.consumedAt), gt(authCodes.expiresAt, new Date())))
        .orderBy(desc(authCodes.createdAt))
        .limit(1);
      if (!row || row.attempts >= MAX_ATTEMPTS) throw new AppError(400, 'code_expired');
      if (!safeEqual(row.codeHash, hashCode(email, code))) {
        await db
          .update(authCodes)
          .set({ attempts: row.attempts + 1 })
          .where(eq(authCodes.id, row.id));
        throw new AppError(400, 'code_wrong');
      }
      await db.update(authCodes).set({ consumedAt: new Date() }).where(eq(authCodes.id, row.id));
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) return existing.id;
      const [u] = await db
        .insert(users)
        .values({ email, name: (name ?? '').trim().slice(0, 24), provider: 'email' })
        .returning();
      return u.id;
    },

    /** Is this username free? When it is not, up to three free ones built from it (digits, a dot, an underscore). */
    async usernameStatus(username: string): Promise<UsernameStatus> {
      const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (!taken) return { available: true, suggestions: [] };
      const base = username.replace(/[._]?\d+$/, '').slice(0, 20) || username.slice(0, 20);
      const n = () => 10 + randomInt(0, 90);
      const tries = [
        ...new Set([`${base}${n()}`, `${base}_${n()}`, `${base}.${n()}`, `${base}${n()}`, `${base}_${n()}`]),
      ];
      const used = await db.select({ u: users.username }).from(users).where(inArray(users.username, tries));
      const gone = new Set(used.map((r) => r.u));
      return { available: false, suggestions: tries.filter((t) => !gone.has(t)).slice(0, 3) };
    },

    /** Makes an account with a username and password; the name is the username's until they choose one. */
    async signup(username: string, password: string, name?: string): Promise<string> {
      const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (taken) throw new AppError(409, 'username_taken');
      const passwordHash = await hashPassword(password);
      const rows = await db
        .insert(users)
        .values({ username, passwordHash, name: (name ?? '').trim().slice(0, 24), provider: 'password' })
        .onConflictDoNothing()
        .returning();
      if (!rows[0]) throw new AppError(409, 'username_taken');
      return rows[0].id;
    },

    /** The same answer, after the same work, whether the username is unknown or the password is wrong. */
    async passwordLogin(username: string, password: string): Promise<string> {
      const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      const ok = await verifyPassword(password, u?.passwordHash ?? (await dummyHash()));
      if (!u?.passwordHash || !ok) throw new AppError(401, 'login_wrong');
      return u.id;
    },

    /** Finds the user for a Google account, linking by verified email when one already signed in with a code. */
    async googleUser(p: GoogleProfile): Promise<string> {
      const [bySub] = await db.select().from(users).where(eq(users.googleSub, p.sub)).limit(1);
      if (bySub) return bySub.id;
      if (p.email && p.emailVerified) {
        const email = p.email.toLowerCase();
        const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (byEmail) {
          await db
            .update(users)
            .set({ googleSub: p.sub, name: byEmail.name || p.name.slice(0, 24) })
            .where(eq(users.id, byEmail.id));
          return byEmail.id;
        }
      }
      const [u] = await db
        .insert(users)
        .values({
          googleSub: p.sub,
          email: p.emailVerified && p.email ? p.email.toLowerCase() : null,
          name: p.name.slice(0, 24),
          provider: 'google',
        })
        .returning();
      return u.id;
    },
  };
}
