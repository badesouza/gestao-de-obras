import type { PrismaClient, TipoCentroDeCusto } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';

/* ── Centros de custo (onde a despesa é apropriada) ──
   Serviço ≠ centro de custo: cada serviço aponta um centro padrão,
   que pode ser trocado em cada ocorrência e em cada item de compra. */

export interface DadosCentro {
  codigo: string; nome: string; tipo: TipoCentroDeCusto;
  descricao?: string | null; responsavel?: string | null; ativo?: boolean; paiId?: string | null;
}

const FUSO_MS = -3 * 3600_000;

export async function listarCentros(prisma: PrismaClient, entityId: string) {
  const agora = new Date(Date.now() + FUSO_MS);
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1) - FUSO_MS);
  const [centros, ocorrencias, ocorrenciasMes, valores, servicos] = await Promise.all([
    prisma.centroDeCusto.findMany({ where: { entityId }, orderBy: [{ ativo: 'desc' }, { codigo: 'asc' }] }),
    prisma.registroDiario.groupBy({ by: ['centroDeCustoId'], where: { entityId, centroDeCustoId: { not: null } }, _count: { _all: true } }),
    prisma.registroDiario.groupBy({ by: ['centroDeCustoId'], where: { entityId, centroDeCustoId: { not: null }, createdAt: { gte: inicioMes } }, _count: { _all: true } }),
    prisma.pedidoCompraItemOrigem.groupBy({
      by: ['centroDeCustoId'],
      where: { entityId, centroDeCustoId: { not: null }, pedidoCompraItem: { pedidoCompra: { status: { not: 'CANCELLED' } } } },
      _sum: { valorTotal: true },
    }),
    prisma.centroCusto.findMany({ where: { entityId, centroDeCustoPadraoId: { not: null } }, select: { id: true, nome: true, centroDeCustoPadraoId: true } }),
  ]);
  const semCentro = await prisma.pedidoCompraItemOrigem.aggregate({
    where: { entityId, centroDeCustoId: null, pedidoCompraItem: { pedidoCompra: { status: { not: 'CANCELLED' } } } },
    _sum: { valorTotal: true },
  });
  return {
    itens: centros.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
      ocorrencias: ocorrencias.find(o => o.centroDeCustoId === c.id)?._count._all ?? 0,
      ocorrenciasMes: ocorrenciasMes.find(o => o.centroDeCustoId === c.id)?._count._all ?? 0,
      valorComprometido: (valores.find(v => v.centroDeCustoId === c.id)?._sum.valorTotal ?? 0).toString(),
      servicos: servicos.filter(s => s.centroDeCustoPadraoId === c.id).map(s => ({ id: s.id, nome: s.nome })),
    })),
    valorSemCentro: (semCentro._sum.valorTotal ?? 0).toString(),
  };
}

