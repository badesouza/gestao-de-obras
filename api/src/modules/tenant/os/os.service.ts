import type { EtapaOS, Prisma, PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { hojeBrasilia } from '../../../shared/sequencia.js';
import { pode, poderesFluxo, type QuemAge } from '../../../shared/acessos.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { centroPadraoDoServico } from '../centros-de-custo/centros-de-custo.service.js';
import {
  ROTULO_ETAPA, aplicarAcao, assertAcessoOS, escopoEquipes, escopoServicos, filtroEscopoOS, iniciarOrdemServico, obterConfig,
} from '../ordens/ordens.service.js';

/* ── Módulo de Ordens de Serviço ──────────────────────────────────
   Lista com indicadores, Nova OS (segue a ficha do serviço, equipe
   obrigatória), ficha da OS e baixa com foto. As etapas e ações são
   as de ordens.service (aprovar, executar, finalizar, reabrir…).
   Os campos comuns também vão para a tabela de valores, para a Sala
   de Situação, o mapa e a tela do serviço continuarem lendo.        */

export type Ator = QuemAge & { id: string };

const DIA = 86_400_000;
const COMUNS = {
  bairro: 'Bairro / Localidade', logradouro: 'Logradouro / Referência', origem: 'Origem da Demanda',
  tipo: 'Tipo de Serviço', equipe: 'Equipe / Turma', obs: 'Observações',
} as const;
const NOMES_COMUNS = Object.values(COMUNS) as string[];
const ABERTAS: EtapaOS[] = ['AGUARDANDO_APROVACAO', 'REGISTRADA', 'EXECUTADA'];

export interface RespostaCampo { id: string | null; nome: string; tipo: string; valor: string | number | boolean | string[] | null }
interface CamposOS { abertura?: RespostaCampo[]; baixa?: RespostaCampo[]; obsBaixa?: string | null }

const vazio = (v: RespostaCampo['valor']) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** Iniciais para os avatares (Marcos Vieira → MV) */
function sigla(nome: string) {
  const p = nome.trim().split(/\s+/).filter(x => !/^(da|de|do|das|dos|e)$/i.test(x));
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? ''))).toUpperCase();
}

/** Prazo e atraso de uma OS (o prazo corre até a baixa) */
function prazoDe(r: { createdAt: Date; executadoEm: Date | null; etapa: EtapaOS }, prazoDias: number, agora: Date) {
  const fim = r.executadoEm ?? agora;
  const usados = Math.max(0, (fim.getTime() - r.createdAt.getTime()) / DIA);
  const aberta = r.etapa === 'AGUARDANDO_APROVACAO' || r.etapa === 'REGISTRADA';
  return { prazoDias, diasUsados: Math.round(usados * 10) / 10, atrasada: aberta && usados > prazoDias, noPrazo: !!r.executadoEm && usados <= prazoDias };
}

/** Grava um campo comum na tabela de valores (Sala de Situação, mapa e tela do serviço leem dali) */
async function gravarComum(prisma: PrismaClient, entityId: string, registroId: string, userId: string, nome: string, valor: string | null | undefined) {
  const texto = valor?.toString().trim();
  if (!texto) return;
  const prop = await prisma.centroCustoPropriedade.findFirst({ where: { entityId, nome }, select: { id: true } })
    ?? await prisma.centroCustoPropriedade.create({ data: { entityId, nome, tipo: 'TEXTO', createdByUserId: userId }, select: { id: true } });
  await prisma.registroDiarioValor.upsert({
    where: { registroDiarioId_propriedadeId: { registroDiarioId: registroId, propriedadeId: prop.id } },
    update: { valorTexto: texto.slice(0, 2000) },
    create: { registroDiarioId: registroId, propriedadeId: prop.id, entityId, valorTexto: texto.slice(0, 2000) },
  });
}

function valoresComuns(valores: { valorTexto: string | null; propriedade: { nome: string } }[]) {
  const v: Record<string, string> = {};
  valores.forEach(x => { if (x.valorTexto) v[x.propriedade.nome] = x.valorTexto; });
  return {
    bairro: v[COMUNS.bairro] ?? '', logradouro: v[COMUNS.logradouro] ?? '', origemDemanda: v[COMUNS.origem] ?? '',
    tipo: v[COMUNS.tipo] ?? '', equipeTexto: v[COMUNS.equipe] ?? '', observacoes: v[COMUNS.obs] ?? '',
  };
}

