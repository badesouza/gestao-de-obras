import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import { requireTenantAuth } from '../../../plugins/auth-tenant.js';
import {
  getEquipeDetail,
  setLider,
  listLideres,
  addOperador,
  updateOperador,
  deleteOperador,
} from './equipe.service.js';

export async function registerEquipeRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);

  /* GET /equipes/lideres — lista usuários com flag isLiderEquipe */
  fastify.get('/equipes/lideres', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const lideres = await listLideres(fastify.prisma, req.user.entityId!);
      return reply.send({ items: lideres });
    } catch (e) { return handleAppError(reply, e); }
  });

  /* GET /equipes/:cadastroId — detalhe da equipe (líder + operadores) */
  fastify.get('/equipes/:cadastroId', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { cadastroId } = req.params as { cadastroId: string };
      const detail = await getEquipeDetail(fastify.prisma, req.user.entityId!, cadastroId);
      return reply.send(detail);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* PATCH /equipes/:cadastroId/lider */
  fastify.patch('/equipes/:cadastroId/lider', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { cadastroId } = req.params as { cadastroId: string };
      const { liderUserId } = z.object({ liderUserId: z.string().uuid().nullable() }).parse(req.body);
      const result = await setLider(fastify.prisma, req.user.entityId!, cadastroId, liderUserId);
      return reply.send(result);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* POST /equipes/:cadastroId/operadores */
  fastify.post('/equipes/:cadastroId/operadores', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { cadastroId } = req.params as { cadastroId: string };
      const body = z.object({
        nome: z.string().min(1).max(150),
        cargo: z.string().min(1).max(100),
      }).parse(req.body);
      const op = await addOperador(fastify.prisma, req.user.entityId!, cadastroId, body);
      return reply.status(201).send(op);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* PATCH /equipes/operadores/:operadorId */
  fastify.patch('/equipes/operadores/:operadorId', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { operadorId } = req.params as { operadorId: string };
      const body = z.object({
        nome: z.string().min(1).max(150).optional(),
        cargo: z.string().min(1).max(100).optional(),
        ativo: z.boolean().optional(),
      }).parse(req.body);
      const op = await updateOperador(fastify.prisma, req.user.entityId!, operadorId, body);
      return reply.send(op);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* DELETE /equipes/operadores/:operadorId */
  fastify.delete('/equipes/operadores/:operadorId', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { operadorId } = req.params as { operadorId: string };
      await deleteOperador(fastify.prisma, req.user.entityId!, operadorId);
      return reply.status(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });
}
