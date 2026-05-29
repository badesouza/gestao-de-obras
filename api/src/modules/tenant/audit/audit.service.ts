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
export async function writeTenantAudit(
  prisma: PrismaClient,
  input: TenantAuditInput,
) {
  return prisma.tenantAuditLog.create({
    data: {
      entityId: input.entityId,
      userId: input.userId ?? null,
      action: input.action,
      resource: input.resource,
      previousValue: input.previousValue ?? undefined,
      newValue: input.newValue ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}

/** Returns permission codes for a tenant user */
export async function getTenantUserPermissions(
  prisma: PrismaClient,
  userId: string,
): Promise<string[]> {
  const user = await prisma.tenantUser.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });
  if (!user) return [];
  return user.role.permissions.map((rp) => rp.permission.code);
}
