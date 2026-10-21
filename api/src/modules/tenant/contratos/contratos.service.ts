import type { AditivoTipo, PrismaClient } from '../../../../generated/prisma/index.js';
import { Prisma } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { hojeBrasilia } from '../../../shared/sequencia.js';
import { writeTenantAudit } from '../audit/audit.service.js';

/* ── Contratos da licitação, no padrão do Object ──────────────────
   licitação → contratos (fornecedor, vigência) → lotes → itens,
   e os aditivos: de prazo (nova vigência), de valor (reajuste dos
   preços) e de quantidade (acréscimo percentual às quantidades).
   Contrato vencido não aceita compras nem orçamentos novos.          */

type Tx = Prisma.TransactionClient;
const zero = () => new Prisma.Decimal(0);
const dia = (d: Date | null | undefined) => d ? d.toISOString().slice(0, 10) : null;
const paraData = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const LIMITE_ADITIVO_QTD = 50;
export const DIAS_AVISO_VENCIMENTO = 30;

export const MODALIDADES = [
  'PREGÃO ELETRÔNICO', 'PREGÃO PRESENCIAL', 'REGISTRO DE PREÇOS', 'CONCORRÊNCIA', 'CONCORRÊNCIA PÚBLICA',
  'TOMADA DE PREÇOS', 'CARTA CONVITE', 'DISPENSA DE LICITAÇÃO', 'INEXIGIBILIDADE DE LICITAÇÃO',
  'CREDENCIAMENTO', 'CHAMAMENTO PÚBLICO', 'CHAMADA PÚBLICA', 'CONCURSO', 'LEILÃO', 'DIALOGO COMPETITIVO',
  'CARTA CONTRATO', 'PREGÃO INTERNACIONAL', 'CONCORRÊNCIA INTERNACIONAL',
] as const;
export const TIPOS_LICITACAO = ['MATERIAL', 'SERVICO', 'COMBUSTIVEL', 'OBRA'] as const;

/* ── situação da vigência ── */
export type SituacaoVigencia = 'VIGENTE' | 'VENCENDO' | 'VENCIDO' | 'A_INICIAR';
export function situacaoVigencia(de: Date, ate: Date, hoje = hojeBrasilia()): { situacao: SituacaoVigencia; diasRestantes: number } {
  const h = paraData(hoje).getTime();
  const dias = Math.round((ate.getTime() - h) / 86_400_000);
  if (dias < 0) return { situacao: 'VENCIDO', diasRestantes: dias };
  if (de.getTime() > h) return { situacao: 'A_INICIAR', diasRestantes: dias };
  return { situacao: dias <= DIAS_AVISO_VENCIMENTO ? 'VENCENDO' : 'VIGENTE', diasRestantes: dias };
}

/** Barra itens de contrato vencido, inativo ou que ainda não começou */
export async function assertItensVigentes(prisma: PrismaClient | Tx, entityId: string, itemIds: string[]) {
  if (!itemIds.length) return;
  const itens = await prisma.licitacaoItem.findMany({
    where: { id: { in: itemIds }, entityId, contratoId: { not: null } },
    select: { descricao: true, contrato: { select: { numero: true, vigenciaDe: true, vigenciaAte: true, status: true } } },
  });
  for (const i of itens) {
    const c = i.contrato!;
    if (c.status !== 'ACTIVE') throw new AppError(422, 'CONTRATO_INATIVO', `O contrato ${c.numero} está desativado (item ${i.descricao})`);
    const { situacao } = situacaoVigencia(c.vigenciaDe, c.vigenciaAte);
    if (situacao === 'VENCIDO') throw new AppError(422, 'CONTRATO_VENCIDO', `O contrato ${c.numero} venceu em ${c.vigenciaAte.toISOString().slice(0, 10).split('-').reverse().join('/')} — faça um aditivo de prazo para usar o item ${i.descricao}`);
    if (situacao === 'A_INICIAR') throw new AppError(422, 'CONTRATO_A_INICIAR', `O contrato ${c.numero} só vale a partir de ${c.vigenciaDe.toISOString().slice(0, 10).split('-').reverse().join('/')}`);
  }
}

