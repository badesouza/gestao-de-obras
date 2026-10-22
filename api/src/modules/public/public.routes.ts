import type { FastifyInstance } from 'fastify';
import { handleAppError } from '../../shared/errors.js';
import { getEntityPublicById } from '../platform/entities/entity.service.js';
import { entradaPublica } from './entrada.service.js';
import { registerLocalitiesRoutes } from './localities.routes.js';
import { registerCentralPublicRoutes } from '../central-municipe/central.routes.js';
import { registerLinkAcessoPublicRoutes } from '../tenant/pessoas/pessoas.routes.js';

/** Public routes for tenant context and shared lookups (no auth) */
export async function registerPublicRoutes(fastify: FastifyInstance) {
  await registerLinkAcessoPublicRoutes(fastify);
  fastify.get('/tenants/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tenant = await getEntityPublicById(fastify.prisma, id);
      return reply.send(tenant);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  /* tela de entrada da prefeitura: só totais e últimas OS (sem endereço nem pessoa) */
  fastify.get('/tenants/:id/entrada', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.send(await entradaPublica(fastify.prisma, id));
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  await registerLocalitiesRoutes(fastify);
  await registerCentralPublicRoutes(fastify);
}
