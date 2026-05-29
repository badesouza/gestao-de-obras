import type { FastifyInstance } from 'fastify';
import { handleAppError } from '../../shared/errors.js';
import { getEntityPublicById } from '../platform/entities/entity.service.js';
import { registerLocalitiesRoutes } from './localities.routes.js';

/** Public routes for tenant context and shared lookups (no auth) */
export async function registerPublicRoutes(fastify: FastifyInstance) {
  fastify.get('/tenants/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tenant = await getEntityPublicById(fastify.prisma, id);
      return reply.send(tenant);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  await registerLocalitiesRoutes(fastify);
}
