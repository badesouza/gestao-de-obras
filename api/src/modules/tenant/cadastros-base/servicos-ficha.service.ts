import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { pode } from '../../../shared/acessos.js';
import { saldosDasLicitacoes } from '../compras/compras-fluxo.service.js';
import { obterConfig } from '../ordens/ordens.service.js';
import { writeTenantAudit } from '../audit/audit.service.js';

/**
 * Passo 6 — Serviços e a ficha de cada serviço.
 * Enquanto a ficha nunca foi salva (fichaSalvaEm nulo), cor, subtipos, campos e
 * "munícipe pode pedir" seguem os padrões que hoje estão no código das telas de
 * operação; a tela mostra esses padrões como ponto de partida.
 */

export const TIPOS_CAMPO = ['TEXTO', 'LISTA', 'NUMERO', 'SIM_NAO'] as const;
export const MOMENTOS = ['ABERTURA', 'BAIXA'] as const;

/** Quem atende o serviço: usuários ativos que abrem OS ou dão baixa e atendem este serviço (ou todos) */
async function quemAtende(prisma: PrismaClient, entityId: string) {
  return prisma.tenantUser.findMany({
    where: { entityId, status: 'ACTIVE' },
    select: {
      id: true, name: true, adminGeral: true, acessos: true, role: { select: { code: true, name: true } },
      equipe: { select: { nome: true } }, equipesLideradas: { select: { cadastroId: true } },
      servicos: { select: { centroCustoId: true } },
    },
  });
}

function atende(u: Awaited<ReturnType<typeof quemAtende>>[number], servicoId: string) {
  const faz = pode({ admin: false, acessos: u.acessos }, 'os.abrir') || pode({ admin: false, acessos: u.acessos }, 'os.baixa');
  if (!faz) return false;
  return !u.servicos.length || u.servicos.some(s => s.centroCustoId === servicoId);
}

export async function listarServicos(prisma: PrismaClient, entityId: string) {
  const [servicos, usuarios] = await Promise.all([
    prisma.centroCusto.findMany({
      where: { entityId },
      orderBy: [{ status: 'asc' }, { nome: 'asc' }],
      select: {
        id: true, nome: true, status: true, tipoServico: true, cor: true, subtipos: true, municipePode: true, fichaSalvaEm: true,
        centroDeCustoPadrao: { select: { codigo: true, nome: true } },
        _count: { select: { licitacoes: true, camposFicha: true } },
      },
    }),
    quemAtende(prisma, entityId),
  ]);
  return {
    servicos: servicos.map(s => ({
      id: s.id, nome: s.nome, ativo: s.status === 'ACTIVE', tipoServico: s.tipoServico, cor: s.cor,
      subtipos: s.subtipos.length, fichaSalva: !!s.fichaSalvaEm, municipePode: s.municipePode,
      centro: s.centroDeCustoPadrao, contratos: s._count.licitacoes, campos: s._count.camposFicha,
      pessoas: usuarios.filter(u => atende(u, s.id)).length,
    })),
  };
}

