import type { PrismaClient } from '../../../../generated/prisma/index.js';

/** Searches active licitacao items for linked licitacoes on a centro */
export async function searchItensForCentro(
  prisma: PrismaClient,
  entityId: string,
  centroId: string,
  query: { q?: string; limit: number },
) {
  const links = await prisma.centroCustoLicitacao.findMany({
    where: { centroCustoId: centroId, entityId },
    select: { licitacaoId: true },
  });

  if (links.length === 0) {
    return { items: [] };
  }

  const licitacaoIds = links.map((l) => l.licitacaoId);

  const items = await prisma.licitacaoItem.findMany({
    where: {
      entityId,
      licitacaoId: { in: licitacaoIds },
      status: 'ACTIVE',
      ...(query.q
        ? { descricao: { contains: query.q, mode: 'insensitive' as const } }
        : {}),
    },
    include: { licitacao: { select: { identificacao: true } } },
    orderBy: { descricao: 'asc' },
    take: query.limit,
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      descricao: item.descricao,
      unidadeMedida: item.unidadeMedida,
      licitacaoIdentificacao: item.licitacao.identificacao,
    })),
  };
}
