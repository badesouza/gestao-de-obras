import { IMPORT_MAX_ROWS } from '../../../shared/constants.js';
import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { parseColumnsInput } from './import/columns.parser.js';
import { parseSpreadsheetBuffer } from './import/spreadsheet.parser.js';
import { validateImportRows } from './item.schema.js';
import { assertEntityActive, getLicitacaoForEntity } from './licitacao.service.js';
/** Maps item record to API DTO */
function toItemDto(item) {
    return {
        id: item.id,
        licitacaoId: item.licitacaoId,
        categoria: item.categoria,
        descricao: item.descricao,
        unidadeMedida: item.unidadeMedida,
        quantidade: item.quantidade?.toString() ?? null,
        valorUnitario: item.valorUnitario?.toString() ?? null,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        createdBy: { id: item.createdBy.id, name: item.createdBy.name },
    };
}
/** Ensures licitacao is active before import */
async function assertLicitacaoActiveForImport(prisma, entityId, licitacaoId) {
    const licitacao = await getLicitacaoForEntity(prisma, entityId, licitacaoId);
    if (licitacao.status !== 'ACTIVE') {
        throw new AppError(409, 'LICITACAO_INACTIVE', 'Licitação inativa — importação não permitida');
    }
    return licitacao;
}
/** Persists validated items atomically with audit log */
async function persistImport(prisma, actorId, entityId, licitacaoId, source, items) {
    await prisma.$transaction(async (tx) => {
        await tx.licitacaoItem.createMany({
            data: items.map((item) => ({
                licitacaoId,
                entityId,
                categoria: item.categoria,
                descricao: item.descricao,
                unidadeMedida: item.unidadeMedida,
                quantidade: item.quantidade,
                valorUnitario: item.valorUnitario,
                createdByUserId: actorId,
            })),
        });
        await tx.tenantAuditLog.create({
            data: {
                entityId,
                userId: actorId,
                action: 'LICITACAO_ITEMS_IMPORTED',
                resource: 'licitacao_item',
                metadata: {
                    licitacaoId,
                    source,
                    itemCount: items.length,
                },
            },
        });
    });
    return { importedCount: items.length, licitacaoId };
}
/** Lists items for a licitacao */
export async function listLicitacaoItems(prisma, entityId, licitacaoId, query) {
    await getLicitacaoForEntity(prisma, entityId, licitacaoId);
    const where = {
        licitacaoId,
        entityId,
        ...(query.includeInactive ? {} : { status: 'ACTIVE' }),
        ...(query.categoria
            ? { categoria: { contains: query.categoria, mode: 'insensitive' } }
            : {}),
        ...(query.search
            ? { descricao: { contains: query.search, mode: 'insensitive' } }
            : {}),
    };
    const [total, rows] = await Promise.all([
        prisma.licitacaoItem.count({ where }),
        prisma.licitacaoItem.findMany({
            where,
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'asc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
        }),
    ]);
    return {
        items: rows.map(toItemDto),
        total,
        page: query.page,
        pageSize: query.pageSize,
    };
}
/** Imports items from spreadsheet buffer */
export async function importItemsFromSpreadsheet(prisma, actorId, entityId, licitacaoId, buffer, filename) {
    await assertEntityActive(prisma, entityId);
    await assertLicitacaoActiveForImport(prisma, entityId, licitacaoId);
    const parsedRows = parseSpreadsheetBuffer(buffer, filename);
    if (parsedRows.length === 0) {
        throw new AppError(422, 'IMPORT_EMPTY', 'Planilha vazia ou sem colunas obrigatórias (descricao, unidade)');
    }
    if (parsedRows.length > IMPORT_MAX_ROWS) {
        throw new AppError(413, 'IMPORT_TOO_LARGE', `Importação excede o limite de ${IMPORT_MAX_ROWS} linhas`);
    }
    const { items, lineErrors } = validateImportRows(parsedRows);
    if (lineErrors.length > 0) {
        throw new AppError(422, 'IMPORT_VALIDATION_ERROR', 'Erros na planilha', {
            lineErrors,
        });
    }
    return persistImport(prisma, actorId, entityId, licitacaoId, 'spreadsheet', items);
}
/** Imports items from column textareas */
export async function importItemsFromColumns(prisma, actorId, entityId, licitacaoId, columns) {
    await assertEntityActive(prisma, entityId);
    await assertLicitacaoActiveForImport(prisma, entityId, licitacaoId);
    const { rows, mismatch } = parseColumnsInput(columns);
    if (mismatch && mismatch.length > 0) {
        throw new AppError(422, 'IMPORT_COLUMN_MISMATCH', 'Colunas com quantidade de linhas diferente', { columns: mismatch });
    }
    if (rows.length === 0) {
        throw new AppError(422, 'IMPORT_EMPTY', 'Informe ao menos descrição e unidade com uma linha cada');
    }
    if (rows.length > IMPORT_MAX_ROWS) {
        throw new AppError(413, 'IMPORT_TOO_LARGE', `Importação excede o limite de ${IMPORT_MAX_ROWS} linhas`);
    }
    const { items, lineErrors } = validateImportRows(rows);
    if (lineErrors.length > 0) {
        throw new AppError(422, 'IMPORT_VALIDATION_ERROR', 'Erros nos dados colados', {
            lineErrors,
        });
    }
    return persistImport(prisma, actorId, entityId, licitacaoId, 'textarea', items);
}
/** Deactivates a licitacao item (idempotent) */
export async function deactivateLicitacaoItem(prisma, actorId, entityId, licitacaoId, itemId) {
    await assertEntityActive(prisma, entityId);
    await getLicitacaoForEntity(prisma, entityId, licitacaoId);
    const item = await prisma.licitacaoItem.findFirst({
        where: { id: itemId, licitacaoId, entityId },
        include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!item) {
        throw new AppError(404, 'NOT_FOUND', 'Item não encontrado');
    }
    if (item.status === 'INACTIVE') {
        return toItemDto(item);
    }
    const updated = await prisma.licitacaoItem.update({
        where: { id: itemId },
        data: { status: 'INACTIVE' },
        include: { createdBy: { select: { id: true, name: true } } },
    });
    await writeTenantAudit(prisma, {
        entityId,
        userId: actorId,
        action: 'LICITACAO_ITEM_DEACTIVATED',
        resource: 'licitacao_item',
        previousValue: { status: 'ACTIVE', id: itemId },
        newValue: { status: 'INACTIVE', licitacaoId },
    });
    return toItemDto(updated);
}
//# sourceMappingURL=item.service.js.map