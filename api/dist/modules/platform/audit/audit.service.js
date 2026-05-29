/** Writes an append-only platform audit log entry */
export async function writePlatformAudit(prisma, input) {
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
//# sourceMappingURL=audit.service.js.map