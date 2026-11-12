import type { FastifyInstance } from 'fastify';
import {
  GoogleBody,
  PasswordLoginBody,
  RequestCodeBody,
  SignupBody,
  UsernameQuery,
  VerifyCodeBody,
} from '@daroon/shared';
import { parse } from '../../lib/validate';
import { AppError, unavailable } from '../../lib/errors';
import type { Deps } from '../../app';
import { authService } from './service';
import { accountOf } from '../account/service';

export default async function authRoutes(app: FastifyInstance, { deps }: { deps: Deps }) {
  const svc = authService(deps);
  const strict = { config: { rateLimit: { max: deps.config.AUTH_RATE_LIMIT, timeWindow: '15 minutes' } } };

  /* email codes are offered only where they can arrive: with SMTP, or in development where they go to the log */
  app.get('/auth/config', async () => ({
    google: deps.config.GOOGLE_CLIENT_ID ?? null,
    email: !!deps.config.SMTP_URL || !deps.config.isProd,
    password: true,
  }));

  /* asked while someone types a username, so it has a looser limit of its own (signing up tells the same anyway) */
  const typing = { config: { rateLimit: { max: deps.config.AUTH_RATE_LIMIT * 10, timeWindow: '15 minutes' } } };
  app.get('/auth/username', typing, async (req) => {
    const { u } = parse(UsernameQuery, req.query);
    return svc.usernameStatus(u);
  });

  app.post('/auth/signup', strict, async (req, reply) => {
    const { username, password, name } = parse(SignupBody, req.body);
    const userId = await svc.signup(username, password, name);
    await app.startSession(reply, req, userId);
    return { account: await accountOf(deps, userId) };
  });

  app.post('/auth/login', strict, async (req, reply) => {
    const { username, password } = parse(PasswordLoginBody, req.body);
    const userId = await svc.passwordLogin(username, password);
    await app.startSession(reply, req, userId);
    return { account: await accountOf(deps, userId) };
  });

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
