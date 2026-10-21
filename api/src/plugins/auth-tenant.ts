import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
import { JWT_SCOPE_TENANT } from '../shared/constants.js';
import { sendError } from '../shared/errors.js';
import { pode, permissoesDasCaixas } from '../shared/acessos.js';

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

/** Quem está agindo: caixas marcadas (tela Acessos) e se é administrador geral */
export async function carregarAtor(prisma: PrismaClient, userId: string) {
  const user = await prisma.tenantUser.findUnique({
    where: { id: userId },
    select: { id: true, entityId: true, status: true, adminGeral: true, acessos: true, role: { select: { code: true } } },
  });
  if (!user || user.status !== 'ACTIVE') return null;
  return { id: user.id, entityId: user.entityId, roleCode: user.role.code, admin: user.adminGeral, acessos: user.acessos };
}

async function negarAcesso(prisma: PrismaClient, request: FastifyRequest, reply: FastifyReply, entityId: string, userId: string, exigido: string) {
  await prisma.tenantAuditLog.create({
    data: {
      entityId, userId, action: 'ACCESS_DENIED', resource: 'auth',
      metadata: { permission: exigido, route: request.url },
    },
  });
  return sendError(reply, 403, 'FORBIDDEN', 'Permissão insuficiente');
}

/** Checks a legacy permission code — now derived from the user's checked boxes */
export function requireTenantPermission(
  prisma: PrismaClient,
  permissionCode: string,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ator = await carregarAtor(prisma, request.user.sub);
    if (!ator) return sendError(reply, 401, 'UNAUTHORIZED', 'Usuário inválido');
    if (!permissoesDasCaixas(ator.acessos, ator.admin).includes(permissionCode)) {
      return negarAcesso(prisma, request, reply, ator.entityId, ator.id, permissionCode);
    }
  };
}

/** Exige pelo menos uma das caixas (ex.: 'compras.orcar') */
export function requireAcesso(prisma: PrismaClient, ...chaves: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ator = await carregarAtor(prisma, request.user.sub);
    if (!ator) return sendError(reply, 401, 'UNAUTHORIZED', 'Usuário inválido');
    if (!chaves.some(c => pode(ator, c))) {
      return negarAcesso(prisma, request, reply, ator.entityId, ator.id, chaves.join('|'));
    }
  };
}