/** Equipes que a pessoa pode escolher numa OS (as dela; quem não depende de equipe vê todas) */
async function equipesPermitidas(prisma: PrismaClient, entityId: string, ator: Ator) {
  const minhas = await escopoEquipes(prisma, ator.id);
  return prisma.cadastroAuxiliar.findMany({
    where: { entityId, tipo: 'EQUIPE', ativo: true, ...(minhas ? { id: { in: minhas } } : {}) },
    orderBy: { nome: 'asc' },
    select: {
      id: true, nome: true,
      usuariosEquipe: { where: { user: { status: 'ACTIVE' } }, select: { user: { select: { name: true } } } },
      equipe: { select: { lider: { select: { name: true } }, operadores: { where: { ativo: true }, select: { nome: true } } } },
    },
  });
}

function pessoasDaEquipe(e: Awaited<ReturnType<typeof equipesPermitidas>>[number]) {
  const nomes = [...new Set([
    ...(e.equipe?.lider ? [e.equipe.lider.name] : []),
    ...e.usuariosEquipe.map(u => u.user.name),
    ...(e.equipe?.operadores ?? []).map(o => o.nome),
  ])];
  return nomes;
}

/* ═════════════════════════ Lista com indicadores ═════════════════════════ */

export interface FiltrosOS { etapa?: string; servicoId?: string; equipeId?: string; origem?: string; atrasadas?: boolean; busca?: string; minhas?: boolean }