/* ── saldo por item ── */
async function saldoDosItens(prisma: PrismaClient | Tx, entityId: string, ids: string[]) {
  const vazio = () => ({ reservado: zero(), pedido: zero(), recebido: zero() });
  const m = new Map<string, ReturnType<typeof vazio>>();
  ids.forEach(id => m.set(id, vazio()));
  if (!ids.length) return m;
  const [res, ped, rec] = await Promise.all([
    prisma.solicitacaoServicoItem.groupBy({
      by: ['licitacaoItemId'],
      where: { entityId, licitacaoItemId: { in: ids }, solicitacaoServico: { status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } } },
      _sum: { quantidade: true },
    }),
    prisma.pedidoCompraItem.groupBy({
      by: ['licitacaoItemId'],
      where: { entityId, licitacaoItemId: { in: ids }, pedidoCompra: { status: { not: 'CANCELLED' } } },
      _sum: { quantidadeTotal: true },
    }),
    prisma.pedidoCompraRecebimento.findMany({
      where: { entityId, pedidoCompraItem: { licitacaoItemId: { in: ids }, pedidoCompra: { status: { not: 'CANCELLED' } } } },
      select: { quantidade: true, pedidoCompraItem: { select: { licitacaoItemId: true } } },
    }),
  ]);
  res.forEach(r => { m.get(r.licitacaoItemId)!.reservado = r._sum.quantidade ?? zero(); });
  ped.forEach(r => { m.get(r.licitacaoItemId)!.pedido = r._sum.quantidadeTotal ?? zero(); });
  rec.forEach(r => { const x = m.get(r.pedidoCompraItem.licitacaoItemId)!; x.recebido = x.recebido.plus(r.quantidade); });
  return m;
}

type ItemRow = Prisma.LicitacaoItemGetPayload<{ select: typeof itemSelect }>;
const itemSelect = {
  id: true, categoria: true, descricao: true, marca: true, unidadeMedida: true, quantidade: true, valorUnitario: true,
  status: true, contratoId: true, loteId: true,
} satisfies Prisma.LicitacaoItemSelect;

function itemDto(i: ItemRow, s: { reservado: Prisma.Decimal; pedido: Prisma.Decimal; recebido: Prisma.Decimal } | undefined) {
  const usado = (s?.reservado ?? zero()).plus(s?.pedido ?? zero());
  const vu = i.valorUnitario ?? zero();
  return {
    id: i.id, categoria: i.categoria, descricao: i.descricao, marca: i.marca, unidade: i.unidadeMedida,
    quantidade: i.quantidade?.toString() ?? null, valorUnitario: i.valorUnitario?.toString() ?? null,
    valorTotal: i.quantidade ? i.quantidade.times(vu).toString() : null,
    status: i.status,
    usado: usado.toString(), recebido: (s?.recebido ?? zero()).toString(),
    disponivel: i.quantidade ? i.quantidade.minus(usado).toString() : null,
    emUso: usado.gt(0),
  };
}

