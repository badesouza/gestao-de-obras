import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  IMPORT_MAX_FILE_BYTES,
  PERMISSION_LICITACOES_ITEMS_DEACTIVATE,
  PERMISSION_LICITACOES_ITEMS_IMPORT,
  PERMISSION_LICITACOES_MANAGE,
  PERMISSION_LICITACOES_VIEW,
} from '../../../shared/constants.js';
import { AppError, handleAppError } from '../../../shared/errors.js';
import {
  requireTenantAuth,
  requireTenantPermission,
} from '../../../plugins/auth-tenant.js';
import { generateCsvTemplate, generateXlsxTemplate } from './import/template.generator.js';
import {
  deactivateLicitacaoItem,
  importItemsFromColumns,
  importItemsFromSpreadsheet,
  listLicitacaoItems,
} from './item.service.js';
import { importColumnsRequestSchema } from './item.schema.js';
import {
  createLicitacaoSchema,
  updateItemStatusSchema,
  updateLicitacaoStatusSchema,
} from './licitacao.schema.js';
import {
  createLicitacao,
  deactivateLicitacao,
  getLicitacaoById,
  listLicitacoes,
} from './licitacao.service.js';

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const itemsQuerySchema = z.object({
  search: z.string().optional(),
  categoria: z.string().optional(),
  includeInactive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const templateQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']),
});

/** Registers licitacao and item routes */
export async function registerLicitacaoRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const canView = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_LICITACOES_VIEW)];
  const canManage = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_LICITACOES_MANAGE)];
  const canImport = [
    tenantAuth,
    requireTenantPermission(fastify.prisma, PERMISSION_LICITACOES_ITEMS_IMPORT),
  ];
  const canDeactivateItem = [
    tenantAuth,
    requireTenantPermission(fastify.prisma, PERMISSION_LICITACOES_ITEMS_DEACTIVATE),
  ];

  fastify.get(
    '/licitacoes/import-template',
    { preHandler: canImport },
    async (request, reply) => {
      try {
        const { format } = templateQuerySchema.parse(request.query);
        if (format === 'csv') {
          const buffer = generateCsvTemplate();
          return reply
            .header('Content-Type', 'text/csv; charset=utf-8')
            .header('Content-Disposition', 'attachment; filename="modelo-itens-licitacao.csv"')
            .send(buffer);
        }
        const buffer = generateXlsxTemplate();
        return reply
          .header(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
          .header('Content-Disposition', 'attachment; filename="modelo-itens-licitacao.xlsx"')
          .send(buffer);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/licitacoes',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const query = listQuerySchema.parse(request.query);
        const result = await listLicitacoes(fastify.prisma, request.user.entityId!, query);
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.post(
    '/licitacoes',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const body = createLicitacaoSchema.parse(request.body);
        const licitacao = await createLicitacao(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          body,
        );
        return reply.code(201).send(licitacao);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/licitacoes/:id',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const licitacao = await getLicitacaoById(
          fastify.prisma,
          request.user.entityId!,
          id,
        );
        return reply.send(licitacao);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/licitacoes/:id/status',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        updateLicitacaoStatusSchema.parse(request.body);
        const licitacao = await deactivateLicitacao(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
        );
        return reply.send(licitacao);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/licitacoes/:id/items',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const query = itemsQuerySchema.parse(request.query);
        const result = await listLicitacaoItems(
          fastify.prisma,
          request.user.entityId!,
          id,
          query,
        );
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.post(
    '/licitacoes/:id/items/import/spreadsheet',
    { preHandler: canImport },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const file = await request.file();
        if (!file) {
          throw new AppError(422, 'IMPORT_EMPTY', 'Nenhum arquivo enviado');
        }

        const buffer = await file.toBuffer();
        if (buffer.byteLength > IMPORT_MAX_FILE_BYTES) {
          throw new AppError(413, 'IMPORT_TOO_LARGE', 'Arquivo excede 5 MB');
        }

        const filename = file.filename ?? 'upload.csv';
        const lower = filename.toLowerCase();
        if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
          throw new AppError(
            422,
            'IMPORT_VALIDATION_ERROR',
            'Formato não suportado. Use .csv ou .xlsx',
          );
        }

        const result = await importItemsFromSpreadsheet(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          buffer,
          filename,
        );
        return reply.code(201).send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.post(
    '/licitacoes/:id/items/import/columns',
    { preHandler: canImport },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = importColumnsRequestSchema.parse(request.body);
        const result = await importItemsFromColumns(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body.columns,
        );
        return reply.code(201).send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/licitacoes/:licitacaoId/items/:itemId/status',
    { preHandler: canDeactivateItem },
    async (request, reply) => {
      try {
        const { licitacaoId, itemId } = request.params as {
          licitacaoId: string;
          itemId: string;
        };
        updateItemStatusSchema.parse(request.body);
        const item = await deactivateLicitacaoItem(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          licitacaoId,
          itemId,
        );
        return reply.send(item);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );
}
