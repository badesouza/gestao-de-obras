import type { FastifyInstance } from 'fastify';
import {
  PERMISSION_CENTROS_CUSTO_MANAGE,
  PERMISSION_CENTROS_CUSTO_VIEW,
} from '../../../shared/constants.js';
import { handleAppError } from '../../../shared/errors.js';
import {
  requireTenantAuth,
  requireTenantPermission,
} from '../../../plugins/auth-tenant.js';
import {
  createPedidoFromSolicitacoesSchema,
  createSolicitacaoSchema,
  pedidosQuerySchema,
  recebimentoSchema,
  solicitacoesQuerySchema,
} from './compras.schema.js';
import {
  cancelPedido,
  changeSolicitacaoStatus,
  createPedidoFromSolicitacoes,
  createRecebimento,
  createSolicitacao,
  deletePedido,
  deleteSolicitacao,
  getPedidoById,
  getSolicitacaoById,
  listPedidos,
  listSolicitacoes,
  sendPedido,
} from './compras.service.js';

export async function registerComprasRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const canView = [
    tenantAuth,
    requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_VIEW),
  ];
  const canManage = [
    tenantAuth,
    requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_MANAGE),
  ];

  fastify.get('/compras/solicitacoes', { preHandler: canView }, async (request, reply) => {
    try {
      const query = solicitacoesQuerySchema.parse(request.query);
      const result = await listSolicitacoes(fastify.prisma, request.user.entityId!, query);
      return reply.send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.post('/compras/solicitacoes', { preHandler: canManage }, async (request, reply) => {
    try {
      const body = createSolicitacaoSchema.parse(request.body);
      const result = await createSolicitacao(
        fastify.prisma,
        request.user.sub,
        request.user.entityId!,
        body,
      );
      return reply.code(201).send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.get('/compras/solicitacoes/:id', { preHandler: canView }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await getSolicitacaoById(fastify.prisma, request.user.entityId!, id);
      return reply.send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.delete('/compras/solicitacoes/:id', { preHandler: canManage }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await deleteSolicitacao(fastify.prisma, request.user.sub, request.user.entityId!, id);
      return reply.code(204).send();
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  for (const action of ['submit', 'approve', 'reject', 'cancel'] as const) {
    fastify.post(`/compras/solicitacoes/:id/${action}`, { preHandler: canManage }, async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await changeSolicitacaoStatus(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          action,
        );
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    });
  }

  fastify.get('/compras/pedidos', { preHandler: canView }, async (request, reply) => {
    try {
      const query = pedidosQuerySchema.parse(request.query);
      const result = await listPedidos(fastify.prisma, request.user.entityId!, query);
      return reply.send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.post('/compras/pedidos/from-solicitacoes', { preHandler: canManage }, async (request, reply) => {
    try {
      const body = createPedidoFromSolicitacoesSchema.parse(request.body);
      const result = await createPedidoFromSolicitacoes(
        fastify.prisma,
        request.user.sub,
        request.user.entityId!,
        body,
      );
      return reply.code(201).send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.get('/compras/pedidos/:id', { preHandler: canView }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await getPedidoById(fastify.prisma, request.user.entityId!, id);
      return reply.send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.post('/compras/pedidos/:id/send', { preHandler: canManage }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await sendPedido(fastify.prisma, request.user.sub, request.user.entityId!, id);
      return reply.send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.post('/compras/pedidos/:id/cancel', { preHandler: canManage }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await cancelPedido(fastify.prisma, request.user.sub, request.user.entityId!, id);
      return reply.send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.delete('/compras/pedidos/:id', { preHandler: canManage }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await deletePedido(fastify.prisma, request.user.sub, request.user.entityId!, id);
      return reply.code(204).send();
    } catch (error) {
      return handleAppError(reply, error);
    }
  });

  fastify.post('/compras/pedidos/:id/recebimentos', { preHandler: canManage }, async (request, reply) => {
    try {
      const body = recebimentoSchema.parse(request.body);
      const result = await createRecebimento(
        fastify.prisma,
        request.user.sub,
        request.user.entityId!,
        body,
      );
      return reply.code(201).send(result);
    } catch (error) {
      return handleAppError(reply, error);
    }
  });
}
