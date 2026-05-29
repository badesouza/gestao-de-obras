import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { JWT_SCOPE_TENANT } from '../shared/constants.js';
import { sendError } from '../shared/errors.js';

export interface JwtPayload {
  sub: string;
  email: string;
  scope: string;
  entityId?: string;
  roleCode?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

/** Resolves entity id from header for tenant requests */
export function resolveTenantEntityId(request: FastifyRequest): string | null {
  const header = request.headers['x-tenant-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  const params = request.params as { entityId?: string; id?: string };
  return params.entityId ?? params.id ?? null;
}

/** Verifies JWT and ensures tenant scope with entity match */
export function requireTenantAuth(prisma: PrismaClient) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if (request.user.scope !== JWT_SCOPE_TENANT) {
        return sendError(reply, 403, 'FORBIDDEN', 'Acesso negado');
      }

      const requestEntityId = resolveTenantEntityId(request);
      if (requestEntityId && requestEntityId !== request.user.entityId) {
        await prisma.tenantAuditLog.create({
          data: {
            entityId: request.user.entityId!,
            userId: request.user.sub,
            action: 'ACCESS_DENIED_CROSS_TENANT',
            resource: 'auth',
            metadata: {
              attemptedEntityId: requestEntityId,
              route: request.url,
            },
          },
        });
        return sendError(reply, 403, 'FORBIDDEN', 'Acesso negado');
      }
    } catch {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Não autenticado');
    }
  };
}

/** Loads user permissions and checks required permission */
export function requireTenantPermission(
  prisma: PrismaClient,
  permissionCode: string,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.tenantUser.findUnique({
      where: { id: request.user.sub },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Usuário inválido');
    }

    const permissions = user.role.permissions.map(
      (rp: { permission: { code: string } }) => rp.permission.code,
    );
    if (!permissions.includes(permissionCode)) {
      await prisma.tenantAuditLog.create({
        data: {
          entityId: user.entityId,
          userId: user.id,
          action: 'ACCESS_DENIED',
          resource: 'auth',
          metadata: {
            permission: permissionCode,
            route: request.url,
          },
        },
      });
      return sendError(reply, 403, 'FORBIDDEN', 'Permissão insuficiente');
    }
  };
}
