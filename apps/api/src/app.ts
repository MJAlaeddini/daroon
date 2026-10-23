import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { sql } from 'drizzle-orm';
import type { Config } from './config';
import type { Database } from './db/client';
import { AppError } from './lib/errors';
import session from './plugins/session';
import csrf from './plugins/csrf';
import authRoutes from './modules/auth/routes';
import accountRoutes from './modules/account/routes';
import entryRoutes from './modules/entries/routes';
import storyRoutes from './modules/stories/routes';
import type { Mailer } from './modules/auth/mailer';
import type { GoogleVerifier } from './modules/auth/google';
import type { StoryWriter } from './modules/stories/writer';

/** Everything a request handler may need. Built once in server.ts; tests pass fakes. */
export interface Deps {
  config: Config;
  db: Database;
  mailer: Mailer;
  google: GoogleVerifier | null;
  writer: StoryWriter | null;
  log: { warn: (o: object, m: string) => void; info: (o: object, m: string) => void };
}

export async function buildApp(deps: Deps, opts: { logger?: boolean | object } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: deps.config.TRUST_PROXY,
    bodyLimit: 256 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => new AppError(429, 'too_many_requests', `retry in ${ctx.after}`),
  });
  await app.register(csrf, { origin: deps.config.APP_ORIGIN });
  await app.register(session, { deps });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: err.code, message: err.message });
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.statusCode && e.statusCode < 500)
      return reply.code(e.statusCode).send({ error: e.code ?? 'bad_request', message: e.message });
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'internal' });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: 'not_found' }));

  await app.register(
    async (api) => {
      api.get('/health', async () => {
        await deps.db.db.execute(sql`select 1`);
        return { ok: true };
      });
      await api.register(authRoutes, { deps });
      await api.register(accountRoutes, { deps });
      await api.register(entryRoutes, { deps });
      await api.register(storyRoutes, { deps });
    },
    { prefix: '/api' },
  );
  return app;
}
