import type { PrismaClient, PropriedadeTipo } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import {
  assertCentroActive,
  getCentroForEntity,
} from './centro-custo.service.js';
import {
  cellToOutput,
  formatDateOnly,
  getMonthDateRange,
  parseDateOnly,
  validateCellValue,
  type CellValueInput,
} from './cell-value.validator.js';
import type { UpsertRegistroDiarioRequest } from './registro-diario.schema.js';

function mapRowToDto(
  registro: {
    id: string;
    data: Date;
    valores: Array<{
      propriedadeId: string;
      valorTexto: string | null;
      valorData: Date | null;
      valorDecimal: { toString(): string } | null;
      valorBoolean: boolean | null;
      itens: Array<{ licitacaoItemId: string }>;
      propriedade?: { tipo: PropriedadeTipo };
    }>;
  },
  tipoByProp: Map<string, PropriedadeTipo>,
) {
  const values: Record<string, ReturnType<typeof cellToOutput>> = {};
  for (const valor of registro.valores) {
    const tipo = valor.propriedade?.tipo ?? tipoByProp.get(valor.propriedadeId);
    if (!tipo) continue;
    const output = cellToOutput(tipo, valor);
    if (output) values[valor.propriedadeId] = output;
  }
  return {
    id: registro.id,
    data: formatDateOnly(registro.data),
    values,
  };
}

async function validateItemIds(
  prisma: PrismaClient,
  entityId: string,
  centroId: string,
  itemIds: string[],
) {
  if (itemIds.length === 0) return;

  const links = await prisma.centroCustoLicitacao.findMany({
    where: { centroCustoId: centroId, entityId },
    select: { licitacaoId: true },
  });
  const licitacaoIds = links.map((l) => l.licitacaoId);

  const count = await prisma.licitacaoItem.count({
    where: {
      id: { in: itemIds },
      entityId,
      licitacaoId: { in: licitacaoIds },
      status: 'ACTIVE',
    },
  });
  if (count !== itemIds.length) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Item de licitação inválido para este centro');
  }
}

async function persistCellValues(
  prisma: PrismaClient,
  entityId: string,
  centroId: string,
  registroId: string,
  values: Record<string, CellValueInput> | undefined,
  activeConfigs: Array<{ propriedadeId: string; propriedade: { id: string; tipo: PropriedadeTipo } }>,
) {
  if (!values) return;

  for (const config of activeConfigs) {
    const input = values[config.propriedadeId];
    const parsed = validateCellValue(config.propriedade.tipo, input);
    await validateItemIds(prisma, entityId, centroId, parsed.itemIds);

    const existing = await prisma.registroDiarioValor.findUnique({
      where: {
        registroDiarioId_propriedadeId: {
          registroDiarioId: registroId,
          propriedadeId: config.propriedadeId,
        },
      },
    });

    const isEmpty =
      !parsed.valorTexto &&
      !parsed.valorData &&
      !parsed.valorDecimal &&
      parsed.valorBoolean !== true &&
      parsed.itemIds.length === 0;

    if (isEmpty) {
      if (existing) {
        await prisma.registroDiarioValorItem.deleteMany({
          where: { registroDiarioValorId: existing.id },
        });
        await prisma.registroDiarioValor.delete({ where: { id: existing.id } });
      }
      continue;
    }

    const valorRow = existing
      ? await prisma.registroDiarioValor.update({
          where: { id: existing.id },
          data: {
            valorTexto: parsed.valorTexto,
            valorData: parsed.valorData,
            valorDecimal: parsed.valorDecimal,
            valorBoolean: parsed.valorBoolean,
          },
        })
      : await prisma.registroDiarioValor.create({
          data: {
            registroDiarioId: registroId,
            propriedadeId: config.propriedadeId,
            entityId,
            valorTexto: parsed.valorTexto,
            valorData: parsed.valorData,
            valorDecimal: parsed.valorDecimal,
            valorBoolean: parsed.valorBoolean,
          },
        });

    await prisma.registroDiarioValorItem.deleteMany({
      where: { registroDiarioValorId: valorRow.id },
    });
    if (parsed.itemIds.length > 0) {
      await prisma.registroDiarioValorItem.createMany({
        data: parsed.itemIds.map((licitacaoItemId) => ({
          registroDiarioValorId: valorRow.id,
          licitacaoItemId,
          entityId,
        })),
      });
    }
  }
}

