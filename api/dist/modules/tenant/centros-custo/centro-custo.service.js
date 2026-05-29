import { AppError } from '../../../shared/errors.js';
import { assertEntityActive } from '../licitacoes/licitacao.service.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { formatDateOnly, parseDateOnly, validateDateRanges, } from './cell-value.validator.js';
function optionalDateField(value) {
    if (!value)
        return null;
    return parseDateOnly(value);
}
/** Ensures centro exists, belongs to entity and is active for mutations */
export async function getCentroForEntity(prisma, entityId, centroId) {
    const centro = await prisma.centroCusto.findFirst({
        where: { id: centroId, entityId },
        include: {
            createdBy: { select: { id: true, name: true } },
            licitacoes: {
                include: { licitacao: { select: { id: true, identificacao: true, status: true } } },
            },
            propriedadeConfigs: {
                include: { propriedade: true },
                orderBy: { columnOrder: 'asc' },
            },
        },
    });
    if (!centro) {
        throw new AppError(404, 'NOT_FOUND', 'Centro de custo não encontrado');
    }
    return centro;
}
export async function assertCentroActive(prisma, entityId, centroId) {
    const centro = await getCentroForEntity(prisma, entityId, centroId);
    if (centro.status !== 'ACTIVE') {
        throw new AppError(409, 'CENTRO_INACTIVE', 'Centro de custo inativo');
    }
    return centro;
}
function toCentroSummary(centro) {
    return {
        id: centro.id,
        nome: centro.nome,
        dataPrevistaInicio: centro.dataPrevistaInicio
            ? formatDateOnly(centro.dataPrevistaInicio)
            : null,
        dataPrevistaFim: centro.dataPrevistaFim ? formatDateOnly(centro.dataPrevistaFim) : null,
        dataRealizadaInicio: centro.dataRealizadaInicio
            ? formatDateOnly(centro.dataRealizadaInicio)
            : null,
        dataRealizadaFim: centro.dataRealizadaFim
            ? formatDateOnly(centro.dataRealizadaFim)
            : null,
        status: centro.status,
        licitacaoCount: centro._count?.licitacoes ?? centro.licitacaoCount ?? 0,
        propriedadeCount: centro._count?.propriedadeConfigs ?? centro.propriedadeCount ?? 0,
        createdAt: centro.createdAt.toISOString(),
        createdBy: centro.createdBy,
    };
}
function toCentroDetail(centro, entityName) {
    return {
        ...toCentroSummary({
            ...centro,
            licitacaoCount: centro.licitacoes.length,
            propriedadeCount: centro.propriedadeConfigs.filter((c) => c.active).length,
        }),
        entity: { id: centro.entityId, name: entityName },
        licitacoes: centro.licitacoes.map((l) => ({
            id: l.licitacao.id,
            identificacao: l.licitacao.identificacao,
            status: l.licitacao.status,
        })),
        propriedadesConfig: centro.propriedadeConfigs.map((c) => ({
            propriedadeId: c.propriedadeId,
            columnOrder: c.columnOrder,
            productionRole: c.productionRole,
            active: c.active,
            propriedade: {
                id: c.propriedade.id,
                nome: c.propriedade.nome,
                tipo: c.propriedade.tipo,
                status: c.propriedade.status,
            },
        })),
    };
}
async function replaceLicitacoes(prisma, entityId, centroId, licitacaoIds) {
    if (licitacaoIds.length > 1) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Centro de custo permite apenas uma licitação vinculada');
    }
    if (licitacaoIds.length > 0) {
        const licitacoes = await prisma.licitacao.findMany({
            where: { id: { in: licitacaoIds }, entityId, status: 'ACTIVE' },
        });
        if (licitacoes.length !== licitacaoIds.length) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Licitação inválida ou inativa');
        }
    }
    await prisma.centroCustoLicitacao.deleteMany({ where: { centroCustoId: centroId } });
    if (licitacaoIds.length > 0) {
        await prisma.centroCustoLicitacao.createMany({
            data: licitacaoIds.map((licitacaoId) => ({
                centroCustoId: centroId,
                licitacaoId,
                entityId,
            })),
        });
    }
}
/** Lists centros de custo */
export async function listCentrosCusto(prisma, entityId, query) {
    const where = {
        entityId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
            ? { nome: { contains: query.search, mode: 'insensitive' } }
            : {}),
    };
    const [total, rows] = await Promise.all([
        prisma.centroCusto.count({ where }),
        prisma.centroCusto.findMany({
            where,
            include: {
                createdBy: { select: { id: true, name: true } },
                _count: { select: { licitacoes: true, propriedadeConfigs: { where: { active: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
        }),
    ]);
    return {
        items: rows.map((row) => toCentroSummary({
            ...row,
            licitacaoCount: row._count.licitacoes,
            propriedadeCount: row._count.propriedadeConfigs,
        })),
        total,
        page: query.page,
        pageSize: query.pageSize,
    };
}
/** Creates centro de custo */
export async function createCentroCusto(prisma, actorId, entityId, input) {
    const entity = await assertEntityActive(prisma, entityId);
    validateDateRanges(input);
    const duplicate = await prisma.centroCusto.findUnique({
        where: { entityId_nome: { entityId, nome: input.nome } },
    });
    if (duplicate) {
        throw new AppError(409, 'NOME_DUPLICATE', 'Já existe centro de custo com este nome');
    }
    const centro = await prisma.centroCusto.create({
        data: {
            entityId,
            nome: input.nome,
            dataPrevistaInicio: optionalDateField(input.dataPrevistaInicio),
            dataPrevistaFim: optionalDateField(input.dataPrevistaFim),
            dataRealizadaInicio: optionalDateField(input.dataRealizadaInicio),
            dataRealizadaFim: optionalDateField(input.dataRealizadaFim),
            createdByUserId: actorId,
        },
        include: { createdBy: { select: { id: true, name: true } } },
    });
    if (input.licitacaoIds?.length) {
        await replaceLicitacoes(prisma, entityId, centro.id, input.licitacaoIds);
    }
    await writeTenantAudit(prisma, {
        entityId,
        userId: actorId,
        action: 'CENTRO_CUSTO_CREATED',
        resource: 'centro_custo',
        newValue: { id: centro.id, nome: centro.nome },
    });
    const detail = await getCentroForEntity(prisma, entityId, centro.id);
    return toCentroDetail(detail, entity.name);
}
/** Gets centro detail */
export async function getCentroCustoById(prisma, entityId, centroId) {
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity)
        throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
    const centro = await getCentroForEntity(prisma, entityId, centroId);
    return toCentroDetail(centro, entity.name);
}
/** Updates centro de custo */
export async function updateCentroCusto(prisma, actorId, entityId, centroId, input) {
    await assertEntityActive(prisma, entityId);
    const existing = await getCentroForEntity(prisma, entityId, centroId);
    validateDateRanges(input);
    if (input.nome && input.nome !== existing.nome) {
        const duplicate = await prisma.centroCusto.findUnique({
            where: { entityId_nome: { entityId, nome: input.nome } },
        });
        if (duplicate) {
            throw new AppError(409, 'NOME_DUPLICATE', 'Já existe centro de custo com este nome');
        }
    }
    await prisma.centroCusto.update({
        where: { id: centroId },
        data: {
            ...(input.nome !== undefined ? { nome: input.nome } : {}),
            ...(input.dataPrevistaInicio !== undefined
                ? { dataPrevistaInicio: optionalDateField(input.dataPrevistaInicio) }
                : {}),
            ...(input.dataPrevistaFim !== undefined
                ? { dataPrevistaFim: optionalDateField(input.dataPrevistaFim) }
                : {}),
            ...(input.dataRealizadaInicio !== undefined
                ? { dataRealizadaInicio: optionalDateField(input.dataRealizadaInicio) }
                : {}),
            ...(input.dataRealizadaFim !== undefined
                ? { dataRealizadaFim: optionalDateField(input.dataRealizadaFim) }
                : {}),
        },
    });
    if (input.licitacaoIds) {
        await replaceLicitacoes(prisma, entityId, centroId, input.licitacaoIds);
        await writeTenantAudit(prisma, {
            entityId,
            userId: actorId,
            action: 'CENTRO_CUSTO_LICITACOES_UPDATED',
            resource: 'centro_custo',
            newValue: { id: centroId, licitacaoIds: input.licitacaoIds },
        });
    }
    await writeTenantAudit(prisma, {
        entityId,
        userId: actorId,
        action: 'CENTRO_CUSTO_UPDATED',
        resource: 'centro_custo',
        previousValue: { id: existing.id, nome: existing.nome },
        newValue: input,
    });
    return getCentroCustoById(prisma, entityId, centroId);
}
/** Deactivates centro de custo */
export async function deactivateCentroCusto(prisma, actorId, entityId, centroId) {
    await assertEntityActive(prisma, entityId);
    const centro = await getCentroForEntity(prisma, entityId, centroId);
    if (centro.status === 'INACTIVE') {
        return getCentroCustoById(prisma, entityId, centroId);
    }
    await prisma.centroCusto.update({
        where: { id: centroId },
        data: { status: 'INACTIVE' },
    });
    await writeTenantAudit(prisma, {
        entityId,
        userId: actorId,
        action: 'CENTRO_CUSTO_DEACTIVATED',
        resource: 'centro_custo',
        previousValue: { status: 'ACTIVE' },
        newValue: { status: 'INACTIVE', id: centroId },
    });
    return getCentroCustoById(prisma, entityId, centroId);
}
/** Sets licitacoes for centro */
export async function setCentroCustoLicitacoes(prisma, actorId, entityId, centroId, licitacaoIds) {
    await assertEntityActive(prisma, entityId);
    await getCentroForEntity(prisma, entityId, centroId);
    const previous = await prisma.centroCustoLicitacao.findMany({
        where: { centroCustoId: centroId },
        select: { licitacaoId: true },
    });
    await replaceLicitacoes(prisma, entityId, centroId, licitacaoIds);
    await writeTenantAudit(prisma, {
        entityId,
        userId: actorId,
        action: 'CENTRO_CUSTO_LICITACOES_UPDATED',
        resource: 'centro_custo',
        previousValue: { licitacaoIds: previous.map((p) => p.licitacaoId) },
        newValue: { licitacaoIds },
    });
    return getCentroCustoById(prisma, entityId, centroId);
}
const MARKER_TYPES = ['BOOLEAN', 'DATA', 'TEXTO'];
/** Sets propriedades config for centro */
export async function setPropriedadesConfig(prisma, actorId, entityId, centroId, input) {
    await assertEntityActive(prisma, entityId);
    const centro = await getCentroForEntity(prisma, entityId, centroId);
    const licitacaoCount = centro.licitacoes.length;
    const inicioCount = input.items.filter((i) => i.productionRole === 'INICIO').length;
    const conclusaoCount = input.items.filter((i) => i.productionRole === 'CONCLUSAO').length;
    if (inicioCount > 1 || conclusaoCount > 1) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Apenas uma propriedade marcador de início e uma de conclusão');
    }
    const propriedadeIds = input.items.map((i) => i.propriedadeId);
    const propriedades = await prisma.centroCustoPropriedade.findMany({
        where: { id: { in: propriedadeIds }, entityId, status: 'ACTIVE' },
    });
    if (propriedades.length !== propriedadeIds.length) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Propriedade inválida ou inativa');
    }
    const propMap = new Map(propriedades.map((p) => [p.id, p]));
    for (const item of input.items) {
        const prop = propMap.get(item.propriedadeId);
        if ((prop.tipo === 'ITEM_LICITACAO' || prop.tipo === 'ITENS_LICITACAO') &&
            licitacaoCount === 0) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Vincule ao menos uma licitação antes de usar propriedades tipo item');
        }
        if (item.productionRole !== 'NONE' &&
            !MARKER_TYPES.includes(prop.tipo)) {
            throw new AppError(422, 'VALIDATION_ERROR', 'Marcadores de produção exigem propriedade BOOLEAN, DATA ou TEXTO');
        }
    }
    await prisma.$transaction(async (tx) => {
        await tx.centroCustoPropriedadeConfig.deleteMany({ where: { centroCustoId: centroId } });
        if (input.items.length > 0) {
            await tx.centroCustoPropriedadeConfig.createMany({
                data: input.items.map((item) => ({
                    centroCustoId: centroId,
                    propriedadeId: item.propriedadeId,
                    entityId,
                    columnOrder: item.columnOrder,
                    productionRole: item.productionRole,
                    active: item.active ?? true,
                })),
            });
        }
    });
    await writeTenantAudit(prisma, {
        entityId,
        userId: actorId,
        action: 'CENTRO_PROPRIEDADES_CONFIG_UPDATED',
        resource: 'centro_custo',
        newValue: { centroId, itemCount: input.items.length },
    });
    return getCentroCustoById(prisma, entityId, centroId);
}
//# sourceMappingURL=centro-custo.service.js.map