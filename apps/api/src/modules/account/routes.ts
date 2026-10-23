import type { FastifyInstance } from 'fastify';
import { ProfileBody } from '@daroon/shared';
import { parse } from '../../lib/validate';
import type { Deps } from '../../app';
import { accountOf, accountService } from './service';

export default async function accountRoutes(app: FastifyInstance, { deps }: { deps: Deps }) {
  const svc = accountService(deps);
  app.addHook('preHandler', app.requireUser);

  app.get('/me', async (req) => ({ account: await accountOf(deps, req.user!.id) }));

  app.patch('/me', async (req) => {
    const { name } = parse(ProfileBody, req.body);
    return { account: await svc.rename(req.user!.id, name) };
  });

  app.get('/me/export', async (req, reply) => {
    reply.header('content-disposition', 'attachment; filename="daroon-export.json"');
    return svc.exportAll(req.user!.id);
  });

  app.delete('/me', async (req, reply) => {
    await svc.remove(req.user!.id);
    await app.endSession(reply, req);
    return reply.code(204).send();
  });
}
