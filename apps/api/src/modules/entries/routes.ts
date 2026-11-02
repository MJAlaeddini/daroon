import type { FastifyInstance } from 'fastify';
import { SyncRequest } from '@daroon/shared';
import { parse } from '../../lib/validate';
import type { Deps } from '../../app';
import { entriesService } from './service';

export default async function entryRoutes(app: FastifyInstance, { deps }: { deps: Deps }) {
  const svc = entriesService(deps);
  app.addHook('preHandler', app.requireUser);

  app.post('/sync', { bodyLimit: 2 * 1024 * 1024 }, async (req) => {
    const { since, changes, feedback } = parse(SyncRequest, req.body);
    return svc.sync(req.user!.id, since, changes, feedback);
  });
}
