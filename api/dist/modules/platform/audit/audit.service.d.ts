import type { PrismaClient, Prisma } from '../../../../generated/prisma/index.js';
export interface AuditInput {
    operatorId: string;
    entityId?: string | null;
    action: string;
    resource: string;
    previousValue?: Prisma.InputJsonValue | null;
    newValue?: Prisma.InputJsonValue | null;
    metadata?: Prisma.InputJsonValue | null;
}
/** Writes an append-only platform audit log entry */
export declare function writePlatformAudit(prisma: PrismaClient, input: AuditInput): Promise<{
    id: string;
    action: string;
    resource: string;
    previousValue: Prisma.JsonValue | null;
    newValue: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    entityId: string | null;
    operatorId: string;
}>;
//# sourceMappingURL=audit.service.d.ts.map