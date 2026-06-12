import { Prisma, type LicitacaoStatus, type PrismaClient } from '../../../../generated/prisma/index.js';
import { IMPORT_MAX_ROWS } from '../../../shared/constants.js';
import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { parseColumnsInput } from './import/columns.parser.js';
import { parseSpreadsheetBuffer } from './import/spreadsheet.parser.js';
import { validateImportRows } from './item.schema.js';
import { assertEntityActive, getLicitacaoForEntity } from './licitacao.service.js';

interface UserRef {
  id: string;
  name: string;
}

export interface LicitacaoItemDto {
  id: string;
  licitacaoId: string;
  categoria: string | null;
  descricao: string;
  unidadeMedida: string;
  quantidade: string | null;
  valorUnitario: string | null;
  status: LicitacaoStatus;
  createdAt: string;
  createdBy: UserRef;
  saldo: {
    controleSaldo: boolean;
    quantidadeLicitada: string | null;
    quantidadeReservada: string;
    quantidadeRecebida: string;
    quantidadeDisponivel: string | null;
  };
}

/** Maps item record to API DTO */
function toItemDto(
  item: {
    id: string;
    licitacaoId: string;
    categoria: string | null;
    descricao: string;
    unidadeMedida: string;
    quantidade: Prisma.Decimal | null;
    valorUnitario: Prisma.Decimal | null;
    status: LicitacaoStatus;
    createdAt: Date;
    createdBy: { id: string; name: string };
  },
  saldo?: {
    quantidadeReservada: Prisma.Decimal;
    quantidadeRecebida: Prisma.Decimal;
  },
): LicitacaoItemDto {
  const quantidadeLicitada = item.quantidade ?? null;
  const quantidadeReservada = saldo?.quantidadeReservada ?? new Prisma.Decimal(0);
  const quantidadeRecebida = saldo?.quantidadeRecebida ?? new Prisma.Decimal(0);
  const quantidadeDisponivel = quantidadeLicitada
    ? Prisma.Decimal.max(quantidadeLicitada.minus(quantidadeReservada), 0)
    : null;

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
    saldo: {
      controleSaldo: quantidadeLicitada !== null,
      quantidadeLicitada: quantidadeLicitada?.toString() ?? null,
      quantidadeReservada: quantidadeReservada.toString(),
      quantidadeRecebida: quantidadeRecebida.toString(),
      quantidadeDisponivel: quantidadeDisponivel?.toString() ?? null,
    },
  };
}

