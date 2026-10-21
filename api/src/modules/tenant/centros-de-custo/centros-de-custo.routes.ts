import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, handleAppError } from '../../../shared/errors.js';
import { PERMISSION_CENTROS_CUSTO_MANAGE, PERMISSION_CENTROS_CUSTO_VIEW } from '../../../shared/constants.js';
import { requireTenantAuth, requireTenantPermission } from '../../../plugins/auth-tenant.js';
import { atualizarCentro, criarCentro, definirServicosPadrao, listarCentros, removerCentro } from './centros-de-custo.service.js';

function validar<T>(schema: z.ZodType<T>, dados: unknown): T {
  const r = schema.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    throw new AppError(400, 'VALIDATION_ERROR', p?.message ?? 'Dados inválidos', { campo: p?.path.join('.') });
  }
  return r.data;
}

const centroSchema = z.object({
  codigo: z.string().trim().min(1, 'Informe o código').max(20).regex(/^[0-9A-Za-z.\-/]+$/, 'Código: use números, letras, ponto ou traço'),
  nome: z.string().trim().min(2, 'Informe o nome').max(200),
  tipo: z.enum(['SECRETARIA', 'SETOR', 'PROGRAMA', 'OBRA', 'OUTRO']),
  descricao: z.string().trim().max(1000).optional().nullable(),
  responsavel: z.string().trim().max(160).optional().nullable(),
  ativo: z.boolean().optional(),
  paiId: z.string().uuid().optional().nullable(),
});

export async function registerCentrosDeCustoRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const podeVer = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_VIEW)];
  const podeGerir = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_MANAGE)];

  fastify.get('/centros-de-custo', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await listarCentros(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });
  fastify.post('/centros-de-custo', { preHandler: podeGerir }, async (req, reply) => {
    try { return reply.code(201).send(await criarCentro(fastify.prisma, req.user.entityId!, req.user.sub, validar(centroSchema, req.body))); }
    catch (e) { return handleAppError(reply, e); }
  });
  fastify.put('/centros-de-custo/:id', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await atualizarCentro(fastify.prisma, req.user.entityId!, req.user.sub, id, validar(centroSchema, req.body)));
    } catch (e) { return handleAppError(reply, e); }
  });
  fastify.delete('/centros-de-custo/:id', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await removerCentro(fastify.prisma, req.user.entityId!, req.user.sub, id));
    } catch (e) { return handleAppError(reply, e); }
  });
  fastify.put('/centros-de-custo/:id/servicos', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { servicoIds } = validar(z.object({ servicoIds: z.array(z.string().uuid()).max(200) }), req.body);
      await definirServicosPadrao(fastify.prisma, req.user.entityId!, req.user.sub, id, servicoIds);
      return reply.code(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });
}
