import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DAY_KEY, StoryRequest } from '@daroon/shared';
import { parse } from '../../lib/validate';
import type { Deps } from '../../app';
import { storiesService } from './service';

export default async function storyRoutes(app: FastifyInstance, { deps }: { deps: Deps }) {
  const svc = storiesService(deps);
  app.addHook('preHandler', app.requireUser);

  app.get('/stories', async (req) => ({ stories: await svc.list(req.user!.id), writer: !!deps.writer }));

  app.post(
    '/stories',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } }, bodyLimit: 512 * 1024 },
    async (req) => {
      const body = parse(StoryRequest, req.body);
      return { story: await svc.write(req.user!.id, body) };
    },
  );

  app.delete('/stories/:week', async (req, reply) => {
    const { week } = parse(z.object({ week: z.string().regex(DAY_KEY) }), req.params);
    await svc.remove(req.user!.id, week);
    return reply.code(204).send();
  });
}
