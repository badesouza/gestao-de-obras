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
export async function writePlatformAudit(
  prisma: PrismaClient,
  input: AuditInput,
) {
  return prisma.platformAuditLog.create({
    data: {
      operatorId: input.operatorId,
      entityId: input.entityId ?? null,
      action: input.action,
      resource: input.resource,
      previousValue: input.previousValue ?? undefined,
      newValue: input.newValue ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}
