import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { hojeBrasilia } from '../../../shared/sequencia.js';

/**
 * Passos 4 e 5 — Veículos e equipamentos. Todo veículo/equipamento é ligado a
 * um ou mais serviços (tabela servico_frota, a mesma que a ficha do serviço marca).
 * A OS guarda o veículo como texto (campos "Veículo", "Veículo / Equipamento",
 * "Equipamento Utilizado", "Placa / Patrimônio"); daqui saem o uso no mês e a
 * situação, que muda sozinha:
 *   Na oficina  = há OS aberta de Oficina / Frota citando o veículo
 *   Em uso      = foi usado em alguma OS neste mês
 *   Parado      = nenhuma OS no mês
 */

export type TipoFrota = 'VEICULO' | 'EQUIPAMENTO';
const CAMPOS_VEICULO = ['Veículo', 'Veículo / Equipamento', 'Equipamento Utilizado', 'Placa / Patrimônio'];
const ABERTAS = ['AGUARDANDO_APROVACAO', 'REGISTRADA', 'EXECUTADA'] as const;

/* ── Tipos (Veículos, Máquinas, Equipamentos, Móveis…): cadastro do próprio órgão ── */

export async function listarTiposFrota(prisma: PrismaClient, entityId: string) {
  const tipos = await prisma.tipoFrota.findMany({
    where: { entityId }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    select: { id: true, nome: true, _count: { select: { itens: { where: { ativo: true } } } } },
  });
  return tipos.map(t => ({ id: t.id, nome: t.nome, usos: t._count.itens }));
}

async function nomeLivre(prisma: PrismaClient, entityId: string, nome: string, fora?: string) {
  const dup = await prisma.tipoFrota.findFirst({ where: { entityId, nome: { equals: nome, mode: 'insensitive' }, ...(fora ? { NOT: { id: fora } } : {}) } });
  if (dup) throw new AppError(409, 'CONFLICT', `O tipo "${dup.nome}" já existe`);
}

export async function criarTipoFrota(prisma: PrismaClient, entityId: string, nome: string) {
  const limpo = nome.trim();
  await nomeLivre(prisma, entityId, limpo);
  const ultimo = await prisma.tipoFrota.aggregate({ where: { entityId }, _max: { ordem: true } });
  const t = await prisma.tipoFrota.create({ data: { entityId, nome: limpo, ordem: (ultimo._max.ordem ?? 0) + 1 } });
  return { id: t.id, nome: t.nome, usos: 0 };
}

export async function renomearTipoFrota(prisma: PrismaClient, entityId: string, id: string, nome: string) {
  const t = await prisma.tipoFrota.findFirst({ where: { id, entityId } });
  if (!t) throw new AppError(404, 'NOT_FOUND', 'Tipo não encontrado');
  const limpo = nome.trim();
  await nomeLivre(prisma, entityId, limpo, id);
  await prisma.tipoFrota.update({ where: { id }, data: { nome: limpo } });
  return { id, nome: limpo };
}

/** Tipo em uso não sai: primeiro troca o tipo de quem usa */
export async function removerTipoFrota(prisma: PrismaClient, entityId: string, id: string) {
  const t = await prisma.tipoFrota.findFirst({ where: { id, entityId }, select: { nome: true, _count: { select: { itens: { where: { ativo: true } } } } } });
  if (!t) throw new AppError(404, 'NOT_FOUND', 'Tipo não encontrado');
  const n = t._count.itens;
  if (n > 0) throw new AppError(409, 'CONFLICT', `"${t.nome}" está em ${n} ${n === 1 ? 'cadastro' : 'cadastros'}. Troque o tipo deles antes de excluir.`);
  await prisma.tipoFrota.delete({ where: { id } });
  return { removido: true };
}

function chaves(item: { nome: string; placa: string | null; patrimonio: string | null }) {
  return [item.nome, item.placa, item.patrimonio].filter((x): x is string => !!x && x.trim().length > 1).map(x => x.trim().toLowerCase());
}

