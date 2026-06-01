import { useEffect, useRef, useState } from 'react';
import { tenantApi } from '../../lib/api-client';
import type { ServicoConfig } from '../pages/servico-config';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function metricUnit(slug: string) {
  if (slug === 'varricao') return 'm';
  if (slug === 'coleta-entulhos') return 'm³';
  return 'm²';
}

function metricLabel(slug: string) {
  if (slug === 'varricao') return 'Extensão executada';
  if (slug === 'coleta-entulhos') return 'Volume coletado';
  if (slug === 'tapa-buracos') return 'Área executada';
  if (slug === 'pintura') return 'Área pintada';
  if (slug === 'rocagem') return 'Área roçada';
  return 'Produção';
}

type MetaMes = { metaRegistros: number | null; metaProducao: number | null; metaHoras: number | null };
type DraftMes = { metaRegistros: string; metaProducao: string; metaHoras: string };

const emptyDraft = (): DraftMes => ({ metaRegistros: '', metaProducao: '', metaHoras: '' });
const fmt = (v: number | null) =>
  v != null ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v) : '—';
const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
const parse = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/* ── Gráfico SVG aprimorado ──────────────────────────────────────── */
function GraficoAnual({ metas, cor, mesAtual }: {
  metas: (number | null)[];
  cor: string;
  mesAtual: number;
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const valid = metas.filter(v => v != null) as number[];

  if (valid.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 0',
        background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 6px, #fff 6px, #fff 12px)',
        borderRadius: 16, border: '1.5px dashed #e2e8f0',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
        <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
          Defina metas para visualizar a curva anual
        </p>
      </div>
    );
  }

  const W = 860, H = 200, padL = 48, padR = 20, padT = 24, padB = 32;
  const w = W - padL - padR;
  const h = H - padT - padB;
  const maxVal = Math.max(...valid, 1) * 1.1;
  const n = 12;

  const x = (i: number) => padL + (i / (n - 1)) * w;
  const y = (v: number) => padT + h - (v / maxVal) * h;

  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    if (metas[i] != null && metas[i + 1] != null) {
      segments.push({ x1: x(i), y1: y(metas[i]!), x2: x(i + 1), y2: y(metas[i + 1]!) });
    }
  }

  const firstValidIdx = metas.findIndex(v => v != null);
  const lastValidIdx = [...metas].reverse().findIndex(v => v != null);
  const lastIdx = 11 - lastValidIdx;

  /* smooth curve path usando bezier */
  const smoothPath = () => {
    const pts = metas
      .map((v, i) => v != null ? { x: x(i), y: y(v) } : null)
      .filter(Boolean) as { x: number; y: number }[];

    if (pts.length < 2) return '';

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpX = (prev.x + curr.x) / 2;
      d += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
    }
    return d;
  };

  const areaPath = () => {
    const pts = metas
      .map((v, i) => v != null ? { x: x(i), y: y(v) } : null)
      .filter(Boolean) as { x: number; y: number }[];

    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${padT + h}`;
    d += ` L ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpX = (prev.x + curr.x) / 2;
      d += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${padT + h} Z`;
    return d;
  };

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i));

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: H, overflow: 'visible' }}
        onMouseLeave={() => setHovIdx(null)}
      >
        <defs>
          <linearGradient id="pg-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={cor} stopOpacity={0.01} />
          </linearGradient>
          <filter id="pg-glow">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={cor} floodOpacity="0.4" />
          </filter>
          <linearGradient id="pg-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={cor} stopOpacity={0.6} />
            <stop offset="50%" stopColor={cor} stopOpacity={1} />
            <stop offset="100%" stopColor={cor} stopOpacity={0.6} />
          </linearGradient>
        </defs>

        {/* grid horizontal sutil */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)}
              stroke="#f1f5f9" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={9}
              fontWeight={600} fill="#cbd5e1">{fmtK(v)}</text>
          </g>
        ))}

        {/* coluna do mês atual */}
        <rect
          x={x(mesAtual - 1) - w / n / 2} y={padT}
          width={w / n} height={h}
          fill={`${cor}08`} rx={4}
        />

        {/* área preenchida */}
        <path d={areaPath()} fill="url(#pg-area)" />

        {/* linha principal */}
        <path d={smoothPath()} fill="none" stroke="url(#pg-line)"
          strokeWidth={3} strokeLinecap="round" filter="url(#pg-glow)" />

        {/* zonas hover invisíveis */}
        {metas.map((v, i) => (
          <rect key={i}
            x={x(i) - w / n / 2} y={padT}
            width={w / n} height={h + padB}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHovIdx(i)}
          />
        ))}

        {/* linha vertical hover */}
        {hovIdx !== null && metas[hovIdx] != null && (
          <line x1={x(hovIdx)} y1={padT} x2={x(hovIdx)} y2={padT + h}
            stroke={cor} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
        )}

        {/* pontos */}
        {metas.map((v, i) => v != null ? (
          <g key={i}>
            {hovIdx === i && (
              <circle cx={x(i)} cy={y(v)} r={14} fill={cor} opacity={0.1} />
            )}
            <circle cx={x(i)} cy={y(v)}
              r={hovIdx === i ? 7 : 4.5}
              fill="#fff" stroke={cor}
              strokeWidth={hovIdx === i ? 3 : 2}
              style={{ transition: 'r 0.15s, stroke-width 0.15s' }}
            />
            {hovIdx === i && (
              <text x={x(i)} y={y(v) - 14} textAnchor="middle"
                fontSize={11} fontWeight={800} fill={cor}>{fmtK(v)}</text>
            )}
          </g>
        ) : (
          <circle key={i} cx={x(i)} cy={padT + h} r={2.5} fill="#e2e8f0" opacity={0.6} />
        ))}

        {/* eixo X */}
        {MESES.map((m, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle"
            fontSize={10} fontWeight={i === mesAtual - 1 ? 800 : 500}
            fill={i === mesAtual - 1 ? cor : '#94a3b8'}>
            {m}
          </text>
        ))}
      </svg>

      {/* tooltip flutuante quando hover */}
      {hovIdx !== null && metas[hovIdx] != null && (
        <div style={{
          position: 'absolute',
          left: `${(hovIdx / 11) * 100}%`,
          top: 0,
          transform: hovIdx > 8 ? 'translateX(-100%)' : 'translateX(8px)',
          background: '#0a1018',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '8px 12px',
          pointerEvents: 'none',
          zIndex: 10,
          minWidth: 120,
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            {MESES_FULL[hovIdx]}
          </p>
          <p style={{ fontSize: 18, fontWeight: 900, color: cor, lineHeight: 1 }}>
            {fmt(metas[hovIdx])}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Componente principal ────────────────────────────────────────── */
interface Props {
  entityId: string;
  centroId: string;
  config: ServicoConfig;
  year: number;
}

const ROW_ICONS = {
  metaRegistros: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  metaProducao: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  metaHoras: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
};

const ROW_COLORS = {
  metaRegistros: '#2563eb',
  metaProducao: '#7c3aed',
  metaHoras: '#f59e0b',
};

export function PlanejamentoAnual({ entityId, centroId, config, year }: Props) {
  const [metas, setMetas] = useState<Record<number, MetaMes>>({});
  const [draft, setDraft] = useState<Record<number, DraftMes>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState(year);
  const [graficoIndicador, setGraficoIndicador] = useState<'metaProducao' | 'metaRegistros' | 'metaHoras'>('metaProducao');
  const [hovRow, setHovRow] = useState<string | null>(null);
  const [hovCol, setHovCol] = useState<number | null>(null);
  const mesAtual = new Date().getMonth() + 1;

  const unit = metricUnit(config.slug);
  const prodLabel = metricLabel(config.slug);

  useEffect(() => {
    setLoading(true);
    tenantApi.centrosCusto.getMetasAno(entityId, centroId, activeYear)
      .then(r => setMetas(r.metas ?? {}))
      .catch(() => setMetas({}))
      .finally(() => setLoading(false));
  }, [entityId, centroId, activeYear]);

  const startEdit = () => {
    const d: Record<number, DraftMes> = {};
    for (let m = 1; m <= 12; m++) {
      const meta = metas[m];
      d[m] = {
        metaRegistros: meta?.metaRegistros != null ? String(meta.metaRegistros) : '',
        metaProducao:  meta?.metaProducao  != null ? String(meta.metaProducao)  : '',
        metaHoras:     meta?.metaHoras     != null ? String(meta.metaHoras)     : '',
      };
    }
    setDraft(d);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const metasBody: Record<number, MetaMes> = {};
    for (let m = 1; m <= 12; m++) {
      const d = draft[m] ?? emptyDraft();
      metasBody[m] = {
        metaRegistros: parse(d.metaRegistros),
        metaProducao:  parse(d.metaProducao),
        metaHoras:     parse(d.metaHoras),
      };
    }
    await tenantApi.centrosCusto.saveMetasAno(entityId, centroId, { year: activeYear, metas: metasBody });
    setMetas(metasBody);
    setSaving(false);
    setEditing(false);
  };

  const setCell = (month: number, field: keyof DraftMes, value: string) => {
    setDraft(d => ({ ...d, [month]: { ...(d[month] ?? emptyDraft()), [field]: value } }));
  };

  const graficoData = Array.from({ length: 12 }, (_, i) => metas[i + 1]?.[graficoIndicador] ?? null);

  const totalMeta = (field: keyof MetaMes) =>
    Array.from({ length: 12 }, (_, i) => metas[i + 1]?.[field] ?? 0)
      .reduce<number>((a, b) => a + (b ?? 0), 0);

  const rows = [
    { field: 'metaRegistros' as const, label: 'Ocorrências', unit: 'ocorr.' },
    { field: 'metaProducao'  as const, label: prodLabel,     unit },
    { field: 'metaHoras'    as const, label: 'Horas',        unit: 'h' },
  ] as const;

  const graficoLabels = {
    metaProducao: prodLabel,
    metaRegistros: 'Ocorrências',
    metaHoras: 'Horas',
  };

  return (
    <div style={{
      borderRadius: 20,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04), 0 20px 60px -10px rgba(0,0,0,0.08)',
    }}>

      {/* ── Header com gradiente ────────────────────────────── */}
      <div style={{
        padding: '24px 28px 20px',
        background: `linear-gradient(135deg, ${config.cor}0d 0%, transparent 60%)`,
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        {/* ícone */}
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: `${config.cor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.cor} strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="13" y2="18"/>
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: config.cor, marginBottom: 2 }}>
            Planejamento anual
          </p>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {config.nome}
            <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>— metas {activeYear}</span>
          </h3>
        </div>

        {/* navegação de ano */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: '#f8fafc', borderRadius: 12, padding: '4px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <button type="button" onClick={() => setActiveYear(y => y - 1)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', padding: '6px 10px', borderRadius: 8,
            fontSize: 14, lineHeight: 1, transition: 'all 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >‹</button>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', minWidth: 44, textAlign: 'center' }}>
            {activeYear}
          </span>
          <button type="button" onClick={() => setActiveYear(y => y + 1)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', padding: '6px 10px', borderRadius: 8,
            fontSize: 14, lineHeight: 1, transition: 'all 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >›</button>
        </div>

        {/* botões */}
        {!editing ? (
          <button type="button" onClick={startEdit} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 12, fontWeight: 700, color: '#fff',
            background: `linear-gradient(135deg, ${config.cor}, ${config.cor}cc)`,
            border: 'none', borderRadius: 12, padding: '10px 18px', cursor: 'pointer',
            boxShadow: `0 4px 14px ${config.cor}40`,
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${config.cor}55`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 4px 14px ${config.cor}40`; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar metas
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setEditing(false)} style={{
              fontSize: 12, fontWeight: 700, color: '#64748b',
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: '10px 16px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: '#fff',
              background: saving ? '#94a3b8' : 'linear-gradient(135deg, #16a34a, #15803d)',
              border: 'none', borderRadius: 12, padding: '10px 20px', cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 14px rgba(22,163,74,0.35)',
              transition: 'all 0.2s',
            }}>
              {saving ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {saving ? 'Salvando…' : 'Salvar planejamento'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${config.cor}30`, borderTopColor: config.cor, animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Carregando metas…</p>
        </div>
      ) : (
        <>
          {/* ── Tabela ──────────────────────────────────────── */}
          <div style={{ padding: '20px 24px 0', overflowX: 'auto' }}>
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
              .plan-row { animation: fadeUp 0.3s ease both; }
              .plan-cell-val {
                display: inline-flex; align-items: center; justify-content: center;
                padding: 5px 10px; border-radius: 9px; font-size: 12px; font-weight: 700;
                transition: all 0.15s; min-width: 52px;
              }
              .plan-cell-val:hover { transform: scale(1.08); }
              .plan-input {
                width: 60px; text-align: center; font-size: 12px; font-weight: 700;
                border-radius: 9px; padding: 5px 4px;
                outline: none; transition: all 0.15s;
                -moz-appearance: textfield;
              }
              .plan-input::-webkit-outer-spin-button,
              .plan-input::-webkit-inner-spin-button { -webkit-appearance: none; }
              .plan-input:focus { transform: scale(1.05); }
            `}</style>

            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 2px', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left', padding: '8px 16px 12px',
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: '#cbd5e1',
                    borderBottom: '1px solid #f1f5f9', width: 170,
                  }}>Indicador</th>
                  {MESES.map((m, i) => {
                    const isCur = i + 1 === mesAtual && activeYear === year;
                    return (
                      <th key={i} style={{
                        textAlign: 'center', padding: '8px 4px 12px',
                        fontSize: 10, fontWeight: isCur ? 900 : 700,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: isCur ? config.cor : hovCol === i + 1 ? '#475569' : '#cbd5e1',
                        borderBottom: `2px solid ${isCur ? config.cor : hovCol === i + 1 ? '#e2e8f0' : '#f8fafc'}`,
                        minWidth: 68, transition: 'all 0.15s',
                        position: 'relative',
                      }}>
                        {m}
                        {isCur && (
                          <span style={{
                            display: 'block', width: 5, height: 5, borderRadius: '50%',
                            background: config.cor, margin: '3px auto 0',
                          }} />
                        )}
                      </th>
                    );
                  })}
                  <th style={{
                    textAlign: 'right', padding: '8px 16px 12px',
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: '#cbd5e1',
                    borderBottom: '1px solid #f1f5f9',
                  }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ field, label, unit: u }, rowIdx) => {
                  const rowColor = ROW_COLORS[field];
                  const total = totalMeta(field);
                  const isHovRow = hovRow === field;

                  return (
                    <tr key={field}
                      className="plan-row"
                      style={{
                        animationDelay: `${rowIdx * 0.07}s`,
                        background: isHovRow ? `${rowColor}05` : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={() => setHovRow(field)}
                      onMouseLeave={() => setHovRow(null)}
                    >
                      {/* label */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            display: 'flex', width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            alignItems: 'center', justifyContent: 'center',
                            background: `${rowColor}15`, color: rowColor,
                            transition: 'all 0.15s',
                            transform: isHovRow ? 'scale(1.1)' : 'scale(1)',
                          }}>
                            {ROW_ICONS[field]}
                          </span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{label}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{u}</div>
                          </div>
                        </div>
                      </td>

                      {/* células de meses */}
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = i + 1;
                        const val = metas[m]?.[field] ?? null;
                        const isCur = m === mesAtual && activeYear === year;
                        const isHovCell = hovCol === m;
                        const draftVal = draft[m]?.[field] ?? '';

                        return (
                          <td key={m}
                            style={{
                              padding: '8px 4px', textAlign: 'center',
                              background: isCur ? `${config.cor}08` : isHovCell ? `${rowColor}06` : 'transparent',
                              transition: 'background 0.12s',
                            }}
                            onMouseEnter={() => setHovCol(m)}
                            onMouseLeave={() => setHovCol(null)}
                          >
                            {editing ? (
                              <input
                                type="number" min="0"
                                value={draftVal}
                                onChange={e => setCell(m, field, e.target.value)}
                                placeholder="—"
                                className="plan-input"
                                style={{
                                  border: `1.5px solid ${draftVal ? rowColor + '70' : '#e8edf2'}`,
                                  background: draftVal ? `${rowColor}0a` : '#fafbfc',
                                  color: draftVal ? '#0f172a' : '#94a3b8',
                                }}
                              />
                            ) : (
                              <span className="plan-cell-val" style={{
                                color: val != null ? (isCur ? config.cor : rowColor) : '#dde1e7',
                                background: val != null ? (isCur ? `${config.cor}12` : `${rowColor}0c`) : 'transparent',
                                fontWeight: val != null ? 700 : 400,
                              }}>
                                {val != null ? fmt(val) : '·'}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* total com badge */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {total > 0 ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 12px', borderRadius: 99,
                            fontSize: 12, fontWeight: 800,
                            color: rowColor,
                            background: `${rowColor}12`,
                            border: `1px solid ${rowColor}25`,
                            boxShadow: isHovRow ? `0 2px 8px ${rowColor}25` : 'none',
                            transition: 'all 0.2s',
                          }}>
                            {fmt(total)}
                            <span style={{ fontSize: 9, fontWeight: 600, color: `${rowColor}90` }}>{u}</span>
                          </span>
                        ) : (
                          <span style={{ color: '#e2e8f0', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Gráfico ─────────────────────────────────────── */}
          <div style={{
            margin: '24px 24px 24px',
            padding: '20px 20px 16px',
            background: '#fafbfc',
            borderRadius: 18,
            border: '1px solid #f1f5f9',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 2 }}>
                  Curva de metas
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                  {graficoLabels[graficoIndicador]} — {activeYear}
                </p>
              </div>

              {/* tabs de indicador */}
              <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
                {(['metaProducao', 'metaRegistros', 'metaHoras'] as const).map(ind => {
                  const isActive = graficoIndicador === ind;
                  const color = ROW_COLORS[ind];
                  return (
                    <button key={ind} type="button" onClick={() => setGraficoIndicador(ind)}
                      style={{
                        fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 9, cursor: 'pointer',
                        border: 'none',
                        background: isActive ? '#fff' : 'transparent',
                        color: isActive ? color : '#94a3b8',
                        boxShadow: isActive ? `0 1px 4px rgba(0,0,0,0.1), 0 0 0 1.5px ${color}30` : 'none',
                        transition: 'all 0.2s',
                      }}>
                      {graficoLabels[ind]}
                    </button>
                  );
                })}
              </div>
            </div>

            <GraficoAnual
              metas={graficoData}
              cor={ROW_COLORS[graficoIndicador]}
              mesAtual={mesAtual}
            />
          </div>
        </>
      )}
    </div>
  );
}
