import type { CentroCustoStatus, PrismaClient, PropriedadeTipo } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { assertEntityActive } from '../licitacoes/licitacao.service.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import type { CreatePropriedadeRequest, UpdatePropriedadeRequest } from './propriedade.schema.js';

export interface PropriedadeDto {
  id: string;
  nome: string;
  tipo: PropriedadeTipo;
  status: CentroCustoStatus;
  createdAt: string;
  createdBy: { id: string; name: string };
}

/** Lists propriedades catalog */
export async function listPropriedades(prisma: PrismaClient, entityId: string) {
  const rows = await prisma.centroCustoPropriedade.findMany({
    where: { entityId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { nome: 'asc' },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      tipo: row.tipo,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
    })),
  };
}

/** Creates propriedade in catalog */
export async function createPropriedade(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  input: CreatePropriedadeRequest,
) {
  await assertEntityActive(prisma, entityId);

  const duplicate = await prisma.centroCustoPropriedade.findUnique({
    where: { entityId_nome: { entityId, nome: input.nome } },
  });
  if (duplicate) {
    throw new AppError(409, 'NOME_DUPLICATE', 'Propriedade com este nome já existe');
  }

  const row = await prisma.centroCustoPropriedade.create({
    data: {
      entityId,
      nome: input.nome,
      tipo: input.tipo,
      createdByUserId: actorId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'PROPRIEDADE_CREATED',
    resource: 'centro_custo_propriedade',
    newValue: { id: row.id, nome: row.nome, tipo: row.tipo },
  });

  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
}

/** Updates propriedade (nome or deactivate); tipo is immutable after use */
export async function updatePropriedade(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  propriedadeId: string,
  input: UpdatePropriedadeRequest,
) {
  await assertEntityActive(prisma, entityId);

  const row = await prisma.centroCustoPropriedade.findFirst({
    where: { id: propriedadeId, entityId },
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Propriedade não encontrada');
  }

  if (input.nome && input.nome !== row.nome) {
    const duplicate = await prisma.centroCustoPropriedade.findUnique({
      where: { entityId_nome: { entityId, nome: input.nome } },
    });
    if (duplicate) {
      throw new AppError(409, 'NOME_DUPLICATE', 'Propriedade com este nome já existe');
    }
  }

  const updated = await prisma.centroCustoPropriedade.update({
    where: { id: propriedadeId },
    data: {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.status === 'INACTIVE' ? { status: 'INACTIVE' as const } : {}),
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  if (input.status === 'INACTIVE') {
    await writeTenantAudit(prisma, {
      entityId,
      userId: actorId,
      action: 'PROPRIEDADE_DEACTIVATED',
      resource: 'centro_custo_propriedade',
      newValue: { id: propriedadeId },
    });
  }

  return {
    id: updated.id,
    nome: updated.nome,
    tipo: updated.tipo,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    createdBy: updated.createdBy,
  };
}

/** Gets propriedade by id scoped to entity */
export async function getPropriedadeById(
  prisma: PrismaClient,
  entityId: string,
  propriedadeId: string,
) {
  const row = await prisma.centroCustoPropriedade.findFirst({
    where: { id: propriedadeId, entityId },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Propriedade não encontrada');
  }
  return row;
}