export async function obterFicha(prisma: PrismaClient, entityId: string, id: string) {
  const s = await prisma.centroCusto.findFirst({
    where: { id, entityId },
    select: {
      id: true, nome: true, status: true, tipoServico: true, cor: true, prazoDias: true, subtipos: true,
      municipePode: true, nomeMunicipe: true, fichaSalvaEm: true, centroDeCustoPadraoId: true,
      licitacoes: { select: { licitacaoId: true } },
      camposFicha: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true, detalhe: true, tipo: true, opcoes: true, momento: true, obrigatorio: true } },
    },
  });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');
  const [centros, saldos, usuarios, cfg] = await Promise.all([
    prisma.centroDeCusto.findMany({ where: { entityId, ativo: true }, orderBy: { codigo: 'asc' }, select: { id: true, codigo: true, nome: true } }),
    saldosDasLicitacoes(prisma, entityId),
    quemAtende(prisma, entityId),
    obterConfig(prisma, entityId),
  ]);
  const ligadas = new Set(s.licitacoes.map(l => l.licitacaoId));
  const licitacoes = saldos.map(l => {
    const contratado = Number(l.valores.contratado);
    const disponivel = Number(l.valores.disponivel);
    const contratos = new Map<string, { numero: string; fornecedor: string | null; vigenciaAte: string; situacao: string }>();
    l.itens.forEach(i => { if (i.contrato) contratos.set(i.contrato.id, { numero: i.contrato.numero, fornecedor: i.contrato.fornecedor, vigenciaAte: i.contrato.vigenciaAte, situacao: i.contrato.situacao }); });
    return {
      id: l.id, identificacao: l.identificacao, objeto: l.objeto, fornecedor: l.fornecedor,
      saldoPct: contratado > 0 ? Math.max(0, Math.round((disponivel / contratado) * 100)) : null,
      contratos: [...contratos.values()],
      ligada: ligadas.has(l.id),
    };
  });
  const atendem = usuarios.filter(u => atende(u, s.id)).map(u => ({
    nome: u.name, perfil: u.role.name, equipe: u.equipe?.nome ?? null, lider: u.equipesLideradas.length > 0,
    exclusivo: u.servicos.length > 0,
  }));
  const aprovam = usuarios.filter(u => !u.adminGeral && (pode({ admin: false, acessos: u.acessos }, 'os.aprovar') || pode({ admin: false, acessos: u.acessos }, 'os.conferir'))
    && (!u.servicos.length || u.servicos.some(x => x.centroCustoId === s.id))).map(u => u.name);
  return {
    id: s.id, nome: s.nome, ativo: s.status === 'ACTIVE', tipoServico: s.tipoServico, cor: s.cor, prazoDias: s.prazoDias,
    subtipos: s.subtipos, municipePode: s.municipePode, nomeMunicipe: s.nomeMunicipe, fichaSalvaEm: s.fichaSalvaEm,
    centroDeCustoId: s.centroDeCustoPadraoId, campos: s.camposFicha,
    centros, licitacoes, atendem, aprovam, metaDiasGeral: cfg.metaDias,
  };
}

export interface DadosFicha {
  nome: string; ativo: boolean; tipoServico: 'MANUTENCAO' | 'CONSTRUCAO'; cor: string | null; prazoDias: number | null;
  subtipos: string[]; municipePode: boolean; nomeMunicipe: string | null; centroDeCustoId: string | null; licitacaoIds: string[];
  campos: { nome: string; detalhe?: string | null; tipo: typeof TIPOS_CAMPO[number]; opcoes?: string[]; momento: typeof MOMENTOS[number]; obrigatorio: boolean }[];
}

export async function salvarFicha(prisma: PrismaClient, entityId: string, userId: string, id: string, d: DadosFicha) {
  const s = await prisma.centroCusto.findFirst({ where: { id, entityId } });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');
  const nome = d.nome.trim();
  if (nome.toLowerCase() !== s.nome.toLowerCase()) {
    const dup = await prisma.centroCusto.findFirst({ where: { entityId, nome: { equals: nome, mode: 'insensitive' }, NOT: { id } } });
    if (dup) throw new AppError(409, 'CONFLICT', `Já existe um serviço "${nome}"`);
  }
  if (d.centroDeCustoId) {
    const c = await prisma.centroDeCusto.findFirst({ where: { id: d.centroDeCustoId, entityId, ativo: true } });
    if (!c) throw new AppError(400, 'VALIDATION_ERROR', 'Centro de custo não encontrado');
  }
  const licitacaoIds = [...new Set(d.licitacaoIds)];
  if (licitacaoIds.length) {
    const n = await prisma.licitacao.count({ where: { entityId, id: { in: licitacaoIds } } });
    if (n !== licitacaoIds.length) throw new AppError(400, 'VALIDATION_ERROR', 'Licitação não encontrada');
  }
  const subtipos = [...new Set(d.subtipos.map(x => x.trim()).filter(Boolean))];
  const nomesCampo = d.campos.map(c => c.nome.trim().toLowerCase());
  if (nomesCampo.some(n => !n)) throw new AppError(400, 'VALIDATION_ERROR', 'Todo campo precisa de nome');
  if (new Set(nomesCampo).size !== nomesCampo.length) throw new AppError(400, 'VALIDATION_ERROR', 'Há campos com o mesmo nome');
  for (const c of d.campos) {
    if (c.tipo === 'LISTA' && !(c.opcoes ?? []).filter(o => o.trim()).length) throw new AppError(400, 'VALIDATION_ERROR', `O campo "${c.nome}" é uma lista: informe as opções`);
  }

  await prisma.$transaction(async tx => {
    await tx.centroCusto.update({
      where: { id },
      data: {
        nome, status: d.ativo ? 'ACTIVE' : 'INACTIVE', tipoServico: d.tipoServico, cor: d.cor, prazoDias: d.prazoDias,
        subtipos, municipePode: d.municipePode, nomeMunicipe: d.nomeMunicipe?.trim() || null,
        centroDeCustoPadraoId: d.centroDeCustoId, fichaSalvaEm: new Date(),
      },
    });
    await tx.centroCustoLicitacao.deleteMany({ where: { centroCustoId: id } });
    if (licitacaoIds.length) await tx.centroCustoLicitacao.createMany({ data: licitacaoIds.map(licitacaoId => ({ centroCustoId: id, licitacaoId, entityId })) });
    await tx.servicoCampo.deleteMany({ where: { servicoId: id } });
    if (d.campos.length) {
      await tx.servicoCampo.createMany({
        data: d.campos.map((c, ordem) => ({
          entityId, servicoId: id, nome: c.nome.trim(), detalhe: c.detalhe?.trim() || null, tipo: c.tipo,
          opcoes: c.tipo === 'LISTA' ? (c.opcoes ?? []).map(o => o.trim()).filter(Boolean) : [], momento: c.momento, obrigatorio: c.obrigatorio, ordem,
        })),
      });
    }
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'SERVICO_FICHA_SALVA', resource: 'servico', newValue: { id, nome, ativo: d.ativo, campos: d.campos.length, licitacoes: licitacaoIds.length } });
  return obterFicha(prisma, entityId, id);
}