async function getSaldoByItemId(prisma: PrismaClient, entityId: string, itemIds: string[]) {
  const empty = new Map<string, { quantidadeReservada: Prisma.Decimal; quantidadeRecebida: Prisma.Decimal }>();
  if (itemIds.length === 0) return empty;

  const [solicitacoes, pedidos] = await Promise.all([
    prisma.solicitacaoServicoItem.groupBy({
      by: ['licitacaoItemId'],
      where: {
        entityId,
        licitacaoItemId: { in: itemIds },
        solicitacaoServico: { status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      },
      _sum: { quantidade: true },
    }),
    prisma.pedidoCompraItem.findMany({
      where: {
        entityId,
        licitacaoItemId: { in: itemIds },
        pedidoCompra: { status: { not: 'CANCELLED' } },
      },
      select: {
        licitacaoItemId: true,
        quantidadeTotal: true,
        recebimentos: { select: { quantidade: true } },
      },
    }),
  ]);

  itemIds.forEach((id) => {
    empty.set(id, {
      quantidadeReservada: new Prisma.Decimal(0),
      quantidadeRecebida: new Prisma.Decimal(0),
    });
  });

  solicitacoes.forEach((row) => {
    const current = empty.get(row.licitacaoItemId);
    if (!current) return;
    current.quantidadeReservada = current.quantidadeReservada.plus(row._sum.quantidade ?? 0);
  });

  pedidos.forEach((pedidoItem) => {
    const current = empty.get(pedidoItem.licitacaoItemId);
    if (!current) return;
    current.quantidadeReservada = current.quantidadeReservada.plus(pedidoItem.quantidadeTotal);
    current.quantidadeRecebida = current.quantidadeRecebida.plus(
      pedidoItem.recebimentos.reduce((sum, recebimento) => sum.plus(recebimento.quantidade), new Prisma.Decimal(0)),
    );
  });

  return empty;
}

/** Ensures licitacao is active before import */
async function assertLicitacaoActiveForImport(
  prisma: PrismaClient,
  entityId: string,
  licitacaoId: string,
) {
  const licitacao = await getLicitacaoForEntity(prisma, entityId, licitacaoId);
  if (licitacao.status !== 'ACTIVE') {
    throw new AppError(409, 'LICITACAO_INACTIVE', 'Licitação inativa — importação não permitida');
  }
  return licitacao;
}

/** Persists validated items atomically with audit log */
async function persistImport(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  licitacaoId: string,
  source: 'spreadsheet' | 'textarea',
  items: ReturnType<typeof validateImportRows>['items'],
) {
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
export async function listLicitacaoItems(
  prisma: PrismaClient,
  entityId: string,
  licitacaoId: string,
  query: {
    search?: string;
    categoria?: string;
    includeInactive?: boolean;
    page: number;
    pageSize: number;
  },
) {
  await getLicitacaoForEntity(prisma, entityId, licitacaoId);

  const where = {
    licitacaoId,
    entityId,
    ...(query.includeInactive ? {} : { status: 'ACTIVE' as const }),
    ...(query.categoria
      ? { categoria: { contains: query.categoria, mode: 'insensitive' as const } }
      : {}),
    ...(query.search
      ? { descricao: { contains: query.search, mode: 'insensitive' as const } }
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

  const saldoByItemId = await getSaldoByItemId(prisma, entityId, rows.map((item) => item.id));

  return {
    items: rows.map((item) => toItemDto(item, saldoByItemId.get(item.id))),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Imports items from spreadsheet buffer */
export async function importItemsFromSpreadsheet(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  licitacaoId: string,
  buffer: Buffer,
  filename: string,
) {
  await assertEntityActive(prisma, entityId);
  await assertLicitacaoActiveForImport(prisma, entityId, licitacaoId);

  const parsedRows = parseSpreadsheetBuffer(buffer, filename);
  if (parsedRows.length === 0) {
    throw new AppError(
      422,
      'IMPORT_EMPTY',
      'Planilha vazia ou sem colunas obrigatórias (descricao, unidade)',
    );
  }
  if (parsedRows.length > IMPORT_MAX_ROWS) {
    throw new AppError(
      413,
      'IMPORT_TOO_LARGE',
      `Importação excede o limite de ${IMPORT_MAX_ROWS} linhas`,
    );
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
export async function importItemsFromColumns(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  licitacaoId: string,
  columns: Partial<Record<'categoria' | 'descricao' | 'unidade' | 'quantidade' | 'valor', string>>,
) {
  await assertEntityActive(prisma, entityId);
  await assertLicitacaoActiveForImport(prisma, entityId, licitacaoId);

  const { rows, mismatch } = parseColumnsInput(columns);
  if (mismatch && mismatch.length > 0) {
    throw new AppError(
      422,
      'IMPORT_COLUMN_MISMATCH',
      'Colunas com quantidade de linhas diferente',
      { columns: mismatch },
    );
  }
  if (rows.length === 0) {
    throw new AppError(
      422,
      'IMPORT_EMPTY',
      'Informe ao menos descrição e unidade com uma linha cada',
    );
  }
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new AppError(
      413,
      'IMPORT_TOO_LARGE',
      `Importação excede o limite de ${IMPORT_MAX_ROWS} linhas`,
    );
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
export async function deactivateLicitacaoItem(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  licitacaoId: string,
  itemId: string,
) {
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
