import type { FastifyInstance } from 'fastify';
import { handleAppError } from '../../../shared/errors.js';
import { requireTenantAuth } from '../../../plugins/auth-tenant.js';

/* ── Sala de Situação ─────────────────────────────────────────────
   Agrega todas as ocorrências da entidade em números para o secretário:
   abertas, atrasadas, concluídas na semana, tempo até concluir, fotos,
   o que está chegando do campo, alertas, por serviço e por equipe.    */

const PROPS = ['Status', 'Bairro / Localidade', 'Logradouro / Referência', 'Equipe / Turma', 'Tipo de Serviço'];
const DIAS_ATRASO = 7;
const META_DIAS = 5;
const LIMITE_GPS_M = 2000;
const DIAS_SERIE = 14;
const FUSO_MS = -3 * 3600_000; // Brasília

type Situacao = 'aberta' | 'execucao' | 'concluida' | 'cancelada';

function situacaoDe(status: string): Situacao {
  const s = status.toLowerCase();
  if (s.includes('conclu') || s.includes('executad') || s.includes('finaliz')) return 'concluida';
  if (s.includes('cancel')) return 'cancelada';
  if (s.includes('andamento') || s.includes('parcial') || s.includes('execu')) return 'execucao';
  return 'aberta';
}

/** Meia-noite (horário de Brasília) do dia de `d`, como instante UTC */
function inicioDia(d: Date): Date {
  const local = new Date(d.getTime() + FUSO_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - FUSO_MS);
}

function diaISO(d: Date): string {
  return new Date(d.getTime() + FUSO_MS).toISOString().slice(0, 10);
}

