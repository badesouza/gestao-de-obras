import type { EtapaOS, Prisma, PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { hojeBrasilia, proximoNumero } from '../../../shared/sequencia.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { MODELOS_SEM_EQUIPE, pode, poderesFluxo, type QuemAge } from '../../../shared/acessos.js';

/* ── Ordem de serviço: número oficial e etapas ────────────────────
   Registrada → Executada (baixa do fiscal) → Finalizada (conferência).
   Opcional: Aguardando aprovação antes de Registrada. Quem aprova e
   quem confere é configurável por entidade (por perfil).            */

export const ROTULO_ETAPA: Record<EtapaOS, string> = {
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  REGISTRADA: 'Registrada',
  EXECUTADA: 'Executada',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

export const PAPEIS_CONFIGURAVEIS = ['ADMIN', 'COORDENADOR', 'ENGINEER', 'FISCAL', 'OPERATOR'] as const;

export async function obterConfig(prisma: PrismaClient, entityId: string) {
  return prisma.configuracaoObras.upsert({ where: { entityId }, update: {}, create: { entityId } });
}

export async function salvarConfig(
  prisma: PrismaClient, entityId: string, userId: string,
  dados: {
    exigeAprovacaoOS: boolean; aprovadores: string[]; exigeConferencia: boolean; conferentes: string[]; metaDias: number;
    exigeAprovacaoCompra: boolean; revisoresCompra: string[]; aprovadoresCompra: string[];
  },
) {
  dados = { ...dados, exigeAprovacaoOS: true }; /* sempre ligado (Central de Solicitações) */
  const filtra = (l: string[]) => Array.from(new Set(l.filter(p => (PAPEIS_CONFIGURAVEIS as readonly string[]).includes(p))));
  const cfg = await prisma.configuracaoObras.upsert({
    where: { entityId },
    update: { ...dados, aprovadores: filtra(dados.aprovadores), conferentes: filtra(dados.conferentes), revisoresCompra: filtra(dados.revisoresCompra), aprovadoresCompra: filtra(dados.aprovadoresCompra) },
    create: { entityId, ...dados, aprovadores: filtra(dados.aprovadores), conferentes: filtra(dados.conferentes), revisoresCompra: filtra(dados.revisoresCompra), aprovadoresCompra: filtra(dados.aprovadoresCompra) },
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'CONFIG_OBRAS_UPDATED', resource: 'configuracao_obras', newValue: dados });
  return cfg;
}


/** Grava o rótulo da etapa na propriedade "Status" (relatórios e mapa usam esse texto) */
export async function sincronizarStatusTexto(prisma: PrismaClient, entityId: string, registroId: string, centroId: string, etapa: EtapaOS) {
  const cfgStatus = await prisma.centroCustoPropriedadeConfig.findFirst({
    where: { centroCustoId: centroId, entityId, propriedade: { nome: 'Status' } },
    select: { propriedadeId: true },
  });
  if (!cfgStatus) return;
  await prisma.registroDiarioValor.upsert({
    where: { registroDiarioId_propriedadeId: { registroDiarioId: registroId, propriedadeId: cfgStatus.propriedadeId } },
    update: { valorTexto: ROTULO_ETAPA[etapa] },
    create: { registroDiarioId: registroId, propriedadeId: cfgStatus.propriedadeId, entityId, valorTexto: ROTULO_ETAPA[etapa] },
  });
}

export const ORIGENS_OS = ['ESCRITORIO', 'MUNICIPE', 'CAMPO'] as const;
export type OrigemOS = typeof ORIGENS_OS[number];

/** Dá número oficial e a etapa inicial a uma ocorrência recém-criada.
    Tudo passa pelo crivo do responsável na Central de Solicitações:
    - escritório e campo → entram em "Aguardando aprovação";
    - munícipe → quem converteu o pedido na Central já analisou, então a OS nasce aprovada por ele. */
export async function iniciarOrdemServico(
  prisma: PrismaClient, entityId: string, registroId: string, centroId: string, origem: OrigemOS = 'ESCRITORIO', analistaId?: string,
) {
  const ano = hojeBrasilia().slice(0, 4);
  const n = await proximoNumero(prisma, entityId, `OS-${ano}`);
  const jaAnalisada = origem === 'MUNICIPE' && !!analistaId;
  const etapa: EtapaOS = jaAnalisada ? 'REGISTRADA' : 'AGUARDANDO_APROVACAO';
  await prisma.registroDiario.update({
    where: { id: registroId },
    data: {
      numeroOS: `OS ${ano}/${String(n).padStart(4, '0')}`, etapa, origem,
      ...(jaAnalisada ? { aprovadoEm: new Date(), aprovadoPorId: analistaId } : {}),
    },
  });
  await sincronizarStatusTexto(prisma, entityId, registroId, centroId, etapa);
}

export type AcaoOS = 'aprovar' | 'recusar' | 'executar' | 'finalizar' | 'reabrir' | 'cancelar';

export async function aplicarAcao(
  prisma: PrismaClient, entityId: string, ator: QuemAge & { id: string },
  registroId: string, acao: AcaoOS, observacao?: string,
) {
  const r = await prisma.registroDiario.findFirst({
    where: { id: registroId, entityId },
    select: { id: true, etapa: true, centroCustoId: true, numeroOS: true, executadoPorId: true, recusadoEm: true },
  });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Ordem de serviço não encontrada');
  await assertAcessoOS(prisma, ator, r.id, entityId);

  const cfg = await obterConfig(prisma, entityId);
  const { podeAprovar, podeConferir, podeReabrir, podeCancelar } = poderesFluxo(ator);
  const agora = new Date();
  const negar = (m: string) => { throw new AppError(403, 'FORBIDDEN', m); };
  const exigirMotivo = () => { if (!observacao || observacao.trim().length < 5) throw new AppError(400, 'VALIDATION_ERROR', 'Explique o motivo'); };
  const etapaInvalida = () => { throw new AppError(409, 'CONFLICT', `Esta OS está "${ROTULO_ETAPA[r.etapa]}" — ação não permitida agora`); };

  let dados: Prisma.RegistroDiarioUncheckedUpdateInput;
  switch (acao) {
    case 'aprovar':
      if (r.etapa !== 'AGUARDANDO_APROVACAO') etapaInvalida();
      if (!podeAprovar) negar('Você não tem acesso para aprovar ordens de serviço');
      dados = { etapa: 'REGISTRADA', aprovadoEm: agora, aprovadoPorId: ator.id };
      break;
    case 'recusar':
      /* o responsável não aprova a abertura: a OS sai como cancelada, com o motivo guardado */
      if (r.etapa !== 'AGUARDANDO_APROVACAO') etapaInvalida();
      if (!podeAprovar) negar('Você não tem acesso para recusar a abertura de ordens de serviço');
      exigirMotivo();
      dados = { etapa: 'CANCELADA', recusadoEm: agora, recusadoPorId: ator.id, motivoRecusa: observacao!.trim() };
      break;
    case 'executar':
      if (r.etapa !== 'REGISTRADA') etapaInvalida();
      if (!pode(ator, 'os.baixa')) negar('Você não tem acesso para dar baixa em ordens de serviço');
      dados = cfg.exigeConferencia
        ? { etapa: 'EXECUTADA', executadoEm: agora, executadoPorId: ator.id }
        : { etapa: 'FINALIZADA', executadoEm: agora, executadoPorId: ator.id, finalizadoEm: agora, finalizadoPorId: ator.id };
      /* baixa refeita: a devolução fica só no histórico */
      dados = { ...dados, devolvidoEm: null, motivoDevolucao: null };
      break;
    case 'finalizar':
      if (r.etapa !== 'EXECUTADA') etapaInvalida();
      if (!podeConferir) negar('Você não tem acesso para conferir a baixa');
      if (cfg.conferenciaPropriaBloqueada && r.executadoPorId === ator.id && !ator.admin) negar('Quem deu a baixa não pode conferir a própria baixa');
      dados = { etapa: 'FINALIZADA', finalizadoEm: agora, finalizadoPorId: ator.id };
      break;
    case 'reabrir':
      if (r.etapa !== 'EXECUTADA' && r.etapa !== 'FINALIZADA' && r.etapa !== 'CANCELADA') etapaInvalida();
      if (!podeReabrir) negar('Você não tem acesso para reabrir ordens de serviço');
      exigirMotivo();
      dados = { etapa: 'REGISTRADA', executadoEm: null, executadoPorId: null, finalizadoEm: null, finalizadoPorId: null };
      /* baixa devolvida para refazer: o fiscal vê o motivo no celular */
      if (r.etapa === 'EXECUTADA') dados = { ...dados, devolvidoEm: agora, motivoDevolucao: observacao!.trim() };
      /* reabrir uma abertura recusada vale como aprovação de quem reabriu */
      if (r.recusadoEm) dados = { ...dados, recusadoEm: null, recusadoPorId: null, motivoRecusa: null, aprovadoEm: agora, aprovadoPorId: ator.id };
      break;
    case 'cancelar':
      if (r.etapa === 'FINALIZADA' || r.etapa === 'CANCELADA') etapaInvalida();
      if (!podeCancelar) negar('Você não tem acesso para cancelar ordens de serviço');
      exigirMotivo();
      dados = { etapa: 'CANCELADA' };
      break;
  }

  const novo = await prisma.registroDiario.update({ where: { id: r.id }, data: { ...dados!, updatedByUserId: ator.id }, select: { etapa: true } });
  await sincronizarStatusTexto(prisma, entityId, r.id, r.centroCustoId, novo.etapa);
  await writeTenantAudit(prisma, {
    entityId, userId: ator.id, action: `OS_${acao.toUpperCase()}`, resource: 'registro_diario',
    previousValue: { etapa: r.etapa }, newValue: { id: r.id, numeroOS: r.numeroOS, etapa: novo.etapa, observacao: observacao ?? null },
  });
  return { etapa: novo.etapa };
}

/* ── vínculo usuário × serviço ──
   Administrador geral ou caixa "Ver todos os serviços" = todos.
   Fora isso, só os serviços marcados no cadastro (nenhum marcado = nenhum). */

export async function servicosDoUsuario(prisma: PrismaClient, userId: string): Promise<string[]> {
  const v = await prisma.usuarioServico.findMany({ where: { userId }, select: { centroCustoId: true } });
  return v.map(x => x.centroCustoId);
}

/** Serviços que a pessoa enxerga: null = todos */
export async function escopoServicos(prisma: PrismaClient, ator: QuemAge & { id: string }): Promise<string[] | null> {
  if (pode(ator, 'servicos.todos')) return null;
  return servicosDoUsuario(prisma, ator.id);
}

/** Equipes que limitam o que a pessoa vê: null = não depende de equipe
    (Administrador, Secretário(a) e Coordenador); senão, as equipes dela */
export async function escopoEquipes(prisma: PrismaClient, userId: string): Promise<string[] | null> {
  const u = await prisma.tenantUser.findUnique({
    where: { id: userId },
    select: { adminGeral: true, role: { select: { code: true } }, equipes: { select: { equipeId: true } } },
  });
  if (!u || u.adminGeral || MODELOS_SEM_EQUIPE.includes(u.role.code)) return null;
  return u.equipes.map(e => e.equipeId);
}

/** Filtro de OS pelo alcance da pessoa: serviços que atende E equipes dela
    (OS antiga sem equipe aparece para quem a abriu). Lista vazia não acha nada. */
export async function filtroEscopoOS(prisma: PrismaClient, ator: QuemAge & { id: string }): Promise<Prisma.RegistroDiarioWhereInput> {
  const [servicos, equipes] = await Promise.all([escopoServicos(prisma, ator), escopoEquipes(prisma, ator.id)]);
  const partes: Prisma.RegistroDiarioWhereInput[] = [];
  if (servicos) partes.push({ centroCustoId: { in: servicos } });
  if (equipes) partes.push({ OR: [{ equipeId: { in: equipes } }, { equipeId: null, createdByUserId: ator.id }] });
  return partes.length ? { AND: partes } : {};
}

/** A pessoa pode ver esta OS? (serviço e equipe) */
export async function assertAcessoOS(prisma: PrismaClient, ator: QuemAge & { id: string }, registroId: string, entityId: string) {
  const escopo = await filtroEscopoOS(prisma, ator);
  const ok = await prisma.registroDiario.count({ where: { id: registroId, entityId, ...escopo } });
  if (!ok) throw new AppError(403, 'FORBIDDEN', 'Esta OS não é dos seus serviços ou das suas equipes');
}

export async function assertAcessoServico(prisma: PrismaClient, userId: string, centroId: string) {
  const u = await prisma.tenantUser.findUnique({ where: { id: userId }, select: { adminGeral: true, acessos: true } });
  if (!u) throw new AppError(401, 'UNAUTHORIZED', 'Usuário inválido');
  const escopo = await escopoServicos(prisma, { id: userId, admin: u.adminGeral, acessos: u.acessos });
  if (escopo && !escopo.includes(centroId)) {
    throw new AppError(403, 'FORBIDDEN', 'Você não está vinculado a este serviço');
  }
}

export async function definirServicosDoUsuario(prisma: PrismaClient, entityId: string, atorId: string, userId: string, centroIds: string[]) {
  const user = await prisma.tenantUser.findFirst({ where: { id: userId, entityId }, select: { id: true } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');
  const validos = await prisma.centroCusto.findMany({ where: { entityId, id: { in: centroIds } }, select: { id: true } });
  await prisma.$transaction([
    prisma.usuarioServico.deleteMany({ where: { userId } }),
    prisma.usuarioServico.createMany({ data: validos.map(c => ({ userId, centroCustoId: c.id, entityId })) }),
  ]);
  await writeTenantAudit(prisma, { entityId, userId: atorId, action: 'USER_SERVICOS_UPDATED', resource: 'tenant_user', newValue: { userId, centroIds: validos.map(c => c.id) } });
  return validos.map(c => c.id);
}
