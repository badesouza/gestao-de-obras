import type { FastifyInstance } from 'fastify';
import { handleAppError } from '../../../shared/errors.js';
import { requirePlatformAuth } from '../../../plugins/auth-platform.js';
import { bootstrapTenantAdmin } from '../../tenant/auth/auth.service.js';
import { entityHasAdmin } from '../../tenant/users/user.service.js';
import { bootstrapAdminSchema } from '../../tenant/users/user.schema.js';
import {
  createEntitySchema,
  listEntitiesQuerySchema,
  updateEntitySchema,
  updateEntityStatusSchema,
} from './entity.schema.js';
import {
  createEntity,
  getEntityById,
  listEntities,
  listEntityAuditLogs,
  updateEntity,
  updateEntityStatus,
} from './entity.service.js';

/** Registers platform entity CRUD routes */
export async function registerPlatformEntityRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/entities',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const query = listEntitiesQuerySchema.parse(request.query);
        const result = await listEntities(fastify.prisma, query);
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.post(
    '/entities',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const body = createEntitySchema.parse(request.body);
        const entity = await createEntity(
          fastify.prisma,
          request.user.sub,
          body,
        );
        return reply.code(201).send(entity);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/entities/:id',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const entity = await getEntityById(fastify.prisma, id);
        return reply.send(entity);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/entities/:id',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateEntitySchema.parse(request.body);
        const entity = await updateEntity(
          fastify.prisma,
          request.user.sub,
          id,
          body,
        );
        return reply.send(entity);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/entities/:id/status',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateEntityStatusSchema.parse(request.body);
        const entity = await updateEntityStatus(
          fastify.prisma,
          request.user.sub,
          id,
          body.status,
        );
        return reply.send(entity);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/entities/:id/audit-logs',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const page = Number((request.query as { page?: string }).page ?? 1);
        const result = await listEntityAuditLogs(fastify.prisma, id, page);
        return reply.send(result);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/entities/:id/admin-status',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const hasAdmin = await entityHasAdmin(fastify.prisma, id);
        return reply.send({ hasAdmin });
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.post(
    '/entities/:id/bootstrap-admin',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = bootstrapAdminSchema.parse(request.body);
        const admin = await bootstrapTenantAdmin(fastify.prisma, id, body);
        return reply.code(201).send(admin);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );
}
