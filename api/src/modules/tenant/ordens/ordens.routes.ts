import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, handleAppError } from '../../../shared/errors.js';
import { PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT, PERMISSION_USERS_MANAGE, PERMISSION_USERS_VIEW } from '../../../shared/constants.js';
import { carregarAtor, requireAcesso, requireTenantAuth, requireTenantPermission } from '../../../plugins/auth-tenant.js';
import {
  PAPEIS_CONFIGURAVEIS, aplicarAcao, definirServicosDoUsuario, obterConfig, salvarConfig, servicosDoUsuario,
} from './ordens.service.js';

function validar<T>(schema: z.ZodType<T>, dados: unknown): T {
  const r = schema.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    throw new AppError(400, 'VALIDATION_ERROR', p?.message ?? 'Dados inválidos', { campo: p?.path.join('.') });
  }
  return r.data;
}

const papel = z.enum(PAPEIS_CONFIGURAVEIS);

export async function registerOrdensRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const podeEditar = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT)];
  const podeGerirUsuarios = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_USERS_MANAGE)];
  const podeVerUsuarios = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_USERS_VIEW)];

  /* avança ou volta a etapa da OS */
  fastify.post('/registros/:id/etapa', { preHandler: podeEditar }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { acao, observacao } = validar(z.object({
        acao: z.enum(['aprovar', 'executar', 'finalizar', 'reabrir', 'cancelar']),
        observacao: z.string().trim().max(1000).optional(),
      }), req.body);
      const ator = await carregarAtor(fastify.prisma, req.user.sub);
      if (!ator) throw new AppError(401, 'UNAUTHORIZED', 'Usuário inválido');
      return reply.send(await aplicarAcao(fastify.prisma, req.user.entityId!, ator, id, acao, observacao));
    } catch (e) { return handleAppError(reply, e); }
  });

  /* regras da secretaria */
  fastify.get('/configuracoes/obras', { preHandler: [tenantAuth] }, async (req, reply) => {
    try { return reply.send(await obterConfig(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });
  fastify.put('/configuracoes/obras', { preHandler: [tenantAuth, requireAcesso(fastify.prisma, 'cad.regras')] }, async (req, reply) => {
    try {
      const dados = validar(z.object({
        exigeAprovacaoOS: z.boolean(),
        aprovadores: z.array(papel).min(1, 'Escolha pelo menos um perfil que aprova'),
        exigeConferencia: z.boolean(),
        conferentes: z.array(papel).min(1, 'Escolha pelo menos um perfil que confere'),
        metaDias: z.number().int().min(1, 'Meta mínima de 1 dia').max(90),
        exigeAprovacaoCompra: z.boolean().default(true),
        revisoresCompra: z.array(papel).default(['ADMIN', 'COORDENADOR']),
        aprovadoresCompra: z.array(papel).default(['ADMIN']),
      }), req.body);
      return reply.send(await salvarConfig(fastify.prisma, req.user.entityId!, req.user.sub, dados));
    } catch (e) { return handleAppError(reply, e); }
  });

  /* serviços que cada usuário atende */
  fastify.get('/users/:id/servicos', { preHandler: podeVerUsuarios }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send({ centroIds: await servicosDoUsuario(fastify.prisma, id) });
    } catch (e) { return handleAppError(reply, e); }
  });
  fastify.put('/users/:id/servicos', { preHandler: podeGerirUsuarios }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { centroIds } = validar(z.object({ centroIds: z.array(z.string().uuid()).max(100) }), req.body);
      return reply.send({ centroIds: await definirServicosDoUsuario(fastify.prisma, req.user.entityId!, req.user.sub, id, centroIds) });
    } catch (e) { return handleAppError(reply, e); }
  });
}
