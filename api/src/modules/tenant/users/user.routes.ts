import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import {
  PERMISSION_USERS_MANAGE,
  PERMISSION_USERS_VIEW,
} from '../../../shared/constants.js';
import {
  requireTenantAuth,
  requireTenantPermission,
} from '../../../plugins/auth-tenant.js';
import {
  createTenantUserSchema,
  resetTenantUserPasswordSchema,
  updateTenantUserSchema,
  updateTenantUserStatusSchema,
} from './user.schema.js';
import {
  createTenantUser,
  getTenantUserById,
  listTenantUsers,
  resetTenantUserPassword,
  updateTenantUser,
  updateTenantUserStatus,
} from './user.service.js';

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Registers tenant user management routes */
export async function registerTenantUserRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const canView = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_USERS_VIEW)];
  const canManage = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_USERS_MANAGE)];

  fastify.get(
    '/users',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const query = listQuerySchema.parse(request.query);
        const result = await listTenantUsers(
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
    '/users',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const body = createTenantUserSchema.parse(request.body);
        const user = await createTenantUser(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          body,
        );
        return reply.code(201).send(user);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.get(
    '/users/:id',
    { preHandler: canView },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const user = await getTenantUserById(
          fastify.prisma,
          request.user.entityId!,
          id,
        );
        return reply.send(user);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/users/:id',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateTenantUserSchema.parse(request.body);
        const user = await updateTenantUser(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body,
        );
        return reply.send(user);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/users/:id/status',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateTenantUserStatusSchema.parse(request.body);
        const user = await updateTenantUserStatus(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body.status,
        );
        return reply.send(user);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );

  fastify.patch(
    '/users/:id/password',
    { preHandler: canManage },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = resetTenantUserPasswordSchema.parse(request.body);
        const user = await resetTenantUserPassword(
          fastify.prisma,
          request.user.sub,
          request.user.entityId!,
          id,
          body.password,
        );
        return reply.send(user);
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );
}
