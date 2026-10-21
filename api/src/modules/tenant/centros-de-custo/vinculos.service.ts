import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';

/* ── Serviços urbanos × centro de custo, tudo de uma vez ──
   Cada serviço aponta o seu centro padrão. Ao salvar, dá para acertar
   também o que já foi lançado sem centro (ocorrências e compras).      */

export interface Vinculo { servicoId: string; slug: string; centroDeCustoId: string | null }

/** Situação de cada serviço: centro padrão e quanto ficou sem centro */
export async function listarVinculos(prisma: PrismaClient, entityId: string, slugs: Record<string, string>) {
  const servicos = await prisma.centroCusto.findMany({
    where: { entityId }, orderBy: { nome: 'asc' },
    select: { id: true, nome: true, status: true, centroDeCustoPadraoId: true },
  });
  const semCentro = await prisma.registroDiario.groupBy({ by: ['centroCustoId'], where: { entityId, centroDeCustoId: null }, _count: { _all: true } });
  const slugPorId = Object.fromEntries(Object.entries(slugs).map(([s, id]) => [id, s]));
  const comprasSem = await Promise.all(servicos.map(async s => {
    const slug = slugPorId[s.id];
    if (!slug) return 0;
    const [a, b] = await Promise.all([
      prisma.solicitacaoServicoItem.count({ where: { entityId, centroDeCustoId: null, OR: [{ servicoSlug: slug }, { servicoSlug: null, solicitacaoServico: { servicoSlug: slug } }] } }),
      prisma.pedidoCompraItemOrigem.count({ where: { entityId, centroDeCustoId: null, servicoSlug: slug } }),
    ]);
    return a + b;
  }));
  return servicos.map((s, i) => ({
    servicoId: s.id, nome: s.nome, ativo: s.status === 'ACTIVE', slug: slugPorId[s.id] ?? null,
    centroDeCustoId: s.centroDeCustoPadraoId,
    ocorrenciasSemCentro: semCentro.find(x => x.centroCustoId === s.id)?._count._all ?? 0,
    comprasSemCentro: comprasSem[i],
  }));
}

/** Grava o centro padrão de cada serviço e, se pedido, acerta o que foi lançado sem centro */
export async function salvarVinculos(prisma: PrismaClient, entityId: string, userId: string, vinculos: Vinculo[], aplicarAntigos: boolean) {
  const centros = Array.from(new Set(vinculos.map(v => v.centroDeCustoId).filter((x): x is string => !!x)));
  if (centros.length) {
    const ok = await prisma.centroDeCusto.count({ where: { entityId, ativo: true, id: { in: centros } } });
    if (ok !== centros.length) throw new AppError(400, 'VALIDATION_ERROR', 'Há centro de custo inválido ou desativado na lista');
  }
  const ids = vinculos.map(v => v.servicoId);
  const existem = await prisma.centroCusto.count({ where: { entityId, id: { in: ids } } });
  if (existem !== ids.length) throw new AppError(400, 'VALIDATION_ERROR', 'Há serviço que não é desta entidade');

  const acertos = { ocorrencias: 0, solicitacoes: 0, pedidos: 0, orcamentos: 0 };
  await prisma.$transaction(async (tx) => {
    for (const v of vinculos) {
      await tx.centroCusto.update({ where: { id: v.servicoId }, data: { centroDeCustoPadraoId: v.centroDeCustoId } });
      if (!aplicarAntigos || !v.centroDeCustoId) continue;
      const c = v.centroDeCustoId;
      acertos.ocorrencias += (await tx.registroDiario.updateMany({ where: { entityId, centroCustoId: v.servicoId, centroDeCustoId: null }, data: { centroDeCustoId: c } })).count;
      if (!v.slug) continue;
      acertos.solicitacoes += (await tx.solicitacaoServicoItem.updateMany({
        where: { entityId, centroDeCustoId: null, OR: [{ servicoSlug: v.slug }, { servicoSlug: null, solicitacaoServico: { servicoSlug: v.slug } }] },
        data: { centroDeCustoId: c },
      })).count;
      acertos.pedidos += (await tx.pedidoCompraItemOrigem.updateMany({ where: { entityId, centroDeCustoId: null, servicoSlug: v.slug }, data: { centroDeCustoId: c } })).count;
      acertos.orcamentos += (await tx.orcamentoItem.updateMany({ where: { centroDeCustoId: null, servicoSlug: v.slug, orcamento: { entityId } }, data: { centroDeCustoId: c } })).count;
      await tx.orcamento.updateMany({ where: { entityId, centroDeCustoId: null, servicoSlug: v.slug }, data: { centroDeCustoId: c } });
    }
  }, { timeout: 60_000 });
  await writeTenantAudit(prisma, { entityId, userId, action: 'SERVICOS_CENTROS_DE_CUSTO', resource: 'centro_de_custo', newValue: { vinculos: vinculos.length, aplicarAntigos, ...acertos } });
  return acertos;
}

/** Estrutura sugerida: a secretaria e um setor por serviço (só para os serviços ainda sem centro) */
export async function montarEstruturaSugerida(
  prisma: PrismaClient, entityId: string, userId: string,
  d: { codigoSecretaria: string; nomeSecretaria: string; responsavel?: string | null },
) {
  const servicos = await prisma.centroCusto.findMany({ where: { entityId, status: 'ACTIVE' }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, centroDeCustoPadraoId: true } });
  const sem = servicos.filter(s => !s.centroDeCustoPadraoId);
  if (!sem.length) throw new AppError(409, 'CONFLICT', 'Todos os serviços já têm centro de custo');
  const raiz = d.codigoSecretaria.trim();
  const criados = await prisma.$transaction(async (tx) => {
    let secretaria = await tx.centroDeCusto.findFirst({ where: { entityId, codigo: raiz } });
    secretaria ??= await tx.centroDeCusto.create({ data: { entityId, codigo: raiz, nome: d.nomeSecretaria.trim(), tipo: 'SECRETARIA', responsavel: d.responsavel ?? null } });
    const usados = new Set((await tx.centroDeCusto.findMany({ where: { entityId, codigo: { startsWith: `${raiz}.` } }, select: { codigo: true } })).map(c => c.codigo));
    let n = 1;
    const novos: { codigo: string; nome: string }[] = [];
    for (const s of sem) {
      while (usados.has(`${raiz}.${String(n).padStart(2, '0')}`)) n++;
      const codigo = `${raiz}.${String(n).padStart(2, '0')}`;
      usados.add(codigo);
      const c = await tx.centroDeCusto.create({ data: { entityId, codigo, nome: s.nome, tipo: 'SETOR', paiId: secretaria.id } });
      await tx.centroCusto.update({ where: { id: s.id }, data: { centroDeCustoPadraoId: c.id } });
      novos.push({ codigo, nome: s.nome });
    }
    return novos;
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CENTRO_DE_CUSTO_ESTRUTURA_SUGERIDA', resource: 'centro_de_custo', newValue: { raiz, criados: criados.length } });
  return { criados };
}