function distanciaM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function registerPainelRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);

  fastify.get('/painel', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const entityId = req.user.entityId!;
      const agora = new Date();
      const hoje0 = inicioDia(agora);
      const dia = 86_400_000;
      const semana0 = new Date(hoje0.getTime() - 6 * dia);
      const semanaAnterior0 = new Date(hoje0.getTime() - 13 * dia);
      const mes0 = (() => { const l = new Date(agora.getTime() + FUSO_MS); return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - FUSO_MS); })();
      const janela0 = new Date(hoje0.getTime() - 180 * dia);

      const [registros, bairros, equipesCadastro] = await Promise.all([
        fastify.prisma.registroDiario.findMany({
          where: { entityId, createdAt: { gte: janela0 } },
          select: {
            id: true, data: true, createdAt: true, updatedAt: true, lat: true, lng: true,
            centroCusto: { select: { id: true, nome: true } },
            createdBy: { select: { id: true, name: true } },
            valores: {
              where: { propriedade: { nome: { in: PROPS } } },
              select: { valorTexto: true, propriedade: { select: { nome: true } } },
            },
            midias: { where: { tipo: 'foto' }, orderBy: { createdAt: 'asc' }, take: 1, select: { id: true } },
            _count: { select: { midias: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 3000,
        }),
        fastify.prisma.cadastroAuxiliar.findMany({
          where: { entityId, tipo: 'BAIRRO', lat: { not: null }, lng: { not: null } },
          select: { nome: true, lat: true, lng: true },
        }),
        fastify.prisma.cadastroAuxiliar.findMany({
          where: { entityId, tipo: 'EQUIPE', ativo: true },
          select: { nome: true },
          orderBy: { ordem: 'asc' },
        }),
      ]);

      const itens = registros.map(r => {
        const v: Record<string, string> = {};
        r.valores.forEach(x => { if (x.valorTexto) v[x.propriedade.nome] = x.valorTexto; });
        const status = v['Status'] ?? '';
        return {
          id: r.id,
          criadoEm: r.createdAt,
          atualizadoEm: r.updatedAt,
          lat: r.lat, lng: r.lng,
          servico: r.centroCusto,
          fiscal: r.createdBy,
          bairro: v['Bairro / Localidade'] ?? '',
          logradouro: v['Logradouro / Referência'] ?? '',
          equipe: v['Equipe / Turma'] ?? '',
          tipo: v['Tipo de Serviço'] ?? '',
          status,
          situacao: situacaoDe(status),
          fotoId: r.midias[0]?.id ?? null,
          fotos: r._count.midias,
        };
      });

      const ativos = itens.filter(i => i.situacao !== 'cancelada');
      const abertos = ativos.filter(i => i.situacao === 'aberta' || i.situacao === 'execucao');
      const concluidos = ativos.filter(i => i.situacao === 'concluida');
      const doMes = ativos.filter(i => i.criadoEm >= mes0);

      /* ── KPIs ── */
      const atrasados = abertos.filter(i => agora.getTime() - i.criadoEm.getTime() > DIAS_ATRASO * dia);
      const concluidasSemana = concluidos.filter(i => i.atualizadoEm >= semana0).length;
      const concluidasSemanaAnterior = concluidos.filter(i => i.atualizadoEm >= semanaAnterior0 && i.atualizadoEm < semana0).length;
      const concluidos30 = concluidos.filter(i => i.atualizadoEm >= new Date(hoje0.getTime() - 29 * dia));
      const tempoMedioDias = concluidos30.length
        ? Math.round(concluidos30.reduce((s, i) => s + (i.atualizadoEm.getTime() - i.criadoEm.getTime()) / dia, 0) / concluidos30.length * 10) / 10
        : null;
      const comFoto = doMes.filter(i => i.fotos > 0).length;
      const comFotoPct = doMes.length ? Math.round(comFoto / doMes.length * 100) : null;

      /* ── Série dos últimos 14 dias ── */
      const serie: { data: string; registradas: number; concluidas: number }[] = [];
      for (let k = DIAS_SERIE - 1; k >= 0; k--) {
        const d0 = new Date(hoje0.getTime() - k * dia), d1 = new Date(d0.getTime() + dia);
        serie.push({
          data: diaISO(d0),
          registradas: ativos.filter(i => i.criadoEm >= d0 && i.criadoEm < d1).length,
          concluidas: concluidos.filter(i => i.atualizadoEm >= d0 && i.atualizadoEm < d1).length,
        });
      }

      /* ── Chegando do campo ── */
      const feed = itens.slice(0, 8).map(i => ({
        id: i.id, servico: i.servico, bairro: i.bairro, logradouro: i.logradouro, tipo: i.tipo,
        status: i.status, situacao: i.situacao, criadoEm: i.criadoEm.toISOString(),
        fiscal: i.fiscal.name, fotoId: i.fotoId, fotos: i.fotos, lat: i.lat, lng: i.lng,
      }));

      /* ── Alertas ── */
      const diasAberta = (i: { criadoEm: Date }) => Math.floor((agora.getTime() - i.criadoEm.getTime()) / dia);
      const gpsLonge = abertos.concat(concluidos).flatMap(i => {
        if (i.lat == null || i.lng == null || !i.bairro) return [];
        const b = bairros.find(x => x.nome.toLowerCase() === i.bairro.toLowerCase());
        if (!b) return [];
        const d = distanciaM(i.lat, i.lng, b.lat!, b.lng!);
        return d > LIMITE_GPS_M ? [{ id: i.id, servico: i.servico.nome, bairro: i.bairro, distanciaM: Math.round(d) }] : [];
      }).filter(x => itens.find(i => i.id === x.id)!.criadoEm >= mes0);
      const semFoto = doMes.filter(i => i.fotos === 0);

      const alertas = {
        atrasadas: {
          total: atrasados.length,
          itens: atrasados.sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime()).slice(0, 3)
            .map(i => ({ id: i.id, servico: i.servico.nome, servicoId: i.servico.id, bairro: i.bairro, dias: diasAberta(i) })),
        },
        gpsLonge: { total: gpsLonge.length, itens: gpsLonge.slice(0, 3) },
        semFoto: {
          total: semFoto.length,
          itens: semFoto.slice(0, 3).map(i => ({ id: i.id, servico: i.servico.nome, servicoId: i.servico.id, bairro: i.bairro, criadoEm: i.criadoEm.toISOString() })),
        },
      };

      /* ── Por serviço (mês) ── */
      const porServicoMap = new Map<string, { id: string; nome: string; abertas: number; execucao: number; concluidas: number; total: number }>();
      for (const i of doMes) {
        const s = porServicoMap.get(i.servico.id) ?? { id: i.servico.id, nome: i.servico.nome, abertas: 0, execucao: 0, concluidas: 0, total: 0 };
        s.total++;
        if (i.situacao === 'concluida') s.concluidas++;
        else if (i.situacao === 'execucao') s.execucao++;
        else s.abertas++;
        porServicoMap.set(i.servico.id, s);
      }
      const porServico = Array.from(porServicoMap.values()).sort((a, b) => b.total - a.total);

      /* ── Equipes hoje ── */
      const deHoje = ativos.filter(i => i.criadoEm >= hoje0);
      const equipesMap = new Map<string, { nome: string; hoje: number; ultimo: string | null }>();
      for (const e of equipesCadastro) equipesMap.set(e.nome, { nome: e.nome, hoje: 0, ultimo: null });
      for (const i of ativos) {
        if (!i.equipe) continue;
        const e = equipesMap.get(i.equipe) ?? { nome: i.equipe, hoje: 0, ultimo: null };
        if (i.criadoEm >= hoje0) e.hoje++;
        if (!e.ultimo || i.criadoEm.toISOString() > e.ultimo) e.ultimo = i.criadoEm.toISOString();
        equipesMap.set(i.equipe, e);
      }
      const equipes = Array.from(equipesMap.values()).sort((a, b) => b.hoje - a.hoje || (b.ultimo ?? '').localeCompare(a.ultimo ?? ''));

      /* ── Fiscais em campo hoje ── */
      const fiscaisMap = new Map<string, string>();
      deHoje.forEach(i => fiscaisMap.set(i.fiscal.id, i.fiscal.name));

      return reply.send({
        agora: agora.toISOString(),
        kpis: {
          abertas: abertos.length,
          emExecucao: abertos.filter(i => i.situacao === 'execucao').length,
          atrasadas: atrasados.length,
          concluidasSemana, concluidasSemanaAnterior,
          tempoMedioDias, metaDias: META_DIAS,
          comFotoPct, semFoto: semFoto.length,
          registradasHoje: deHoje.length,
          totalMes: doMes.length,
        },
        serie,
        feed,
        alertas,
        porServico,
        equipes,
        fiscais: { total: fiscaisMap.size, nomes: Array.from(fiscaisMap.values()) },
      });
    } catch (e) {
      return handleAppError(reply, e);
    }
  });
}
