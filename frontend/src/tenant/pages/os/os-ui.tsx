import type { ReactNode } from 'react';
import type { CampoFichaOS, Etapa, LinhaOS, PessoaSigla, RespostaCampoOS, ValorCampoOS } from '../../../lib/api-client';
import { padroesDoServico } from '../cadastros/servico-padroes';
import '../../styles/os-premium.css';

/* ── Peças comuns das telas de Ordens de Serviço (padrão SisObras + os-premium) ── */

export const ROTULO_ETAPA: Record<Etapa, string> = {
  AGUARDANDO_APROVACAO: 'Aguardando aprovação', REGISTRADA: 'Registrada', EXECUTADA: 'Executada · conferir',
  FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada',
};
const TOM_ETAPA: Record<Etapa, string> = {
  AGUARDANDO_APROVACAO: 'amber', REGISTRADA: 'brand', EXECUTADA: 'cyan', FINALIZADA: 'mint', CANCELADA: 'ghost',
};

/** Badge da etapa com o ponto pulsando (devolvida aparece em coral) */
export function EtapaPill({ etapa, devolvida, curto }: { etapa: Etapa; devolvida?: boolean; curto?: boolean }) {
  if (devolvida) return <span className="os-pill coral"><i />Devolvida</span>;
  const rot = curto && etapa === 'AGUARDANDO_APROVACAO' ? 'Aguardando' : curto && etapa === 'EXECUTADA' ? 'A conferir' : ROTULO_ETAPA[etapa];
  return <span className={`os-pill ${TOM_ETAPA[etapa]}`}><i />{rot}</span>;
}

/** Ícone do serviço pela natureza do nome (cone, folha, lâmpada, vassoura…) */
const PATHS: [RegExp, ReactNode][] = [
  [/buraco|pavim|asfalt|recape|fresag/i, <><path d="M9.5 3h5l4.5 16h-14z" /><path d="M3 21h18" /><path d="M7.5 12h9" /></>],
  [/ro[cç]ag|capina|poda|pra[cç]a|jardim|[aá]rvore/i, <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" /><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12" /></>],
  [/ilumin|l[aâ]mpada|poste/i, <><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z" /></>],
  [/varr|limpeza|entulho|coleta|lixo/i, <><path d="M3 22l7-7" /><path d="M15 3 3 15l4 4L19 7z" /><path d="M18 2l4 4" /></>],
  [/pint/i, <><rect x="3" y="3" width="14" height="6" rx="1.5" /><path d="M17 6h3v5H11v4" /><rect x="9" y="15" width="4" height="7" rx="1" /></>],
  [/serralh|constru|obra|reforma/i, <><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" /><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" /><path d="M4 15v-3a6 6 0 0 1 6-6" /><path d="M14 6a6 6 0 0 1 6 6v3" /></>],
  [/oficina|frota|ve[ií]culo/i, <><path d="M1 4h14v12H1z" /><path d="M15 8h4l4 4v4h-8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>],
];
const CHAVE = <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />;
export function IconeServico({ nome }: { nome: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{PATHS.find(([re]) => re.test(nome))?.[1] ?? CHAVE}</svg>;
}
export const corServico = (cor: string | null | undefined) => cor || '#635BFF';

export function MarcaServico({ nome, cor, sub, tamanho, iconeDe }: { nome: string; cor: string | null; sub?: ReactNode; tamanho?: number; iconeDe?: string }) {
  const st = { '--c': corServico(cor), ...(tamanho ? { width: tamanho, height: tamanho, borderRadius: tamanho / 3.3 } : {}) } as React.CSSProperties;
  return (
    <span className="os-svc">
      <span className="m" style={st}><IconeServico nome={iconeDe ?? nome} /></span>
      <span style={{ minWidth: 0 }}><b>{nome}</b>{sub && <small>{sub}</small>}</span>
    </span>
  );
}

/** Cor de avatar estável pelo nome */
const GRADS = [
  'linear-gradient(135deg,#635BFF,#10C6D4)', 'linear-gradient(135deg,#E8962A,#E5534B)', 'linear-gradient(135deg,#19B88A,#10C6D4)',
  'linear-gradient(135deg,#8B5CF6,#635BFF)', 'linear-gradient(135deg,#10C6D4,#19B88A)', 'linear-gradient(135deg,#17213C,#3A4363)',
  'linear-gradient(135deg,#E5534B,#F59088)', 'linear-gradient(135deg,#19B88A,#0E8F6A)',
];
export function corAvatar(nome: string) {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADS[h % GRADS.length];
}
export function siglaDe(nome: string) {
  const p = nome.trim().split(/\s+/).filter(x => !/^(da|de|do|das|dos|e)$/i.test(x));
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? ''))).toUpperCase();
}
export function Avatares({ pessoas, max = 3, grande }: { pessoas: PessoaSigla[]; max?: number; grande?: boolean }) {
  const extra = pessoas.length - max;
  return (
    <span className="os-avs" title={pessoas.map(p => p.nome).join(', ')}>
      {pessoas.slice(0, max).map(p => <span key={p.nome} className={`os-av${grande ? ' lg' : ''}`} style={{ '--a': corAvatar(p.nome) } as React.CSSProperties}>{p.sigla}</span>)}
      {extra > 0 && <span className={`os-av${grande ? ' lg' : ''}`} style={{ '--a': 'linear-gradient(135deg,#68728A,#3A4363)' } as React.CSSProperties}>+{extra}</span>}
    </span>
  );
}

