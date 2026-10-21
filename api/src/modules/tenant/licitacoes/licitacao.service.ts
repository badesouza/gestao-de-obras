import type { LicitacaoStatus, PrismaClient } from '../../../../generated/prisma/index.js';
import { situacaoVigencia } from '../contratos/contratos.service.js';
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
  numeroProcesso: string | null;
  modalidade: string | null;
  tipo: string | null;
  dataHomologacao: string | null;
  contratos: { total: number; vigentes: number; vencendo: number; vencidos: number; proximoVencimento: string | null; fornecedores: string[] };
}

type ContratoResumo = { status: LicitacaoStatus; vigenciaDe: Date; vigenciaAte: Date; fornecedor: { razaoSocial: string } | null };

function resumoContratos(contratos: ContratoResumo[] = []) {
  const ativos = contratos.filter(c => c.status === 'ACTIVE').map(c => ({ ...c, ...situacaoVigencia(c.vigenciaDe, c.vigenciaAte) }));
  const proximo = ativos.filter(c => c.situacao !== 'VENCIDO').sort((a, b) => a.vigenciaAte.getTime() - b.vigenciaAte.getTime())[0];
  return {
    total: contratos.length,
    vigentes: ativos.filter(c => c.situacao === 'VIGENTE' || c.situacao === 'VENCENDO').length,
    vencendo: ativos.filter(c => c.situacao === 'VENCENDO').length,
    vencidos: ativos.filter(c => c.situacao === 'VENCIDO').length,
    proximoVencimento: proximo ? proximo.vigenciaAte.toISOString().slice(0, 10) : null,
    fornecedores: Array.from(new Set(contratos.map(c => c.fornecedor?.razaoSocial).filter((x): x is string => !!x))),
  };
}

const incluirContratos = { select: { status: true, vigenciaDe: true, vigenciaAte: true, fornecedor: { select: { razaoSocial: true } } } } as const;

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
    numeroProcesso?: string | null;
    modalidade?: string | null;
    tipo?: string | null;
    dataHomologacao?: Date | null;
    contratos?: ContratoResumo[];
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
    numeroProcesso: licitacao.numeroProcesso ?? null,
    modalidade: licitacao.modalidade ?? null,
    tipo: licitacao.tipo ?? null,
    dataHomologacao: licitacao.dataHomologacao ? licitacao.dataHomologacao.toISOString().slice(0, 10) : null,
    contratos: resumoContratos(licitacao.contratos),
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
      contratos: incluirContratos,
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
      numeroProcesso: input.numeroProcesso || null,
      modalidade: input.modalidade || null,
      tipo: input.tipo || null,
      dataHomologacao: input.dataHomologacao ? new Date(`${input.dataHomologacao}T00:00:00.000Z`) : null,
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
            { numeroProcesso: { contains: query.search, mode: 'insensitive' as const } },
            { contratos: { some: { OR: [{ numero: { contains: query.search, mode: 'insensitive' as const } }, { fornecedor: { razaoSocial: { contains: query.search, mode: 'insensitive' as const } } }] } } },
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
        contratos: incluirContratos,
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
  const emUso = await prisma.licitacaoItem.count({
    where: { licitacaoId, OR: [{ solicitacaoServicoItens: { some: {} } }, { pedidoCompraItens: { some: {} } }, { orcamentoItens: { some: {} } }, { registroValores: { some: {} } }] },
  });
  if (emUso) {
    throw new AppError(409, 'LICITACAO_EM_USO', 'Esta licitação já tem compras, orçamentos ou ocorrências. Desative em vez de apagar, para guardar o histórico.');
  }

  await prisma.$transaction([
    prisma.contratoAditivoItem.deleteMany({ where: { aditivo: { contrato: { licitacaoId } } } }),
    prisma.licitacaoItem.deleteMany({ where: { licitacaoId } }),
    prisma.contrato.deleteMany({ where: { licitacaoId } }),
    prisma.licitacao.delete({ where: { id: licitacaoId } }),
  ]);

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