/* ── estrutura completa da licitação ── */
export async function estruturaDaLicitacao(prisma: PrismaClient, entityId: string, licitacaoId: string) {
  const l = await prisma.licitacao.findFirst({
    where: { id: licitacaoId, entityId },
    include: {
      fornecedor: { select: { id: true, razaoSocial: true, cnpj: true } },
      createdBy: { select: { name: true } },
      arquivos: { select: { id: true, nomeArquivo: true, tamanhoBytes: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      contratos: {
        orderBy: [{ vigenciaAte: 'desc' }, { numero: 'asc' }],
        include: {
          fornecedor: { select: { id: true, razaoSocial: true, cnpj: true, nomeFantasia: true } },
          lotes: { orderBy: { numero: 'asc' }, include: { itens: { select: itemSelect, orderBy: { descricao: 'asc' } } } },
          aditivos: {
            orderBy: { dataPublicacao: 'asc' },
            include: { lote: { select: { numero: true } }, _count: { select: { itens: true } }, createdBy: { select: { name: true } }, arquivos: { select: { id: true, nomeArquivo: true } } },
          },
          arquivos: { select: { id: true, nomeArquivo: true, tamanhoBytes: true, createdAt: true } },
        },
      },
      items: { where: { contratoId: null }, select: itemSelect, orderBy: { descricao: 'asc' } },
    },
  });
  if (!l) throw new AppError(404, 'LICITACAO_NOT_FOUND', 'Licitação não encontrada');

  const ids = [...l.items.map(i => i.id), ...l.contratos.flatMap(c => c.lotes.flatMap(lt => lt.itens.map(i => i.id)))];
  const saldo = await saldoDosItens(prisma, entityId, ids);
  const somaItens = (itens: ItemRow[]) => itens.reduce((t, i) => t.plus(i.quantidade && i.valorUnitario && i.status === 'ACTIVE' ? i.quantidade.times(i.valorUnitario) : 0), zero());
  const somaUsado = (itens: ItemRow[]) => itens.reduce((t, i) => {
    const s = saldo.get(i.id); return t.plus(s ? s.reservado.plus(s.pedido).times(i.valorUnitario ?? 0) : 0);
  }, zero());

  const contratos = l.contratos.map(c => {
    const itens = c.lotes.flatMap(lt => lt.itens);
    const vig = situacaoVigencia(c.vigenciaDe, c.vigenciaAte);
    const valorItens = somaItens(itens);
    return {
      id: c.id, numero: c.numero, status: c.status,
      fornecedor: c.fornecedor,
      vigenciaDe: dia(c.vigenciaDe), vigenciaAte: dia(c.vigenciaAte), vigenciaOriginal: dia(c.vigenciaOriginal),
      ...vig,
      valor: c.valor?.toString() ?? null,
      valorItens: valorItens.toString(),
      valorUsado: somaUsado(itens).toString(),
      valorAditivado: c.aditivos.reduce((t, a) => t.plus(a.valorAditivado), zero()).toString(),
      lotes: c.lotes.map(lt => ({
        id: lt.id, numero: lt.numero, descricao: lt.descricao,
        valor: somaItens(lt.itens).toString(),
        itens: lt.itens.map(i => itemDto(i, saldo.get(i.id))),
      })),
      aditivos: c.aditivos.map(a => ({
        id: a.id, numero: a.numero, tipo: a.tipo, dataPublicacao: dia(a.dataPublicacao),
        vigenciaAnterior: dia(a.vigenciaAnterior), novaVigencia: dia(a.novaVigencia),
        percentual: a.percentual?.toString() ?? null, lote: a.lote?.numero ?? null,
        valorAditivado: a.valorAditivado.toString(), observacao: a.observacao,
        itensAfetados: a._count.itens, criadoPor: a.createdBy.name, criadoEm: a.createdAt.toISOString(),
        arquivos: a.arquivos,
      })),
      arquivos: c.arquivos.map(d => ({ id: d.id, nome: d.nomeArquivo, tamanho: d.tamanhoBytes, criadoEm: d.createdAt.toISOString() })),
    };
  });

  const todosItens = [...l.items, ...l.contratos.flatMap(c => c.lotes.flatMap(lt => lt.itens))];
  return {
    id: l.id, identificacao: l.identificacao, objeto: l.objeto, status: l.status,
    numeroProcesso: l.numeroProcesso, modalidade: l.modalidade, tipo: l.tipo, dataHomologacao: dia(l.dataHomologacao),
    fornecedorLegado: l.fornecedor,
    criadoPor: l.createdBy.name, criadoEm: l.createdAt.toISOString(),
    arquivos: l.arquivos.map(d => ({ id: d.id, nome: d.nomeArquivo, tamanho: d.tamanhoBytes, criadoEm: d.createdAt.toISOString() })),
    resumo: {
      contratos: contratos.length,
      vigentes: contratos.filter(c => c.status === 'ACTIVE' && (c.situacao === 'VIGENTE' || c.situacao === 'VENCENDO')).length,
      vencendo: contratos.filter(c => c.status === 'ACTIVE' && c.situacao === 'VENCENDO').length,
      vencidos: contratos.filter(c => c.status === 'ACTIVE' && c.situacao === 'VENCIDO').length,
      valorGlobal: somaItens(todosItens).toString(),
      valorUsado: somaUsado(todosItens).toString(),
      itens: todosItens.filter(i => i.status === 'ACTIVE').length,
    },
    contratos,
    itensSemContrato: l.items.map(i => itemDto(i, saldo.get(i.id))),
    modalidades: MODALIDADES,
  };
}

/* ── licitação: dados do processo ── */
export interface DadosProcesso { numeroProcesso?: string | null; modalidade?: string | null; tipo?: string | null; dataHomologacao?: string | null }
export async function salvarDadosProcesso(prisma: PrismaClient, entityId: string, userId: string, licitacaoId: string, d: DadosProcesso) {
  const l = await prisma.licitacao.findFirst({ where: { id: licitacaoId, entityId }, select: { id: true } });
  if (!l) throw new AppError(404, 'LICITACAO_NOT_FOUND', 'Licitação não encontrada');
  await prisma.licitacao.update({
    where: { id: licitacaoId },
    data: {
      numeroProcesso: d.numeroProcesso ?? null, modalidade: d.modalidade ?? null, tipo: d.tipo ?? null,
      dataHomologacao: d.dataHomologacao ? paraData(d.dataHomologacao) : null,
    },
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'LICITACAO_PROCESSO_ATUALIZADO', resource: 'licitacao', newValue: { id: licitacaoId, ...d } });
}

/* ── fornecedor ── */
const soDigitos = (s: string) => s.replace(/\D/g, '');
const formatarCnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

export function cnpjValido(cnpj: string) {
  const d = soDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((t, p, i) => t + p * Number(d[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Procura o fornecedor pelo CNPJ: primeiro no cadastro, depois na Receita (BrasilAPI) */
export async function consultarCnpj(prisma: PrismaClient, entityId: string, cnpj: string) {
  const d = soDigitos(cnpj);
  if (!cnpjValido(d)) throw new AppError(400, 'CNPJ_INVALIDO', 'CNPJ inválido — confira os números');
  const fmt = formatarCnpj(d);
  const local = await prisma.fornecedor.findFirst({
    where: { entityId, OR: [{ cnpj: fmt }, { cnpj: d }] },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, telefone: true, email: true, endereco: true },
  });
  if (local) return { origem: 'cadastro' as const, fornecedor: local };
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'gestao-de-obras/1.0', Accept: 'application/json' },
    });
    if (r.status === 404) throw new AppError(404, 'CNPJ_NAO_ENCONTRADO', 'CNPJ não encontrado na Receita');
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json() as Record<string, unknown>;
    const s = (k: string) => (typeof j[k] === 'string' && (j[k] as string).trim()) || null;
    const endereco = [s('descricao_tipo_de_logradouro'), s('logradouro')].filter(Boolean).join(' ')
      + (s('numero') ? `, ${s('numero')}` : '') + (s('complemento') ? ` ${s('complemento')}` : '')
      + (s('bairro') ? ` — ${s('bairro')}` : '') + (s('municipio') ? `, ${s('municipio')}/${s('uf') ?? ''}` : '');
    return {
      origem: 'receita' as const,
      fornecedor: {
        id: null, cnpj: fmt, razaoSocial: s('razao_social') ?? '', nomeFantasia: s('nome_fantasia'),
        telefone: s('ddd_telefone_1'), email: s('email'), endereco: endereco.trim() || null,
        situacao: s('descricao_situacao_cadastral'),
      },
    };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(503, 'RECEITA_FORA', 'Não deu para consultar a Receita agora. Preencha a razão social à mão.');
  }
}

export interface FornecedorNovo { cnpj?: string | null; razaoSocial: string; nomeFantasia?: string | null; telefone?: string | null; email?: string | null; endereco?: string | null }

async function resolverFornecedor(tx: Tx, entityId: string, fornecedorId?: string | null, novo?: FornecedorNovo | null) {
  if (fornecedorId) {
    const f = await tx.fornecedor.findFirst({ where: { id: fornecedorId, entityId }, select: { id: true } });
    if (!f) throw new AppError(422, 'FORNECEDOR_INVALIDO', 'Fornecedor não encontrado');
    return f.id;
  }
  if (!novo) return null;
  let cnpj: string | null = null;
  if (novo.cnpj) {
    if (!cnpjValido(novo.cnpj)) throw new AppError(400, 'CNPJ_INVALIDO', 'CNPJ do fornecedor inválido');
    cnpj = formatarCnpj(soDigitos(novo.cnpj));
    const existe = await tx.fornecedor.findFirst({ where: { entityId, OR: [{ cnpj }, { cnpj: soDigitos(novo.cnpj) }] }, select: { id: true } });
    if (existe) return existe.id;
  }
  const f = await tx.fornecedor.create({
    data: {
      entityId, cnpj, razaoSocial: novo.razaoSocial.toUpperCase(), nomeFantasia: novo.nomeFantasia?.toUpperCase() ?? null,
      telefone: novo.telefone ?? null, email: novo.email ?? null, endereco: novo.endereco ?? null,
    },
  });
  return f.id;
}

/* ── contratos ── */
export interface DadosContrato {
  numero: string; vigenciaDe: string; vigenciaAte: string; valor?: string | null;
  fornecedorId?: string | null; fornecedorNovo?: FornecedorNovo | null;
  primeiroLote?: { numero: string; descricao?: string | null } | null;
}

function validarVigencia(de: string, ate: string) {
  if (ate < de) throw new AppError(400, 'VIGENCIA_INVALIDA', 'O fim da vigência não pode ser antes do início');
}

export async function criarContrato(prisma: PrismaClient, entityId: string, userId: string, licitacaoId: string, d: DadosContrato) {
  validarVigencia(d.vigenciaDe, d.vigenciaAte);
  const l = await prisma.licitacao.findFirst({ where: { id: licitacaoId, entityId }, select: { id: true, objeto: true, status: true } });
  if (!l) throw new AppError(404, 'LICITACAO_NOT_FOUND', 'Licitação não encontrada');
  if (l.status !== 'ACTIVE') throw new AppError(409, 'LICITACAO_INACTIVE', 'Licitação desativada');
  const numero = d.numero.trim().toUpperCase();
  const dup = await prisma.contrato.findFirst({ where: { licitacaoId, numero }, select: { id: true } });
  if (dup) throw new AppError(409, 'CONTRATO_DUPLICADO', `Já existe o contrato ${numero} nesta licitação`);
  const c = await prisma.$transaction(async (tx) => {
    const fornecedorId = await resolverFornecedor(tx, entityId, d.fornecedorId, d.fornecedorNovo);
    return tx.contrato.create({
      data: {
        entityId, licitacaoId, numero, fornecedorId, createdByUserId: userId,
        vigenciaDe: paraData(d.vigenciaDe), vigenciaAte: paraData(d.vigenciaAte),
        valor: d.valor ? new Prisma.Decimal(d.valor) : null,
        lotes: { create: [{ numero: (d.primeiroLote?.numero ?? '01').trim().toUpperCase(), descricao: d.primeiroLote?.descricao?.trim().toUpperCase() || l.objeto.slice(0, 300).toUpperCase() }] },
      },
    });
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CONTRATO_CRIADO', resource: 'contrato', newValue: { id: c.id, numero, licitacaoId } });
  return { id: c.id };
}

async function buscarContrato(prisma: PrismaClient | Tx, entityId: string, id: string) {
  const c = await prisma.contrato.findFirst({ where: { id, entityId } });
  if (!c) throw new AppError(404, 'CONTRATO_NAO_ENCONTRADO', 'Contrato não encontrado');
  return c;
}

export async function atualizarContrato(prisma: PrismaClient, entityId: string, userId: string, id: string, d: DadosContrato) {
  validarVigencia(d.vigenciaDe, d.vigenciaAte);
  const c = await buscarContrato(prisma, entityId, id);
  const numero = d.numero.trim().toUpperCase();
  if (numero !== c.numero) {
    const dup = await prisma.contrato.findFirst({ where: { licitacaoId: c.licitacaoId, numero }, select: { id: true } });
    if (dup) throw new AppError(409, 'CONTRATO_DUPLICADO', `Já existe o contrato ${numero} nesta licitação`);
  }
  await prisma.$transaction(async (tx) => {
    const fornecedorId = await resolverFornecedor(tx, entityId, d.fornecedorId, d.fornecedorNovo);
    await tx.contrato.update({
      where: { id },
      data: {
        numero, fornecedorId, vigenciaDe: paraData(d.vigenciaDe), vigenciaAte: paraData(d.vigenciaAte),
        valor: d.valor ? new Prisma.Decimal(d.valor) : null,
      },
    });
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CONTRATO_ALTERADO', resource: 'contrato', previousValue: { numero: c.numero, vigenciaAte: dia(c.vigenciaAte) }, newValue: { id, numero, vigenciaAte: d.vigenciaAte } });
}

/** Sem itens usados: apaga. Com uso: só desativa (o histórico fica). */
export async function removerContrato(prisma: PrismaClient, entityId: string, userId: string, id: string) {
  const c = await buscarContrato(prisma, entityId, id);
  const ids = (await prisma.licitacaoItem.findMany({ where: { contratoId: id }, select: { id: true } })).map(i => i.id);
  const usados = ids.length ? await prisma.licitacaoItem.count({
    where: { id: { in: ids }, OR: [{ solicitacaoServicoItens: { some: {} } }, { pedidoCompraItens: { some: {} } }, { orcamentoItens: { some: {} } }, { registroValores: { some: {} } }] },
  }) : 0;
  if (usados) {
    await prisma.contrato.update({ where: { id }, data: { status: 'INACTIVE' } });
    await writeTenantAudit(prisma, { entityId, userId, action: 'CONTRATO_DESATIVADO', resource: 'contrato', newValue: { id, numero: c.numero } });
    return { removido: false, desativado: true };
  }
  await prisma.$transaction([
    prisma.contratoAditivoItem.deleteMany({ where: { aditivo: { contratoId: id } } }),
    prisma.licitacaoItem.deleteMany({ where: { contratoId: id } }),
    prisma.contrato.delete({ where: { id } }),
  ]);
  await writeTenantAudit(prisma, { entityId, userId, action: 'CONTRATO_EXCLUIDO', resource: 'contrato', previousValue: { id, numero: c.numero } });
  return { removido: true, desativado: false };
}

export async function reativarContrato(prisma: PrismaClient, entityId: string, userId: string, id: string) {
  await buscarContrato(prisma, entityId, id);
  await prisma.contrato.update({ where: { id }, data: { status: 'ACTIVE' } });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CONTRATO_REATIVADO', resource: 'contrato', newValue: { id } });
}

/* ── lotes ── */
async function buscarLote(prisma: PrismaClient | Tx, entityId: string, id: string) {
  const lt = await prisma.contratoLote.findFirst({ where: { id, contrato: { entityId } }, include: { contrato: { select: { id: true, licitacaoId: true, status: true, numero: true } } } });
  if (!lt) throw new AppError(404, 'LOTE_NAO_ENCONTRADO', 'Lote não encontrado');
  return lt;
}

export async function criarLote(prisma: PrismaClient, entityId: string, contratoId: string, d: { numero: string; descricao?: string | null }) {
  await buscarContrato(prisma, entityId, contratoId);
  const numero = d.numero.trim().toUpperCase();
  const dup = await prisma.contratoLote.findFirst({ where: { contratoId, numero }, select: { id: true } });
  if (dup) throw new AppError(409, 'LOTE_DUPLICADO', `Já existe o lote ${numero} neste contrato`);
  const lt = await prisma.contratoLote.create({ data: { contratoId, numero, descricao: d.descricao?.trim().toUpperCase() || null } });
  return { id: lt.id };
}

export async function atualizarLote(prisma: PrismaClient, entityId: string, id: string, d: { numero: string; descricao?: string | null }) {
  const lt = await buscarLote(prisma, entityId, id);
  const numero = d.numero.trim().toUpperCase();
  if (numero !== lt.numero) {
    const dup = await prisma.contratoLote.findFirst({ where: { contratoId: lt.contratoId, numero }, select: { id: true } });
    if (dup) throw new AppError(409, 'LOTE_DUPLICADO', `Já existe o lote ${numero} neste contrato`);
  }
  await prisma.contratoLote.update({ where: { id }, data: { numero, descricao: d.descricao?.trim().toUpperCase() || null } });
}

export async function removerLote(prisma: PrismaClient, entityId: string, id: string) {
  await buscarLote(prisma, entityId, id);
  const n = await prisma.licitacaoItem.count({ where: { loteId: id } });
  if (n) throw new AppError(409, 'LOTE_COM_ITENS', 'Tire ou mova os itens antes de excluir o lote');
  await prisma.contratoLote.delete({ where: { id } });
}

/* ── itens dentro do lote ── */
export interface DadosItem { categoria?: string | null; descricao: string; marca?: string | null; unidade: string; quantidade?: string | null; valorUnitario?: string | null }

export async function adicionarItem(prisma: PrismaClient, entityId: string, userId: string, loteId: string, d: DadosItem) {
  const lt = await buscarLote(prisma, entityId, loteId);
  const i = await prisma.licitacaoItem.create({
    data: {
      entityId, licitacaoId: lt.contrato.licitacaoId, contratoId: lt.contratoId, loteId,
      categoria: d.categoria?.trim().toUpperCase() || null, descricao: d.descricao.trim().toUpperCase(), marca: d.marca?.trim().toUpperCase() || null,
      unidadeMedida: d.unidade.trim().toUpperCase(),
      quantidade: d.quantidade ? new Prisma.Decimal(d.quantidade) : null,
      valorUnitario: d.valorUnitario ? new Prisma.Decimal(d.valorUnitario) : null,
      createdByUserId: userId,
    },
  });
  return { id: i.id };
}

/** Move itens soltos (sem contrato) da mesma licitação para um lote — usado para organizar o que já existia */
export async function vincularItens(prisma: PrismaClient, entityId: string, userId: string, loteId: string, itemIds: string[]) {
  const lt = await buscarLote(prisma, entityId, loteId);
  const r = await prisma.licitacaoItem.updateMany({
    where: { id: { in: itemIds }, entityId, licitacaoId: lt.contrato.licitacaoId, contratoId: null },
    data: { contratoId: lt.contratoId, loteId },
  });
  if (r.count !== itemIds.length) throw new AppError(422, 'ITENS_INVALIDOS', 'Alguns itens não são desta licitação ou já estão em um contrato');
  await writeTenantAudit(prisma, { entityId, userId, action: 'ITENS_VINCULADOS_AO_LOTE', resource: 'contrato_lote', newValue: { loteId, itens: itemIds.length } });
  return { vinculados: r.count };
}

/** Destino da importação por planilha quando vem com ?loteId= */
export async function destinoDoLote(prisma: PrismaClient, entityId: string, licitacaoId: string, loteId: string) {
  const lt = await buscarLote(prisma, entityId, loteId);
  if (lt.contrato.licitacaoId !== licitacaoId) throw new AppError(422, 'LOTE_INVALIDO', 'O lote não é desta licitação');
  return { contratoId: lt.contratoId, loteId };
}

/* ── aditivos ── */
export interface DadosAditivo {
  tipo: AditivoTipo; numero: string; dataPublicacao: string;
  novaVigencia?: string | null; percentual?: string | null; loteId?: string | null; observacao?: string | null;
}

export async function criarAditivo(prisma: PrismaClient, entityId: string, userId: string, contratoId: string, d: DadosAditivo) {
  const c = await buscarContrato(prisma, entityId, contratoId);
  const numero = d.numero.trim().toUpperCase();
  const dup = await prisma.contratoAditivo.findFirst({ where: { contratoId, numero }, select: { id: true } });
  if (dup) throw new AppError(409, 'ADITIVO_DUPLICADO', `Já existe o aditivo ${numero} neste contrato`);
  const pct = d.percentual ? new Prisma.Decimal(d.percentual) : null;

  const aditivo = await prisma.$transaction(async (tx) => {
    const base = {
      entityId, contratoId, numero, tipo: d.tipo, dataPublicacao: paraData(d.dataPublicacao),
      observacao: d.observacao?.trim() || null, createdByUserId: userId,
    };
    if (d.tipo === 'PRAZO') {
      if (!d.novaVigencia) throw new AppError(400, 'VALIDATION_ERROR', 'Informe a nova vigência');
      const nova = paraData(d.novaVigencia);
      if (nova.getTime() <= c.vigenciaAte.getTime()) throw new AppError(400, 'VIGENCIA_INVALIDA', `A nova vigência precisa ser depois de ${dia(c.vigenciaAte)!.split('-').reverse().join('/')}`);
      await tx.contrato.update({ where: { id: contratoId }, data: { vigenciaAte: nova, vigenciaOriginal: c.vigenciaOriginal ?? c.vigenciaAte } });
      return tx.contratoAditivo.create({ data: { ...base, vigenciaAnterior: c.vigenciaAte, novaVigencia: nova } });
    }

    if (!pct || pct.isZero()) throw new AppError(400, 'VALIDATION_ERROR', 'Informe o percentual do aditivo');
    if (d.tipo === 'QUANTIDADE' && (pct.lte(0) || pct.gt(LIMITE_ADITIVO_QTD))) {
      throw new AppError(400, 'PERCENTUAL_INVALIDO', `O acréscimo de quantidade vai de 0,01% a ${LIMITE_ADITIVO_QTD}% (25% em geral; 50% para reforma)`);
    }
    if (d.tipo === 'VALOR' && (pct.lte(-100) || pct.gt(100))) throw new AppError(400, 'PERCENTUAL_INVALIDO', 'Percentual de reajuste fora do razoável');

    if (d.loteId) {
      const lt = await tx.contratoLote.findFirst({ where: { id: d.loteId, contratoId }, select: { id: true } });
      if (!lt) throw new AppError(422, 'LOTE_INVALIDO', 'O lote não é deste contrato');
    } else if (d.tipo === 'QUANTIDADE') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Escolha o lote que recebe o acréscimo');
    }
    const itens = await tx.licitacaoItem.findMany({
      where: { contratoId, status: 'ACTIVE', ...(d.loteId ? { loteId: d.loteId } : {}) },
      select: { id: true, quantidade: true, valorUnitario: true },
    });
    const fator = pct.div(100).plus(1);
    const mudancas: Prisma.ContratoAditivoItemCreateManyAditivoInput[] = [];
    let valorAditivado = zero();
    for (const i of itens) {
      if (d.tipo === 'QUANTIDADE') {
        if (!i.quantidade) continue;
        const nova = i.quantidade.times(fator).toDecimalPlaces(4);
        valorAditivado = valorAditivado.plus(nova.minus(i.quantidade).times(i.valorUnitario ?? 0));
        await tx.licitacaoItem.update({ where: { id: i.id }, data: { quantidade: nova } });
        mudancas.push({ licitacaoItemId: i.id, quantidadeAnterior: i.quantidade, quantidadeNova: nova });
      } else {
        if (!i.valorUnitario) continue;
        const novo = i.valorUnitario.times(fator).toDecimalPlaces(4);
        valorAditivado = valorAditivado.plus(novo.minus(i.valorUnitario).times(i.quantidade ?? 0));
        await tx.licitacaoItem.update({ where: { id: i.id }, data: { valorUnitario: novo } });
        mudancas.push({ licitacaoItemId: i.id, valorAnterior: i.valorUnitario, valorNovo: novo });
      }
    }
    if (!mudancas.length) throw new AppError(422, 'SEM_ITENS', d.tipo === 'QUANTIDADE' ? 'Nenhum item com quantidade neste lote' : 'Nenhum item com preço para reajustar');
    return tx.contratoAditivo.create({
      data: { ...base, percentual: pct, loteId: d.loteId ?? null, valorAditivado: valorAditivado.toDecimalPlaces(2), itens: { createMany: { data: mudancas } } },
    });
  });
  await writeTenantAudit(prisma, { entityId, userId, action: `CONTRATO_ADITIVO_${d.tipo}`, resource: 'contrato_aditivo', newValue: { id: aditivo.id, contratoId, numero, percentual: d.percentual ?? null, novaVigencia: d.novaVigencia ?? null } });
  return { id: aditivo.id, valorAditivado: aditivo.valorAditivado.toString() };
}

/** Desfaz o último aditivo do contrato (só o último, para não embaralhar o histórico) */
export async function desfazerAditivo(prisma: PrismaClient, entityId: string, userId: string, aditivoId: string) {
  const a = await prisma.contratoAditivo.findFirst({ where: { id: aditivoId, entityId }, include: { itens: true } });
  if (!a) throw new AppError(404, 'NOT_FOUND', 'Aditivo não encontrado');
  const ultimo = await prisma.contratoAditivo.findFirst({ where: { contratoId: a.contratoId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  if (ultimo?.id !== a.id) throw new AppError(409, 'NAO_E_O_ULTIMO', 'Só dá para desfazer o último aditivo do contrato');
  await prisma.$transaction(async (tx) => {
    if (a.tipo === 'PRAZO') {
      const c = await tx.contrato.findUniqueOrThrow({ where: { id: a.contratoId } });
      const voltaOriginal = c.vigenciaOriginal && a.vigenciaAnterior && c.vigenciaOriginal.getTime() === a.vigenciaAnterior.getTime();
      await tx.contrato.update({ where: { id: a.contratoId }, data: { vigenciaAte: a.vigenciaAnterior!, ...(voltaOriginal ? { vigenciaOriginal: null } : {}) } });
    }
    for (const m of a.itens) {
      if (a.tipo === 'QUANTIDADE') {
        const usado = await saldoDosItens(tx, entityId, [m.licitacaoItemId]);
        const u = usado.get(m.licitacaoItemId)!;
        if (m.quantidadeAnterior && u.reservado.plus(u.pedido).gt(m.quantidadeAnterior)) {
          throw new AppError(409, 'SALDO_JA_USADO', 'O acréscimo já foi usado em compras — não dá para desfazer');
        }
        await tx.licitacaoItem.update({ where: { id: m.licitacaoItemId }, data: { quantidade: m.quantidadeAnterior } });
      } else if (a.tipo === 'VALOR') {
        await tx.licitacaoItem.update({ where: { id: m.licitacaoItemId }, data: { valorUnitario: m.valorAnterior } });
      }
    }
    await tx.contratoAditivo.delete({ where: { id: a.id } });
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CONTRATO_ADITIVO_DESFEITO', resource: 'contrato_aditivo', previousValue: { id: a.id, numero: a.numero, tipo: a.tipo } });
}

/* ── documentos (PDF/imagem) ── */
export const TIPOS_DOCUMENTO = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export async function anexarDocumento(
  prisma: PrismaClient, entityId: string, userId: string,
  alvo: { licitacaoId?: string; contratoId?: string; aditivoId?: string },
  arq: { nome: string; mimeType: string; dados: Buffer },
) {
  if (alvo.licitacaoId && !(await prisma.licitacao.count({ where: { id: alvo.licitacaoId, entityId } }))) throw new AppError(404, 'NOT_FOUND', 'Licitação não encontrada');
  if (alvo.contratoId) await buscarContrato(prisma, entityId, alvo.contratoId);
  if (alvo.aditivoId && !(await prisma.contratoAditivo.count({ where: { id: alvo.aditivoId, entityId } }))) throw new AppError(404, 'NOT_FOUND', 'Aditivo não encontrado');
  const d = await prisma.documentoContratacao.create({
    data: { entityId, ...alvo, nomeArquivo: arq.nome.slice(0, 255), mimeType: arq.mimeType, tamanhoBytes: arq.dados.length, dados: new Uint8Array(arq.dados) },
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'DOCUMENTO_CONTRATACAO_ANEXADO', resource: 'documento_contratacao', newValue: { id: d.id, ...alvo, nome: arq.nome } });
  return { id: d.id };
}

export async function lerDocumento(prisma: PrismaClient, entityId: string, id: string) {
  const d = await prisma.documentoContratacao.findFirst({ where: { id, entityId }, select: { nomeArquivo: true, mimeType: true, dados: true } });
  if (!d) throw new AppError(404, 'NOT_FOUND', 'Documento não encontrado');
  return { nome: d.nomeArquivo, mimeType: d.mimeType, dados: Buffer.from(d.dados) };
}

export async function removerDocumento(prisma: PrismaClient, entityId: string, userId: string, id: string) {
  const r = await prisma.documentoContratacao.deleteMany({ where: { id, entityId } });
  if (!r.count) throw new AppError(404, 'NOT_FOUND', 'Documento não encontrado');
  await writeTenantAudit(prisma, { entityId, userId, action: 'DOCUMENTO_CONTRATACAO_REMOVIDO', resource: 'documento_contratacao', previousValue: { id } });
}

/* ── contratos que vencem (para a Sala de Situação e a lista de licitações) ── */
export async function contratosAVencer(prisma: PrismaClient, entityId: string) {
  const hoje = paraData(hojeBrasilia());
  const limite = new Date(hoje.getTime() + DIAS_AVISO_VENCIMENTO * 86_400_000);
  const rows = await prisma.contrato.findMany({
    where: { entityId, status: 'ACTIVE', vigenciaAte: { lte: limite }, licitacao: { status: 'ACTIVE' } },
    select: { id: true, numero: true, vigenciaDe: true, vigenciaAte: true, licitacaoId: true, licitacao: { select: { identificacao: true } }, fornecedor: { select: { razaoSocial: true } } },
    orderBy: { vigenciaAte: 'asc' },
    take: 50,
  });
  return rows.map(c => ({
    id: c.id, numero: c.numero, licitacaoId: c.licitacaoId, licitacao: c.licitacao.identificacao,
    fornecedor: c.fornecedor?.razaoSocial ?? null, vigenciaAte: dia(c.vigenciaAte),
    ...situacaoVigencia(c.vigenciaDe, c.vigenciaAte),
  }));
}