async function validar(prisma: PrismaClient, entityId: string, dados: DadosCentro, id?: string) {
  const dup = await prisma.centroDeCusto.findFirst({ where: { entityId, codigo: dados.codigo, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (dup) throw new AppError(409, 'CONFLICT', `Já existe um centro de custo com o código ${dados.codigo}`);
  if (dados.paiId) {
    if (dados.paiId === id) throw new AppError(400, 'VALIDATION_ERROR', 'Um centro não pode ser pai dele mesmo');
    const pai = await prisma.centroDeCusto.findFirst({ where: { id: dados.paiId, entityId }, select: { id: true } });
    if (!pai) throw new AppError(400, 'VALIDATION_ERROR', 'Centro de custo pai não encontrado');
  }
}

export async function criarCentro(prisma: PrismaClient, entityId: string, userId: string, dados: DadosCentro) {
  await validar(prisma, entityId, dados);
  const c = await prisma.centroDeCusto.create({ data: { entityId, ...dados } });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CENTRO_DE_CUSTO_CREATED', resource: 'centro_de_custo', newValue: { id: c.id, codigo: c.codigo, nome: c.nome } });
  return c;
}

export async function atualizarCentro(prisma: PrismaClient, entityId: string, userId: string, id: string, dados: DadosCentro) {
  const atual = await prisma.centroDeCusto.findFirst({ where: { id, entityId } });
  if (!atual) throw new AppError(404, 'NOT_FOUND', 'Centro de custo não encontrado');
  await validar(prisma, entityId, dados, id);
  const c = await prisma.centroDeCusto.update({ where: { id }, data: dados });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CENTRO_DE_CUSTO_UPDATED', resource: 'centro_de_custo', previousValue: { codigo: atual.codigo, nome: atual.nome, ativo: atual.ativo }, newValue: { id, ...dados } });
  return c;
}

/** Exclui se nunca foi usado; se já tem lançamentos, só desativa (preserva o histórico) */
export async function removerCentro(prisma: PrismaClient, entityId: string, userId: string, id: string) {
  const c = await prisma.centroDeCusto.findFirst({
    where: { id, entityId },
    include: { _count: { select: { registros: true, solicitacaoItens: true, origensPedido: true, filhos: true } } },
  });
  if (!c) throw new AppError(404, 'NOT_FOUND', 'Centro de custo não encontrado');
  const usado = c._count.registros + c._count.solicitacaoItens + c._count.origensPedido + c._count.filhos > 0;
  if (usado) {
    await prisma.centroDeCusto.update({ where: { id }, data: { ativo: false } });
    await writeTenantAudit(prisma, { entityId, userId, action: 'CENTRO_DE_CUSTO_DEACTIVATED', resource: 'centro_de_custo', newValue: { id } });
    return { removido: false, desativado: true };
  }
  await prisma.centroCusto.updateMany({ where: { entityId, centroDeCustoPadraoId: id }, data: { centroDeCustoPadraoId: null } });
  await prisma.centroDeCusto.delete({ where: { id } });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CENTRO_DE_CUSTO_DELETED', resource: 'centro_de_custo', previousValue: { id, codigo: c.codigo } });
  return { removido: true, desativado: false };
}

/** Define este centro como padrão dos serviços informados (tira dos que saíram da lista) */
export async function definirServicosPadrao(prisma: PrismaClient, entityId: string, userId: string, id: string, servicoIds: string[]) {
  const c = await prisma.centroDeCusto.findFirst({ where: { id, entityId }, select: { id: true } });
  if (!c) throw new AppError(404, 'NOT_FOUND', 'Centro de custo não encontrado');
  await prisma.$transaction([
    prisma.centroCusto.updateMany({ where: { entityId, centroDeCustoPadraoId: id, id: { notIn: servicoIds } }, data: { centroDeCustoPadraoId: null } }),
    prisma.centroCusto.updateMany({ where: { entityId, id: { in: servicoIds } }, data: { centroDeCustoPadraoId: id } }),
  ]);
  await writeTenantAudit(prisma, { entityId, userId, action: 'CENTRO_DE_CUSTO_SERVICOS', resource: 'centro_de_custo', newValue: { id, servicoIds } });
}

/** Centro padrão do serviço (usado quando a ocorrência não informa) */
export async function centroPadraoDoServico(prisma: PrismaClient, entityId: string, servicoId: string) {
  const s = await prisma.centroCusto.findFirst({ where: { id: servicoId, entityId }, select: { centroDeCustoPadraoId: true } });
  return s?.centroDeCustoPadraoId ?? null;
}

export async function assertCentroValido(prisma: PrismaClient, entityId: string, centroDeCustoId: string) {
  const c = await prisma.centroDeCusto.findFirst({ where: { id: centroDeCustoId, entityId, ativo: true }, select: { id: true } });
  if (!c) throw new AppError(400, 'VALIDATION_ERROR', 'Centro de custo inválido ou desativado');
}
