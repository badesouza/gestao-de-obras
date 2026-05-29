import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { hashPassword } from '../../platform/auth/auth.service.js';
import type { TenantLoginRequest } from './auth.schema.js';
/** Authenticates a tenant user within entity context */
export declare function loginTenantUser(prisma: PrismaClient, input: TenantLoginRequest, metadata?: Record<string, unknown>): Promise<{
    userId: string;
    email: string;
    name: string;
    entityId: string;
    entityName: string;
    roleCode: string;
    roleName: string;
    permissions: string[];
}>;
/** Returns authenticated tenant user profile */
export declare function getTenantUserProfile(prisma: PrismaClient, userId: string, entityId: string): Promise<{
    id: string;
    name: string;
    email: string;
    status: "ACTIVE";
    entity: {
        id: string;
        name: string;
        status: import("../../../../generated/prisma/index.js").$Enums.EntityStatus;
    };
    role: {
        code: string;
        name: string;
    };
    permissions: string[];
}>;
/** Records tenant logout in audit trail */
export declare function logoutTenantUser(prisma: PrismaClient, userId: string, entityId: string, metadata?: Record<string, unknown>): Promise<void>;
/** Builds JWT payload for tenant scope */
export declare function buildTenantTokenPayload(userId: string, email: string, entityId: string, roleCode: string): {
    sub: string;
    email: string;
    entityId: string;
    roleCode: string;
    scope: string;
};
/** Creates the first tenant administrator for an entity */
export declare function bootstrapTenantAdmin(prisma: PrismaClient, entityId: string, input: {
    name: string;
    email: string;
    password: string;
}): Promise<{
    id: string;
    name: string;
    email: string;
    role: string;
}>;
export { hashPassword };
//# sourceMappingURL=auth.service.d.ts.map