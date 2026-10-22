import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';

/**
 * Módulo 1 — Cadastros guiados em 7 passos.
 * Aqui ficam o resumo dos passos (Início dos Cadastros), o Órgão e os Lugares.
 */

export type SituacaoPasso = 'ok' | 'warn' | 'opt';

export interface PassoResumo {
  n: number;
  chave: 'orgao' | 'lugares' | 'pessoas' | 'veiculos' | 'equipamentos' | 'centros' | 'servicos';
  situacao: SituacaoPasso;
  contagem: string;
  aviso: string | null;
  avisoLeve: boolean;
}

const ETAPAS_ABERTAS = ['AGUARDANDO_APROVACAO', 'REGISTRADA', 'EXECUTADA'] as const;
const PROP_BAIRRO = 'Bairro / Localidade';

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Situação dos 7 passos do cadastro, calculada a partir do que já existe no banco */
export async function resumoCadastros(prisma: PrismaClient, entityId: string) {
  const [entity, macrozonas, bairros, bairrosSemPonto, usuarios, equipes, veiculos, equipamentos, centros, servicos, servicosSemCentro, veiculosSemServico, equipamentosSemServico] =
    await Promise.all([
      prisma.entity.findUnique({ where: { id: entityId }, select: { name: true } }),
      prisma.cadastroAuxiliar.count({ where: { entityId, tipo: 'MACROZONA', ativo: true } }),
      prisma.cadastroAuxiliar.count({ where: { entityId, tipo: 'BAIRRO', ativo: true } }),
      prisma.cadastroAuxiliar.count({ where: { entityId, tipo: 'BAIRRO', ativo: true, OR: [{ lat: null }, { lng: null }] } }),
      prisma.tenantUser.count({ where: { entityId, status: 'ACTIVE' } }),
      prisma.cadastroAuxiliar.findMany({ where: { entityId, tipo: 'EQUIPE', ativo: true }, select: { equipe: { select: { liderUserId: true } } } }),
      prisma.cadastroAuxiliar.count({ where: { entityId, tipo: 'VEICULO', ativo: true } }),
      prisma.cadastroAuxiliar.count({ where: { entityId, tipo: 'EQUIPAMENTO', ativo: true } }),
      prisma.centroDeCusto.count({ where: { entityId, ativo: true } }),
      prisma.centroCusto.count({ where: { entityId, status: 'ACTIVE' } }),
      prisma.centroCusto.count({ where: { entityId, status: 'ACTIVE', centroDeCustoPadraoId: null } }),
      prisma.cadastroAuxiliar.count({ where: { entityId, tipo: 'VEICULO', ativo: true, servicosFrota: { none: { servico: { status: 'ACTIVE' } } } } }),
      prisma.cadastroAuxiliar.count({ where: { entityId, tipo: 'EQUIPAMENTO', ativo: true, servicosFrota: { none: { servico: { status: 'ACTIVE' } } } } }),
    ]);

  const equipesSemLider = equipes.filter(e => !e.equipe?.liderUserId).length;

  const passos: PassoResumo[] = [
    {
      n: 1, chave: 'orgao',
      situacao: entity?.name ? 'ok' : 'warn',
      contagem: entity?.name ?? 'Sem nome',
      aviso: entity?.name ? null : 'Falta o nome do órgão', avisoLeve: false,
    },
    {
      n: 2, chave: 'lugares',
      situacao: bairros > 0 ? 'ok' : 'warn',
      contagem: `${plural(macrozonas, 'macrozona', 'macrozonas')} · ${plural(bairros, 'bairro', 'bairros')}`,
      aviso: bairros === 0 ? 'Nenhum bairro cadastrado' : bairrosSemPonto > 0 ? `${plural(bairrosSemPonto, 'bairro', 'bairros')} sem ponto no mapa (opcional)` : null,
      avisoLeve: bairros > 0,
    },
    {
      n: 3, chave: 'pessoas',
      situacao: usuarios > 0 && equipesSemLider === 0 ? 'ok' : 'warn',
      contagem: `${plural(usuarios, 'usuário', 'usuários')} · ${plural(equipes.length, 'equipe', 'equipes')}`,
      aviso: equipesSemLider > 0 ? `${plural(equipesSemLider, 'equipe', 'equipes')} sem líder` : null,
      avisoLeve: false,
    },
    {
      n: 4, chave: 'veiculos',
      situacao: veiculos > 0 && veiculosSemServico === 0 ? 'ok' : 'warn',
      contagem: veiculos === 0 ? 'Nada cadastrado' : plural(veiculos, 'veículo', 'veículos'),
      aviso: veiculos === 0 ? 'Nenhum veículo' : veiculosSemServico > 0 ? `${plural(veiculosSemServico, 'veículo', 'veículos')} sem serviço` : null,
      avisoLeve: false,
    },
    {
      n: 5, chave: 'equipamentos',
      situacao: equipamentos > 0 && equipamentosSemServico === 0 ? 'ok' : 'warn',
      contagem: equipamentos === 0 ? 'Nada cadastrado' : plural(equipamentos, 'equipamento', 'equipamentos'),
      aviso: equipamentos === 0 ? 'Nenhum equipamento' : equipamentosSemServico > 0 ? `${plural(equipamentosSemServico, 'equipamento', 'equipamentos')} sem serviço` : null,
      avisoLeve: false,
    },
    {
      n: 6, chave: 'centros',
      situacao: centros > 0 ? 'ok' : 'warn',
      contagem: plural(centros, 'centro de custo', 'centros de custo'),
      aviso: centros === 0 ? 'Nenhum centro de custo' : null, avisoLeve: false,
    },
    {
      n: 7, chave: 'servicos',
      situacao: servicos > 0 && servicosSemCentro === 0 ? 'ok' : 'warn',
      contagem: plural(servicos, 'serviço', 'serviços'),
      aviso: servicosSemCentro > 0 ? `${plural(servicosSemCentro, 'serviço', 'serviços')} sem centro de custo` : servicos === 0 ? 'Nenhum serviço' : null,
      avisoLeve: false,
    },
  ];

  const prontos = passos.filter(p => p.situacao !== 'warn').length;
  return { prontos, total: passos.length, passos };
}

