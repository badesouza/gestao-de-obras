import type { OrcamentoStatus, PrismaClient } from '../../../../generated/prisma/index.js';
import { Prisma } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { proximoNumero } from '../../../shared/sequencia.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { obterConfig } from '../ordens/ordens.service.js';
import { poderesCompra, type AtorCompra } from '../compras/compras-fluxo.service.js';
import { createPedidoFromSolicitacoes, createSolicitacao } from '../compras/compras.service.js';
import { assertItensVigentes } from '../contratos/contratos.service.js';

/* ── Orçamentação ─────────────────────────────────────────────────
   O fiscal vai ao local, fotografa (com carimbo) e lista o material dos
   contratos que a obra vai precisar — cada linha com seu serviço e seu
   centro de custo. O orçamento passa pela mesma revisão e aprovação das
   compras e, aprovado, vira pedido de compra (um por contrato), já
   aprovado e pronto para ir ao fornecedor.                           */

export const MAX_FOTOS_ORCAMENTO = 12;

export interface ItemOrcamentoEntrada {
  licitacaoItemId: string;
  quantidade: string;
  servicoSlug?: string | null;
  servicoNome?: string | null;
  centroDeCustoId?: string | null;
}

export interface DadosOrcamento {
  titulo: string;
  descricao?: string | null;
  bairro?: string | null;
  logradouro?: string | null;
  lat?: number | null;
  lng?: number | null;
  servicoSlug: string;
  servicoNome: string;
  centroDeCustoId?: string | null;
  itens: ItemOrcamentoEntrada[];
}

export type AcaoOrcamento = 'enviar' | 'revisar' | 'aprovar' | 'devolver' | 'cancelar';

const pessoa = { select: { id: true, name: true } } as const;

const incluirResumo = {
  createdBy: pessoa,
  revisadoPor: pessoa,
  aprovadoPor: pessoa,
  centroDeCusto: { select: { id: true, codigo: true, nome: true } },
  itens: { select: { valorTotal: true } },
  _count: { select: { fotos: true, itens: true } },
  pedidos: { select: { id: true, numero: true, status: true } },
  fotos: { select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 },
} satisfies Prisma.OrcamentoInclude;

