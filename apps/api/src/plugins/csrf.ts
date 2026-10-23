import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { forbidden } from '../lib/errors';

/**
 * Cookies are SameSite=Lax; on top of that every state-changing request must come from the app's own
 * origin and carry JSON, which a cross-site form cannot send.
 */
export default fp(async function csrf(app: FastifyInstance, { origin }: { origin: string }) {
  const allowed = new URL(origin).origin;
  app.addHook('onRequest', async (req) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
    const o = req.headers.origin;
    if (o && o !== allowed) throw forbidden('bad_origin');
    if (!o) {
      const ref = req.headers.referer;
      if (ref && new URL(ref).origin !== allowed) throw forbidden('bad_origin');
    }
    const ct = req.headers['content-type'] ?? '';
    const hasBody = req.headers['content-length'] && req.headers['content-length'] !== '0';
    if (hasBody && !ct.startsWith('application/json')) throw forbidden('json_only');
  });
});
