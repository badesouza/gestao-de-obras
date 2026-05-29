/** Writes an append-only tenant audit log entry */
export async function writeTenantAudit(prisma, input) {
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
export async function getTenantUserPermissions(prisma, userId) {
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
    if (!user)
        return [];
    return user.role.permissions.map((rp) => rp.permission.code);
}
//# sourceMappingURL=audit.service.js.map