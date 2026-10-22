import type { PrismaClient } from '../../../generated/prisma/index.js';
import { AppError } from '../../shared/errors.js';

/* ── Tela de entrada da prefeitura (pública, sem login) ───────────────────
   Só totais do dia, tendência de 14 dias e as últimas OS com número,
   serviço e etapa. Nada de endereço, bairro, foto ou nome de pessoa.
   Abaixo de MINIMO_OS nos últimos 30 dias, a tela não mostra os números. */

const FUSO_MS = -3 * 3600_000; // Brasília
const DIA = 86_400_000;
const DIAS_SERIE = 14;
const MINIMO_OS = 5;
const PRAZO_PADRAO = 7;
const CACHE_MS = 60_000;

const cache = new Map<string, { em: number; dados: EntradaPublica }>();

export interface EntradaPublica {
  mostrarNumeros: boolean;
  kpis: {
    abertasHoje: number;
    finalizadasHoje: number;
    noPrazoPct: number | null;
    equipesEmCampo: number;
    equipesTotal: number;
    tempoMedioDias: number | null;
  };
  /** um valor por dia, do mais antigo para hoje */
  series: { abertas: number[]; finalizadas: number[]; noPrazo: (number | null)[]; equipes: number[]; tempo: (number | null)[] };
  servicos: { nome: string; cor: string | null; hoje: number }[];
  ultimas: { numero: string; servico: string; cor: string | null; etapa: string; origem: string; criadoEm: string }[];
}

function inicioDia(d: Date): Date {
  const local = new Date(d.getTime() + FUSO_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - FUSO_MS);
}

const media = (l: number[]) => (l.length ? Math.round(l.reduce((s, x) => s + x, 0) / l.length * 10) / 10 : null);

export async function entradaPublica(prisma: PrismaClient, entityId: string): Promise<EntradaPublica> {
  const guardado = cache.get(entityId);
  if (guardado && Date.now() - guardado.em < CACHE_MS) return guardado.dados;

  const entidade = await prisma.entity.findUnique({ where: { id: entityId }, select: { status: true } });
  if (!entidade || entidade.status === 'INACTIVE') throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');

  const agora = new Date();
  const hoje0 = inicioDia(agora);
  const serie0 = new Date(hoje0.getTime() - (DIAS_SERIE - 1) * DIA);
  const mes0 = new Date(hoje0.getTime() - 29 * DIA);

  const [registros, cfg, equipesTotal, servicosAtivos] = await Promise.all([
    prisma.registroDiario.findMany({
      where: {
        entityId,
        etapa: { not: 'CANCELADA' },
        recusadoEm: null,
        OR: [{ createdAt: { gte: mes0 } }, { executadoEm: { gte: mes0 } }, { finalizadoEm: { gte: mes0 } }],
      },
      select: {
        numeroOS: true, etapa: true, origem: true, equipeId: true,
        createdAt: true, executadoEm: true, finalizadoEm: true,
        centroCusto: { select: { nome: true, cor: true, prazoDias: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
    prisma.configuracaoObras.findUnique({ where: { entityId }, select: { metaDias: true } }),
    prisma.cadastroAuxiliar.count({ where: { entityId, tipo: 'EQUIPE', ativo: true } }),
    prisma.centroCusto.findMany({ where: { entityId, status: 'ACTIVE' }, select: { nome: true, cor: true }, orderBy: { nome: 'asc' } }),
  ]);

  const prazoDe = (r: (typeof registros)[number]) => r.centroCusto.prazoDias ?? cfg?.metaDias ?? PRAZO_PADRAO;
  const diasAteExecutar = (r: (typeof registros)[number]) => (r.executadoEm!.getTime() - r.createdAt.getTime()) / DIA;
  const noDia = (d: Date | null, d0: Date) => d != null && d >= d0 && d.getTime() < d0.getTime() + DIA;

  const executadas30 = registros.filter(r => r.executadoEm && r.executadoEm >= mes0);
  const noPrazo30 = executadas30.filter(r => diasAteExecutar(r) <= prazoDe(r));

  const series: EntradaPublica['series'] = { abertas: [], finalizadas: [], noPrazo: [], equipes: [], tempo: [] };
  for (let d0 = serie0; d0 <= hoje0; d0 = new Date(d0.getTime() + DIA)) {
    const execDia = registros.filter(r => noDia(r.executadoEm, d0));
    series.abertas.push(registros.filter(r => noDia(r.createdAt, d0)).length);
    series.finalizadas.push(registros.filter(r => noDia(r.finalizadoEm, d0)).length);
    series.noPrazo.push(execDia.length ? Math.round(execDia.filter(r => diasAteExecutar(r) <= prazoDe(r)).length / execDia.length * 100) : null);
    series.tempo.push(media(execDia.map(diasAteExecutar)));
    series.equipes.push(new Set(registros.filter(r => r.equipeId && (noDia(r.createdAt, d0) || noDia(r.executadoEm, d0))).map(r => r.equipeId)).size);
  }

  /* serviços da legenda: os que mais tiveram OS no mês (cor da ficha), completando com os ativos */
  const contaMes = new Map<string, { nome: string; cor: string | null; mes: number; hoje: number }>();
  for (const r of registros) {
    if (r.createdAt < mes0) continue;
    const s = contaMes.get(r.centroCusto.nome) ?? { nome: r.centroCusto.nome, cor: r.centroCusto.cor, mes: 0, hoje: 0 };
    s.mes++;
    if (r.createdAt >= hoje0) s.hoje++;
    contaMes.set(r.centroCusto.nome, s);
  }
  const servicos = [...contaMes.values()].sort((a, b) => b.mes - a.mes);
  for (const s of servicosAtivos) {
    if (servicos.length >= 4) break;
    if (!contaMes.has(s.nome)) servicos.push({ nome: s.nome, cor: s.cor, mes: 0, hoje: 0 });
  }

  const ultimas = registros.slice(0, 8).filter(r => r.numeroOS).map(r => ({
    numero: r.numeroOS!, servico: r.centroCusto.nome, cor: r.centroCusto.cor,
    etapa: r.etapa, origem: r.origem, criadoEm: r.createdAt.toISOString(),
  }));

  const dados: EntradaPublica = {
    mostrarNumeros: registros.filter(r => r.createdAt >= mes0).length >= MINIMO_OS,
    kpis: {
      abertasHoje: series.abertas[series.abertas.length - 1],
      finalizadasHoje: series.finalizadas[series.finalizadas.length - 1],
      noPrazoPct: executadas30.length ? Math.round(noPrazo30.length / executadas30.length * 100) : null,
      equipesEmCampo: series.equipes[series.equipes.length - 1],
      equipesTotal,
      tempoMedioDias: media(executadas30.map(diasAteExecutar)),
    },
    series,
    servicos: servicos.slice(0, 4).map(({ nome, cor, hoje }) => ({ nome, cor, hoje })),
    ultimas,
  };
  cache.set(entityId, { em: Date.now(), dados });
  return dados;
}