/* ───────────────────────── Órgão ───────────────────────── */

export async function obterOrgao(prisma: PrismaClient, entityId: string) {
  const e = await prisma.entity.findUnique({
    where: { id: entityId },
    select: {
      name: true, cnpj: true, email: true, phone: true, address: true,
      legalRepresentativeName: true, municipalityName: true, uf: true, coatOfArmsUrl: true,
    },
  });
  if (!e) throw new AppError(404, 'NOT_FOUND', 'Órgão não encontrado');
  return {
    nome: e.name,
    municipio: e.municipalityName,
    uf: e.uf,
    cnpj: e.cnpj,
    secretario: e.legalRepresentativeName,
    telefone: e.phone,
    email: e.email,
    endereco: e.address,
    brasaoUrl: e.coatOfArmsUrl,
  };
}

export interface DadosOrgao {
  nome: string;
  cnpj?: string | null;
  secretario?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
}

export async function salvarOrgao(prisma: PrismaClient, entityId: string, d: DadosOrgao) {
  const cnpj = d.cnpj ? d.cnpj.replace(/\D/g, '') : null;
  if (cnpj && cnpj.length !== 14) throw new AppError(400, 'VALIDATION_ERROR', 'CNPJ precisa ter 14 números');
  if (cnpj) {
    const outro = await prisma.entity.findFirst({ where: { cnpj, NOT: { id: entityId } }, select: { id: true } });
    if (outro) throw new AppError(409, 'CONFLICT', 'Este CNPJ já está em outro órgão');
  }
  await prisma.entity.update({
    where: { id: entityId },
    data: {
      name: d.nome.trim(),
      cnpj,
      legalRepresentativeName: d.secretario?.trim() || null,
      phone: d.telefone?.replace(/\D/g, '') || null,
      email: d.email?.trim() || null,
      address: d.endereco?.trim() || null,
    },
  });
  return obterOrgao(prisma, entityId);
}

