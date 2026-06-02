import type { PrismaClient, Prisma } from '../../../../generated/prisma/index.js';
export interface TenantAuditInput {
    entityId: string;
    userId?: string | null;
    action: string;
    resource: string;
    previousValue?: Prisma.InputJsonValue | null;
    newValue?: Prisma.InputJsonValue | null;
    metadata?: Prisma.InputJsonValue | null;
}
/** Writes an append-only tenant audit log entry */
export declare function writeTenantAudit(prisma: PrismaClient | Prisma.TransactionClient, input: TenantAuditInput): Promise<{
    id: string;
    action: string;
    resource: string;
    previousValue: Prisma.JsonValue | null;
    newValue: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    entityId: string;
    userId: string | null;
}>;
/** Returns permission codes for a tenant user */
export declare function getTenantUserPermissions(prisma: PrismaClient, userId: string): Promise<string[]>;
//# sourceMappingURL=audit.service.d.ts.map