import type { PedidoCompraStatus, PrismaClient } from '../../../../generated/prisma/index.js';
import { Prisma } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { obterConfig } from '../ordens/ordens.service.js';

/* ── Pedido de compra: lançamento → revisão → aprovação → envio ao fornecedor ──
   Quem revisa e quem aprova é configurável por perfil. Quem revisou não aprova
   o mesmo pedido (separação de funções), exceto o administrador.              */

export type AcaoPedido = 'enviar_revisao' | 'revisar' | 'aprovar' | 'devolver' | 'enviar_fornecedor';

export function poderesCompra(cfg: { revisoresCompra: string[]; aprovadoresCompra: string[] }, roleCode: string) {
  return {
    podeRevisarCompra: roleCode === 'ADMIN' || cfg.revisoresCompra.includes(roleCode),
    podeAprovarCompra: roleCode === 'ADMIN' || cfg.aprovadoresCompra.includes(roleCode),
  };
}

/** Etapa em que um pedido recém-gerado deve nascer */
export async function statusInicialDoPedido(prisma: PrismaClient | Prisma.TransactionClient, entityId: string, enviar: boolean): Promise<PedidoCompraStatus> {
  if (!enviar) return 'DRAFT';
  const cfg = await obterConfig(prisma as PrismaClient, entityId);
  return cfg.exigeAprovacaoCompra ? 'EM_REVISAO' : 'SENT';
}

export async function acaoPedido(
  prisma: PrismaClient, entityId: string,
  ator: { id: string; roleCode: string; podeLancar: boolean },
  pedidoId: string, acao: AcaoPedido, motivo?: string,
) {
  const p = await prisma.pedidoCompra.findFirst({
    where: { id: pedidoId, entityId },
    select: { id: true, numero: true, status: true, revisadoPorId: true },
  });
  if (!p) throw new AppError(404, 'NOT_FOUND', 'Pedido não encontrado');
  const cfg = await obterConfig(prisma, entityId);
  const { podeRevisarCompra, podeAprovarCompra } = poderesCompra(cfg, ator.roleCode);
  const agora = new Date();
  const negar = (m: string): never => { throw new AppError(403, 'FORBIDDEN', m); };
  const invalido = (): never => { throw new AppError(409, 'STATUS_INVALIDO', `O pedido ${p.numero} não está na etapa certa para isso`); };

  let dados: Prisma.PedidoCompraUncheckedUpdateInput;
  switch (acao) {
    case 'enviar_revisao':
      if (p.status !== 'DRAFT') invalido();
      if (!ator.podeLancar) negar('Seu perfil não lança pedidos de compra');
      dados = cfg.exigeAprovacaoCompra
        ? { status: 'EM_REVISAO', enviadoRevisaoEm: agora, devolvidoMotivo: null, devolvidoEm: null }
        : { status: 'APROVADO', enviadoRevisaoEm: agora, aprovadoEm: agora, aprovadoPorId: ator.id };
      break;
    case 'revisar':
      if (p.status !== 'EM_REVISAO') invalido();
      if (!podeRevisarCompra) negar('Seu perfil não revisa pedidos de compra');
      dados = { status: 'AGUARDANDO_APROVACAO', revisadoEm: agora, revisadoPorId: ator.id };
      break;
    case 'aprovar':
      if (p.status !== 'AGUARDANDO_APROVACAO') invalido();
      if (!podeAprovarCompra) negar('Seu perfil não aprova pedidos de compra');
      if (p.revisadoPorId === ator.id && ator.roleCode !== 'ADMIN') negar('Quem revisou o pedido não pode aprová-lo');
      dados = { status: 'APROVADO', aprovadoEm: agora, aprovadoPorId: ator.id };
      break;
    case 'devolver':
      if (p.status !== 'EM_REVISAO' && p.status !== 'AGUARDANDO_APROVACAO') invalido();
      if (!podeRevisarCompra && !podeAprovarCompra) negar('Seu perfil não devolve pedidos de compra');
      if (!motivo || motivo.trim().length < 5) throw new AppError(400, 'VALIDATION_ERROR', 'Explique o motivo da devolução');
      dados = { status: 'DRAFT', devolvidoEm: agora, devolvidoMotivo: motivo.trim(), revisadoEm: null, revisadoPorId: null };
      break;
    case 'enviar_fornecedor':
      if (!(p.status === 'APROVADO' || (p.status === 'DRAFT' && !cfg.exigeAprovacaoCompra))) {
        throw new AppError(409, 'STATUS_INVALIDO', cfg.exigeAprovacaoCompra ? 'O pedido precisa ser revisado e aprovado antes de ir ao fornecedor' : 'Pedido não pode ser enviado');
      }
      if (!ator.podeLancar) negar('Seu perfil não envia pedidos ao fornecedor');
      dados = { status: 'SENT', sentAt: agora };
      break;
  }

  const novo = await prisma.pedidoCompra.update({ where: { id: p.id }, data: dados!, select: { status: true } });
  await writeTenantAudit(prisma, {
    entityId, userId: ator.id, action: `PEDIDO_COMPRA_${acao.toUpperCase()}`, resource: 'pedido_compra',
    previousValue: { id: p.id, status: p.status }, newValue: { id: p.id, numero: p.numero, status: novo.status, motivo: motivo ?? null },
  });
  return { status: novo.status };
}

