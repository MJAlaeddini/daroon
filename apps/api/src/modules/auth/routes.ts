import type { FastifyInstance } from 'fastify';
import { GoogleBody, RequestCodeBody, VerifyCodeBody } from '@daroon/shared';
import { parse } from '../../lib/validate';
import { AppError, unavailable } from '../../lib/errors';
import type { Deps } from '../../app';
import { authService } from './service';
import { accountOf } from '../account/service';

export default async function authRoutes(app: FastifyInstance, { deps }: { deps: Deps }) {
  const svc = authService(deps);
  const strict = { config: { rateLimit: { max: deps.config.AUTH_RATE_LIMIT, timeWindow: '15 minutes' } } };

  app.get('/auth/config', async () => ({ google: deps.config.GOOGLE_CLIENT_ID ?? null, email: true }));

  app.post('/auth/email/request', strict, async (req, reply) => {
    const { email } = parse(RequestCodeBody, req.body);
    await svc.requestCode(email);
    return reply.code(204).send();
  });

  app.post('/auth/email/verify', strict, async (req, reply) => {
    const { email, code, name } = parse(VerifyCodeBody, req.body);
    const userId = await svc.verifyCode(email, code, name);
    await app.startSession(reply, req, userId);
    return { account: await accountOf(deps, userId) };
  });

  app.post('/auth/google', strict, async (req, reply) => {
    if (!deps.google) throw unavailable('google_disabled');
    const { credential } = parse(GoogleBody, req.body);
    let profile;
    try {
      profile = await deps.google.verify(credential);
    } catch {
      throw new AppError(401, 'google_invalid');
    }
    const userId = await svc.googleUser(profile);
    await app.startSession(reply, req, userId);
    return { account: await accountOf(deps, userId) };
  });

  app.post('/auth/logout', async (req, reply) => {
    await app.endSession(reply, req);
    return reply.code(204).send();
  });
}
