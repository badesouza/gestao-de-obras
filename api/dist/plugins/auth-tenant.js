import { JWT_SCOPE_TENANT } from '../shared/constants.js';
import { sendError } from '../shared/errors.js';
/** Resolves entity id from header for tenant requests */
export function resolveTenantEntityId(request) {
    const header = request.headers['x-tenant-id'];
    if (typeof header === 'string' && header.length > 0) {
        return header;
    }
    const params = request.params;
    return params.entityId ?? params.id ?? null;
}
/** Verifies JWT and ensures tenant scope with entity match */
export function requireTenantAuth(prisma) {
    return async (request, reply) => {
        try {
            await request.jwtVerify();
            if (request.user.scope !== JWT_SCOPE_TENANT) {
                return sendError(reply, 403, 'FORBIDDEN', 'Acesso negado');
            }
            const requestEntityId = resolveTenantEntityId(request);
            if (requestEntityId && requestEntityId !== request.user.entityId) {
                await prisma.tenantAuditLog.create({
                    data: {
                        entityId: request.user.entityId,
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
        }
        catch {
            return sendError(reply, 401, 'UNAUTHORIZED', 'Não autenticado');
        }
    };
}
/** Loads user permissions and checks required permission */
export function requireTenantPermission(prisma, permissionCode) {
    return async (request, reply) => {
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
        const permissions = user.role.permissions.map((rp) => rp.permission.code);
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
//# sourceMappingURL=auth-tenant.js.map