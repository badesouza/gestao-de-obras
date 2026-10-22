import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { pode, veTodosServicos } from '../../../shared/acessos.js';
import { obterConfig } from '../ordens/ordens.service.js';
import { writeTenantAudit } from '../audit/audit.service.js';

/**
 * Passo 6 — Serviços e a ficha de cada serviço.
 * Enquanto a ficha nunca foi salva (fichaSalvaEm nulo), cor, subtipos, campos e
 * "munícipe pode pedir" seguem os padrões que hoje estão no código das telas de
 * operação; a tela mostra esses padrões como ponto de partida.
 */

/** Como se preenche uma ação: LISTA = escolhe uma atividade · VARIAS = escolhe várias ·
    NUMERO = cada atividade é uma medida (ex.: "Área (m²)") · TEXTO = texto livre · SIM_NAO */
export const TIPOS_CAMPO = ['TEXTO', 'LISTA', 'VARIAS', 'NUMERO', 'SIM_NAO'] as const;
export const MOMENTOS = ['ABERTURA', 'BAIXA'] as const;
export const LOCAIS = ['ENDERECO', 'ROTA', 'LOCAL', 'VEICULO'] as const;
const COM_ATIVIDADES = new Set(['LISTA', 'VARIAS', 'NUMERO']);

/** Campos que vêm em toda OS, ajustados para cada serviço */
export interface CamposComuns {
  local: { tipo: typeof LOCAIS[number]; lista: string[] };
  origem: { usa: boolean; obrigatorio: boolean };
  equipe: { usa: boolean; obrigatorio: boolean };
  veiculo: { usa: boolean; obrigatorio: boolean };
  fotos: { usa: boolean; obrigatorio: boolean };
  observacoes: { usa: boolean; obrigatorio: boolean };
  /** Veículos e equipamentos (cadastro do passo 4) que este serviço pode usar */
  equipamentos: string[];
}

/** Quem atende o serviço: usuários ativos que abrem OS ou dão baixa e atendem este serviço (ou têm a caixa "Ver todos os serviços") */
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
  return veTodosServicos(u) || u.servicos.some(s => s.centroCustoId === servicoId);
}

export async function listarServicos(prisma: PrismaClient, entityId: string) {
  const [servicos, usuarios] = await Promise.all([
    prisma.centroCusto.findMany({
      where: { entityId },
      orderBy: [{ status: 'asc' }, { nome: 'asc' }],
      select: {
        id: true, nome: true, status: true, tipoServico: true, cor: true, subtipos: true, municipePode: true, fichaSalvaEm: true,
        centroDeCustoPadrao: { select: { codigo: true, nome: true } },
        _count: { select: { camposFicha: true } },
      },
    }),
    quemAtende(prisma, entityId),
  ]);
  return {
    servicos: servicos.map(s => ({
      id: s.id, nome: s.nome, ativo: s.status === 'ACTIVE', tipoServico: s.tipoServico, cor: s.cor,
      subtipos: s.subtipos.length, fichaSalva: !!s.fichaSalvaEm, municipePode: s.municipePode,
      centro: s.centroDeCustoPadrao, campos: s._count.camposFicha,
      pessoas: usuarios.filter(u => atende(u, s.id)).length,
    })),
  };
}

/** O que a janela do serviço precisa para escolher: centros de custo, veículos/equipamentos e origens */
export async function baseFicha(prisma: PrismaClient, entityId: string) {
  const [centros, cfg, frota] = await Promise.all([
    prisma.centroDeCusto.findMany({ where: { entityId, ativo: true }, orderBy: { codigo: 'asc' }, select: { id: true, codigo: true, nome: true, paiId: true } }),
    obterConfig(prisma, entityId),
    prisma.cadastroAuxiliar.findMany({
      where: { entityId, tipo: { in: ['VEICULO', 'EQUIPAMENTO'] }, ativo: true },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
      select: { id: true, tipo: true, nome: true, subtipo: true, placa: true, patrimonio: true },
    }),
  ]);
  return { centros, frota, origens: cfg.origensDemanda, metaDiasGeral: cfg.metaDias };
}

export async function obterFicha(prisma: PrismaClient, entityId: string, id: string) {
  const s = await prisma.centroCusto.findFirst({
    where: { id, entityId },
    select: {
      id: true, nome: true, status: true, tipoServico: true, cor: true, prazoDias: true, subtipos: true,
      municipePode: true, nomeMunicipe: true, fichaSalvaEm: true, centroDeCustoPadraoId: true, camposComuns: true,
      frota: { where: { cadastro: { ativo: true } }, select: { cadastroId: true } },
      camposFicha: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true, detalhe: true, tipo: true, opcoes: true, momento: true, obrigatorio: true } },
    },
  });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');
  const [{ centros, frota, origens, metaDiasGeral }, usuarios] = await Promise.all([baseFicha(prisma, entityId), quemAtende(prisma, entityId)]);
  const atendem = usuarios.filter(u => atende(u, s.id)).map(u => ({
    nome: u.name, perfil: u.role.name, equipe: u.equipe?.nome ?? null, lider: u.equipesLideradas.length > 0,
    exclusivo: !veTodosServicos(u),
  }));
  const aprovam = usuarios.filter(u => !u.adminGeral && (pode({ admin: false, acessos: u.acessos }, 'os.aprovar') || pode({ admin: false, acessos: u.acessos }, 'os.conferir'))
    && (veTodosServicos(u) || u.servicos.some(x => x.centroCustoId === s.id))).map(u => u.name);
  /* veículos e equipamentos: vale o vínculo (servico_frota), que também é marcado no cadastro de cada um */
  const frotaVinculada = s.frota.map(f => f.cadastroId);
  const salvos = (s.camposComuns ?? null) as CamposComuns | null;
  const camposComuns: CamposComuns | null = salvos && {
    ...salvos, equipamentos: frotaVinculada,
    veiculo: { usa: frotaVinculada.length > 0, obrigatorio: frotaVinculada.length > 0 && !!salvos.veiculo?.obrigatorio },
  };
  return {
    id: s.id, nome: s.nome, ativo: s.status === 'ACTIVE', tipoServico: s.tipoServico, cor: s.cor, prazoDias: s.prazoDias,
    subtipos: s.subtipos, municipePode: s.municipePode, nomeMunicipe: s.nomeMunicipe, fichaSalvaEm: s.fichaSalvaEm,
    centroDeCustoId: s.centroDeCustoPadraoId, campos: s.camposFicha, camposComuns, frotaVinculada,
    centros, frota, origens, atendem, aprovam, metaDiasGeral,
  };
}