export async function definirBrasao(prisma: PrismaClient, entityId: string, url: string | null) {
  await prisma.entity.update({ where: { id: entityId }, data: { coatOfArmsUrl: url } });
  return obterOrgao(prisma, entityId);
}

/* ───────────────────────── Lugares ───────────────────────── */

/** OS em aberto por nome de bairro (o bairro da OS é guardado como texto) */
async function osAbertasPorBairro(prisma: PrismaClient, entityId: string) {
  const valores = await prisma.registroDiarioValor.findMany({
    where: {
      entityId,
      propriedade: { nome: PROP_BAIRRO },
      registroDiario: { etapa: { in: [...ETAPAS_ABERTAS] } },
    },
    select: { valorTexto: true },
  });
  const mapa = new Map<string, number>();
  for (const v of valores) {
    const k = (v.valorTexto ?? '').trim().toLowerCase();
    if (k) mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return mapa;
}

async function bairroTemOS(prisma: PrismaClient, entityId: string, nome: string) {
  const n = await prisma.registroDiarioValor.count({
    where: { entityId, propriedade: { nome: PROP_BAIRRO }, valorTexto: { equals: nome, mode: 'insensitive' } },
  });
  return n > 0;
}

export async function listarLugares(prisma: PrismaClient, entityId: string) {
  const [macros, bairros, abertas] = await Promise.all([
    prisma.cadastroAuxiliar.findMany({
      where: { entityId, tipo: 'MACROZONA', ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: { id: true, nome: true },
    }),
    prisma.cadastroAuxiliar.findMany({
      where: { entityId, tipo: 'BAIRRO', ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, lat: true, lng: true, macrozonaId: true, macrozona: { select: { nome: true } } },
    }),
    osAbertasPorBairro(prisma, entityId),
  ]);
  return {
    macrozonas: macros.map(m => ({ ...m, bairros: bairros.filter(b => b.macrozonaId === m.id).length })),
    bairros: bairros.map(b => ({
      id: b.id,
      nome: b.nome,
      macrozonaId: b.macrozonaId,
      macrozona: b.macrozona?.nome ?? null,
      lat: b.lat,
      lng: b.lng,
      osAbertas: abertas.get(b.nome.trim().toLowerCase()) ?? 0,
    })),
  };
}

async function proximaOrdem(prisma: PrismaClient, entityId: string, tipo: 'MACROZONA' | 'BAIRRO') {
  const max = await prisma.cadastroAuxiliar.aggregate({ where: { entityId, tipo }, _max: { ordem: true } });
  return (max._max.ordem ?? 0) + 1;
}

/** Cria ou reativa (mesmo nome já existiu e foi desativado) */
async function criarOuReativar(prisma: PrismaClient, entityId: string, tipo: 'MACROZONA' | 'BAIRRO', nome: string) {
  const limpo = nome.trim();
  const existente = await prisma.cadastroAuxiliar.findFirst({ where: { entityId, tipo, nome: { equals: limpo, mode: 'insensitive' } } });
  if (existente) {
    if (existente.ativo) throw new AppError(409, 'CONFLICT', `"${limpo}" já está cadastrado`);
    return prisma.cadastroAuxiliar.update({ where: { id: existente.id }, data: { ativo: true, nome: limpo } });
  }
  return prisma.cadastroAuxiliar.create({ data: { entityId, tipo, nome: limpo, ordem: await proximaOrdem(prisma, entityId, tipo) } });
}

async function validarMacrozona(prisma: PrismaClient, entityId: string, macrozonaId: string | null | undefined) {
  if (!macrozonaId) return;
  const m = await prisma.cadastroAuxiliar.findFirst({ where: { id: macrozonaId, entityId, tipo: 'MACROZONA' } });
  if (!m) throw new AppError(400, 'VALIDATION_ERROR', 'Macrozona não encontrada');
}

export async function criarMacrozona(prisma: PrismaClient, entityId: string, nome: string) {
  return criarOuReativar(prisma, entityId, 'MACROZONA', nome);
}

export async function renomearMacrozona(prisma: PrismaClient, entityId: string, id: string, nome: string) {
  const m = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: 'MACROZONA' } });
  if (!m) throw new AppError(404, 'NOT_FOUND', 'Macrozona não encontrada');
  return prisma.cadastroAuxiliar.update({ where: { id }, data: { nome: nome.trim() } });
}

