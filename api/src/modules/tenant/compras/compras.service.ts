import type {
  PedidoCompraStatus,
  PrismaClient,
  SolicitacaoServicoStatus,
} from '../../../../generated/prisma/index.js';
import { Prisma } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { writeTenantAudit } from '../audit/audit.service.js';

type Tx = Prisma.TransactionClient;

const pedidoInclude = {
  createdBy: { select: { id: true, name: true } },
  itens: {
    include: {
      licitacaoItem: {
        include: {
          licitacao: { select: { id: true, identificacao: true, objeto: true } },
        },
      },
      origens: true,
      recebimentos: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

const solicitacaoInclude = {
  licitacao: { select: { id: true, identificacao: true } },
  createdBy: { select: { id: true, name: true } },
  itens: {
    include: { licitacaoItem: { select: { categoria: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

function decimal(value: string | number | Prisma.Decimal) {
  return new Prisma.Decimal(value);
}

function toDecimalString(value: { toString(): string }) {
  return value.toString();
}

async function assertSaldoDisponivel(
  tx: Tx,
  entityId: string,
  itemIds: string[],
  licitacaoItems: Array<{ id: string; descricao: string; quantidade: Prisma.Decimal | null }>,
  requestedByItemId: Map<string, Prisma.Decimal>,
) {
  const controlledItems = licitacaoItems.filter((item) => item.quantidade !== null);
  if (controlledItems.length === 0) return;

  const [solicitacoes, pedidos] = await Promise.all([
    tx.solicitacaoServicoItem.groupBy({
      by: ['licitacaoItemId'],
      where: {
        entityId,
        licitacaoItemId: { in: itemIds },
        solicitacaoServico: { status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      },
      _sum: { quantidade: true },
    }),
    tx.pedidoCompraItem.findMany({
      where: {
        entityId,
        licitacaoItemId: { in: itemIds },
        pedidoCompra: { status: { not: 'CANCELLED' } },
      },
      select: {
        licitacaoItemId: true,
        quantidadeTotal: true,
      },
    }),
  ]);

  const reservedByItemId = new Map<string, Prisma.Decimal>();
  itemIds.forEach((id) => reservedByItemId.set(id, new Prisma.Decimal(0)));

  solicitacoes.forEach((row) => {
    const current = reservedByItemId.get(row.licitacaoItemId) ?? new Prisma.Decimal(0);
    reservedByItemId.set(row.licitacaoItemId, current.plus(row._sum.quantidade ?? 0));
  });

  pedidos.forEach((item) => {
    const current = reservedByItemId.get(item.licitacaoItemId) ?? new Prisma.Decimal(0);
    reservedByItemId.set(item.licitacaoItemId, current.plus(item.quantidadeTotal));
  });

  const exceeded = controlledItems.find((item) => {
    const requested = requestedByItemId.get(item.id) ?? new Prisma.Decimal(0);
    const reserved = reservedByItemId.get(item.id) ?? new Prisma.Decimal(0);
    const available = item.quantidade!.minus(reserved);
    return requested.gt(Prisma.Decimal.max(available, 0));
  });

  if (exceeded) {
    const reserved = reservedByItemId.get(exceeded.id) ?? new Prisma.Decimal(0);
    const available = Prisma.Decimal.max(exceeded.quantidade!.minus(reserved), 0);
    throw new AppError(
      409,
      'SALDO_INSUFICIENTE',
      `Saldo insuficiente para o item "${exceeded.descricao}". Disponivel: ${available.toString()}.`,
    );
  }
}

function toSolicitacaoDto(solicitacao: Awaited<ReturnType<typeof getSolicitacaoById>>) {
  const valorTotal = solicitacao.itens.reduce(
    (sum, item) => sum.plus(item.valorTotal),
    new Prisma.Decimal(0),
  );
  return {
    id: solicitacao.id,
    numero: solicitacao.numero,
    servicoSlug: solicitacao.servicoSlug,
    servicoNome: solicitacao.servicoNome,
    licitacaoId: solicitacao.licitacaoId,
    licitacao: solicitacao.licitacao,
    status: solicitacao.status,
    prioridade: solicitacao.prioridade,
    justificativa: solicitacao.justificativa,
    observacoes: solicitacao.observacoes,
    submittedAt: solicitacao.submittedAt?.toISOString() ?? null,
    approvedAt: solicitacao.approvedAt?.toISOString() ?? null,
    createdAt: solicitacao.createdAt.toISOString(),
    updatedAt: solicitacao.updatedAt.toISOString(),
    createdBy: solicitacao.createdBy,
    valorTotal: toDecimalString(valorTotal),
    itens: solicitacao.itens.map((item) => ({
      id: item.id,
      licitacaoItemId: item.licitacaoItemId,
      categoria: item.licitacaoItem.categoria,
      descricao: item.descricaoSnapshot,
      unidadeMedida: item.unidadeMedidaSnapshot,
      valorUnitario: toDecimalString(item.valorUnitarioSnapshot),
      quantidade: toDecimalString(item.quantidade),
      valorTotal: toDecimalString(item.valorTotal),
      observacoes: item.observacoes,
    })),
  };
}

function pedidoStatusFromItens(
  itens: Array<{ quantidadeTotal: Prisma.Decimal; recebimentos: Array<{ quantidade: Prisma.Decimal }> }>,
  current: PedidoCompraStatus,
): PedidoCompraStatus {
  if (current === 'DRAFT' || current === 'CANCELLED') return current;
  const totalPedido = itens.reduce((sum, item) => sum.plus(item.quantidadeTotal), new Prisma.Decimal(0));
  const totalRecebido = itens.reduce(
    (sum, item) => sum.plus(item.recebimentos.reduce((s, r) => s.plus(r.quantidade), new Prisma.Decimal(0))),
    new Prisma.Decimal(0),
  );
  if (totalRecebido.lte(0)) return 'SENT';
  if (totalRecebido.gte(totalPedido)) return 'RECEIVED';
  return 'PARTIAL';
}

function toPedidoDto(pedido: Awaited<ReturnType<typeof getPedidoById>>) {
  const itens = pedido.itens.map((item) => {
    const quantidadeRecebida = item.recebimentos.reduce(
      (sum, recebimento) => sum.plus(recebimento.quantidade),
      new Prisma.Decimal(0),
    );
    const quantidadePendente = Prisma.Decimal.max(item.quantidadeTotal.minus(quantidadeRecebida), 0);
    return {
      id: item.id,
      licitacaoItemId: item.licitacaoItemId,
      categoria: item.licitacaoItem.categoria,
      descricao: item.descricaoSnapshot,
      unidadeMedida: item.unidadeMedidaSnapshot,
      valorUnitario: toDecimalString(item.valorUnitarioSnapshot),
      quantidadeTotal: toDecimalString(item.quantidadeTotal),
      quantidadeRecebida: toDecimalString(quantidadeRecebida),
      quantidadePendente: toDecimalString(quantidadePendente),
      valorTotal: toDecimalString(item.valorTotal),
      origens: item.origens.map((origem) => ({
        id: origem.id,
        solicitacaoServicoId: origem.solicitacaoServicoId,
        solicitacaoServicoItemId: origem.solicitacaoServicoItemId,
        servicoSlug: origem.servicoSlug,
        servicoNome: origem.servicoNome,
        quantidade: toDecimalString(origem.quantidade),
        valorTotal: toDecimalString(origem.valorTotal),
      })),
      recebimentos: item.recebimentos.map((recebimento) => ({
        id: recebimento.id,
        quantidade: toDecimalString(recebimento.quantidade),
        recebidoEm: recebimento.recebidoEm.toISOString().slice(0, 10),
        responsavel: recebimento.responsavel,
        observacoes: recebimento.observacoes,
        createdAt: recebimento.createdAt.toISOString(),
        createdBy: recebimento.createdBy,
      })),
    };
  });
  const valorTotal = pedido.itens.reduce((sum, item) => sum.plus(item.valorTotal), new Prisma.Decimal(0));
  const quantidadeTotal = pedido.itens.reduce((sum, item) => sum.plus(item.quantidadeTotal), new Prisma.Decimal(0));
  const quantidadeRecebida = pedido.itens.reduce(
    (sum, item) => sum.plus(item.recebimentos.reduce((s, r) => s.plus(r.quantidade), new Prisma.Decimal(0))),
    new Prisma.Decimal(0),
  );
  return {
    id: pedido.id,
    numero: pedido.numero,
    status: pedido.status,
    observacoes: pedido.observacoes,
    sentAt: pedido.sentAt?.toISOString() ?? null,
    createdAt: pedido.createdAt.toISOString(),
    updatedAt: pedido.updatedAt.toISOString(),
    createdBy: pedido.createdBy,
    valorTotal: toDecimalString(valorTotal),
    quantidadeTotal: toDecimalString(quantidadeTotal),
    quantidadeRecebida: toDecimalString(quantidadeRecebida),
    itens,
  };
}

async function nextNumero(prisma: Tx | PrismaClient, entityId: string, prefix: string, table: 'solicitacao' | 'pedido') {
  const year = new Date().getFullYear();
  const count = table === 'solicitacao'
    ? await prisma.solicitacaoServico.count({ where: { entityId, numero: { startsWith: `${prefix}-${year}-` } } })
    : await prisma.pedidoCompra.count({ where: { entityId, numero: { startsWith: `${prefix}-${year}-` } } });
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function getSolicitacaoById(prisma: PrismaClient | Tx, entityId: string, id: string) {
  const solicitacao = await prisma.solicitacaoServico.findFirst({
    where: { id, entityId },
    include: solicitacaoInclude,
  });
  if (!solicitacao) throw new AppError(404, 'NOT_FOUND', 'Solicitacao nao encontrada');
  return solicitacao;
}

export async function listSolicitacoes(
  prisma: PrismaClient,
  entityId: string,
  query: { servicoSlug?: string; status?: SolicitacaoServicoStatus; page: number; pageSize: number },
) {
  const where = {
    entityId,
    ...(query.servicoSlug ? { servicoSlug: query.servicoSlug } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.solicitacaoServico.count({ where }),
    prisma.solicitacaoServico.findMany({
      where,
      include: solicitacaoInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { items: rows.map(toSolicitacaoDto), total, page: query.page, pageSize: query.pageSize };
}

export async function createSolicitacao(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  body: {
    servicoSlug: string;
    servicoNome: string;
    licitacaoId: string;
    prioridade: string;
    justificativa: string;
    observacoes?: string | null;
    submit: boolean;
    itens: Array<{ licitacaoItemId: string; quantidade: string; observacoes?: string | null }>;
  },
) {
  const solicitacao = await prisma.$transaction(async (tx) => {
    const licitacao = await tx.licitacao.findFirst({
      where: { id: body.licitacaoId, entityId, status: 'ACTIVE' },
    });
    if (!licitacao) throw new AppError(422, 'LICITACAO_INVALIDA', 'Licitação ativa não encontrada');

    const itemIds = body.itens.map((item) => item.licitacaoItemId);
    const licitacaoItems = await tx.licitacaoItem.findMany({
      where: {
        id: { in: itemIds },
        licitacaoId: body.licitacaoId,
        entityId,
        status: 'ACTIVE',
      },
    });
    if (licitacaoItems.length !== new Set(itemIds).size) {
      throw new AppError(422, 'ITEM_INVALIDO', 'Um ou mais itens não pertencem à licitação selecionada');
    }
    const itemMap = new Map(licitacaoItems.map((item) => [item.id, item]));
    const requestedByItemId = new Map<string, Prisma.Decimal>();
    body.itens.forEach((input) => {
      const current = requestedByItemId.get(input.licitacaoItemId) ?? new Prisma.Decimal(0);
      requestedByItemId.set(input.licitacaoItemId, current.plus(decimal(input.quantidade)));
    });
    await assertSaldoDisponivel(tx, entityId, itemIds, licitacaoItems, requestedByItemId);

    const now = new Date();
    const numero = await nextNumero(tx, entityId, 'SS', 'solicitacao');
    const created = await tx.solicitacaoServico.create({
      data: {
        entityId,
        numero,
        servicoSlug: body.servicoSlug,
        servicoNome: body.servicoNome,
        licitacaoId: body.licitacaoId,
        prioridade: body.prioridade,
        justificativa: body.justificativa,
        observacoes: body.observacoes ?? null,
        status: body.submit ? 'SUBMITTED' : 'DRAFT',
        submittedAt: body.submit ? now : null,
        createdByUserId: actorId,
        itens: {
          create: body.itens.map((input) => {
            const licItem = itemMap.get(input.licitacaoItemId)!;
            const quantidade = decimal(input.quantidade);
            const valorUnitario = decimal(licItem.valorUnitario?.toString() ?? 0);
            return {
              entityId,
              licitacaoItemId: licItem.id,
              descricaoSnapshot: licItem.descricao,
              unidadeMedidaSnapshot: licItem.unidadeMedida,
              valorUnitarioSnapshot: valorUnitario,
              quantidade,
              valorTotal: quantidade.mul(valorUnitario),
              observacoes: input.observacoes ?? null,
            };
          }),
        },
      },
      include: solicitacaoInclude,
    });

    await writeTenantAudit(tx, {
      entityId,
      userId: actorId,
      action: body.submit ? 'SOLICITACAO_SERVICO_SUBMITTED' : 'SOLICITACAO_SERVICO_CREATED',
      resource: 'solicitacao_servico',
      newValue: { id: created.id, numero: created.numero, status: created.status },
    });

    return created;
  });
  return toSolicitacaoDto(solicitacao);
}

export async function changeSolicitacaoStatus(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  id: string,
  action: 'submit' | 'approve' | 'reject' | 'cancel',
) {
  const solicitacao = await prisma.$transaction(async (tx) => {
    const current = await getSolicitacaoById(tx, entityId, id);
    const now = new Date();
    const data: Prisma.SolicitacaoServicoUpdateInput = {};
    let auditAction = '';

    if (action === 'submit') {
      if (current.status !== 'DRAFT') throw new AppError(409, 'STATUS_INVALIDO', 'Somente rascunho pode ser enviado');
      data.status = 'SUBMITTED';
      data.submittedAt = now;
      auditAction = 'SOLICITACAO_SERVICO_SUBMITTED';
    }
    if (action === 'approve') {
      if (!['SUBMITTED', 'DRAFT'].includes(current.status)) throw new AppError(409, 'STATUS_INVALIDO', 'Solicitação não pode ser aprovada');
      data.status = 'APPROVED';
      data.approvedAt = now;
      data.submittedAt = current.submittedAt ?? now;
      auditAction = 'SOLICITACAO_SERVICO_APPROVED';
    }
    if (action === 'reject') {
      if (current.status === 'CONSOLIDATED') throw new AppError(409, 'STATUS_INVALIDO', 'Solicitação consolidada não pode ser rejeitada');
      data.status = 'REJECTED';
      auditAction = 'SOLICITACAO_SERVICO_REJECTED';
    }
    if (action === 'cancel') {
      if (current.status === 'CONSOLIDATED') throw new AppError(409, 'STATUS_INVALIDO', 'Solicitação consolidada não pode ser cancelada');
      data.status = 'CANCELLED';
      auditAction = 'SOLICITACAO_SERVICO_CANCELLED';
    }

    const updated = await tx.solicitacaoServico.update({
      where: { id },
      data,
      include: solicitacaoInclude,
    });
    await writeTenantAudit(tx, {
      entityId,
      userId: actorId,
      action: auditAction,
      resource: 'solicitacao_servico',
      previousValue: { id, status: current.status },
      newValue: { id, status: updated.status },
    });
    return updated;
  });
  return toSolicitacaoDto(solicitacao);
}

export async function deleteSolicitacao(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  id: string,
) {
  await prisma.$transaction(async (tx) => {
    const current = await getSolicitacaoById(tx, entityId, id);
    const linkedOrigins = await tx.pedidoCompraItemOrigem.findMany({
      where: { solicitacaoServicoId: id, entityId },
      select: { pedidoCompraItem: { select: { pedidoCompraId: true } } },
    });
    const pedidoIds = Array.from(new Set(linkedOrigins.map((origin) => origin.pedidoCompraItem.pedidoCompraId)));

    if (pedidoIds.length > 0) {
      await tx.pedidoCompra.deleteMany({ where: { id: { in: pedidoIds }, entityId } });
    }

    await tx.solicitacaoServico.delete({ where: { id } });
    await writeTenantAudit(tx, {
      entityId,
      userId: actorId,
      action: 'SOLICITACAO_SERVICO_DELETED',
      resource: 'solicitacao_servico',
      previousValue: { id, numero: current.numero, status: current.status, pedidoIdsRemovidos: pedidoIds },
    });
  });
}

export async function getPedidoById(prisma: PrismaClient | Tx, entityId: string, id: string) {
  const pedido = await prisma.pedidoCompra.findFirst({
    where: { id, entityId },
    include: pedidoInclude,
  });
  if (!pedido) throw new AppError(404, 'NOT_FOUND', 'Pedido de compra não encontrado');
  return pedido;
}

export async function listPedidos(
  prisma: PrismaClient,
  entityId: string,
  query: { status?: PedidoCompraStatus; page: number; pageSize: number },
) {
  const where = { entityId, ...(query.status ? { status: query.status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.pedidoCompra.count({ where }),
    prisma.pedidoCompra.findMany({
      where,
      include: pedidoInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { items: rows.map(toPedidoDto), total, page: query.page, pageSize: query.pageSize };
}

export async function createPedidoFromSolicitacoes(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  body: { solicitacaoIds: string[]; observacoes?: string | null; send: boolean },
) {
  const pedido = await prisma.$transaction(async (tx) => {
    const solicitacoes = await tx.solicitacaoServico.findMany({
      where: { id: { in: body.solicitacaoIds }, entityId },
      include: { itens: true },
    });
    if (solicitacoes.length !== new Set(body.solicitacaoIds).size) {
      throw new AppError(422, 'SOLICITACOES_INVALIDAS', 'Uma ou mais solicitações não foram encontradas');
    }
    const invalid = solicitacoes.find((solicitacao) => solicitacao.status !== 'APPROVED');
    if (invalid) {
      throw new AppError(409, 'SOLICITACAO_NAO_APROVADA', `A solicitação ${invalid.numero} não está aprovada`);
    }

    const numero = await nextNumero(tx, entityId, 'PC', 'pedido');
    const now = new Date();
    const created = await tx.pedidoCompra.create({
      data: {
        entityId,
        numero,
        status: body.send ? 'SENT' : 'DRAFT',
        sentAt: body.send ? now : null,
        observacoes: body.observacoes ?? null,
        createdByUserId: actorId,
      },
    });

    const grouped = new Map<string, {
      licitacaoItemId: string;
      descricao: string;
      unidade: string;
      valorUnitario: Prisma.Decimal;
      quantidade: Prisma.Decimal;
      valorTotal: Prisma.Decimal;
      origins: Array<{
        solicitacaoId: string;
        solicitacaoItemId: string;
        servicoSlug: string;
        servicoNome: string;
        quantidade: Prisma.Decimal;
        valorTotal: Prisma.Decimal;
      }>;
    }>();

    for (const solicitacao of solicitacoes) {
      for (const item of solicitacao.itens) {
        const current = grouped.get(item.licitacaoItemId);
        const origin = {
          solicitacaoId: solicitacao.id,
          solicitacaoItemId: item.id,
          servicoSlug: solicitacao.servicoSlug,
          servicoNome: solicitacao.servicoNome,
          quantidade: item.quantidade,
          valorTotal: item.valorTotal,
        };
        if (!current) {
          grouped.set(item.licitacaoItemId, {
            licitacaoItemId: item.licitacaoItemId,
            descricao: item.descricaoSnapshot,
            unidade: item.unidadeMedidaSnapshot,
            valorUnitario: item.valorUnitarioSnapshot,
            quantidade: item.quantidade,
            valorTotal: item.valorTotal,
            origins: [origin],
          });
        } else {
          current.quantidade = current.quantidade.plus(item.quantidade);
          current.valorTotal = current.valorTotal.plus(item.valorTotal);
          current.origins.push(origin);
        }
      }
    }

    for (const group of grouped.values()) {
      const pedidoItem = await tx.pedidoCompraItem.create({
        data: {
          entityId,
          pedidoCompraId: created.id,
          licitacaoItemId: group.licitacaoItemId,
          descricaoSnapshot: group.descricao,
          unidadeMedidaSnapshot: group.unidade,
          valorUnitarioSnapshot: group.valorUnitario,
          quantidadeTotal: group.quantidade,
          valorTotal: group.valorTotal,
        },
      });

      await tx.pedidoCompraItemOrigem.createMany({
        data: group.origins.map((origin) => ({
          entityId,
          pedidoCompraItemId: pedidoItem.id,
          solicitacaoServicoId: origin.solicitacaoId,
          solicitacaoServicoItemId: origin.solicitacaoItemId,
          servicoSlug: origin.servicoSlug,
          servicoNome: origin.servicoNome,
          quantidade: origin.quantidade,
          valorTotal: origin.valorTotal,
        })),
      });
    }

    await tx.solicitacaoServico.updateMany({
      where: { id: { in: body.solicitacaoIds }, entityId },
      data: { status: 'CONSOLIDATED' },
    });

    await writeTenantAudit(tx, {
      entityId,
      userId: actorId,
      action: body.send ? 'PEDIDO_COMPRA_CREATED_AND_SENT' : 'PEDIDO_COMPRA_CREATED',
      resource: 'pedido_compra',
      newValue: { id: created.id, numero: created.numero, solicitacaoIds: body.solicitacaoIds },
    });

    return getPedidoById(tx, entityId, created.id);
  });
  return toPedidoDto(pedido);
}

export async function sendPedido(prisma: PrismaClient, actorId: string, entityId: string, id: string) {
  const pedido = await prisma.$transaction(async (tx) => {
    const current = await getPedidoById(tx, entityId, id);
    if (current.status !== 'DRAFT') throw new AppError(409, 'STATUS_INVALIDO', 'Somente pedido em rascunho pode ser enviado');
    const updated = await tx.pedidoCompra.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
      include: pedidoInclude,
    });
    await writeTenantAudit(tx, {
      entityId,
      userId: actorId,
      action: 'PEDIDO_COMPRA_SENT',
      resource: 'pedido_compra',
      previousValue: { id, status: current.status },
      newValue: { id, status: updated.status },
    });
    return updated;
  });
  return toPedidoDto(pedido);
}

async function restoreSolicitacoesFromPedido(tx: Tx, entityId: string, pedido: Awaited<ReturnType<typeof getPedidoById>>) {
  const solicitacaoIds = Array.from(new Set(
    pedido.itens.flatMap((item) => item.origens.map((origem) => origem.solicitacaoServicoId)),
  ));
  if (solicitacaoIds.length === 0) return;
  await tx.solicitacaoServico.updateMany({
    where: { id: { in: solicitacaoIds }, entityId, status: 'CONSOLIDATED' },
    data: { status: 'APPROVED' },
  });
}

export async function cancelPedido(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  id: string,
) {
  const pedido = await prisma.$transaction(async (tx) => {
    const current = await getPedidoById(tx, entityId, id);
    if (current.status === 'CANCELLED') return current;
    await restoreSolicitacoesFromPedido(tx, entityId, current);

    const updated = await tx.pedidoCompra.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: pedidoInclude,
    });
    await writeTenantAudit(tx, {
      entityId,
      userId: actorId,
      action: 'PEDIDO_COMPRA_CANCELLED',
      resource: 'pedido_compra',
      previousValue: { id, status: current.status },
      newValue: { id, status: updated.status },
    });
    return updated;
  });
  return toPedidoDto(pedido);
}

export async function deletePedido(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  id: string,
) {
  await prisma.$transaction(async (tx) => {
    const current = await getPedidoById(tx, entityId, id);
    await restoreSolicitacoesFromPedido(tx, entityId, current);
    await tx.pedidoCompra.delete({ where: { id } });
    await writeTenantAudit(tx, {
      entityId,
      userId: actorId,
      action: 'PEDIDO_COMPRA_DELETED',
      resource: 'pedido_compra',
      previousValue: { id, numero: current.numero, status: current.status },
    });
  });
}

export async function createRecebimento(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  body: {
    pedidoCompraItemId: string;
    quantidade: string;
    recebidoEm: string;
    responsavel: string;
    observacoes?: string | null;
  },
) {
  const pedido = await prisma.$transaction(async (tx) => {
    const item = await tx.pedidoCompraItem.findFirst({
      where: { id: body.pedidoCompraItemId, entityId },
      include: { pedidoCompra: true, recebimentos: true },
    });
    if (!item) throw new AppError(404, 'NOT_FOUND', 'Item do pedido não encontrado');
    if (item.pedidoCompra.status === 'DRAFT' || item.pedidoCompra.status === 'CANCELLED') {
      throw new AppError(409, 'STATUS_INVALIDO', 'Pedido ainda não está disponível para recebimento');
    }
    const quantidade = decimal(body.quantidade);
    const jaRecebido = item.recebimentos.reduce((sum, recebimento) => sum.plus(recebimento.quantidade), new Prisma.Decimal(0));
    if (jaRecebido.plus(quantidade).gt(item.quantidadeTotal)) {
      throw new AppError(422, 'QUANTIDADE_EXCEDIDA', 'Quantidade recebida excede o total pedido');
    }

    await tx.pedidoCompraRecebimento.create({
      data: {
        entityId,
        pedidoCompraItemId: item.id,
        quantidade,
        recebidoEm: new Date(`${body.recebidoEm}T00:00:00.000Z`),
        responsavel: body.responsavel,
        observacoes: body.observacoes ?? null,
        createdByUserId: actorId,
      },
    });

    const pedidoAtual = await getPedidoById(tx, entityId, item.pedidoCompraId);
    const nextStatus = pedidoStatusFromItens(pedidoAtual.itens, pedidoAtual.status);
    const updated = await tx.pedidoCompra.update({
      where: { id: item.pedidoCompraId },
      data: { status: nextStatus },
      include: pedidoInclude,
    });

    await writeTenantAudit(tx, {
      entityId,
      userId: actorId,
      action: 'PEDIDO_COMPRA_RECEBIMENTO_CREATED',
      resource: 'pedido_compra_recebimento',
      newValue: { pedidoCompraId: item.pedidoCompraId, pedidoCompraItemId: item.id, quantidade: body.quantidade },
    });

    return updated;
  });
  return toPedidoDto(pedido);
}