export async function listarFrota(prisma: PrismaClient, entityId: string, tipo: TipoFrota) {
  const hoje = hojeBrasilia();
  const inicioMes = new Date(`${hoje.slice(0, 7)}-01T03:00:00Z`);
  const [itens, contagem, equipes, valores, servicos, tiposFrota] = await Promise.all([
    prisma.cadastroAuxiliar.findMany({
      where: { entityId, tipo, ativo: true },
      orderBy: [{ nome: 'asc' }],
      select: {
        id: true, nome: true, subtipo: true, placa: true, patrimonio: true, tipoFrota: { select: { id: true, nome: true } },
        equipesComVeiculo: { select: { cadastro: { select: { id: true, nome: true, ativo: true } } } },
        servicosFrota: { where: { servico: { status: 'ACTIVE' } }, orderBy: { servico: { nome: 'asc' } }, select: { servico: { select: { id: true, nome: true, cor: true } } } },
      },
    }),
    prisma.cadastroAuxiliar.groupBy({ by: ['tipo'], where: { entityId, tipo: { in: ['VEICULO', 'EQUIPAMENTO'] }, ativo: true }, _count: { _all: true } }),
    prisma.cadastroAuxiliar.findMany({ where: { entityId, tipo: 'EQUIPE', ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    prisma.registroDiarioValor.findMany({
      where: {
        entityId, propriedade: { nome: { in: CAMPOS_VEICULO } }, valorTexto: { not: null },
        registroDiario: { OR: [{ createdAt: { gte: inicioMes } }, { etapa: { in: [...ABERTAS] } }] },
      },
      select: {
        valorTexto: true,
        registroDiario: { select: { id: true, numeroOS: true, etapa: true, createdAt: true, centroCusto: { select: { nome: true } } } },
      },
    }),
    prisma.centroCusto.findMany({ where: { entityId, status: 'ACTIVE' }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, cor: true } }),
    listarTiposFrota(prisma, entityId),
  ]);

  return {
    itens: itens.map(i => {
      const k = chaves(i);
      const cita = valores.filter(v => k.includes((v.valorTexto ?? '').trim().toLowerCase()));
      const doMes = new Set(cita.filter(v => v.registroDiario.createdAt >= inicioMes).map(v => v.registroDiario.id));
      const oficina = cita.find(v => /oficina|frota/i.test(v.registroDiario.centroCusto.nome) && (ABERTAS as readonly string[]).includes(v.registroDiario.etapa));
      const situacao = oficina ? 'NA_OFICINA' : doMes.size > 0 ? 'EM_USO' : 'PARADO';
      const equipe = i.equipesComVeiculo.map(e => e.cadastro).find(e => e.ativo) ?? null;
      return {
        id: i.id, nome: i.nome, subtipo: i.subtipo, placa: i.placa, patrimonio: i.patrimonio, tipo: i.tipoFrota,
        equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null,
        servicos: i.servicosFrota.map(v => v.servico),
        situacao, usoMes: doMes.size, osOficina: oficina?.registroDiario.numeroOS ?? null,
      };
    }),
    contagem: {
      veiculos: contagem.find(c => c.tipo === 'VEICULO')?._count._all ?? 0,
      equipamentos: contagem.find(c => c.tipo === 'EQUIPAMENTO')?._count._all ?? 0,
    },
    equipes,
    servicos,
    tiposFrota,
  };
}

export interface DadosFrota {
  tipo: TipoFrota; nome: string; subtipo?: string | null; tipoFrotaId?: string | null; placa?: string | null; patrimonio?: string | null; equipeId?: string | null;
  /** serviços que usam (ao menos um) */
  servicoIds: string[];
  vincularDepois?: boolean;
}

async function ligarEquipe(prisma: PrismaClient, entityId: string, itemId: string, equipeId: string | null | undefined) {
  // o veículo é de uma equipe só
  await prisma.equipe.updateMany({ where: { entityId, veiculoId: itemId, ...(equipeId ? { NOT: { cadastroId: equipeId } } : {}) }, data: { veiculoId: null } });
  if (!equipeId) return;
  const cad = await prisma.cadastroAuxiliar.findFirst({ where: { id: equipeId, entityId, tipo: 'EQUIPE' } });
  if (!cad) throw new AppError(400, 'VALIDATION_ERROR', 'Equipe não encontrada');
  await prisma.equipe.upsert({ where: { cadastroId: equipeId }, update: { veiculoId: itemId }, create: { entityId, cadastroId: equipeId, veiculoId: itemId } });
}

/** Troca os serviços ligados ao veículo/equipamento (precisa de ao menos um) */
async function ligarServicos(prisma: PrismaClient, entityId: string, itemId: string, servicoIds: string[]) {
  const ids = [...new Set(servicoIds)];
  if (!ids.length) throw new AppError(400, 'VALIDATION_ERROR', 'Marque ao menos um serviço que usa');
  const n = await prisma.centroCusto.count({ where: { entityId, id: { in: ids } } });
  if (n !== ids.length) throw new AppError(400, 'VALIDATION_ERROR', 'Serviço não encontrado');
  await prisma.$transaction([
    prisma.servicoFrota.deleteMany({ where: { cadastroId: itemId, NOT: { servicoId: { in: ids } } } }),
    prisma.servicoFrota.createMany({ data: ids.map(servicoId => ({ servicoId, cadastroId: itemId, entityId })), skipDuplicates: true }),
  ]);
}

function limpos(d: DadosFrota) {
  return {
    nome: d.nome.trim(),
    subtipo: d.subtipo?.trim() || null,
    placa: d.placa?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null,
    patrimonio: d.patrimonio?.trim() || null,
    tipoFrotaId: d.tipoFrotaId || null,
  };
}

async function conferirTipo(prisma: PrismaClient, entityId: string, tipoFrotaId: string | null | undefined) {
  if (!tipoFrotaId) return;
  const t = await prisma.tipoFrota.findFirst({ where: { id: tipoFrotaId, entityId } });
  if (!t) throw new AppError(400, 'VALIDATION_ERROR', 'Tipo não encontrado');
}

export async function criarFrota(prisma: PrismaClient, entityId: string, d: DadosFrota) {
  if (!d.servicoIds?.length && !d.vincularDepois) throw new AppError(400, 'VALIDATION_ERROR', 'Marque ao menos um serviço que usa');
  const v = limpos(d);
  await conferirTipo(prisma, entityId, v.tipoFrotaId);
  const existe = await prisma.cadastroAuxiliar.findFirst({ where: { entityId, tipo: d.tipo, nome: { equals: v.nome, mode: 'insensitive' } } });
  if (existe?.ativo) throw new AppError(409, 'CONFLICT', `"${v.nome}" já está cadastrado`);
  const item = existe
    ? await prisma.cadastroAuxiliar.update({ where: { id: existe.id }, data: { ...v, ativo: true } })
    : await prisma.cadastroAuxiliar.create({ data: { entityId, tipo: d.tipo, ...v } });
  if (d.tipo === 'VEICULO') await ligarEquipe(prisma, entityId, item.id, d.equipeId);
  if (d.servicoIds.length || !d.vincularDepois) await ligarServicos(prisma, entityId, item.id, d.servicoIds);
  return { id: item.id };
}

export async function atualizarFrota(prisma: PrismaClient, entityId: string, id: string, d: DadosFrota) {
  const item = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: d.tipo } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Não encontrado');
  const v = limpos(d);
  await conferirTipo(prisma, entityId, v.tipoFrotaId);
  if (v.nome.toLowerCase() !== item.nome.toLowerCase()) {
    const dup = await prisma.cadastroAuxiliar.findFirst({ where: { entityId, tipo: d.tipo, nome: { equals: v.nome, mode: 'insensitive' }, NOT: { id } } });
    if (dup) throw new AppError(409, 'CONFLICT', `"${v.nome}" já está cadastrado`);
  }
  await prisma.cadastroAuxiliar.update({ where: { id }, data: v });
  if (d.tipo === 'VEICULO') await ligarEquipe(prisma, entityId, id, d.equipeId);
  await ligarServicos(prisma, entityId, id, d.servicoIds);
  return { id };
}

/** Citado em alguma OS: fica inativo (o histórico continua); senão sai de vez */
export async function removerFrota(prisma: PrismaClient, entityId: string, id: string) {
  const item = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: { in: ['VEICULO', 'EQUIPAMENTO'] } } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Não encontrado');
  const usado = await prisma.registroDiarioValor.count({
    where: { entityId, propriedade: { nome: { in: CAMPOS_VEICULO } }, valorTexto: { in: [item.nome, item.placa ?? '', item.patrimonio ?? ''].filter(Boolean), mode: 'insensitive' } },
  });
  await prisma.equipe.updateMany({ where: { veiculoId: id }, data: { veiculoId: null } });
  if (usado) {
    await prisma.cadastroAuxiliar.update({ where: { id }, data: { ativo: false } });
    return { removido: false, desativado: true };
  }
  await prisma.cadastroAuxiliar.delete({ where: { id } });
  return { removido: true, desativado: false };
}

/** Serviços que ainda não escolheram um centro de custo (aviso do passo 5) */
export async function servicosSemCentro(prisma: PrismaClient, entityId: string) {
  return prisma.centroCusto.findMany({
    where: { entityId, status: 'ACTIVE', centroDeCustoPadraoId: null },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });
}