export async function removerMacrozona(prisma: PrismaClient, entityId: string, id: string) {
  const m = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: 'MACROZONA' } });
  if (!m) throw new AppError(404, 'NOT_FOUND', 'Macrozona não encontrada');
  await prisma.cadastroAuxiliar.updateMany({ where: { entityId, macrozonaId: id }, data: { macrozonaId: null } });
  await prisma.cadastroAuxiliar.update({ where: { id }, data: { ativo: false } });
}

export interface DadosBairro {
  nome: string;
  macrozonaId?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export async function criarBairro(prisma: PrismaClient, entityId: string, d: DadosBairro) {
  if (!d.macrozonaId) throw new AppError(400, 'VALIDATION_ERROR', 'Escolha a macrozona');
  await validarMacrozona(prisma, entityId, d.macrozonaId);
  const b = await criarOuReativar(prisma, entityId, 'BAIRRO', d.nome);
  return prisma.cadastroAuxiliar.update({
    where: { id: b.id },
    data: { macrozonaId: d.macrozonaId, lat: d.lat ?? null, lng: d.lng ?? null },
  });
}

export async function atualizarBairro(prisma: PrismaClient, entityId: string, id: string, d: DadosBairro) {
  const b = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: 'BAIRRO' } });
  if (!b) throw new AppError(404, 'NOT_FOUND', 'Bairro não encontrado');
  if (!d.macrozonaId) throw new AppError(400, 'VALIDATION_ERROR', 'Escolha a macrozona');
  await validarMacrozona(prisma, entityId, d.macrozonaId);
  const nome = d.nome.trim();
  if (nome.toLowerCase() !== b.nome.toLowerCase()) {
    const dup = await prisma.cadastroAuxiliar.findFirst({ where: { entityId, tipo: 'BAIRRO', nome: { equals: nome, mode: 'insensitive' }, NOT: { id } } });
    if (dup) throw new AppError(409, 'CONFLICT', `"${nome}" já está cadastrado`);
  }
  return prisma.cadastroAuxiliar.update({
    where: { id },
    data: { nome, macrozonaId: d.macrozonaId, lat: d.lat ?? null, lng: d.lng ?? null },
  });
}

/** Bairro que já tem OS não é apagado: fica inativo e o histórico continua */
export async function removerBairro(prisma: PrismaClient, entityId: string, id: string) {
  const b = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: 'BAIRRO' } });
  if (!b) throw new AppError(404, 'NOT_FOUND', 'Bairro não encontrado');
  if (await bairroTemOS(prisma, entityId, b.nome)) {
    await prisma.cadastroAuxiliar.update({ where: { id }, data: { ativo: false } });
    return { removido: false, desativado: true };
  }
  await prisma.cadastroAuxiliar.delete({ where: { id } });
  return { removido: true, desativado: false };
}

/** "Colar lista": um bairro por linha, todos na mesma macrozona */
export async function colarBairros(prisma: PrismaClient, entityId: string, nomes: string[], macrozonaId: string | null) {
  await validarMacrozona(prisma, entityId, macrozonaId);
  const limpos = [...new Set(nomes.map(n => n.trim()).filter(Boolean))];
  let criados = 0;
  const repetidos: string[] = [];
  for (const nome of limpos) {
    try {
      const b = await criarOuReativar(prisma, entityId, 'BAIRRO', nome);
      if (macrozonaId) await prisma.cadastroAuxiliar.update({ where: { id: b.id }, data: { macrozonaId } });
      criados++;
    } catch (e) {
      if (e instanceof AppError && e.code === 'CONFLICT') repetidos.push(nome);
      else throw e;
    }
  }
  return { criados, repetidos };
}