/** Barra de prazo: corre até a baixa; atrasada vira fita vermelha */
export function BarraPrazo({ l }: { l: Pick<LinhaOS, 'etapa' | 'prazoDias' | 'diasUsados' | 'atrasada' | 'noPrazo' | 'executadoEm'> }) {
  const dias = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${n === 1 ? 'dia' : 'dias'}`;
  let cls = 'os-sla', w = Math.min(100, Math.max(6, l.diasUsados / l.prazoDias * 100)), cor = 'linear-gradient(90deg,#635BFF,#10C6D4)', txt = `${dias(l.diasUsados)} de ${l.prazoDias}`;
  if (l.etapa === 'AGUARDANDO_APROVACAO') { cls += ' wait'; cor = 'linear-gradient(90deg,#F2B44C,#E8962A)'; txt = `aprovar · prazo ${l.prazoDias} dias`; }
  else if (l.atrasada) { cls += ' late'; w = 100; txt = `${dias(Math.round((l.diasUsados - l.prazoDias) * 10) / 10)} de atraso`; }
  else if (l.executadoEm) { cls += l.noPrazo ? ' ok' : ' late'; cor = 'linear-gradient(90deg,#19B88A,#10C6D4)'; txt = l.noPrazo ? `feita em ${dias(l.diasUsados)}` : `feita com ${dias(Math.round((l.diasUsados - l.prazoDias) * 10) / 10)} de atraso`; }
  else if (w > 70) cor = 'linear-gradient(90deg,#F2B44C,#E8962A)';
  if (l.etapa === 'CANCELADA') return <span className="os-sla"><small style={{ color: 'var(--muted)' }}>—</small></span>;
  return (
    <span className={cls}>
      <span className="b"><span style={{ width: `${w}%`, '--sc': cor } as React.CSSProperties} /></span>
      <small>{txt}</small>
    </span>
  );
}

/** Mini-gráfico que se desenha */
export function Spark({ valores, cor = '#635BFF', area = 'rgba(99,91,255,.13)' }: { valores: number[]; cor?: string; area?: string }) {
  const max = Math.max(1, ...valores);
  const pts = valores.map((v, i) => [valores.length > 1 ? i / (valores.length - 1) * 100 : 50, 27 - v / max * 22] as const);
  const linha = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const ult = pts[pts.length - 1];
  return (
    <svg className="os-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" style={{ '--sc': cor, '--sa': area } as React.CSSProperties}>
      <path className="a" d={`${linha} L100 30 L0 30 Z`} />
      <path className="l" pathLength={100} d={linha} />
      {ult && <circle className="p" cx={ult[0]} cy={ult[1]} r={3} />}
    </svg>
  );
}

/** Anel de % (no prazo) */
export function Anel({ pct, id }: { pct: number; id: string }) {
  const off = 163 - 163 * Math.max(0, Math.min(100, pct)) / 100;
  return (
    <svg className="os-ring" viewBox="0 0 62 62" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#19B88A" /><stop offset="1" stopColor="#10C6D4" /></linearGradient></defs>
      <circle className="bg" cx="31" cy="31" r="26" />
      <circle className="fg" cx="31" cy="31" r="26" stroke={`url(#${id})`} strokeDashoffset={off} />
    </svg>
  );
}

/* ── Ficha do serviço: campos, valores e fallback de quem nunca salvou a ficha ── */

/** Tipos e campos do serviço: os da ficha salva, senão os padrões das telas antigas */
export function fichaDoServico(s: { id: string; fichaSalva: boolean; subtipos: string[]; campos: CampoFichaOS[] }) {
  if (s.fichaSalva || s.subtipos.length || s.campos.length) return { subtipos: s.subtipos, campos: s.campos };
  const p = padroesDoServico(s.id);
  return {
    subtipos: p.subtipos,
    campos: p.campos.map((c, i): CampoFichaOS => ({ id: `padrao-${i}`, nome: c.nome, detalhe: c.detalhe, tipo: c.tipo, opcoes: c.opcoes, momento: c.momento, obrigatorio: c.obrigatorio })),
  };
}

