import type { PrismaClient } from '../../../generated/prisma/index.js';
import { z } from 'zod';
import { AppError } from '../../shared/errors.js';
import { createRegistroDiario } from '../tenant/centros-custo/registro-diario.service.js';
import { hojeBrasilia, proximoNumero } from '../../shared/sequencia.js';

/* ── Central do Munícipe ─────────────────────────────────────────
   Pedido feito pelo cidadão (link / QR Code, sem login) → a equipe
   analisa e converte em ocorrência do serviço certo, ou recusa.     */

const soDigitos = (s: string) => s.replace(/\D/g, '');

function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export const novaSolicitacaoSchema = z.object({
  categoria: z.string().regex(/^[a-z0-9-]{2,80}$/, 'Escolha o tipo de problema'),
  categoriaNome: z.string().trim().min(2, 'Escolha o tipo de problema').max(160),
  descricao: z.string().trim().min(5, 'Conte um pouco mais sobre o problema').max(2000),
  bairro: z.string().trim().min(2, 'Informe o bairro').max(150),
  logradouro: z.string().trim().min(3, 'Informe a rua').max(300),
  referencia: z.string().trim().max(300).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  precisaoM: z.number().min(0).max(100000).optional().nullable(),
  nome: z.string().trim().min(3, 'Informe seu nome').max(160),
  telefone: z.string().trim().refine(t => { const n = soDigitos(t).length; return n === 10 || n === 11; }, 'Telefone com DDD'),
  cpf: z.string().trim().optional().nullable().refine(c => !c || cpfValido(c), 'CPF inválido'),
  email: z.string().trim().email('E-mail inválido').max(160).optional().nullable().or(z.literal('')),
  aceite: z.literal(true, { message: 'É preciso aceitar o uso dos dados para atender o pedido' }),
});
export type NovaSolicitacao = z.infer<typeof novaSolicitacaoSchema>;

export interface FotoRecebida { mimeType: string; dados: Buffer }

/** Bairros ativos da entidade (com coordenada, quando houver) */
export function listarBairros(prisma: PrismaClient, entityId: string) {
  return prisma.cadastroAuxiliar.findMany({
    where: { entityId, tipo: 'BAIRRO', ativo: true },
    select: { nome: true, lat: true, lng: true },
    orderBy: { nome: 'asc' },
  });
}

export async function criarSolicitacao(
  prisma: PrismaClient, entityId: string, entrada: NovaSolicitacao, fotos: FotoRecebida[], ip: string | null,
) {
  const entidade = await prisma.entity.findUnique({ where: { id: entityId }, select: { status: true } });
  if (!entidade || entidade.status !== 'ACTIVE') throw new AppError(404, 'NOT_FOUND', 'Prefeitura não encontrada');
  if (fotos.length === 0) throw new AppError(400, 'VALIDATION_ERROR', 'Envie pelo menos uma foto do problema');

  const bairros = await listarBairros(prisma, entityId);
  const bairro = bairros.find(b => b.nome.toLowerCase() === entrada.bairro.toLowerCase());
  if (bairros.length > 0 && !bairro) throw new AppError(400, 'VALIDATION_ERROR', 'Escolha um bairro da lista');

  const ano = hojeBrasilia().slice(0, 4);
  const n = await proximoNumero(prisma, entityId, `PROTOCOLO-${ano}`);
  const protocolo = `${ano}-${String(n).padStart(5, '0')}`;

  const criada = await prisma.solicitacaoMunicipe.create({
    data: {
      entityId, protocolo,
      categoria: entrada.categoria, categoriaNome: entrada.categoriaNome,
      descricao: entrada.descricao,
      bairro: bairro?.nome ?? entrada.bairro,
      logradouro: entrada.logradouro,
      referencia: entrada.referencia || null,
      lat: entrada.lat ?? null, lng: entrada.lng ?? null, precisaoM: entrada.precisaoM ?? null,
      nome: entrada.nome,
      telefone: soDigitos(entrada.telefone),
      cpf: entrada.cpf ? soDigitos(entrada.cpf) : null,
      email: entrada.email || null,
      origemIp: ip,
      fotos: { create: fotos.map(f => ({ mimeType: f.mimeType, tamanhoBytes: f.dados.length, dados: f.dados as unknown as Uint8Array<ArrayBuffer> })) },
    },
    select: { protocolo: true, createdAt: true },
  });
  return { protocolo: criada.protocolo, criadoEm: criada.createdAt.toISOString() };
}

/** Acompanhamento público: precisa do protocolo e do telefone usado no pedido */
export async function consultarSolicitacao(prisma: PrismaClient, entityId: string, protocolo: string, telefone: string) {
  const s = await prisma.solicitacaoMunicipe.findUnique({
    where: { entityId_protocolo: { entityId, protocolo } },
    select: {
      protocolo: true, status: true, categoriaNome: true, bairro: true, logradouro: true,
      createdAt: true, analisadoEm: true, motivoRecusa: true, telefone: true,
      registroDiario: { select: { updatedAt: true, valores: { where: { propriedade: { nome: 'Status' } }, select: { valorTexto: true } } } },
    },
  });
  if (!s || s.telefone !== soDigitos(telefone)) throw new AppError(404, 'NOT_FOUND', 'Não encontramos esse protocolo com esse telefone');
  return {
    protocolo: s.protocolo,
    status: s.status,
    categoriaNome: s.categoriaNome,
    bairro: s.bairro,
    logradouro: s.logradouro,
    criadoEm: s.createdAt.toISOString(),
    analisadoEm: s.analisadoEm?.toISOString() ?? null,
    motivoRecusa: s.motivoRecusa,
    servicoStatus: s.registroDiario?.valores[0]?.valorTexto ?? null,
    servicoAtualizadoEm: s.registroDiario?.updatedAt.toISOString() ?? null,
  };
}

