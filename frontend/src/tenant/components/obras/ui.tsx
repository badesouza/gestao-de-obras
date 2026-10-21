import type { Situacao } from '../../../lib/api-client';
import { SITUACAO, useContador, useFotoUrl, horaDe } from './util';
import '../../styles/obras-ui.css';

/* ── peças visuais compartilhadas ── */

export function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  const W = 96, H = 30, max = Math.max(1, ...valores), n = Math.max(2, valores.length);
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  const pts = valores.map((v, i) => `${(i / (n - 1)) * W},${y(v)}`).join(' ');
  return (
    <svg className="ob-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline className="ob-spark-linha" points={pts} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      {valores.length > 0 && <circle className="ob-spark-ponto" cx={((valores.length - 1) / (n - 1)) * W} cy={y(valores[valores.length - 1])} r="3" fill={cor} />}
    </svg>
  );
}

export function Medidor({ valor, meta, cor }: { valor: number | null; meta: number; cor: string }) {
  const pct = valor == null ? 0 : Math.min(100, (valor / (meta * 2)) * 100);
  return (
    <div className="ob-medidor" aria-hidden="true">
      <div className="ob-medidor-trilho">
        <div className="ob-medidor-barra" style={{ width: `${pct}%`, background: cor }} />
        <div className="ob-medidor-meta" style={{ left: '50%' }} />
      </div>
    </div>
  );
}

export function Anel({ pct, cor }: { pct: number | null; cor: string }) {
  const r = 14, c = 2 * Math.PI * r, p = pct == null ? 0 : pct / 100;
  return (
    <svg className="ob-anel" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle className="ob-anel-trilho" cx="18" cy="18" r={r} fill="none" strokeWidth="4" />
      <circle className="ob-anel-arco" cx="18" cy="18" r={r} fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 18 18)" />
    </svg>
  );
}

export type Tom = 'ok' | 'alerta' | 'ruim' | 'neutro';

export function Kpi({ i, rotulo, valor, decimais = 0, unidade, nota, tom, cor, grafico }: {
  i: number; rotulo: string; valor: number | null; decimais?: number; unidade?: string;
  nota: string; tom: Tom; cor: string; grafico: React.ReactNode;
}) {
  const n = useContador(valor ?? 0);
  const texto = valor == null ? '—' : decimais ? n.toFixed(decimais).replace('.', ',') : Math.round(n).toString();
  return (
    <div className="ob-kpi ob-reveal" style={{ '--i': i, '--kpi-cor': cor } as React.CSSProperties}>
      <span className="ob-kpi-rotulo">{rotulo}</span>
      <div className="ob-kpi-linha">
        <span className="ob-kpi-valor">{texto}</span>
        {unidade && valor != null && <span className="ob-kpi-unidade">{unidade}</span>}
      </div>
      <div className="ob-kpi-rodape">
        <span className={`ob-kpi-nota tom-${tom}`}>{nota}</span>
        {grafico}
      </div>
    </div>
  );
}

export function KpiCarregando() {
  return <div className="ob-kpi"><span className="ob-skeleton" style={{ height: 96 }} /></div>;
}

export function Badge({ situacao, titulo }: { situacao: Situacao; titulo?: string }) {
  const s = SITUACAO[situacao];
  return <span className={`ob-badge ${s.classe}`} title={titulo}><i />{s.rotulo}</span>;
}

/** Miniatura da foto carimbada, com a hora no canto (a parte de baixo, onde fica o carimbo, aparece) */
export function FotoThumb({ entityId, fotoId, quando, cor, icone, tamanho = 80, contagem }: {
  entityId: string; fotoId: string | null | undefined; quando?: string; cor: string;
  icone?: React.ReactNode; tamanho?: number; contagem?: number;
}) {
  const url = useFotoUrl(entityId, fotoId);
  return (
    <span className="ob-thumb" style={{ '--serv-cor': cor, width: tamanho, height: tamanho } as React.CSSProperties}>
      {url ? <img src={url} alt="" /> : fotoId ? <span className="ob-skeleton" /> : (
        <span className="ob-thumb-vazio">{icone}<small>sem foto</small></span>
      )}
      {url && quando && <span className="ob-thumb-hora"><b>{horaDe(quando)}</b><i /></span>}
      {url && contagem != null && contagem > 1 && <span className="ob-thumb-qtd">{contagem}</span>}
    </span>
  );
}