export async function painelOS(prisma: PrismaClient, entityId: string, ator: Ator, f: FiltrosOS) {
  const agora = new Date();
  const [escopo, cfg] = await Promise.all([filtroEscopoOS(prisma, ator), obterConfig(prisma, entityId)]);
  const janela = new Date(agora.getTime() - 120 * DIA);
  const rows = await prisma.registroDiario.findMany({
    where: { entityId, ...escopo, OR: [{ createdAt: { gte: janela } }, { etapa: { in: ABERTAS } }] },
    select: {
      id: true, numeroOS: true, etapa: true, origem: true, createdAt: true, executadoEm: true, finalizadoEm: true, aprovadoEm: true,
      executadoPorId: true, devolvidoEm: true, motivoDevolucao: true, createdByUserId: true, lat: true, lng: true,
      centroCusto: { select: { id: true, nome: true, cor: true, prazoDias: true } },
      equipe: { select: { id: true, nome: true } },
      createdBy: { select: { name: true } },
      valores: { where: { propriedade: { nome: { in: NOMES_COMUNS } } }, select: { valorTexto: true, propriedade: { select: { nome: true } } } },
      midias: { where: { tipo: 'foto' }, orderBy: { createdAt: 'asc' }, take: 1, select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1500,
  });

  const fluxo = poderesFluxo(ator);
  const itens = rows.map(r => {
    const c = valoresComuns(r.valores);
    const prazo = prazoDe(r, r.centroCusto.prazoDias ?? cfg.metaDias ?? 7, agora);
    return {
      id: r.id, numeroOS: r.numeroOS, etapa: r.etapa, origem: r.origem,
      criadoEm: r.createdAt, executadoEm: r.executadoEm, finalizadoEm: r.finalizadoEm, aprovadoEm: r.aprovadoEm,
      devolvida: !!r.devolvidoEm && r.etapa === 'REGISTRADA', motivoDevolucao: r.motivoDevolucao,
      servico: { id: r.centroCusto.id, nome: r.centroCusto.nome, cor: r.centroCusto.cor },
      equipe: r.equipe ? { id: r.equipe.id, nome: r.equipe.nome } : (c.equipeTexto ? { id: null, nome: c.equipeTexto } : null),
      abertoPor: r.createdBy.name, minha: r.createdByUserId === ator.id, executadoPorMim: r.executadoPorId === ator.id,
      bairro: c.bairro, logradouro: c.logradouro, tipo: c.tipo, origemDemanda: c.origemDemanda,
      lat: r.lat, lng: r.lng, fotoId: r.midias[0]?.id ?? null,
      ...prazo,
    };
  });

  const abertas = itens.filter(i => ABERTAS.includes(i.etapa));
  const semana0 = agora.getTime() - 7 * DIA, semanaAnt0 = agora.getTime() - 14 * DIA, mes0 = agora.getTime() - 30 * DIA;
  const feitas = itens.filter(i => i.executadoEm);
  const feitasSemana = feitas.filter(i => i.executadoEm!.getTime() >= semana0).length;
  const feitasSemanaAnt = feitas.filter(i => i.executadoEm!.getTime() >= semanaAnt0 && i.executadoEm!.getTime() < semana0).length;
  const feitas30 = feitas.filter(i => i.executadoEm!.getTime() >= mes0);
  const aprovar = fluxo.podeAprovar ? itens.filter(i => i.etapa === 'AGUARDANDO_APROVACAO').length : 0;
  const conferir = fluxo.podeConferir ? itens.filter(i => i.etapa === 'EXECUTADA' && (!i.executadoPorMim || ator.admin)).length : 0;
  const hoje0 = new Date(hojeBrasilia() + 'T03:00:00Z').getTime();
  const serie = (lista: typeof itens, campo: 'criadoEm' | 'executadoEm') => Array.from({ length: 14 }, (_, k) => {
    const d0 = hoje0 - (13 - k) * DIA;
    return lista.filter(i => { const t = i[campo]?.getTime(); return t != null && t >= d0 && t < d0 + DIA; }).length;
  });

  const porBairro = new Map<string, { n: number; atrasadas: number }>();
  abertas.forEach(i => {
    const b = i.bairro || 'Sem bairro';
    const x = porBairro.get(b) ?? { n: 0, atrasadas: 0 };
    x.n++; if (i.atrasada) x.atrasadas++;
    porBairro.set(b, x);
  });

  const equipesCad = await equipesPermitidas(prisma, entityId, ator);
  const equipes = equipesCad.map(e => {
    const minhas = itens.filter(i => i.equipe?.id === e.id);
    const f30 = minhas.filter(i => i.executadoEm && i.executadoEm.getTime() >= mes0);
    return {
      id: e.id, nome: e.nome,
      abertas: minhas.filter(i => ABERTAS.includes(i.etapa)).length,
      noPrazoPct: f30.length ? Math.round(f30.filter(i => i.noPrazo).length / f30.length * 100) : null,
      pessoas: pessoasDaEquipe(e).slice(0, 4).map(n => ({ nome: n, sigla: sigla(n) })),
    };
  }).sort((a, b) => b.abertas - a.abertas);

  /* "chegando do campo": os últimos acontecimentos */
  const eventos: { quando: Date; texto: string; numeroOS: string | null; id: string; tipo: string }[] = [];
  itens.slice(0, 60).forEach(i => {
    eventos.push({ quando: i.criadoEm, id: i.id, numeroOS: i.numeroOS, tipo: 'aberta', texto: `aberta${i.equipe ? ` para a ${i.equipe.nome}` : ''}${i.bairro ? ` · ${i.bairro}` : ''}` });
    if (i.executadoEm) eventos.push({ quando: i.executadoEm, id: i.id, numeroOS: i.numeroOS, tipo: 'baixa', texto: `recebeu baixa${i.bairro ? ` · ${i.bairro}` : ''}` });
    if (i.finalizadoEm) eventos.push({ quando: i.finalizadoEm, id: i.id, numeroOS: i.numeroOS, tipo: 'finalizada', texto: `finalizada${i.noPrazo ? ' no prazo' : ''}` });
  });
  eventos.sort((a, b) => b.quando.getTime() - a.quando.getTime());

  const contagem: Record<string, number> = { TODAS: itens.length };
  for (const e of Object.keys(ROTULO_ETAPA)) contagem[e] = itens.filter(i => i.etapa === e).length;

  const busca = f.busca?.trim().toLowerCase();
  const linhas = itens.filter(i =>
    (!f.etapa || f.etapa === 'TODAS' || i.etapa === f.etapa)
    && (!f.servicoId || i.servico.id === f.servicoId)
    && (!f.equipeId || i.equipe?.id === f.equipeId)
    && (!f.origem || i.origem === f.origem)
    && (!f.atrasadas || i.atrasada)
    && (!busca || `${i.numeroOS} ${i.logradouro} ${i.bairro} ${i.tipo}`.toLowerCase().includes(busca)));

  const servicosVistos = new Map(itens.map(i => [i.servico.id, i.servico]));
  return {
    kpis: {
      abertas: abertas.length,
      abertasHoje: itens.filter(i => i.criadoEm.getTime() >= hoje0).length,
      atrasadas: abertas.filter(i => i.atrasada).length,
      aprovar, conferir,
      feitasSemana, feitasSemanaAnt,
      noPrazoPct: feitas30.length ? Math.round(feitas30.filter(i => i.noPrazo).length / feitas30.length * 100) : null,
      tempoMedioDias: feitas30.length ? Math.round(feitas30.reduce((s, i) => s + i.diasUsados, 0) / feitas30.length * 10) / 10 : null,
      metaDias: cfg.metaDias,
      serieAbertas: serie(itens, 'criadoEm'),
      serieFeitas: serie(itens, 'executadoEm'),
    },
    bairros: [...porBairro.entries()].map(([nome, x]) => ({ nome, ...x })).sort((a, b) => b.n - a.n).slice(0, 6),
    equipes,
    eventos: eventos.slice(0, 8),
    contagem,
    servicos: [...servicosVistos.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
    poderes: { ...fluxo, podeAbrir: pode(ator, 'os.abrir'), podeBaixa: pode(ator, 'os.baixa') },
    linhas: linhas.slice(0, 300),
    total: linhas.length,
  };
}

/* ═════════════════════════ Nova OS ═════════════════════════ */

export async function formOS(prisma: PrismaClient, entityId: string, ator: Ator) {
  const [escopo, cfg, equipesCad, bairros] = await Promise.all([
    escopoServicos(prisma, ator),
    obterConfig(prisma, entityId),
    equipesPermitidas(prisma, entityId, ator),
    prisma.cadastroAuxiliar.findMany({ where: { entityId, tipo: 'BAIRRO', ativo: true }, orderBy: { nome: 'asc' }, select: { nome: true, lat: true, lng: true } }),
  ]);
  const servicos = await prisma.centroCusto.findMany({
    where: { entityId, status: 'ACTIVE', ...(escopo ? { id: { in: escopo } } : {}) },
    orderBy: { nome: 'asc' },
    select: {
      id: true, nome: true, cor: true, prazoDias: true, subtipos: true, fichaSalvaEm: true, camposComuns: true,
      camposFicha: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true, detalhe: true, tipo: true, opcoes: true, momento: true, obrigatorio: true } },
    },
  });
  const abertasPor = await prisma.registroDiario.groupBy({
    by: ['centroCustoId'], where: { entityId, etapa: { in: ABERTAS } }, _count: { _all: true },
  });
  const abertasEquipe = await prisma.registroDiario.groupBy({
    by: ['equipeId'], where: { entityId, etapa: { in: ABERTAS }, equipeId: { not: null } }, _count: { _all: true },
  });
  return {
    servicos: servicos.map(s => ({
      id: s.id, nome: s.nome, cor: s.cor, prazoDias: s.prazoDias ?? cfg.metaDias, subtipos: s.subtipos,
      fichaSalva: !!s.fichaSalvaEm, camposComuns: s.camposComuns,
      campos: s.camposFicha,
      abertas: abertasPor.find(a => a.centroCustoId === s.id)?._count._all ?? 0,
    })),
    equipes: equipesCad.map(e => ({
      id: e.id, nome: e.nome,
      abertas: abertasEquipe.find(a => a.equipeId === e.id)?._count._all ?? 0,
      pessoas: pessoasDaEquipe(e).slice(0, 4).map(n => ({ nome: n, sigla: sigla(n) })),
      qtdPessoas: pessoasDaEquipe(e).length,
    })),
    bairros,
    origens: cfg.origensDemanda,
    podeAbrir: pode(ator, 'os.abrir'),
  };
}

export interface DadosNovaOS {
  servicoId: string; equipeId: string; tipo?: string | null; bairro: string; logradouro: string;
  lat?: number | null; lng?: number | null; origemDemanda?: string | null; observacoes?: string | null;
  campos?: RespostaCampo[];
}

export async function abrirOS(prisma: PrismaClient, entityId: string, ator: Ator, d: DadosNovaOS, deCelular: boolean) {
  if (!pode(ator, 'os.abrir')) throw new AppError(403, 'FORBIDDEN', 'Você não tem acesso para abrir ordens de serviço');
  const escopo = await escopoServicos(prisma, ator);
  if (escopo && !escopo.includes(d.servicoId)) throw new AppError(403, 'FORBIDDEN', 'Você não atende este serviço');
  const servico = await prisma.centroCusto.findFirst({
    where: { id: d.servicoId, entityId, status: 'ACTIVE' },
    select: { id: true, nome: true, subtipos: true, fichaSalvaEm: true, camposFicha: { where: { momento: 'ABERTURA' }, select: { id: true, nome: true, obrigatorio: true } } },
  });
  if (!servico) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');
  const equipes = await equipesPermitidas(prisma, entityId, ator);
  const equipe = equipes.find(e => e.id === d.equipeId);
  if (!equipe) throw new AppError(400, 'VALIDATION_ERROR', 'Escolha uma das suas equipes');
  if (servico.subtipos.length && !d.tipo?.trim()) throw new AppError(400, 'VALIDATION_ERROR', 'Escolha o tipo de serviço');
  if (!d.bairro?.trim()) throw new AppError(400, 'VALIDATION_ERROR', 'Informe o bairro');
  if (!d.logradouro?.trim()) throw new AppError(400, 'VALIDATION_ERROR', 'Informe a rua ou uma referência');
  const respostas = (d.campos ?? []).filter(c => !vazio(c.valor));
  for (const c of servico.camposFicha.filter(x => x.obrigatorio)) {
    if (!respostas.some(r => r.id === c.id || r.nome === c.nome)) throw new AppError(400, 'VALIDATION_ERROR', `Preencha "${c.nome}"`);
  }

  const registro = await prisma.registroDiario.create({
    data: {
      centroCustoId: servico.id, entityId, data: new Date(hojeBrasilia() + 'T00:00:00Z'),
      centroDeCustoId: await centroPadraoDoServico(prisma, entityId, servico.id),
      lat: d.lat ?? null, lng: d.lng ?? null,
      createdByUserId: ator.id, updatedByUserId: ator.id,
      equipeId: equipe.id,
      campos: { abertura: respostas } as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  await gravarComum(prisma, entityId, registro.id, ator.id, COMUNS.bairro, d.bairro);
  await gravarComum(prisma, entityId, registro.id, ator.id, COMUNS.logradouro, d.logradouro);
  await gravarComum(prisma, entityId, registro.id, ator.id, COMUNS.origem, d.origemDemanda);
  await gravarComum(prisma, entityId, registro.id, ator.id, COMUNS.tipo, d.tipo);
  await gravarComum(prisma, entityId, registro.id, ator.id, COMUNS.equipe, equipe.nome);
  await gravarComum(prisma, entityId, registro.id, ator.id, COMUNS.obs, d.observacoes);
  /* número oficial e "Aguardando aprovação" (tudo passa pelo crivo do responsável) */
  await iniciarOrdemServico(prisma, entityId, registro.id, servico.id, deCelular ? 'CAMPO' : 'ESCRITORIO');
  const r = await prisma.registroDiario.findUniqueOrThrow({ where: { id: registro.id }, select: { numeroOS: true, etapa: true } });
  await writeTenantAudit(prisma, {
    entityId, userId: ator.id, action: 'OS_ABERTA', resource: 'registro_diario',
    newValue: { id: registro.id, numeroOS: r.numeroOS, etapa: r.etapa, servico: servico.nome, equipe: equipe.nome },
  });
  return { id: registro.id, numeroOS: r.numeroOS, etapa: r.etapa };
}

/* ═════════════════════════ Ficha da OS ═════════════════════════ */

const TEXTO_ACAO: Record<string, string> = {
  OS_ABERTA: 'Aberta', REGISTRO_DIARIO_CREATED: 'Aberta', OS_APROVAR: 'Aprovada', OS_RECUSAR: 'Recusada',
  OS_EXECUTAR: 'Baixa dada', OS_FINALIZAR: 'Conferida e finalizada', OS_REABRIR: 'Devolvida / reaberta', OS_CANCELAR: 'Cancelada',
};

export async function detalheOS(prisma: PrismaClient, entityId: string, ator: Ator, id: string) {
  await assertAcessoOS(prisma, ator, id, entityId);
  const [r, cfg] = await Promise.all([
    prisma.registroDiario.findFirst({
      where: { id, entityId },
      select: {
        id: true, numeroOS: true, etapa: true, origem: true, createdAt: true, lat: true, lng: true, enderecoGeocodificado: true,
        aprovadoEm: true, executadoEm: true, finalizadoEm: true, recusadoEm: true, motivoRecusa: true,
        devolvidoEm: true, motivoDevolucao: true, executadoPorId: true, campos: true, trabalharam: true,
        createdBy: { select: { id: true, name: true } }, aprovadoPor: { select: { name: true } }, executadoPor: { select: { name: true } },
        finalizadoPor: { select: { name: true } }, recusadoPor: { select: { name: true } },
        centroCusto: {
          select: {
            id: true, nome: true, cor: true, prazoDias: true, camposComuns: true,
            camposFicha: { where: { momento: 'BAIXA' }, orderBy: { ordem: 'asc' }, select: { id: true, nome: true, detalhe: true, tipo: true, opcoes: true, obrigatorio: true } },
          },
        },
        equipe: {
          select: {
            id: true, nome: true,
            usuariosEquipe: { where: { user: { status: 'ACTIVE' } }, select: { user: { select: { name: true } } } },
            equipe: { select: { lider: { select: { name: true } }, operadores: { where: { ativo: true }, select: { nome: true } } } },
          },
        },
        valores: { where: { propriedade: { nome: { in: NOMES_COMUNS } } }, select: { valorTexto: true, propriedade: { select: { nome: true } } } },
        midias: { orderBy: { createdAt: 'asc' }, select: { id: true, tipo: true, momento: true, createdAt: true } },
      },
    }),
    obterConfig(prisma, entityId),
  ]);
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Ordem de serviço não encontrada');

  const logs = await prisma.tenantAuditLog.findMany({
    where: { entityId, resource: 'registro_diario', newValue: { path: ['id'], equals: id } },
    orderBy: { createdAt: 'asc' },
    select: { action: true, createdAt: true, newValue: true, user: { select: { name: true } } },
  });
  const historico = logs.filter(l => TEXTO_ACAO[l.action]).map(l => {
    const nv = (l.newValue ?? {}) as { etapa?: EtapaOS; observacao?: string | null };
    return { quando: l.createdAt, acao: l.action, texto: TEXTO_ACAO[l.action], quem: l.user?.name ?? '—', etapa: nv.etapa ?? null, observacao: nv.observacao ?? null };
  });
  if (!historico.some(h => h.acao === 'OS_ABERTA' || h.acao === 'REGISTRO_DIARIO_CREATED')) {
    historico.unshift({ quando: r.createdAt, acao: 'OS_ABERTA', texto: 'Aberta', quem: r.createdBy.name, etapa: null, observacao: null });
  }

  const c = valoresComuns(r.valores);
  const campos = (r.campos ?? {}) as CamposOS;
  const fotos = r.midias.filter(m => m.tipo === 'foto').map(m => ({
    id: m.id, quando: m.createdAt,
    momento: m.momento ?? (r.executadoEm && m.createdAt > r.executadoEm ? 'BAIXA' : 'ABERTURA'),
  }));
  const fluxo = poderesFluxo(ator);
  const conferirBloqueado = cfg.conferenciaPropriaBloqueada && r.executadoPorId === ator.id && !ator.admin;
  const equipePessoas = r.equipe ? [...new Set([
    ...(r.equipe.equipe?.lider ? [r.equipe.equipe.lider.name] : []),
    ...r.equipe.usuariosEquipe.map(u => u.user.name),
    ...(r.equipe.equipe?.operadores ?? []).map(o => o.nome),
  ])] : [];
  return {
    id: r.id, numeroOS: r.numeroOS, etapa: r.etapa, rotuloEtapa: ROTULO_ETAPA[r.etapa], origem: r.origem,
    criadoEm: r.createdAt, aprovadoEm: r.aprovadoEm, executadoEm: r.executadoEm, finalizadoEm: r.finalizadoEm,
    recusadoEm: r.recusadoEm, motivoRecusa: r.motivoRecusa, devolvidoEm: r.devolvidoEm, motivoDevolucao: r.motivoDevolucao,
    abertoPor: r.createdBy.name, aprovadoPor: r.aprovadoPor?.name ?? null, executadoPor: r.executadoPor?.name ?? null,
    finalizadoPor: r.finalizadoPor?.name ?? null, recusadoPor: r.recusadoPor?.name ?? null,
    servico: { id: r.centroCusto.id, nome: r.centroCusto.nome, cor: r.centroCusto.cor },
    equipe: r.equipe ? { id: r.equipe.id, nome: r.equipe.nome, pessoas: equipePessoas.map(n => ({ nome: n, sigla: sigla(n) })) } : null,
    local: { bairro: c.bairro, logradouro: c.logradouro, lat: r.lat, lng: r.lng, endereco: r.enderecoGeocodificado },
    tipo: c.tipo, origemDemanda: c.origemDemanda, observacoes: c.observacoes,
    abertura: campos.abertura ?? [],
    baixa: campos.baixa ?? [], obsBaixa: campos.obsBaixa ?? null, trabalharam: r.trabalharam,
    camposBaixa: r.centroCusto.camposFicha,
    fotosObrigatorias: true,
    fotos,
    prazo: prazoDe(r, r.centroCusto.prazoDias ?? cfg.metaDias ?? 7, new Date()),
    historico,
    poderes: {
      aprovar: r.etapa === 'AGUARDANDO_APROVACAO' && fluxo.podeAprovar,
      darBaixa: r.etapa === 'REGISTRADA' && pode(ator, 'os.baixa'),
      conferir: r.etapa === 'EXECUTADA' && fluxo.podeConferir && !conferirBloqueado,
      conferirBloqueado: r.etapa === 'EXECUTADA' && fluxo.podeConferir && conferirBloqueado,
      cancelar: r.etapa !== 'FINALIZADA' && r.etapa !== 'CANCELADA' && fluxo.podeCancelar,
      reabrir: (r.etapa === 'FINALIZADA' || r.etapa === 'CANCELADA') && fluxo.podeReabrir,
    },
  };
}

/* ═════════════════════════ Baixa com foto ═════════════════════════ */

export interface DadosBaixa { campos?: RespostaCampo[]; trabalharam?: string[]; observacao?: string | null }

export async function darBaixa(prisma: PrismaClient, entityId: string, ator: Ator, id: string, d: DadosBaixa) {
  await assertAcessoOS(prisma, ator, id, entityId);
  const r = await prisma.registroDiario.findFirst({
    where: { id, entityId },
    select: {
      etapa: true, campos: true, devolvidoEm: true,
      centroCusto: { select: { camposFicha: { where: { momento: 'BAIXA' }, select: { id: true, nome: true, obrigatorio: true } } } },
      midias: { where: { tipo: 'foto' }, select: { momento: true, createdAt: true } },
    },
  });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Ordem de serviço não encontrada');
  if (r.etapa !== 'REGISTRADA') throw new AppError(409, 'CONFLICT', `Esta OS está "${ROTULO_ETAPA[r.etapa]}" — não dá para dar baixa agora`);
  if (!pode(ator, 'os.baixa')) throw new AppError(403, 'FORBIDDEN', 'Você não tem acesso para dar baixa em ordens de serviço');
  /* foto do depois: tirada para esta baixa (depois de uma devolução, vale só foto nova) */
  const depois = r.midias.filter(m => m.momento === 'BAIXA' && (!r.devolvidoEm || m.createdAt > r.devolvidoEm));
  if (!depois.length) throw new AppError(400, 'VALIDATION_ERROR', 'Tire pelo menos uma foto do depois');
  const respostas = (d.campos ?? []).filter(c => !vazio(c.valor));
  for (const c of r.centroCusto.camposFicha.filter(x => x.obrigatorio)) {
    if (!respostas.some(x => x.id === c.id || x.nome === c.nome)) throw new AppError(400, 'VALIDATION_ERROR', `Preencha "${c.nome}"`);
  }
  const atual = (r.campos ?? {}) as CamposOS;
  await prisma.registroDiario.update({
    where: { id },
    data: {
      campos: { ...atual, baixa: respostas, obsBaixa: d.observacao?.trim() || null } as unknown as Prisma.InputJsonValue,
      trabalharam: [...new Set((d.trabalharam ?? []).map(x => x.trim()).filter(Boolean))].slice(0, 30),
    },
  });
  return aplicarAcao(prisma, entityId, ator, id, 'executar', d.observacao ?? undefined);
}