/** Lists registro diario rows for a month */
export async function listRegistrosDiarios(
  prisma: PrismaClient,
  entityId: string,
  centroId: string,
  year: number,
  month: number,
) {
  await getCentroForEntity(prisma, entityId, centroId);
  const { start, end } = getMonthDateRange(year, month);

  const centro = await prisma.centroCusto.findFirst({
    where: { id: centroId, entityId },
    include: {
      propriedadeConfigs: {
        where: { active: true },
        include: { propriedade: true },
      },
    },
  });
  if (!centro) {
    throw new AppError(404, 'NOT_FOUND', 'Centro de custo não encontrado');
  }

  const tipoByProp = new Map(
    centro.propriedadeConfigs.map((c) => [c.propriedadeId, c.propriedade.tipo]),
  );

  const rows = await prisma.registroDiario.findMany({
    where: {
      centroCustoId: centroId,
      entityId,
      data: { gte: start, lte: end },
    },
    include: {
      valores: {
        include: { itens: true, propriedade: true },
      },
    },
    orderBy: [{ data: 'asc' }, { createdAt: 'asc' }],
  });

  return {
    year,
    month,
    rows: rows.map((row) => mapRowToDto(row, tipoByProp)),
  };
}

/** Creates a registro diario row */
export async function createRegistroDiario(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  centroId: string,
  input: UpsertRegistroDiarioRequest,
) {
  await assertCentroActive(prisma, entityId, centroId);
  const centro = await getCentroForEntity(prisma, entityId, centroId);
  const activeConfigs = centro.propriedadeConfigs.filter((c) => c.active);

  const data = parseDateOnly(input.data);

  const registro = await prisma.registroDiario.create({
    data: {
      centroCustoId: centroId,
      entityId,
      data,
      createdByUserId: actorId,
      updatedByUserId: actorId,
    },
  });

  await persistCellValues(
    prisma,
    entityId,
    centroId,
    registro.id,
    input.values,
    activeConfigs,
  );

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'REGISTRO_DIARIO_CREATED',
    resource: 'registro_diario',
    newValue: { id: registro.id, centroId, data: input.data },
  });

  const result = await listRegistrosDiarios(
    prisma,
    entityId,
    centroId,
    data.getUTCFullYear(),
    data.getUTCMonth() + 1,
  );
  const row = result.rows.find((r) => r.id === registro.id);
  if (!row) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Falha ao carregar registro criado');
  }
  return row;
}

/** Updates a registro diario row */
export async function updateRegistroDiario(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  centroId: string,
  registroId: string,
  input: UpsertRegistroDiarioRequest,
) {
  await assertCentroActive(prisma, entityId, centroId);
  const centro = await getCentroForEntity(prisma, entityId, centroId);
  const activeConfigs = centro.propriedadeConfigs.filter((c) => c.active);

  const existing = await prisma.registroDiario.findFirst({
    where: { id: registroId, centroCustoId: centroId, entityId },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Registro não encontrado');
  }

  const data = parseDateOnly(input.data);

  await prisma.registroDiario.update({
    where: { id: registroId },
    data: { data, updatedByUserId: actorId },
  });

  await persistCellValues(
    prisma,
    entityId,
    centroId,
    registroId,
    input.values,
    activeConfigs,
  );

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'REGISTRO_DIARIO_UPDATED',
    resource: 'registro_diario',
    newValue: { id: registroId, data: input.data },
  });

  const result = await listRegistrosDiarios(
    prisma,
    entityId,
    centroId,
    data.getUTCFullYear(),
    data.getUTCMonth() + 1,
  );
  const row = result.rows.find((r) => r.id === registroId);
  if (!row) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Falha ao carregar registro');
  }
  return row;
}

/** Deletes a registro diario row */
export async function deleteRegistroDiario(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  centroId: string,
  registroId: string,
) {
  await assertCentroActive(prisma, entityId, centroId);

  const existing = await prisma.registroDiario.findFirst({
    where: { id: registroId, centroCustoId: centroId, entityId },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Registro não encontrado');
  }

  await prisma.registroDiario.delete({ where: { id: registroId } });

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'REGISTRO_DIARIO_DELETED',
    resource: 'registro_diario',
    previousValue: { id: registroId, data: formatDateOnly(existing.data) },
  });
}
