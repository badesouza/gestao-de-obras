import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';
/** Ensures entity exists and is active before licitacao mutations */
export async function assertEntityActive(prisma, entityId) {
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
        throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
    }
    if (entity.status !== 'ACTIVE') {
        throw new AppError(403, 'ENTITY_INACTIVE', 'Entidade inativa — operação não permitida');
    }
    return entity;
}
/** Maps licitacao record to API DTO */
function toLicitacaoDto(licitacao, activeItemCount) {
    return {
        id: licitacao.id,
        identificacao: licitacao.identificacao,
        objeto: licitacao.objeto,
        status: licitacao.status,
        createdAt: licitacao.createdAt.toISOString(),
        createdBy: { id: licitacao.createdBy.id, name: licitacao.createdBy.name },
        activeItemCount,
    };
}
/** Loads licitacao scoped to entity or throws */
export async function getLicitacaoForEntity(prisma, entityId, licitacaoId) {
    const licitacao = await prisma.licitacao.findFirst({
        where: { id: licitacaoId, entityId },
        include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!licitacao) {
        throw new AppError(404, 'LICITACAO_NOT_FOUND', 'Licitação não encontrada');
    }
    return licitacao;
}
/** Creates a licitacao for the current entity */
export async function createLicitacao(prisma, actorId, entityId, input) {
    await assertEntityActive(prisma, entityId);
    const duplicate = await prisma.licitacao.findUnique({
        where: {
            entityId_identificacao: {
                entityId,
                identificacao: input.identificacao,
            },
        },
    });
    if (duplicate) {
        throw new AppError(409, 'IDENTIFICACAO_DUPLICATE', 'Já existe licitação com esta identificação nesta entidade');
    }
    const licitacao = await prisma.licitacao.create({
        data: {
            entityId,
            identificacao: input.identificacao,
            objeto: input.objeto,
            createdByUserId: actorId,
        },
        include: { createdBy: { select: { id: true, name: true } } },
    });
    await writeTenantAudit(prisma, {
        entityId,
        userId: actorId,
        action: 'LICITACAO_CREATED',
        resource: 'licitacao',
        newValue: {
            id: licitacao.id,
            identificacao: licitacao.identificacao,
            objeto: licitacao.objeto,
        },
    });
    return toLicitacaoDto(licitacao, 0);
}
/** Lists licitacoes for the current entity */
export async function listLicitacoes(prisma, entityId, query) {
    const where = {
        entityId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
            ? {
                OR: [
                    { identificacao: { contains: query.search, mode: 'insensitive' } },
                    { objeto: { contains: query.search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const [total, rows] = await Promise.all([
        prisma.licitacao.count({ where }),
        prisma.licitacao.findMany({
            where,
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
        }),
    ]);
    const ids = rows.map((row) => row.id);
    const counts = ids.length === 0
        ? []
        : await prisma.licitacaoItem.groupBy({
            by: ['licitacaoId'],
            where: { licitacaoId: { in: ids }, status: 'ACTIVE' },
            _count: { _all: true },
        });
    const countMap = new Map(counts.map((c) => [c.licitacaoId, c._count._all]));
    return {
        items: rows.map((row) => toLicitacaoDto(row, countMap.get(row.id) ?? 0)),
        total,
        page: query.page,
        pageSize: query.pageSize,
    };
}
/** Gets licitacao detail scoped to entity */
export async function getLicitacaoById(prisma, entityId, licitacaoId) {
    const licitacao = await getLicitacaoForEntity(prisma, entityId, licitacaoId);
    const activeItemCount = await prisma.licitacaoItem.count({
        where: { licitacaoId, status: 'ACTIVE' },
    });
    return toLicitacaoDto(licitacao, activeItemCount);
}
/** Deactivates a licitacao (idempotent) */
export async function deactivateLicitacao(prisma, actorId, entityId, licitacaoId) {
    await assertEntityActive(prisma, entityId);
    const licitacao = await getLicitacaoForEntity(prisma, entityId, licitacaoId);
    if (licitacao.status === 'INACTIVE') {
        return toLicitacaoDto(licitacao, await prisma.licitacaoItem.count({ where: { licitacaoId, status: 'ACTIVE' } }));
    }
    const updated = await prisma.licitacao.update({
        where: { id: licitacaoId },
        data: { status: 'INACTIVE' },
        include: { createdBy: { select: { id: true, name: true } } },
    });
    await writeTenantAudit(prisma, {
        entityId,
        userId: actorId,
        action: 'LICITACAO_DEACTIVATED',
        resource: 'licitacao',
        previousValue: { status: 'ACTIVE' },
        newValue: { status: 'INACTIVE', id: licitacaoId },
    });
    const activeItemCount = await prisma.licitacaoItem.count({
        where: { licitacaoId, status: 'ACTIVE' },
    });
    return toLicitacaoDto(updated, activeItemCount);
}
//# sourceMappingURL=licitacao.service.js.map