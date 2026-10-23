import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { and, eq, gt } from 'drizzle-orm';
import { randomToken, sha256 } from '../lib/crypto';
import { unauthorized } from '../lib/errors';
import { sessions, users } from '../db/schema';
import type { Deps } from '../app';

export const SESSION_COOKIE = 'daroon_sid';

export interface SessionUser { id: string; name: string; email: string | null; provider: 'email' | 'google'; createdAt: Date }

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionId: string | null;
  }
  interface FastifyInstance {
    requireUser: (req: FastifyRequest) => Promise<void>;
    startSession: (reply: FastifyReply, req: FastifyRequest, userId: string) => Promise<void>;
    endSession: (reply: FastifyReply, req: FastifyRequest) => Promise<void>;
  }
}

/**
 * Cookie sessions. The cookie holds a random token; the database keeps only its hash,
 * so a database leak does not hand out working sessions.
 */
export default fp(async function session(app: FastifyInstance, { deps }: { deps: Deps }) {
  const { db } = deps.db;
  const days = deps.config.SESSION_DAYS;
  const cookieOpts = { path: '/api', httpOnly: true, sameSite: 'lax' as const, secure: deps.config.isProd, maxAge: days * 86400 };

  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);

  app.addHook('onRequest', async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const id = sha256(token);
    const now = new Date();
    const rows = await db
      .select({ s: sessions, u: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
      .limit(1);
    const row = rows[0];
    if (!row) return;
    req.user = { id: row.u.id, name: row.u.name, email: row.u.email, provider: row.u.provider, createdAt: row.u.createdAt };
    req.sessionId = id;
    // slide the expiry at most once a day
    if (now.getTime() - row.s.lastSeenAt.getTime() > 86_400_000) {
      await db.update(sessions).set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + days * 86_400_000) }).where(eq(sessions.id, id));
    }
  });

  app.decorate('requireUser', async (req: FastifyRequest) => {
    if (!req.user) throw unauthorized();
  });

  app.decorate('startSession', async (reply: FastifyReply, req: FastifyRequest, userId: string) => {
    const token = randomToken();
    await db.insert(sessions).values({
      id: sha256(token), userId, expiresAt: new Date(Date.now() + days * 86_400_000),
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
    });
    reply.setCookie(SESSION_COOKIE, token, cookieOpts);
  });

  app.decorate('endSession', async (reply: FastifyReply, req: FastifyRequest) => {
    if (req.sessionId) await db.delete(sessions).where(eq(sessions.id, req.sessionId));
    reply.clearCookie(SESSION_COOKIE, { path: '/api' });
  });
});