/* ── Saldos dos contratos (itens das licitações) ── */

const zero = () => new Prisma.Decimal(0);

export async function saldosDasLicitacoes(prisma: PrismaClient, entityId: string) {
  const [licitacoes, reservas, pedidos, recebidos] = await Promise.all([
    prisma.licitacao.findMany({
      where: { entityId, status: 'ACTIVE' },
      select: {
        id: true, identificacao: true, objeto: true,
        fornecedor: { select: { razaoSocial: true } },
        items: {
          where: { status: 'ACTIVE' },
          select: { id: true, categoria: true, descricao: true, unidadeMedida: true, quantidade: true, valorUnitario: true },
          orderBy: { descricao: 'asc' },
        },
      },
      orderBy: { identificacao: 'asc' },
    }),
    prisma.solicitacaoServicoItem.groupBy({
      by: ['licitacaoItemId'],
      where: { entityId, solicitacaoServico: { status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } } },
      _sum: { quantidade: true },
    }),
    prisma.pedidoCompraItem.groupBy({
      by: ['licitacaoItemId'],
      where: { entityId, pedidoCompra: { status: { not: 'CANCELLED' } } },
      _sum: { quantidadeTotal: true },
    }),
    prisma.pedidoCompraRecebimento.findMany({
      where: { entityId, pedidoCompraItem: { pedidoCompra: { status: { not: 'CANCELLED' } } } },
      select: { quantidade: true, pedidoCompraItem: { select: { licitacaoItemId: true } } },
    }),
  ]);

  const mapa = (rows: { licitacaoItemId: string; q: Prisma.Decimal | null }[]) => {
    const m = new Map<string, Prisma.Decimal>();
    rows.forEach(r => m.set(r.licitacaoItemId, (m.get(r.licitacaoItemId) ?? zero()).plus(r.q ?? 0)));
    return m;
  };
  const reservado = mapa(reservas.map(r => ({ licitacaoItemId: r.licitacaoItemId, q: r._sum.quantidade })));
  const pedido = mapa(pedidos.map(r => ({ licitacaoItemId: r.licitacaoItemId, q: r._sum.quantidadeTotal })));
  const recebido = mapa(recebidos.map(r => ({ licitacaoItemId: r.pedidoCompraItem.licitacaoItemId, q: r.quantidade })));

  return licitacoes.map(l => {
    const tot = { contratado: zero(), pedido: zero(), reservado: zero(), recebido: zero() };
    const itens = l.items.map(i => {
      const vu = i.valorUnitario ?? zero();
      const ped = pedido.get(i.id) ?? zero();
      const res = reservado.get(i.id) ?? zero();
      const rec = recebido.get(i.id) ?? zero();
      const disponivel = i.quantidade ? i.quantidade.minus(ped).minus(res) : null;
      if (i.quantidade) tot.contratado = tot.contratado.plus(i.quantidade.times(vu));
      tot.pedido = tot.pedido.plus(ped.times(vu));
      tot.reservado = tot.reservado.plus(res.times(vu));
      tot.recebido = tot.recebido.plus(rec.times(vu));
      return {
        id: i.id, categoria: i.categoria, descricao: i.descricao, unidade: i.unidadeMedida,
        valorUnitario: vu.toString(),
        contratado: i.quantidade?.toString() ?? null,
        pedido: ped.toString(), reservado: res.toString(), recebido: rec.toString(),
        disponivel: disponivel?.toString() ?? null,
      };
    });
    return {
      id: l.id, identificacao: l.identificacao, objeto: l.objeto, fornecedor: l.fornecedor?.razaoSocial ?? null,
      valores: {
        contratado: tot.contratado.toString(), pedido: tot.pedido.toString(),
        reservado: tot.reservado.toString(), recebido: tot.recebido.toString(),
        disponivel: tot.contratado.minus(tot.pedido).minus(tot.reservado).toString(),
      },
      itens,
    };
  });
}