/* ── lado da prefeitura ── */

const listaSelect = {
  id: true, protocolo: true, categoria: true, categoriaNome: true, descricao: true,
  bairro: true, logradouro: true, referencia: true, lat: true, lng: true, precisaoM: true,
  nome: true, telefone: true, cpf: true, email: true, status: true, motivoRecusa: true,
  registroDiarioId: true, analisadoEm: true, createdAt: true,
  analisadoPor: { select: { name: true } },
  registroDiario: { select: { centroCustoId: true } },
  fotos: { select: { id: true }, orderBy: { createdAt: 'asc' as const } },
} as const;

export async function listarSolicitacoes(prisma: PrismaClient, entityId: string, status?: 'NOVA' | 'CONVERTIDA' | 'RECUSADA') {
  const [itens, contagem] = await Promise.all([
    prisma.solicitacaoMunicipe.findMany({
      where: { entityId, ...(status ? { status } : {}) },
      select: listaSelect,
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    prisma.solicitacaoMunicipe.groupBy({ by: ['status'], where: { entityId }, _count: { _all: true } }),
  ]);
  const conta = (s: string) => contagem.find(c => c.status === s)?._count._all ?? 0;
  return {
    resumo: { novas: conta('NOVA'), convertidas: conta('CONVERTIDA'), recusadas: conta('RECUSADA') },
    itens: itens.map(i => ({
      ...i,
      analisadoPor: i.analisadoPor?.name ?? null,
      centroCustoId: i.registroDiario?.centroCustoId ?? null,
      registroDiario: undefined,
      fotos: i.fotos.map(f => f.id),
      analisadoEm: i.analisadoEm?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

export async function lerFoto(prisma: PrismaClient, entityId: string, fotoId: string) {
  const f = await prisma.solicitacaoMunicipeFoto.findFirst({
    where: { id: fotoId, solicitacao: { entityId } },
    select: { mimeType: true, dados: true },
  });
  if (!f) throw new AppError(404, 'NOT_FOUND', 'Foto não encontrada');
  return f;
}

async function solicitacaoNova(prisma: PrismaClient, entityId: string, id: string) {
  const s = await prisma.solicitacaoMunicipe.findFirst({ where: { id, entityId }, include: { fotos: true } });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Solicitação não encontrada');
  if (s.status !== 'NOVA') throw new AppError(409, 'CONFLICT', 'Esta solicitação já foi analisada');
  return s;
}

/** Transforma o pedido em ocorrência do serviço escolhido, com fotos e GPS */
export async function converterEmOcorrencia(prisma: PrismaClient, entityId: string, userId: string, id: string, centroCustoId: string) {
  const s = await solicitacaoNova(prisma, entityId, id);

  const configs = await prisma.centroCustoPropriedadeConfig.findMany({
    where: { centroCustoId, entityId, active: true },
    select: { propriedadeId: true, propriedade: { select: { nome: true } } },
  });
  if (configs.length === 0) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');
  const pid = (nome: string) => configs.find(c => c.propriedade.nome === nome)?.propriedadeId;

  const valores: Record<string, { text: string }> = {};
  const por = (nome: string, texto: string) => { const p = pid(nome); if (p && texto) valores[p] = { text: texto }; };
  por('Bairro / Localidade', s.bairro);
  por('Logradouro / Referência', [s.logradouro, s.referencia].filter(Boolean).join(' — '));
  por('Origem da Demanda', 'Munícipe');
  por('Observações', `Pedido do munícipe — protocolo ${s.protocolo}\n${s.descricao}\nSolicitante: ${s.nome} · ${s.telefone}`);

  const registro = await createRegistroDiario(prisma, userId, entityId, centroCustoId, { data: hojeBrasilia(), values: valores });

  if (s.lat != null && s.lng != null) {
    await prisma.registroDiario.update({
      where: { id: registro.id },
      data: { lat: s.lat, lng: s.lng, enderecoGeocodificado: `${s.logradouro}, ${s.bairro}` },
    });
  }
  for (const [i, f] of s.fotos.entries()) {
    await prisma.registroMidia.create({
      data: {
        registroDiarioId: registro.id, entityId, tipo: 'foto',
        nomeArquivo: `municipe_${s.protocolo}_${i + 1}.jpg`,
        mimeType: f.mimeType, tamanhoBytes: f.tamanhoBytes, dados: f.dados,
      },
    });
  }
  await prisma.solicitacaoMunicipe.update({
    where: { id },
    data: { status: 'CONVERTIDA', registroDiarioId: registro.id, analisadoPorId: userId, analisadoEm: new Date() },
  });
  return { registroId: registro.id };
}

export async function recusarSolicitacao(prisma: PrismaClient, entityId: string, userId: string, id: string, motivo: string) {
  await solicitacaoNova(prisma, entityId, id);
  await prisma.solicitacaoMunicipe.update({
    where: { id },
    data: { status: 'RECUSADA', motivoRecusa: motivo, analisadoPorId: userId, analisadoEm: new Date() },
  });
}
