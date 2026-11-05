import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import { requireTela, requireTenantAuth } from '../../../plugins/auth-tenant.js';
import { PERMISSION_CENTROS_CUSTO_MANAGE, PERMISSION_CENTROS_CUSTO_VIEW } from '../../../shared/constants.js';
import { registrarEnderecoDescoberto } from './endereco-descoberto.service.js';

const createSchema = z.object({
  bairro:     z.string().min(1).max(150),
  logradouro: z.string().min(1).max(300),
  lat:        z.number(),
  lng:        z.number(),
});

const listQuerySchema = z.object({
  bairro: z.string().optional(),
});

export async function registerEnderecoDescobertoRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  /* Cinturão (linha 5): a regra do menu da tela que usa cada rota, conferida no servidor.
     Modo observação: quem seria barrado só vai para o log até OBRAS_BLOQUEAR_TELAS=true. */
  const podeVer = [tenantAuth, requireTela(fastify.prisma, 'Endereços descobertos (ver)', PERMISSION_CENTROS_CUSTO_VIEW)];
  const podeGerir = [tenantAuth, requireTela(fastify.prisma, 'Endereços descobertos (gravar)', PERMISSION_CENTROS_CUSTO_MANAGE)];

  /* GET /enderecos-descobertos?bairro= */
  fastify.get('/enderecos-descobertos', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { bairro } = listQuerySchema.parse(req.query);
      const entityId = req.user.entityId!;

      const items = await fastify.prisma.enderecoDescoberto.findMany({
        where: {
          entityId,
          ...(bairro ? { bairro: { contains: bairro, mode: 'insensitive' } } : {}),
        },
        orderBy: [{ bairro: 'asc' }, { logradouro: 'asc' }],
      });

      return reply.send({ items, total: items.length });
    } catch (e) { return handleAppError(reply, e); }
  });

  /* POST /enderecos-descobertos — cadastro manual */
  fastify.post('/enderecos-descobertos', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const body = createSchema.parse(req.body);
      const entityId = req.user.entityId!;

      await registrarEnderecoDescoberto(fastify.prisma, { entityId, ...body });

      const item = await fastify.prisma.enderecoDescoberto.findUnique({
        where: {
          entityId_bairro_logradouro: {
            entityId,
            bairro: body.bairro.trim(),
            logradouro: body.logradouro.trim(),
          },
        },
      });

      return reply.status(201).send(item);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* DELETE /enderecos-descobertos/:id */
  fastify.delete('/enderecos-descobertos/:id', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const entityId = req.user.entityId!;

      const item = await fastify.prisma.enderecoDescoberto.findFirst({ where: { id, entityId } });
      if (!item) return reply.status(404).send({ error: 'Não encontrado' });

      await fastify.prisma.enderecoDescoberto.delete({ where: { id } });
      return reply.status(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });
}
