import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import { requireTela, requireTenantAuth } from '../../../plugins/auth-tenant.js';
import { PERMISSION_CENTROS_CUSTO_MANAGE, PERMISSION_CENTROS_CUSTO_VIEW, PERMISSION_USERS_MANAGE } from '../../../shared/constants.js';
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
  /* Cinturão (linha 5): a regra do menu da tela que usa cada rota, conferida no servidor.
     Modo observação: quem seria barrado só vai para o log até OBRAS_BLOQUEAR_TELAS=true. */
  const podeVer = [tenantAuth, requireTela(fastify.prisma, 'Equipes do cadastro auxiliar (ver)', PERMISSION_CENTROS_CUSTO_VIEW)];
  /* líder e operadores: tela antiga Cadastros Auxiliares = passos de Cadastros ou Pessoas */
  const podeGerir = [tenantAuth, requireTela(fastify.prisma, 'Equipes do cadastro auxiliar (gravar)', PERMISSION_CENTROS_CUSTO_MANAGE, PERMISSION_USERS_MANAGE)];

  /* GET /equipes/lideres — lista usuários com flag isLiderEquipe */
  fastify.get('/equipes/lideres', { preHandler: podeVer }, async (req, reply) => {
    try {
      const lideres = await listLideres(fastify.prisma, req.user.entityId!);
      return reply.send({ items: lideres });
    } catch (e) { return handleAppError(reply, e); }
  });

  /* GET /equipes/:cadastroId — detalhe da equipe (líder + operadores) */
  fastify.get('/equipes/:cadastroId', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { cadastroId } = req.params as { cadastroId: string };
      const detail = await getEquipeDetail(fastify.prisma, req.user.entityId!, cadastroId);
      return reply.send(detail);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* PATCH /equipes/:cadastroId/lider */
  fastify.patch('/equipes/:cadastroId/lider', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { cadastroId } = req.params as { cadastroId: string };
      const { liderUserId } = z.object({ liderUserId: z.string().uuid().nullable() }).parse(req.body);
      const result = await setLider(fastify.prisma, req.user.entityId!, cadastroId, liderUserId);
      return reply.send(result);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* POST /equipes/:cadastroId/operadores */
  fastify.post('/equipes/:cadastroId/operadores', { preHandler: podeGerir }, async (req, reply) => {
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
  fastify.patch('/equipes/operadores/:operadorId', { preHandler: podeGerir }, async (req, reply) => {
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
  fastify.delete('/equipes/operadores/:operadorId', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { operadorId } = req.params as { operadorId: string };
      await deleteOperador(fastify.prisma, req.user.entityId!, operadorId);
      return reply.status(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });
}
