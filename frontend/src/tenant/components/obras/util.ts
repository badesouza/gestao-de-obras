import { useEffect, useState } from 'react';
import { centralApi, mapaApi, type Etapa, type RegistroDiarioRow, type Situacao } from '../../../lib/api-client';
import { CENTRO_IDS, SERVICOS_CONFIG, type ServicoConfig } from '../../pages/servico-config';

/* ── utilitários da linguagem visual nova (Sala de Situação e telas de serviço) ── */

export const DIAS_ATRASO = 7;

/** Traduz o status livre de hoje ("Pendente", "Em Andamento"…) para as situações fixas */
export function situacaoDe(status: string | undefined): Situacao {
  const s = (status ?? '').toLowerCase();
  if (s.includes('conclu') || s.includes('executad') || s.includes('finaliz')) return 'concluida';
  if (s.includes('cancel')) return 'cancelada';
  if (s.includes('andamento') || s.includes('parcial') || s.includes('execu') || s.includes('aguardando')) return 'execucao';
  return 'aberta';
}

export const SITUACAO: Record<Situacao, { rotulo: string; classe: string }> = {
  aberta:    { rotulo: 'Aberta',      classe: 'is-aberta' },
  execucao:  { rotulo: 'Em execução', classe: 'is-execucao' },
  concluida: { rotulo: 'Concluída',   classe: 'is-concluida' },
  cancelada: { rotulo: 'Cancelada',   classe: 'is-cancelada' },
};

const SLUG_POR_CENTRO: Record<string, string> = Object.fromEntries(
  Object.entries(CENTRO_IDS).map(([slug, id]) => [id, slug]),
);
export const slugDoCentro = (centroId: string): string | undefined => SLUG_POR_CENTRO[centroId];
export const servicoDoCentro = (centroId: string): ServicoConfig | undefined => {
  const slug = SLUG_POR_CENTRO[centroId];
  return slug ? SERVICOS_CONFIG[slug] : undefined;
};

/** Número da OS como aparece na impressão (o oficial, quando existe) */
export const numeroOS = (id: string, dataISO: string) => `OS-${dataISO.slice(0, 4)}-${id.slice(0, 6).toUpperCase()}`;
export const numeroDaOS = (row: Pick<RegistroDiarioRow, 'id' | 'data' | 'numeroOS'>) => row.numeroOS ?? numeroOS(row.id, row.data);

/* ── etapas da ordem de serviço ── */
export const ETAPA: Record<Etapa, { rotulo: string; classe: string; cor: string }> = {
  AGUARDANDO_APROVACAO: { rotulo: 'Aguardando aprovação', classe: 'is-aprovacao',  cor: 'var(--ob-violeta)' },
  REGISTRADA:           { rotulo: 'Registrada',           classe: 'is-aberta',     cor: 'var(--ob-blue)' },
  EXECUTADA:            { rotulo: 'Executada · conferir', classe: 'is-execucao',   cor: 'var(--ob-amber)' },
  FINALIZADA:           { rotulo: 'Finalizada',           classe: 'is-concluida',  cor: 'var(--ob-green)' },
  CANCELADA:            { rotulo: 'Cancelada',            classe: 'is-cancelada',  cor: 'var(--ob-faint)' },
};
export const etapaAberta = (e: Etapa) => e === 'AGUARDANDO_APROVACAO' || e === 'REGISTRADA';
/** Para registros antigos sem etapa, deduz pelo status de texto */
export const etapaDe = (row: Pick<RegistroDiarioRow, 'etapa'>, statusTexto?: string): Etapa => {
  if (row.etapa) return row.etapa;
  const s = situacaoDe(statusTexto);
  return s === 'concluida' ? 'FINALIZADA' : s === 'cancelada' ? 'CANCELADA' : 'REGISTRADA';
};

export const reduzMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Número que sobe do zero até o valor, com desaceleração */
export function useContador(alvo: number, duracao = 1100) {
  const [v, setV] = useState(0);
  const semAnimacao = reduzMovimento();
  useEffect(() => {
    if (semAnimacao) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duracao);
      setV(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao, semAnimacao]);
  return semAnimacao ? alvo : v;
}

/** Foto autenticada: baixa como blob e libera ao desmontar.
    origem 'registro' = foto de ocorrência; 'central' = foto enviada pelo munícipe */
export function useFotoUrl(entityId: string, fotoId: string | null | undefined, origem: 'registro' | 'central' = 'registro') {
  const [foto, setFoto] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!fotoId) return;
    let viva = true, atual: string | null = null;
    (origem === 'central' ? centralApi.fotoBlob(entityId, fotoId) : mapaApi.fetchMidiaBlob(entityId, fotoId))
      .then(u => { if (viva) { atual = u; setFoto({ id: fotoId, url: u }); } else URL.revokeObjectURL(u); })
      .catch(() => {});
    return () => { viva = false; if (atual) URL.revokeObjectURL(atual); };
  }, [entityId, fotoId, origem]);
  return foto && foto.id === fotoId ? foto.url : null;
}

export function haQuanto(iso: string | null | undefined, agora = Date.now()) {
  if (!iso) return 'sem registro';
  const m = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Dias inteiros desde uma data AAAA-MM-DD (dia do calendário, sem fuso) */
export function diasDesde(dataISO: string, agora = new Date()) {
  const [y, m, d] = dataISO.slice(0, 10).split('-').map(Number);
  const inicio = new Date(y, m - 1, d);
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.max(0, Math.round((hoje.getTime() - inicio.getTime()) / 86_400_000));
}

export const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const dataBr = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
/** Primeiro e último nome ("Maria da Silva Santos" → "Maria Santos") */
export const nomeCurto = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : p[0] ?? ''; };
export const iniciais = (n: string) => n.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