const incluirCompleto = {
  ...incluirResumo,
  itens: {
    include: {
      centroDeCusto: { select: { id: true, codigo: true, nome: true } },
      licitacaoItem: {
        select: {
          id: true, categoria: true, quantidade: true,
          licitacao: { select: { id: true, identificacao: true, objeto: true, fornecedor: { select: { razaoSocial: true } } } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  fotos: { select: { id: true, nomeArquivo: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrcamentoInclude;

type OrcResumo = Prisma.OrcamentoGetPayload<{ include: typeof incluirResumo }>;
type OrcCompleto = Prisma.OrcamentoGetPayload<{ include: typeof incluirCompleto }>;

const zero = () => new Prisma.Decimal(0);
const iso = (d: Date | null) => d?.toISOString() ?? null;

function resumoDto(o: OrcResumo | OrcCompleto) {
  const total = (o.itens as { valorTotal: Prisma.Decimal }[]).reduce((t, i) => t.plus(i.valorTotal), zero());
  return {
    id: o.id, numero: o.numero, titulo: o.titulo, descricao: o.descricao,
    bairro: o.bairro, logradouro: o.logradouro, lat: o.lat, lng: o.lng,
    servicoSlug: o.servicoSlug, servicoNome: o.servicoNome,
    centroDeCusto: o.centroDeCusto,
    status: o.status,
    valorTotal: total.toString(),
    qtdItens: o._count.itens, qtdFotos: o._count.fotos,
    criadoEm: o.createdAt.toISOString(), criadoPor: o.createdBy.name,
    enviadoEm: iso(o.enviadoEm),
    revisadoEm: iso(o.revisadoEm), revisadoPor: o.revisadoPor?.name ?? null, revisadoPorId: o.revisadoPorId,
    aprovadoEm: iso(o.aprovadoEm), aprovadoPor: o.aprovadoPor?.name ?? null,
    devolvidoEm: iso(o.devolvidoEm), devolvidoMotivo: o.devolvidoMotivo,
    convertidoEm: iso(o.convertidoEm),
    pedidos: o.pedidos,
    capaFotoId: o.fotos[0]?.id ?? null,
  };
}

function completoDto(o: OrcCompleto) {
  return {
    ...resumoDto(o),
    itens: o.itens.map(i => ({
      id: i.id,
      licitacaoItemId: i.licitacaoItemId,
      descricao: i.descricaoSnapshot,
      unidade: i.unidadeMedidaSnapshot,
      categoria: i.licitacaoItem.categoria,
      valorUnitario: i.valorUnitarioSnapshot.toString(),
      quantidade: i.quantidade.toString(),
      valorTotal: i.valorTotal.toString(),
      servicoSlug: i.servicoSlug, servicoNome: i.servicoNome,
      centroDeCusto: i.centroDeCusto,
      licitacao: {
        id: i.licitacaoItem.licitacao.id,
        identificacao: i.licitacaoItem.licitacao.identificacao,
        objeto: i.licitacaoItem.licitacao.objeto,
        fornecedor: i.licitacaoItem.licitacao.fornecedor?.razaoSocial ?? null,
      },
    })),
    fotos: o.fotos.map(f => ({ id: f.id, nome: f.nomeArquivo, criadoEm: f.createdAt.toISOString() })),
  };
}

async function buscar(prisma: PrismaClient | Prisma.TransactionClient, entityId: string, id: string) {
  const o = await prisma.orcamento.findFirst({ where: { id, entityId }, include: incluirCompleto });
  if (!o) throw new AppError(404, 'NOT_FOUND', 'Orçamento não encontrado');
  return o;
}

export async function listarOrcamentos(prisma: PrismaClient, entityId: string, status?: OrcamentoStatus) {
  const rows = await prisma.orcamento.findMany({
    where: { entityId, ...(status ? { status } : {}) },
    include: incluirResumo,
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  return rows.map(resumoDto);
}

export async function obterOrcamento(prisma: PrismaClient, entityId: string, id: string) {
  return completoDto(await buscar(prisma, entityId, id));
}

/** Confere itens (do contrato, ativos) e centros de custo, e monta as linhas */
async function montarItens(prisma: PrismaClient | Prisma.TransactionClient, entityId: string, dados: DadosOrcamento) {
  const ids = Array.from(new Set(dados.itens.map(i => i.licitacaoItemId)));
  const licItens = await prisma.licitacaoItem.findMany({
    where: { id: { in: ids }, entityId, status: 'ACTIVE', licitacao: { status: 'ACTIVE' } },
    select: { id: true, descricao: true, unidadeMedida: true, valorUnitario: true },
  });
  if (licItens.length !== ids.length) throw new AppError(422, 'ITEM_INVALIDO', 'Um ou mais materiais não pertencem a um contrato ativo');
  await assertItensVigentes(prisma, entityId, ids);
  const centros = Array.from(new Set([dados.centroDeCustoId, ...dados.itens.map(i => i.centroDeCustoId)].filter((x): x is string => !!x)));
  if (centros.length) {
    const ok = await prisma.centroDeCusto.count({ where: { entityId, ativo: true, id: { in: centros } } });
    if (ok !== centros.length) throw new AppError(422, 'CENTRO_INVALIDO', 'Centro de custo inválido ou desativado');
  }
  const mapa = new Map(licItens.map(i => [i.id, i]));
  return dados.itens.map(i => {
    const li = mapa.get(i.licitacaoItemId)!;
    const quantidade = new Prisma.Decimal(i.quantidade);
    const vu = li.valorUnitario ?? zero();
    const servicoProprio = i.servicoSlug && i.servicoSlug !== dados.servicoSlug;
    return {
      licitacaoItemId: li.id,
      descricaoSnapshot: li.descricao,
      unidadeMedidaSnapshot: li.unidadeMedida,
      valorUnitarioSnapshot: vu,
      quantidade,
      valorTotal: quantidade.times(vu),
      servicoSlug: servicoProprio ? i.servicoSlug! : dados.servicoSlug,
      servicoNome: servicoProprio ? (i.servicoNome ?? i.servicoSlug!) : dados.servicoNome,
      centroDeCustoId: i.centroDeCustoId ?? dados.centroDeCustoId ?? null,
    };
  });
}

function cabecalho(dados: DadosOrcamento) {
  return {
    titulo: dados.titulo,
    descricao: dados.descricao ?? null,
    bairro: dados.bairro ?? null,
    logradouro: dados.logradouro ?? null,
    lat: dados.lat ?? null,
    lng: dados.lng ?? null,
    servicoSlug: dados.servicoSlug,
    servicoNome: dados.servicoNome,
    centroDeCustoId: dados.centroDeCustoId ?? null,
  };
}

export async function criarOrcamento(prisma: PrismaClient, entityId: string, userId: string, dados: DadosOrcamento) {
  const itens = await montarItens(prisma, entityId, dados);
  const ano = new Date().getFullYear();
  const seq = await proximoNumero(prisma, entityId, `ORC-${ano}`);
  const numero = `ORC-${ano}-${String(seq).padStart(4, '0')}`;
  const o = await prisma.orcamento.create({
    data: { entityId, numero, createdByUserId: userId, ...cabecalho(dados), itens: { create: itens } },
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'ORCAMENTO_CRIADO', resource: 'orcamento', newValue: { id: o.id, numero } });
  return obterOrcamento(prisma, entityId, o.id);
}

export async function atualizarOrcamento(prisma: PrismaClient, entityId: string, userId: string, id: string, dados: DadosOrcamento) {
  const atual = await buscar(prisma, entityId, id);
  if (atual.status !== 'RASCUNHO') throw new AppError(409, 'STATUS_INVALIDO', 'Só dá para alterar o orçamento enquanto ele é rascunho (ou depois de devolvido)');
  const itens = await montarItens(prisma, entityId, dados);
  await prisma.$transaction([
    prisma.orcamentoItem.deleteMany({ where: { orcamentoId: id } }),
    prisma.orcamento.update({ where: { id }, data: { ...cabecalho(dados), itens: { create: itens } } }),
  ]);
  await writeTenantAudit(prisma, { entityId, userId, action: 'ORCAMENTO_ALTERADO', resource: 'orcamento', newValue: { id, numero: atual.numero } });
  return obterOrcamento(prisma, entityId, id);
}

export async function adicionarFotos(
  prisma: PrismaClient, entityId: string, id: string,
  fotos: { nome: string; mimeType: string; dados: Buffer }[],
) {
  const o = await buscar(prisma, entityId, id);
  if (o.status === 'CONVERTIDO' || o.status === 'CANCELADO') throw new AppError(409, 'STATUS_INVALIDO', 'Este orçamento já foi encerrado');
  if (o.fotos.length + fotos.length > MAX_FOTOS_ORCAMENTO) throw new AppError(422, 'LIMITE_FOTOS', `Cada orçamento aceita até ${MAX_FOTOS_ORCAMENTO} fotos`);
  await prisma.orcamentoFoto.createMany({
    data: fotos.map(f => ({ orcamentoId: id, nomeArquivo: f.nome.slice(0, 255), mimeType: f.mimeType, tamanhoBytes: f.dados.length, dados: new Uint8Array(f.dados) })),
  });
  return obterOrcamento(prisma, entityId, id);
}

export async function lerFotoOrcamento(prisma: PrismaClient, entityId: string, fotoId: string) {
  const f = await prisma.orcamentoFoto.findFirst({ where: { id: fotoId, orcamento: { entityId } }, select: { mimeType: true, dados: true } });
  if (!f) throw new AppError(404, 'NOT_FOUND', 'Foto não encontrada');
  return { mimeType: f.mimeType, dados: Buffer.from(f.dados) };
}

export async function removerFoto(prisma: PrismaClient, entityId: string, id: string, fotoId: string) {
  const o = await buscar(prisma, entityId, id);
  if (o.status !== 'RASCUNHO') throw new AppError(409, 'STATUS_INVALIDO', 'Só dá para tirar fotos de um orçamento em rascunho');
  const r = await prisma.orcamentoFoto.deleteMany({ where: { id: fotoId, orcamentoId: id } });
  if (!r.count) throw new AppError(404, 'NOT_FOUND', 'Foto não encontrada');
  return obterOrcamento(prisma, entityId, id);
}

/** Revisão e aprovação — mesmas regras e mesmos perfis das compras */
export async function acaoOrcamento(
  prisma: PrismaClient, entityId: string,
  ator: AtorCompra,
  id: string, acao: AcaoOrcamento, motivo?: string,
) {
  const o = await buscar(prisma, entityId, id);
  const cfg = await obterConfig(prisma, entityId);
  const { podeRevisarCompra, podeAprovarCompra } = poderesCompra(ator);
  const podeOrcar = ator.admin || ator.acessos.includes('compras.orcar') || ator.acessos.includes('compras.lancar');
  const agora = new Date();
  const negar = (m: string): never => { throw new AppError(403, 'FORBIDDEN', m); };
  const invalido = (): never => { throw new AppError(409, 'STATUS_INVALIDO', `O orçamento ${o.numero} não está na etapa certa para isso`); };

  let dados: Prisma.OrcamentoUncheckedUpdateInput;
  switch (acao) {
    case 'enviar':
      if (o.status !== 'RASCUNHO') invalido();
      if (!podeOrcar) negar('Você não tem acesso para fazer orçamentos');
      if (!o.itens.length) throw new AppError(422, 'SEM_ITENS', 'Inclua ao menos um material antes de enviar');
      dados = cfg.exigeAprovacaoCompra
        ? { status: 'EM_REVISAO', enviadoEm: agora, devolvidoEm: null, devolvidoMotivo: null }
        : { status: 'APROVADO', enviadoEm: agora, aprovadoEm: agora, aprovadoPorId: ator.id, devolvidoEm: null, devolvidoMotivo: null };
      break;
    case 'revisar':
      if (o.status !== 'EM_REVISAO') invalido();
      if (!podeRevisarCompra) negar('Você não tem acesso para revisar orçamentos');
      dados = { status: 'AGUARDANDO_APROVACAO', revisadoEm: agora, revisadoPorId: ator.id };
      break;
    case 'aprovar':
      if (o.status !== 'AGUARDANDO_APROVACAO') invalido();
      if (!podeAprovarCompra) negar('Você não tem acesso para aprovar orçamentos');
      if (o.revisadoPorId === ator.id && !ator.admin) negar('Quem revisou o orçamento não pode aprová-lo');
      dados = { status: 'APROVADO', aprovadoEm: agora, aprovadoPorId: ator.id };
      break;
    case 'devolver':
      if (o.status !== 'EM_REVISAO' && o.status !== 'AGUARDANDO_APROVACAO') invalido();
      if (!podeRevisarCompra && !podeAprovarCompra) negar('Você não tem acesso para devolver orçamentos');
      if (!motivo || motivo.trim().length < 5) throw new AppError(400, 'VALIDATION_ERROR', 'Explique o motivo da devolução');
      dados = { status: 'RASCUNHO', devolvidoEm: agora, devolvidoMotivo: motivo.trim(), revisadoEm: null, revisadoPorId: null };
      break;
    case 'cancelar':
      if (o.status === 'CONVERTIDO' || o.status === 'CANCELADO') invalido();
      if (!podeOrcar && !podeAprovarCompra) negar('Você não tem acesso para cancelar orçamentos');
      dados = { status: 'CANCELADO' };
      break;
  }
  await prisma.orcamento.update({ where: { id }, data: dados! });
  await writeTenantAudit(prisma, {
    entityId, userId: ator.id, action: `ORCAMENTO_${acao.toUpperCase()}`, resource: 'orcamento',
    previousValue: { id, status: o.status }, newValue: { id, numero: o.numero, motivo: motivo ?? null },
  });
  return obterOrcamento(prisma, entityId, id);
}

/** Orçamento aprovado → um pedido de compra por contrato (tudo ou nada).
    Os pedidos nascem aprovados: a revisão já foi feita no orçamento. */
export async function gerarPedidos(prisma: PrismaClient, entityId: string, userId: string, id: string) {
  const o = await buscar(prisma, entityId, id);
  if (o.status !== 'APROVADO') throw new AppError(409, 'STATUS_INVALIDO', 'O orçamento precisa estar aprovado para virar pedido');

  const porContrato = new Map<string, OrcCompleto['itens']>();
  o.itens.forEach(i => {
    const lic = i.licitacaoItem.licitacao.id;
    porContrato.set(lic, [...(porContrato.get(lic) ?? []), i]);
  });

  const pedidos = await prisma.$transaction(async (tx) => {
    const gerados: { id: string; numero: string }[] = [];
    for (const [licitacaoId, itens] of porContrato) {
      const sol = await createSolicitacao(tx, userId, entityId, {
        servicoSlug: o.servicoSlug ?? 'orcamento',
        servicoNome: o.servicoNome ?? 'Orçamento',
        licitacaoId,
        prioridade: 'Media',
        justificativa: `Orçamento ${o.numero} — ${o.titulo}`.slice(0, 2000),
        observacoes: o.descricao,
        submit: true,
        itens: itens.map(i => ({
          licitacaoItemId: i.licitacaoItemId,
          quantidade: i.quantidade.toString(),
          servicoSlug: i.servicoSlug, servicoNome: i.servicoNome,
          centroDeCustoId: i.centroDeCustoId,
        })),
        centroDeCustoId: o.centroDeCustoId,
      });
      const agora = new Date();
      await tx.solicitacaoServico.update({ where: { id: sol.id }, data: { status: 'APPROVED', approvedAt: agora } });
      const ped = await createPedidoFromSolicitacoes(tx, userId, entityId, {
        solicitacaoIds: [sol.id],
        observacoes: `Gerado do orçamento ${o.numero} — ${o.titulo}`,
        send: false,
      });
      await tx.pedidoCompra.update({
        where: { id: ped.id },
        data: {
          orcamentoId: o.id,
          status: 'APROVADO',
          enviadoRevisaoEm: o.enviadoEm,
          revisadoEm: o.revisadoEm, revisadoPorId: o.revisadoPorId,
          aprovadoEm: o.aprovadoEm ?? agora, aprovadoPorId: o.aprovadoPorId ?? userId,
        },
      });
      gerados.push({ id: ped.id, numero: ped.numero });
    }
    await tx.orcamento.update({ where: { id }, data: { status: 'CONVERTIDO', convertidoEm: new Date() } });
    await writeTenantAudit(tx, {
      entityId, userId, action: 'ORCAMENTO_CONVERTIDO', resource: 'orcamento',
      newValue: { id, numero: o.numero, pedidos: gerados.map(p => p.numero) },
    });
    return gerados;
  }, { timeout: 30_000 });

  return { pedidos, orcamento: await obterOrcamento(prisma, entityId, id) };
}

/** Números para o topo da página */
export async function resumoOrcamentos(prisma: PrismaClient, entityId: string) {
  const grupos = await prisma.orcamento.groupBy({ by: ['status'], where: { entityId }, _count: { _all: true } });
  const conta = (s: OrcamentoStatus) => grupos.find(g => g.status === s)?._count._all ?? 0;
  const itensAbertos = await prisma.orcamentoItem.aggregate({
    where: { orcamento: { entityId, status: { in: ['RASCUNHO', 'EM_REVISAO', 'AGUARDANDO_APROVACAO', 'APROVADO'] } } },
    _sum: { valorTotal: true },
  });
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const convertidosMes = await prisma.orcamentoItem.aggregate({
    where: { orcamento: { entityId, status: 'CONVERTIDO', convertidoEm: { gte: inicioMes } } },
    _sum: { valorTotal: true },
  });
  return {
    rascunho: conta('RASCUNHO'),
    emRevisao: conta('EM_REVISAO'),
    aguardandoAprovacao: conta('AGUARDANDO_APROVACAO'),
    aprovados: conta('APROVADO'),
    convertidos: conta('CONVERTIDO'),
    valorEmAberto: (itensAbertos._sum.valorTotal ?? zero()).toString(),
    valorConvertidoMes: (convertidosMes._sum.valorTotal ?? zero()).toString(),
  };
}
