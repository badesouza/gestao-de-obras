import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  PERMISSION_CENTROS_CUSTO_MANAGE,
  PERMISSION_CENTROS_CUSTO_PROPRIEDADES_MANAGE,
  PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT,
  PERMISSION_CENTROS_CUSTO_VIEW,
} from '../../../shared/constants.js';
import { handleAppError } from '../../../shared/errors.js';
import {
  requireTenantAuth,
  requireTenantPermission,
} from '../../../plugins/auth-tenant.js';
import {
  createCentroCustoSchema,
  propriedadesConfigSchema,
  setLicitacoesSchema,
  updateCentroCustoSchema,
  updateCentroCustoStatusSchema,
} from './centro-custo.schema.js';
import {
  createCentroCusto,
  deactivateCentroCusto,
  getCentroCustoById,
  listCentrosCusto,
  setCentroCustoLicitacoes,
  setPropriedadesConfig,
  updateCentroCusto,
} from './centro-custo.service.js';
import { searchItensForCentro } from './item-search.service.js';
import { getProducaoDiaria } from './production.service.js';
import {
  createPropriedadeSchema,
  updatePropriedadeSchema,
} from './propriedade.schema.js';
import {
  createPropriedade,
  listPropriedades,
  updatePropriedade,
} from './propriedade.service.js';
import {
  monthQuerySchema,
  upsertRegistroDiarioSchema,
} from './registro-diario.schema.js';
import {
  createRegistroDiario,
  deleteRegistroDiario,
  listRegistrosDiarios,
  updateRegistroDiario,
} from './registro-diario.service.js';

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const itemSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Registers centros de custo, propriedades and registro diario routes */
export async function registerCentroCustoRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const canView = [
    tenantAuth,
    requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_VIEW),
  ];
  const canManage = [
    tenantAuth,
    requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_MANAGE),
  ];
  const canManagePropriedades = [
    tenantAuth,
    requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_PROPRIEDADES_MANAGE),
  ];
  const canEditRegistros = [
    tenantAuth,
    requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT),
  ];

  fastify.get(
    '/centros-custo',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const query = listQuerySchema.parse(request.query);
        const result = await listCentrosCusto(
          fastify.prisma,
          request.user.entityId!,
          query,
        );
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.post(
    '/centros-custo',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const body = createCentroCustoSchema.parse(request.body);
        const centro = await createCentroCusto(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          body,
        );
        return reply.code(201).send(centro);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/centros-custo/propriedades',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const result = await listPropriedades(fastify.prisma, request.user.entityId!);
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.post(
    '/centros-custo/propriedades',
    { preHandler: canManagePropriedades },
    async (request, reply) => {
      try {
        const body = createPropriedadeSchema.parse(request.body);
        const propriedade = await createPropriedade(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          body,
        );
        return reply.code(201).send(propriedade);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/centros-custo/propriedades/:id',
    { preHandler: canManagePropriedades },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updatePropriedadeSchema.parse(request.body);
        const propriedade = await updatePropriedade(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body,
        );
        return reply.send(propriedade);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/centros-custo/:id',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const centro = await getCentroCustoById(
          fastify.prisma,
          request.user.entityId!,
          id,
        );
        return reply.send(centro);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/centros-custo/:id',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateCentroCustoSchema.parse(request.body);
        const centro = await updateCentroCusto(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body,
        );
        return reply.send(centro);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/centros-custo/:id/status',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        updateCentroCustoStatusSchema.parse(request.body);
        const centro = await deactivateCentroCusto(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
        );
        return reply.send(centro);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.put(
    '/centros-custo/:id/licitacoes',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = setLicitacoesSchema.parse(request.body);
        const centro = await setCentroCustoLicitacoes(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body.licitacaoIds,
        );
        return reply.send(centro);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.put(
    '/centros-custo/:id/propriedades-config',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = propriedadesConfigSchema.parse(request.body);
        const centro = await setPropriedadesConfig(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body,
        );
        return reply.send(centro);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/centros-custo/:id/registros',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const query = monthQuerySchema.parse(request.query);
        const result = await listRegistrosDiarios(
          fastify.prisma,
          request.user.entityId!,
          id,
          query.year,
          query.month,
        );
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.post(
    '/centros-custo/:id/registros',
    { preHandler: canEditRegistros },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = upsertRegistroDiarioSchema.parse(request.body);
        const row = await createRegistroDiario(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body,
        );
        return reply.code(201).send(row);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/centros-custo/:id/registros/:registroId',
    { preHandler: canEditRegistros },
    async (request, reply) => {
      try {
        const { id, registroId } = request.params as {
          id: string;
          registroId: string;
        };
        const body = upsertRegistroDiarioSchema.parse(request.body);
        const row = await updateRegistroDiario(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          registroId,
          body,
        );
        return reply.send(row);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.delete(
    '/centros-custo/:id/registros/:registroId',
    { preHandler: canEditRegistros },
    async (request, reply) => {
      try {
        const { id, registroId } = request.params as {
          id: string;
          registroId: string;
        };
        await deleteRegistroDiario(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          registroId,
        );
        return reply.code(204).send();
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/centros-custo/:id/producao',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const query = monthQuerySchema.parse(request.query);
        const result = await getProducaoDiaria(
          fastify.prisma,
          request.user.entityId!,
          id,
          query.year,
          query.month,
        );
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/centros-custo/:id/itens-busca',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const query = itemSearchQuerySchema.parse(request.query);
        const result = await searchItensForCentro(
          fastify.prisma,
          request.user.entityId!,
          id,
          { q: query.q, limit: query.limit },
        );
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );
}
