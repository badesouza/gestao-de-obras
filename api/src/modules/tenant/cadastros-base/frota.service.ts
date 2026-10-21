import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { hojeBrasilia } from '../../../shared/sequencia.js';

/**
 * Passo 4 — Veículos e equipamentos (opcional).
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

export const TIPOS_SUGERIDOS: Record<TipoFrota, string[]> = {
  VEICULO: ['Caminhão basculante', 'Caminhão cesto aéreo', 'Caminhonete', 'Retroescavadeira', 'Patrol', 'Trator', 'Outro'],
  EQUIPAMENTO: ['Roçadeira costal', 'Roçadeira tratorizada', 'Motosserra', 'Compactador', 'Betoneira', 'Gerador', 'Outro'],
};

function chaves(item: { nome: string; placa: string | null; patrimonio: string | null }) {
  return [item.nome, item.placa, item.patrimonio].filter((x): x is string => !!x && x.trim().length > 1).map(x => x.trim().toLowerCase());
}

export async function listarFrota(prisma: PrismaClient, entityId: string, tipo: TipoFrota) {
  const hoje = hojeBrasilia();
  const inicioMes = new Date(`${hoje.slice(0, 7)}-01T03:00:00Z`);
  const [itens, contagem, equipes, valores] = await Promise.all([
    prisma.cadastroAuxiliar.findMany({
      where: { entityId, tipo, ativo: true },
      orderBy: [{ nome: 'asc' }],
      select: { id: true, nome: true, subtipo: true, placa: true, patrimonio: true, equipesComVeiculo: { select: { cadastro: { select: { id: true, nome: true, ativo: true } } } } },
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
        id: i.id, nome: i.nome, subtipo: i.subtipo, placa: i.placa, patrimonio: i.patrimonio,
        equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null,
        situacao, usoMes: doMes.size, osOficina: oficina?.registroDiario.numeroOS ?? null,
      };
    }),
    contagem: {
      veiculos: contagem.find(c => c.tipo === 'VEICULO')?._count._all ?? 0,
      equipamentos: contagem.find(c => c.tipo === 'EQUIPAMENTO')?._count._all ?? 0,
    },
    equipes,
    tipos: TIPOS_SUGERIDOS[tipo],
  };
}

export interface DadosFrota {
  tipo: TipoFrota; nome: string; subtipo?: string | null; placa?: string | null; patrimonio?: string | null; equipeId?: string | null;
}

async function ligarEquipe(prisma: PrismaClient, entityId: string, itemId: string, equipeId: string | null | undefined) {
  // o veículo é de uma equipe só
  await prisma.equipe.updateMany({ where: { entityId, veiculoId: itemId, ...(equipeId ? { NOT: { cadastroId: equipeId } } : {}) }, data: { veiculoId: null } });
  if (!equipeId) return;
  const cad = await prisma.cadastroAuxiliar.findFirst({ where: { id: equipeId, entityId, tipo: 'EQUIPE' } });
  if (!cad) throw new AppError(400, 'VALIDATION_ERROR', 'Equipe não encontrada');
  await prisma.equipe.upsert({ where: { cadastroId: equipeId }, update: { veiculoId: itemId }, create: { entityId, cadastroId: equipeId, veiculoId: itemId } });
}

function limpos(d: DadosFrota) {
  return {
    nome: d.nome.trim(),
    subtipo: d.subtipo?.trim() || null,
    placa: d.placa?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null,
    patrimonio: d.patrimonio?.trim() || null,
  };
}

export async function criarFrota(prisma: PrismaClient, entityId: string, d: DadosFrota) {
  const v = limpos(d);
  const existe = await prisma.cadastroAuxiliar.findFirst({ where: { entityId, tipo: d.tipo, nome: { equals: v.nome, mode: 'insensitive' } } });
  if (existe?.ativo) throw new AppError(409, 'CONFLICT', `"${v.nome}" já está cadastrado`);
  const item = existe
    ? await prisma.cadastroAuxiliar.update({ where: { id: existe.id }, data: { ...v, ativo: true } })
    : await prisma.cadastroAuxiliar.create({ data: { entityId, tipo: d.tipo, ...v } });
  if (d.tipo === 'VEICULO') await ligarEquipe(prisma, entityId, item.id, d.equipeId);
  return { id: item.id };
}

export async function atualizarFrota(prisma: PrismaClient, entityId: string, id: string, d: DadosFrota) {
  const item = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: d.tipo } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Não encontrado');
  const v = limpos(d);
  if (v.nome.toLowerCase() !== item.nome.toLowerCase()) {
    const dup = await prisma.cadastroAuxiliar.findFirst({ where: { entityId, tipo: d.tipo, nome: { equals: v.nome, mode: 'insensitive' }, NOT: { id } } });
    if (dup) throw new AppError(409, 'CONFLICT', `"${v.nome}" já está cadastrado`);
  }
  await prisma.cadastroAuxiliar.update({ where: { id }, data: v });
  if (d.tipo === 'VEICULO') await ligarEquipe(prisma, entityId, id, d.equipeId);
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