export async function criarServico(prisma: PrismaClient, entityId: string, userId: string, nome: string, tipoServico: 'MANUTENCAO' | 'CONSTRUCAO') {
  const limpo = nome.trim();
  const dup = await prisma.centroCusto.findFirst({ where: { entityId, nome: { equals: limpo, mode: 'insensitive' } } });
  if (dup) throw new AppError(409, 'CONFLICT', `Já existe um serviço "${limpo}"`);
  const s = await prisma.centroCusto.create({ data: { entityId, nome: limpo, tipoServico, createdByUserId: userId, fichaSalvaEm: new Date(), municipePode: false } });
  await writeTenantAudit(prisma, { entityId, userId, action: 'SERVICO_CRIADO', resource: 'servico', newValue: { id: s.id, nome: limpo } });
  return { id: s.id };
}

/** Para a página do munícipe: o que cada serviço permite (só fichas já salvas) */
export async function servicosParaMunicipe(prisma: PrismaClient, entityId: string) {
  const s = await prisma.centroCusto.findMany({
    where: { entityId, fichaSalvaEm: { not: null } },
    select: { id: true, status: true, municipePode: true, nomeMunicipe: true },
  });
  return s.map(x => ({ id: x.id, pode: x.status === 'ACTIVE' && x.municipePode !== false, nome: x.nomeMunicipe }));
}

/** Excluir serviço criado por engano: só sai de vez se nunca teve OS;
    com OS fica inativo (apagar levaria as OS junto) e o histórico continua. */
export async function excluirServico(prisma: PrismaClient, entityId: string, userId: string, id: string) {
  const s = await prisma.centroCusto.findFirst({ where: { id, entityId }, select: { id: true, nome: true, _count: { select: { registrosDiarios: true } } } });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');
  const desativar = async () => {
    await prisma.centroCusto.update({ where: { id }, data: { status: 'INACTIVE' } });
    await writeTenantAudit(prisma, { entityId, userId, action: 'SERVICO_DESATIVADO', resource: 'servico', newValue: { id, nome: s.nome } });
    return { removido: false, desativado: true };
  };
  if (s._count.registrosDiarios > 0) return desativar();
  try {
    await prisma.centroCusto.delete({ where: { id } });
    await writeTenantAudit(prisma, { entityId, userId, action: 'SERVICO_EXCLUIDO', resource: 'servico', previousValue: { id, nome: s.nome } });
    return { removido: true, desativado: false };
  } catch (e) {
    if ((e as { code?: string }).code !== 'P2003') throw e;
    return desativar();
  }
}
