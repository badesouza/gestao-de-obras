import type { FastifyInstance } from 'fastify';
import { handleAppError } from '../../shared/errors.js';
import { listMunicipalitiesByUf, listStates } from './localities.service.js';

/** Public IBGE locality lookup routes */
export async function registerLocalitiesRoutes(fastify: FastifyInstance) {
  fastify.get('/localities/states', async (_request, reply) => {
    try {
      const states = await listStates();
      return reply.send({ data: states });
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.get('/localities/states/:uf/municipalities', async (request, reply) => {
    try {
      const { uf } = request.params as { uf: string };
      const municipalities = await listMunicipalitiesByUf(uf);
      return reply.send({ data: municipalities });
    } catch (error) {
      return handleAppError(reply, error);
    }
  });
}