export const respostaVazia = (v: ValorCampoOS) => v == null || v === '' || (Array.isArray(v) && !v.length);
export function textoResposta(v: ValorCampoOS): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ') || '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return v;
}
export function paraResposta(c: CampoFichaOS, valor: ValorCampoOS): RespostaCampoOS {
  return { id: c.id.startsWith('padrao-') ? null : c.id, nome: c.nome, tipo: c.tipo, valor };
}

/** Um campo da ficha no formulário: lista vira botões, várias vira etiquetas, número tem − + */
export function CampoFicha({ c, valor, onChange, grande }: { c: CampoFichaOS; valor: ValorCampoOS; onChange: (v: ValorCampoOS) => void; grande?: boolean }) {
  const rot = <span className="so-lbl">{c.nome} {c.obrigatorio && <span className="req">*</span>}{c.detalhe && <span className="opt">{c.detalhe}</span>}</span>;
  if (c.tipo === 'LISTA' || c.tipo === 'SIM_NAO') {
    const ops = c.tipo === 'SIM_NAO' ? ['Sim', 'Não'] : c.opcoes;
    const atual = c.tipo === 'SIM_NAO' ? (valor === true ? 'Sim' : valor === false ? 'Não' : '') : String(valor ?? '');
    if (ops.length <= 5 || grande) {
      return (
        <div className="so-field">{rot}
          <div className="so-seg" role="radiogroup" aria-label={c.nome}>
            {ops.map(o => (
              <label key={o} className={atual === o ? 'on' : ''}>
                <input type="radio" name={c.id} checked={atual === o} onChange={() => onChange(c.tipo === 'SIM_NAO' ? o === 'Sim' : o)} />{o}
              </label>
            ))}
          </div>
        </div>
      );
    }
    return (
      <label className="so-field">{rot}
        <span className="so-ctrl"><select value={atual} onChange={e => onChange(e.target.value || null)}><option value="">Escolha…</option>{ops.map(o => <option key={o}>{o}</option>)}</select></span>
      </label>
    );
  }
  if (c.tipo === 'VARIAS') {
    const lista = Array.isArray(valor) ? valor : [];
    return (
      <div className="so-field">{rot}
        <div className="so-tags">
          {c.opcoes.map(o => {
            const on = lista.includes(o);
            return <button key={o} type="button" className={`so-tag btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? lista.filter(x => x !== o) : [...lista, o])}>{o}</button>;
          })}
        </div>
      </div>
    );
  }
  if (c.tipo === 'NUMERO') {
    const n = typeof valor === 'number' ? valor : valor == null || valor === '' ? null : Number(String(valor).replace(',', '.'));
    const passo = /hora/i.test(c.nome) ? 0.5 : 0.1;
    const muda = (d: number) => onChange(Math.max(0, Math.round(((n ?? 0) + d) * 100) / 100));
    if (grande) {
      return (
        <div className="so-field">{rot}
          <div className="os-step2">
            <button type="button" onClick={() => muda(-passo)} aria-label={`Diminuir ${c.nome}`}>−</button>
            <input type="text" inputMode="decimal" aria-label={c.nome} value={n == null ? '' : String(n).replace('.', ',')}
              onChange={e => { const t = e.target.value.replace(',', '.'); onChange(t === '' ? null : Number.isNaN(Number(t)) ? n : Number(t)); }}
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', textAlign: 'center', font: '700 16px var(--font-mono)', color: 'var(--ink)' }} />
            <button type="button" onClick={() => muda(passo)} aria-label={`Aumentar ${c.nome}`}>+</button>
          </div>
        </div>
      );
    }
    return (
      <label className="so-field">{rot}
        <span className="so-ctrl mono"><input type="text" inputMode="decimal" value={n == null ? '' : String(n).replace('.', ',')}
          onChange={e => { const t = e.target.value.replace(',', '.'); onChange(t === '' ? null : Number.isNaN(Number(t)) ? n : Number(t)); }} /></span>
      </label>
    );
  }
  return (
    <label className="so-field">{rot}
      <span className="so-ctrl"><input type="text" value={String(valor ?? '')} onChange={e => onChange(e.target.value)} /></span>
    </label>
  );
}

/** Distância em metros entre dois pontos */
export function distanciaM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export const textoDistancia = (m: number) => m < 1000 ? `${Math.round(m / 50) * 50 || 50} m` : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
