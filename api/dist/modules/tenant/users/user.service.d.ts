import type { PrismaClient, TenantUserStatus } from '../../../../generated/prisma/index.js';
import type { CreateTenantUserRequest, UpdateTenantUserRequest } from './user.schema.js';
export interface TenantUserDto {
    id: string;
    name: string;
    email: string;
    status: TenantUserStatus;
    isLiderEquipe: boolean;
    role: {
        code: string;
        name: string;
    };
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
}
/** Lists users for the current entity */
export declare function listTenantUsers(prisma: PrismaClient, entityId: string, query: {
    search?: string;
    status?: TenantUserStatus;
    page: number;
    pageSize: number;
}): Promise<{
    data: TenantUserDto[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}>;
/** Gets a tenant user scoped to entity */
export declare function getTenantUserById(prisma: PrismaClient, entityId: string, userId: string): Promise<TenantUserDto>;
/** Creates a tenant user in the current entity */
export declare function createTenantUser(prisma: PrismaClient, actorId: string, entityId: string, input: CreateTenantUserRequest): Promise<TenantUserDto>;
/** Updates tenant user profile/role */
export declare function updateTenantUser(prisma: PrismaClient, actorId: string, entityId: string, userId: string, input: UpdateTenantUserRequest): Promise<TenantUserDto>;
/** Activates or deactivates a tenant user */
export declare function updateTenantUserStatus(prisma: PrismaClient, actorId: string, entityId: string, userId: string, status: TenantUserStatus): Promise<TenantUserDto>;
/** Resets password for a tenant user */
export declare function resetTenantUserPassword(prisma: PrismaClient, actorId: string, entityId: string, userId: string, password: string): Promise<TenantUserDto>;
/** Checks if entity has an active administrator */
export declare function entityHasAdmin(prisma: PrismaClient, entityId: string): Promise<boolean>;
//# sourceMappingURL=user.service.d.ts.map