import type { LicitacaoStatus, PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import type { CreateLicitacaoRequest, UpdateLicitacaoRequest } from './licitacao.schema.js';

interface UserRef {
  id: string;
  name: string;
}

interface FornecedorRef {
  id: string;
  razaoSocial: string;
  cnpj: string | null;
}

export interface LicitacaoDto {
  id: string;
  identificacao: string;
  objeto: string;
  status: LicitacaoStatus;
  fornecedor: FornecedorRef | null;
  createdAt: string;
  createdBy: UserRef;
  activeItemCount: number;
}

/** Ensures entity exists and is active before licitacao mutations */
export async function assertEntityActive(prisma: PrismaClient, entityId: string) {
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
function toLicitacaoDto(
  licitacao: {
    id: string;
    identificacao: string;
    objeto: string;
    status: LicitacaoStatus;
    createdAt: Date;
    createdBy: { id: string; name: string };
    fornecedor?: { id: string; razaoSocial: string; cnpj: string | null } | null;
  },
  activeItemCount: number,
): LicitacaoDto {
  return {
    id: licitacao.id,
    identificacao: licitacao.identificacao,
    objeto: licitacao.objeto,
    status: licitacao.status,
    fornecedor: licitacao.fornecedor
      ? { id: licitacao.fornecedor.id, razaoSocial: licitacao.fornecedor.razaoSocial, cnpj: licitacao.fornecedor.cnpj }
      : null,
    createdAt: licitacao.createdAt.toISOString(),
    createdBy: { id: licitacao.createdBy.id, name: licitacao.createdBy.name },
    activeItemCount,
  };
}

/** Loads licitacao scoped to entity or throws */
export async function getLicitacaoForEntity(
  prisma: PrismaClient,
  entityId: string,
  licitacaoId: string,
) {
  const licitacao = await prisma.licitacao.findFirst({
    where: { id: licitacaoId, entityId },
    include: {
      createdBy: { select: { id: true, name: true } },
      fornecedor: { select: { id: true, razaoSocial: true, cnpj: true } },
    },
  });
  if (!licitacao) {
    throw new AppError(404, 'LICITACAO_NOT_FOUND', 'Licitação não encontrada');
  }
  return licitacao;
}

/** Creates a licitacao for the current entity */
export async function createLicitacao(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  input: CreateLicitacaoRequest,
) {
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
    throw new AppError(
      409,
      'IDENTIFICACAO_DUPLICATE',
      'Já existe licitação com esta identificação nesta entidade',
    );
  }

  const licitacao = await prisma.licitacao.create({
    data: {
      entityId,
      identificacao: input.identificacao,
      objeto: input.objeto,
      createdByUserId: actorId,
      ...(input.fornecedorId ? { fornecedorId: input.fornecedorId } : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      fornecedor: { select: { id: true, razaoSocial: true, cnpj: true } },
    },
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
export async function listLicitacoes(
  prisma: PrismaClient,
  entityId: string,
  query: { search?: string; status?: LicitacaoStatus; page: number; pageSize: number },
) {
  const where = {
    entityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { identificacao: { contains: query.search, mode: 'insensitive' as const } },
            { objeto: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.licitacao.count({ where }),
    prisma.licitacao.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        fornecedor: { select: { id: true, razaoSocial: true, cnpj: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const ids = rows.map((row) => row.id);
  const counts =
    ids.length === 0
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
export async function getLicitacaoById(
  prisma: PrismaClient,
  entityId: string,
  licitacaoId: string,
) {
  const licitacao = await getLicitacaoForEntity(prisma, entityId, licitacaoId);
  const activeItemCount = await prisma.licitacaoItem.count({
    where: { licitacaoId, status: 'ACTIVE' },
  });
  return toLicitacaoDto(licitacao, activeItemCount);
}

/** Updates identificacao, objeto and optionally fornecedor of a licitacao */
export async function updateLicitacao(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  licitacaoId: string,
  input: UpdateLicitacaoRequest,
) {
  await assertEntityActive(prisma, entityId);
  const existing = await getLicitacaoForEntity(prisma, entityId, licitacaoId);

  if (existing.identificacao !== input.identificacao) {
    const duplicate = await prisma.licitacao.findFirst({
      where: { entityId, identificacao: input.identificacao, NOT: { id: licitacaoId } },
    });
    if (duplicate) {
      throw new AppError(409, 'IDENTIFICACAO_DUPLICATE', 'Já existe licitação com esta identificação nesta entidade');
    }
  }

  const updated = await prisma.licitacao.update({
    where: { id: licitacaoId },
    data: {
      identificacao: input.identificacao,
      objeto: input.objeto,
      fornecedorId: input.fornecedorId ?? null,
      updatedAt: new Date(),
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      fornecedor: { select: { id: true, razaoSocial: true, cnpj: true } },
    },
  });

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'LICITACAO_UPDATED',
    resource: 'licitacao',
    previousValue: { identificacao: existing.identificacao, objeto: existing.objeto },
    newValue: { identificacao: updated.identificacao, objeto: updated.objeto },
  });

  const activeItemCount = await prisma.licitacaoItem.count({ where: { licitacaoId, status: 'ACTIVE' } });
  return toLicitacaoDto(updated, activeItemCount);
}

/** Hard-deletes a licitacao and its items */
export async function deleteLicitacao(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  licitacaoId: string,
) {
  await assertEntityActive(prisma, entityId);
  const licitacao = await getLicitacaoForEntity(prisma, entityId, licitacaoId);

  await prisma.licitacaoItem.deleteMany({ where: { licitacaoId } });
  await prisma.licitacao.delete({ where: { id: licitacaoId } });

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'LICITACAO_DELETED',
    resource: 'licitacao',
    previousValue: { id: licitacaoId, identificacao: licitacao.identificacao },
  });
}

/** Deactivates a licitacao (idempotent) */
export async function deactivateLicitacao(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  licitacaoId: string,
) {
  await assertEntityActive(prisma, entityId);
  const licitacao = await getLicitacaoForEntity(prisma, entityId, licitacaoId);

  if (licitacao.status === 'INACTIVE') {
    return toLicitacaoDto(
      licitacao,
      await prisma.licitacaoItem.count({ where: { licitacaoId, status: 'ACTIVE' } }),
    );
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