export interface DadosFicha {
  nome: string; ativo: boolean; tipoServico: 'MANUTENCAO' | 'CONSTRUCAO'; cor: string | null; prazoDias: number | null;
  subtipos: string[]; municipePode: boolean; nomeMunicipe: string | null; centroDeCustoId: string | null;
  camposComuns: CamposComuns;
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
  const equipamentos = [...new Set(d.camposComuns.equipamentos)];
  if (equipamentos.length) {
    const n = await prisma.cadastroAuxiliar.count({ where: { entityId, id: { in: equipamentos }, tipo: { in: ['VEICULO', 'EQUIPAMENTO'] } } });
    if (n !== equipamentos.length) throw new AppError(400, 'VALIDATION_ERROR', 'Há veículo ou equipamento que não está no cadastro');
  }
  const local = d.camposComuns.local;
  const lista = [...new Set(local.lista.map(x => x.trim()).filter(Boolean))];
  if ((local.tipo === 'ROTA' || local.tipo === 'LOCAL') && !lista.length) {
    throw new AppError(400, 'VALIDATION_ERROR', local.tipo === 'ROTA' ? 'Cadastre ao menos uma rota' : 'Cadastre ao menos um local');
  }
  const camposComuns: CamposComuns = { ...d.camposComuns, local: { tipo: local.tipo, lista: local.tipo === 'ROTA' || local.tipo === 'LOCAL' ? lista : [] }, equipamentos };
  const subtipos = [...new Set(d.subtipos.map(x => x.trim()).filter(Boolean))];
  const nomesCampo = d.campos.map(c => c.nome.trim().toLowerCase());
  if (nomesCampo.some(n => !n)) throw new AppError(400, 'VALIDATION_ERROR', 'Toda ação precisa de nome');
  if (new Set(nomesCampo).size !== nomesCampo.length) throw new AppError(400, 'VALIDATION_ERROR', 'Há ações com o mesmo nome');
  for (const c of d.campos) {
    if ((c.tipo === 'LISTA' || c.tipo === 'VARIAS') && !(c.opcoes ?? []).filter(o => o.trim()).length) throw new AppError(400, 'VALIDATION_ERROR', `A ação "${c.nome}" precisa de ao menos uma atividade`);
  }

  await prisma.$transaction(async tx => {
    await tx.centroCusto.update({
      where: { id },
      data: {
        nome, status: d.ativo ? 'ACTIVE' : 'INACTIVE', tipoServico: d.tipoServico, cor: d.cor, prazoDias: d.prazoDias,
        subtipos, municipePode: d.municipePode, nomeMunicipe: d.nomeMunicipe?.trim() || null,
        centroDeCustoPadraoId: d.centroDeCustoId, fichaSalvaEm: new Date(), camposComuns: camposComuns as object,
      },
    });
    await tx.servicoFrota.deleteMany({ where: { servicoId: id, NOT: { cadastroId: { in: equipamentos } } } });
    if (equipamentos.length) await tx.servicoFrota.createMany({ data: equipamentos.map(cadastroId => ({ servicoId: id, cadastroId, entityId })), skipDuplicates: true });
    await tx.servicoCampo.deleteMany({ where: { servicoId: id } });
    if (d.campos.length) {
      await tx.servicoCampo.createMany({
        data: d.campos.map((c, ordem) => ({
          entityId, servicoId: id, nome: c.nome.trim(), detalhe: c.detalhe?.trim() || null, tipo: c.tipo,
          opcoes: COM_ATIVIDADES.has(c.tipo) ? [...new Set((c.opcoes ?? []).map(o => o.trim()).filter(Boolean))] : [], momento: c.momento, obrigatorio: c.obrigatorio, ordem,
        })),
      });
    }
  });
  await writeTenantAudit(prisma, { entityId, userId, action: 'SERVICO_FICHA_SALVA', resource: 'servico', newValue: { id, nome, ativo: d.ativo, acoes: d.campos.length, local: camposComuns.local.tipo, equipamentos: equipamentos.length } });
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

/** Origens da demanda: uma lista só, vale para todos os serviços */
export async function salvarOrigens(prisma: PrismaClient, entityId: string, userId: string, origens: string[]) {
  const lista = [...new Set(origens.map(o => o.trim()).filter(Boolean))];
  if (!lista.length) throw new AppError(400, 'VALIDATION_ERROR', 'Deixe ao menos uma origem na lista');
  await obterConfig(prisma, entityId);
  await prisma.configuracaoObras.update({ where: { entityId }, data: { origensDemanda: lista } });
  await writeTenantAudit(prisma, { entityId, userId, action: 'ORIGENS_DEMANDA_SALVAS', resource: 'configuracao_obras', newValue: { origens: lista } });
  return { origens: lista };
}
