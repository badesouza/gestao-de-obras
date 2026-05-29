import type { FastifyInstance } from 'fastify';
import { handleAppError } from '../../../shared/errors.js';
import { requirePlatformAuth } from '../../../plugins/auth-platform.js';
import { lookupCnpj } from './cnpj.service.js';

/** Registers CNPJ lookup proxy routes */
export async function registerCnpjRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/cnpj/:cnpj',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const { cnpj } = request.params as { cnpj: string };
        const result = await lookupCnpj(cnpj);
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );
}
