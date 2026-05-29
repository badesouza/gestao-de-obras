import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PrismaClient } from '../../generated/prisma/index.js';
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
export declare function resolveTenantEntityId(request: FastifyRequest): string | null;
/** Verifies JWT and ensures tenant scope with entity match */
export declare function requireTenantAuth(prisma: PrismaClient): (request: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
/** Loads user permissions and checks required permission */
export declare function requireTenantPermission(prisma: PrismaClient, permissionCode: string): (request: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
//# sourceMappingURL=auth-tenant.d.ts.map