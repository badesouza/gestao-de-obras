import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  Clock3,
  Gauge,
  Layers3,
  MapPin,
  PieChart as PieChartIcon,
  Route,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { tenantApi, type CellValue, type RegistroDiarioRow } from '../../lib/api-client';
import type { ServicoConfig } from '../pages/servico-config';

type Analytics = Awaited<ReturnType<typeof tenantApi.centrosCusto.analytics>>;
type AnalyticsPoint = { name: string; value: number };
type ProductionPoint = { data: string; total: number; concluidos: number; area: number };
type PropMap = Record<string, string>;

type BairroDetail = {
  name: string;
  registros: number;
  producao: number;
  horas: number;
  produtividade: number;
  irregulares: number;
};

type TipoDetail = {
  name: string;
  qtd: number;
  producao: number;
  pctQtd: number;
  pctProducao: number;
};

interface Props {
  entityId: string;
  centroId: string;
  config: ServicoConfig;
  year: number;
  month: number;
}

const CHART_COLORS = ['#2563eb', '#16a34a', '#f97316', '#7c3aed', '#0891b2', '#dc2626'];
const numberFmt = new Intl.NumberFormat('pt-BR');
const decimalFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function cls(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatMetric(value: number) {
  return Number.isInteger(value) ? numberFmt.format(value) : decimalFmt.format(value);
}

function statusColor(name: string) {
  const value = name.toLocaleLowerCase('pt-BR');
  if (value.includes('conclu') || value.includes('execut')) return '#16a34a';
  if (value.includes('andamento') || value.includes('parcial')) return '#2563eb';
  if (value.includes('pend') || value.includes('abert') || value.includes('aguard')) return '#f97316';
  if (value.includes('cancel') || value.includes('nao exec') || value.includes('não exec')) return '#dc2626';
  return '#64748b';
}

function monthName(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

function metricLabel(slug: string) {
  if (slug === 'varricao') return 'Extensão executada';
  if (slug === 'coleta-entulhos') return 'Volume coletado';
  if (slug === 'tapa-buracos') return 'Area executada';
  if (slug === 'pintura') return 'Area pintada';
  if (slug === 'rocagem') return 'Área roçada';
  return 'Produção medida';
}

function shortMetricLabel(slug: string) {
  if (slug === 'coleta-entulhos') return 'Volume';
  if (slug === 'varricao') return 'Extensão';
  return 'Produção';
}

function metricUnit(slug: string) {
  if (slug === 'varricao') return 'm';
  if (slug === 'coleta-entulhos') return 'm3';
  return 'm2';
}

function performanceBadge(rate: number) {
  if (rate >= 85) return { label: 'Excelente', color: '#16a34a', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  if (rate >= 60) return { label: 'Em ritmo', color: '#2563eb', className: 'bg-blue-50 text-blue-700 ring-blue-200' };
  if (rate > 0) return { label: 'Atencao', color: '#f97316', className: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return { label: 'Sem dados', color: '#64748b', className: 'bg-slate-100 text-slate-600 ring-slate-200' };
}

function textValue(value?: CellValue) {
  if (!value) return '';
  if (typeof value.text === 'string') return value.text;
  if (typeof value.decimal === 'string') return value.decimal;
  if (typeof value.date === 'string') return value.date;
  if (typeof value.boolean === 'boolean') return value.boolean ? 'Sim' : 'Nao';
  return '';
}

function numberValue(value?: CellValue) {
  if (!value) return 0;
  if (typeof value.decimal === 'string') {
    const parsed = Number(value.decimal.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.text === 'string') {
    const parsed = Number(value.text.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function booleanValue(value?: CellValue) {
  if (!value) return false;
  if (typeof value.boolean === 'boolean') return value.boolean;
  const normalized = textValue(value).trim().toLocaleLowerCase('pt-BR');
  return ['sim', 's', 'true', '1', 'yes'].includes(normalized);
}

function firstPropId(propMap: PropMap, names: string[]) {
  return names.map((name) => propMap[name]).find(Boolean);
}

function computeSheetMetrics(rows: RegistroDiarioRow[], propMap: PropMap, config: ServicoConfig) {
  const bairroId = firstPropId(propMap, ['Bairro / Localidade', 'Praça / Jardim / Local', 'Praca / Jardim / Local', 'Rota / Local']);
  const tipoId = firstPropId(propMap, ['Tipo de Resíduo', 'Tipo de Residuo', 'Tipo de Serviço', 'Tipo de Servico']);
  const fotoId = firstPropId(propMap, ['Foto Registrada?']);
  const irregularId = firstPropId(propMap, ['Descarte Irregular?']);
  const horasId = firstPropId(propMap, ['Horas Trabalhadas', 'Horas Trabalhadas Tapa']);
  const producaoId = firstPropId(propMap, [
    'Volume Coletado (m³)',
    'Volume Coletado (mÂ³)',
    'Área Roçada (m²)',
    'Ãrea RoÃ§ada (mÂ²)',
    'Área Executada (m²)',
    'Ãrea Executada (mÂ²)',
    'Área Executada Tapa (m²)',
    'Ãrea Executada Tapa (mÂ²)',
    'Área Pintada (m²)',
    'Ãrea Pintada (mÂ²)',
    'Extensão Executada (m)',
    'ExtensÃ£o Executada (m)',
    'Volume Coletado (mÂ³)',
  ]);

  let comFoto = 0;
  let irregulares = 0;
  let horas = 0;
  let producao = 0;
  const bairros = new Map<string, BairroDetail>();
  const tipos = new Map<string, TipoDetail>();

  for (const row of rows) {
    const bairro = bairroId ? textValue(row.values[bairroId]).trim() : '';
    const tipo = tipoId ? textValue(row.values[tipoId]).trim() : '';
    const rowProducao = producaoId ? numberValue(row.values[producaoId]) : 0;
    const rowHoras = horasId ? numberValue(row.values[horasId]) : 0;
    const rowFoto = fotoId ? booleanValue(row.values[fotoId]) : false;
    const rowIrregular = irregularId ? booleanValue(row.values[irregularId]) : false;

    producao += rowProducao;
    horas += rowHoras;
    if (rowFoto) comFoto += 1;
    if (rowIrregular) irregulares += 1;

    if (bairro) {
      const current = bairros.get(bairro) ?? {
        name: bairro,
        registros: 0,
        producao: 0,
        horas: 0,
        produtividade: 0,
        irregulares: 0,
      };
      current.registros += 1;
      current.producao += rowProducao;
      current.horas += rowHoras;
      if (rowIrregular) current.irregulares += 1;
      current.produtividade = current.horas > 0 ? current.producao / current.horas : 0;
      bairros.set(bairro, current);
    }

    if (tipo) {
      const current = tipos.get(tipo) ?? { name: tipo, qtd: 0, producao: 0, pctQtd: 0, pctProducao: 0 };
      current.qtd += 1;
      current.producao += rowProducao;
      tipos.set(tipo, current);
    }
  }

  const tipoList = Array.from(tipos.values())
    .map((item) => ({
      ...item,
      pctQtd: rows.length > 0 ? (item.qtd / rows.length) * 100 : 0,
      pctProducao: producao > 0 ? (item.producao / producao) * 100 : 0,
    }))
    .sort((a, b) => b.qtd - a.qtd);

  return {
    producao,
    horas,
    produtividade: horas > 0 ? producao / horas : 0,
    comFoto,
    irregulares,
    mediaProducao: rows.length > 0 ? producao / rows.length : 0,
    mediaHoras: rows.length > 0 ? horas / rows.length : 0,
    bairros: Array.from(bairros.values()).sort((a, b) => b.registros - a.registros),
    tipos: tipoList,
    hasHoras: Boolean(horasId),
    hasFoto: Boolean(fotoId),
    hasIrregular: Boolean(irregularId),
    hasProducao: Boolean(producaoId) || config.slug !== '',
  };
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-[10px] border border-white/10 bg-[#0a1010] px-3 py-2 text-xs text-white shadow-2xl">
      {label ? <p className="mb-1 font-semibold text-white/55">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex min-w-36 items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-white/70">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color ?? '#94a3b8' }} />
              {item.name}
            </span>
            <strong className="text-white">{formatMetric(Number(item.value ?? 0))}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingBairros({ bairros, metricTitle, unit }: {
  bairros: BairroDetail[]; metricTitle: string; unit: string;
}) {
  const [hov, setHov] = useState<string | null>(null);
  const maxReg = Math.max(...bairros.map(b => b.registros), 1);
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v);

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #f1f5f9' }}>
      <style>{`.rb-row { transition: background 0.15s; } .rb-row:hover { background: #f8fafc !important; }`}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            {['Bairro', 'Reg.', metricTitle, 'Horas', `${unit}/h`, 'Irreg.'].map((h, i) => (
              <th key={i} style={{
                padding: i === 0 ? '9px 14px' : '9px 8px',
                textAlign: i === 0 ? 'left' : 'right',
                fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#94a3b8',
                width: i === 0 ? 'auto' : i === 1 ? 52 : i === 2 ? 72 : i === 3 ? 56 : i === 4 ? 68 : 48,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bairros.slice(0, 12).map((item, idx) => {
            const isHov = hov === item.name;
            const pct = (item.registros / maxReg) * 100;
            return (
              <tr key={item.name} className="rb-row"
                style={{ borderBottom: '1px solid #f8fafc', background: 'transparent' }}
                onMouseEnter={() => setHov(item.name)}
                onMouseLeave={() => setHov(null)}>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#cbd5e1', fontFamily: 'monospace', minWidth: 16 }}>{idx + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}</div>
                      {isHov && (
                        <div style={{ marginTop: 3, height: 3, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden', width: '100%' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #2563eb80, #2563eb)', borderRadius: 99, transition: 'width 0.4s' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 800, color: '#2563eb', background: '#eff6ff', borderRadius: 99, padding: '1px 7px', border: '1px solid #bfdbfe' }}>
                    {item.registros}
                  </span>
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: item.producao > 0 ? '#7c3aed' : '#e2e8f0' }}>
                  {item.producao > 0 ? fmt(item.producao) : '—'}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: item.horas > 0 ? '#b45309' : '#e2e8f0' }}>
                  {item.horas > 0 ? fmt(item.horas) : '—'}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: item.produtividade > 0 ? '#0369a1' : '#e2e8f0' }}>
                  {item.produtividade > 0 ? fmt(item.produtividade) : '—'}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  {item.irregulares > 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', background: '#fef2f2', borderRadius: 99, padding: '1px 7px', border: '1px solid #fecaca' }}>
                      {item.irregulares}
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
  );
}

function Panel({
  eyebrow,
  title,
  icon,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cls(
        'rounded-[18px] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(10,26,26,0.07)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(10,26,26,0.12)]',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tn-muted)]">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-[17px] font-bold text-[var(--tn-ink)]">{title}</h3>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-slate-100 text-slate-500">
          {icon}
        </div>
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  helper,
  badge,
  icon,
  color,
}: {
  label: string;
  value: string;
  helper: string;
  badge: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <article className="group relative min-h-[104px] overflow-hidden rounded-[16px] border border-white/80 bg-white px-4 py-3.5 shadow-[0_12px_32px_rgba(10,26,26,0.07)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(10,26,26,0.11)]">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div
        className="absolute -bottom-12 -right-10 h-24 w-24 rounded-full opacity-10 transition duration-300 group-hover:scale-125"
        style={{ background: color }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[12px]"
          style={{ background: `${color}18`, color }}
        >
          {icon}
        </div>
        <span className="rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-slate-500 ring-1 ring-slate-200">
          {badge}
        </span>
      </div>
      <p className="relative mt-3 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--tn-muted)]">
        {label}
      </p>
      <div className="relative mt-1 flex items-end justify-between gap-3">
        <p className="text-3xl font-black leading-none text-[var(--tn-ink)]">{value}</p>
      </div>
      <p className="relative mt-2 line-clamp-2 text-xs font-medium leading-snug text-[var(--tn-muted)]">{helper}</p>
    </article>
  );
}

function Ranking({ data, color, emptyText }: { data: AnalyticsPoint[]; color: string; emptyText: string }) {
  if (data.length === 0) {
    return <p className="rounded-[12px] bg-slate-50 p-4 text-sm text-[var(--tn-muted)]">{emptyText}</p>;
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((item, index) => (
        <div key={item.name} className="grid grid-cols-[24px_minmax(0,1fr)_42px] items-center gap-3">
          <span className="text-right font-mono text-[11px] font-bold text-slate-400">{index + 1}</span>
          <div className="min-w-0 rounded-[10px] px-2 py-1.5 transition hover:bg-slate-50">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-sm font-semibold text-slate-800" title={item.name}>
                {item.name}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(item.value / max) * 100}%`, background: color }}
              />
            </div>
          </div>
          <strong className="text-right text-sm text-slate-900">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ color }: { color: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-white"
        style={{ background: color }}
      >
        <BarChart3 size={22} />
      </div>
      <h3 className="mt-4 text-lg font-bold text-[var(--tn-ink)]">Sem dados para análise neste mês</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--tn-muted)]">
        Registre ocorrências no período para liberar KPIs, rankings e gráficos deste serviço.
      </p>
    </div>
  );
}

function Speedometer({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const cx = 160;
  const cy = 158;
  const radius = 118;

  const angleFor = (nextValue: number) => 180 - (nextValue / 100) * 180;

  const point = (nextValue: number, distance: number) => {
    const angle = angleFor(nextValue);
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + Math.cos(rad) * distance,
      y: cy - Math.sin(rad) * distance,
    };
  };

  const arc = (fromValue: number, toValue: number, distance: number) => {
    const start = point(fromValue, distance);
    const end = point(toValue, distance);
    const largeArc = Math.abs(toValue - fromValue) > 50 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${distance} ${distance} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const needle = point(clamped, 78);
  const ticks = Array.from({ length: 21 }, (_, index) => index * 5);
  const labels = [0, 20, 40, 60, 80, 100];

  return (
    <svg viewBox="0 0 320 190" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="svSpeedGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="svDialGlass" cx="50%" cy="54%" r="62%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
          <stop offset="58%" stopColor="#f8fafc" stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0.10" />
        </radialGradient>
        <filter id="svDialShadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#0f172a" floodOpacity="0.16" />
        </filter>
        <filter id="svArcShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor={color} floodOpacity="0.28" />
        </filter>
        <filter id="svNeedleShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.22" />
        </filter>
        <style>{`
          .sv-speed-fill {
            stroke-dasharray: 380;
            stroke-dashoffset: ${380 - (clamped / 100) * 380};
            animation: svSpeedSweep 900ms cubic-bezier(.22,1,.36,1) both;
          }
          .sv-speed-needle {
            transform-origin: ${cx}px ${cy}px;
            animation: svNeedleSettle 950ms cubic-bezier(.22,1,.36,1) both;
          }
          .sv-speed-shine {
            animation: svDialShine 2.8s ease-in-out infinite;
          }
          @keyframes svSpeedSweep {
            from { stroke-dashoffset: 380; }
          }
          @keyframes svNeedleSettle {
            0% { opacity: 0; transform: rotate(-16deg); }
            70% { opacity: 1; transform: rotate(3deg); }
            100% { opacity: 1; transform: rotate(0deg); }
          }
          @keyframes svDialShine {
            0%, 100% { opacity: .18; transform: translateX(-6px); }
            50% { opacity: .38; transform: translateX(6px); }
          }
        `}</style>
      </defs>

      <path
        d={arc(0, 100, radius + 18)}
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="34"
        strokeLinecap="round"
        filter="url(#svDialShadow)"
      />
      <path
        d={arc(0, 100, radius + 7)}
        fill="none"
        stroke="url(#svDialGlass)"
        strokeWidth="36"
        strokeLinecap="round"
      />

      <path
        d={arc(0, 100, radius)}
        fill="none"
        stroke="rgba(15,23,42,0.08)"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d={arc(0, clamped, radius)}
        className="sv-speed-fill"
        fill="none"
        stroke="url(#svSpeedGlow)"
        strokeWidth="18"
        strokeLinecap="round"
        filter="url(#svArcShadow)"
      />
      <path
        d={arc(0, 100, radius - 24)}
        fill="none"
        stroke="rgba(20,184,166,0.08)"
        strokeWidth="2"
      />

      {ticks.map((tick) => {
        const outer = point(tick, radius - 5);
        const inner = point(tick, tick % 20 === 0 ? radius - 22 : radius - 15);
        return (
          <line
            key={tick}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={tick <= clamped ? color : 'rgba(15,23,42,0.18)'}
            strokeWidth={tick % 20 === 0 ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}

      {labels.map((label) => {
        const labelPoint = point(label, radius - 40);
        return (
          <text
            key={label}
            x={labelPoint.x}
            y={labelPoint.y + 4}
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-bold"
          >
            {label}
          </text>
        );
      })}

      <g className="sv-speed-needle">
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke="#0f172a"
          strokeWidth="7"
          strokeLinecap="round"
          filter="url(#svNeedleShadow)"
        />
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="17" fill="white" stroke={color} strokeWidth="6" filter="url(#svNeedleShadow)" />
        <circle cx={cx} cy={cy} r="5" fill="#0f172a" />
      </g>

      <ellipse
        className="sv-speed-shine"
        cx="126"
        cy="66"
        rx="70"
        ry="20"
        fill="white"
        opacity="0.22"
        transform="rotate(-18 126 66)"
      />

      <text x={cx} y="116" textAnchor="middle" className="fill-slate-950 text-[42px] font-black">
        {Math.round(clamped)}%
      </text>
      <text x={cx} y="138" textAnchor="middle" className="fill-slate-500 text-[11px] font-black uppercase tracking-[0.16em]">
        do potencial
      </text>
    </svg>
  );
}

type EquipePoint = { name: string; registros: number; area: number; horas: number };

function EquipeCard({ dados, unit }: { dados: EquipePoint[]; unit: string }) {
  const [hov, setHov] = useState<string | null>(null);
  if (dados.length === 0) {
    return <p className="rounded-[12px] bg-slate-50 p-4 text-sm text-[var(--tn-muted)]">Nenhuma equipe informada no período.</p>;
  }
  const maxReg = Math.max(...dados.map(d => d.registros), 1);
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v);
  const MEDAL = ['🥇','🥈','🥉'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dados.map((eq, i) => {
        const isHov = hov === eq.name;
        const pct = (eq.registros / maxReg) * 100;
        return (
          <div key={eq.name}
            onMouseEnter={() => setHov(eq.name)}
            onMouseLeave={() => setHov(null)}
            style={{
              borderRadius: 14,
              border: `1px solid ${isHov ? '#22c55e30' : '#f1f5f9'}`,
              background: isHov ? '#f0fdf4' : '#fafafa',
              padding: '12px 14px',
              transition: 'all 0.18s ease',
              boxShadow: isHov ? '0 4px 16px rgba(34,197,94,0.1)' : 'none',
            }}>
            {/* linha 1: rank + nome + contagem */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{MEDAL[i] ?? `${i + 1}`}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#16a34a',
                background: '#dcfce7', borderRadius: 99, padding: '2px 8px',
                border: '1px solid #bbf7d0',
              }}>{eq.registros} reg.</span>
            </div>

            {/* barra */}
            <div style={{ height: 5, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #16a34a, #4ade80)',
                transition: 'width 0.6s cubic-bezier(.22,1,.36,1)',
                boxShadow: isHov ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
              }} />
            </div>

            {/* badges de métricas */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {eq.area > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', borderRadius: 99, padding: '2px 8px', border: '1px solid #e9d5ff' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  {fmt(eq.area)} {unit}
                </span>
              )}
              {eq.horas > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fef3c7', borderRadius: 99, padding: '2px 8px', border: '1px solid #fde68a' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {fmt(eq.horas)} h
                </span>
              )}
              {eq.area > 0 && eq.horas > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#0369a1', background: '#e0f2fe', borderRadius: 99, padding: '2px 8px', border: '1px solid #bae6fd' }}>
                  {fmt(eq.area / eq.horas)} {unit}/h
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function kpiConfig(pct: number | null): { color: string; bg: string; label: string; icon: string } {
  if (pct === null) return { color: '#94a3b8', bg: '#f8fafc', label: 'Sem meta', icon: '—' };
  if (pct >= 100) return { color: '#16a34a', bg: '#f0fdf4', label: 'Meta batida', icon: '✓' };
  if (pct >= 75)  return { color: '#2563eb', bg: '#eff6ff', label: 'No ritmo',   icon: '↑' };
  if (pct >= 40)  return { color: '#f59e0b', bg: '#fffbeb', label: 'Atenção',    icon: '!' };
  return             { color: '#dc2626', bg: '#fef2f2', label: 'Crítico',    icon: '↓' };
}

function MetaVsRealizado({ entityId, centroId, year, month, realizado, unit, metricLabel }: {
  entityId: string; centroId: string; year: number; month: number;
  realizado: { registros: number; producao: number; horas: number; produtividade: number; mediaDaily: number; mediaProducao: number; mediaHoras: number };
  unit: string; metricLabel: string;
}) {
  const [metas, setMetas] = useState<{ metaRegistros: number | null; metaProducao: number | null; metaHoras: number | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ metaRegistros: '', metaProducao: '', metaHoras: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    tenantApi.centrosCusto.getMetas(entityId, centroId, year, month)
      .then(m => setMetas({ metaRegistros: m.metaRegistros, metaProducao: m.metaProducao, metaHoras: m.metaHoras }))
      .catch(() => setMetas({ metaRegistros: null, metaProducao: null, metaHoras: null }));
  }, [entityId, centroId, year, month]);

  const startEdit = () => {
    setDraft({
      metaRegistros: metas?.metaRegistros != null ? String(metas.metaRegistros) : '',
      metaProducao:  metas?.metaProducao  != null ? String(metas.metaProducao)  : '',
      metaHoras:     metas?.metaHoras     != null ? String(metas.metaHoras)     : '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const parse = (v: string) => v.trim() === '' ? null : Number(v.replace(',', '.'));
    const saved = {
      metaRegistros: parse(draft.metaRegistros),
      metaProducao:  parse(draft.metaProducao),
      metaHoras:     parse(draft.metaHoras),
    };
    await tenantApi.centrosCusto.saveMetas(entityId, centroId, { year, month, ...saved });
    setMetas(saved);
    setSaving(false);
    setEditing(false);
  };

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v);
  const pct = (real: number, meta: number | null) =>
    meta != null && meta > 0 ? Math.round((real / meta) * 100) : null;

  type RowDef = { label: string; realizado: number; meta: number | null; unit: string; draftKey: 'metaRegistros' | 'metaProducao' | 'metaHoras' | null };
  const rows: RowDef[] = [
    { label: 'Registros',         realizado: realizado.registros,    meta: metas?.metaRegistros ?? null, unit: 'ocorr.', draftKey: 'metaRegistros' },
    { label: metricLabel,         realizado: realizado.producao,     meta: metas?.metaProducao  ?? null, unit,           draftKey: 'metaProducao'  },
    { label: 'Horas trabalhadas', realizado: realizado.horas,        meta: metas?.metaHoras     ?? null, unit: 'h',      draftKey: 'metaHoras'     },
    { label: 'Produtividade',     realizado: realizado.produtividade,meta: null,                         unit: `${unit}/h`, draftKey: null         },
  ];

  return (
    <div>
      {/* header com botão */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {!editing ? (
          <button type="button" onClick={startEdit}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Definir metas
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setEditing(false)}
              style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando…' : 'Salvar metas'}
            </button>
          </div>
        )}
      </div>

      {/* linhas de indicador */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(row => {
          const p = pct(row.realizado, row.meta);
          const kpi = kpiConfig(row.meta != null ? p : null);
          const hasMeta = row.meta != null && row.meta > 0;
          const pctClamped = Math.min(p ?? 0, 100);

          return (
            <div key={row.label} style={{
              borderRadius: 14,
              border: `1px solid ${hasMeta ? kpi.color + '22' : '#f1f5f9'}`,
              borderLeft: `3px solid ${hasMeta ? kpi.color : '#e2e8f0'}`,
              background: hasMeta ? `${kpi.color}07` : '#fafafa',
              padding: '12px 14px',
              transition: 'all 0.22s ease',
            }}>
              {/* linha 1: label + KPI badge + % */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.label}</span>

                {hasMeta && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: kpi.color,
                    background: `${kpi.color}18`, border: `1px solid ${kpi.color}30`,
                    borderRadius: 99, padding: '2px 9px', letterSpacing: '0.04em',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <span>{kpi.icon}</span>{kpi.label}
                  </span>
                )}

                {p !== null && (
                  <span style={{
                    fontSize: 18, fontWeight: 900, color: kpi.color,
                    fontFamily: 'monospace', lineHeight: 1,
                  }}>{p}%</span>
                )}
              </div>

              {/* linha 2: valores */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: hasMeta ? 10 : 0 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{fmt(row.realizado)}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{row.unit}</span>
                {hasMeta && !editing && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: kpi.color, marginLeft: 4 }}>
                    / {fmt(row.meta!)} <span style={{ fontSize: 10, color: '#94a3b8' }}>meta</span>
                  </span>
                )}
                {hasMeta && editing && row.draftKey && (
                  <>
                    <span style={{ color: '#cbd5e1', fontSize: 11, margin: '0 2px' }}>/</span>
                    <input type="number" min="0"
                      value={draft[row.draftKey]}
                      onChange={e => setDraft(d => ({ ...d, [row.draftKey!]: e.target.value }))}
                      placeholder="meta"
                      style={{ width: 76, fontSize: 13, fontWeight: 700, border: `1.5px solid ${kpi.color}60`, borderRadius: 8, padding: '3px 7px', background: '#fff', color: kpi.color, outline: 'none', textAlign: 'right' }}
                    />
                  </>
                )}
                {!hasMeta && editing && row.draftKey && (
                  <input type="number" min="0"
                    value={draft[row.draftKey]}
                    onChange={e => setDraft(d => ({ ...d, [row.draftKey!]: e.target.value }))}
                    placeholder="definir meta…"
                    style={{ width: 120, fontSize: 12, fontWeight: 600, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '3px 8px', background: '#fff', color: '#475569', outline: 'none' }}
                  />
                )}
                {!hasMeta && !editing && row.draftKey && (
                  <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic', marginLeft: 4 }}>sem meta</span>
                )}
              </div>

              {/* barra de progresso */}
              {hasMeta && (
                <div style={{ height: 5, borderRadius: 99, background: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pctClamped}%`,
                    background: `linear-gradient(90deg, ${kpi.color}bb, ${kpi.color})`,
                    borderRadius: 99,
                    transition: 'width 0.7s cubic-bezier(.22,1,.36,1)',
                    boxShadow: `0 0 8px ${kpi.color}50`,
                  }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TooltipState = { x: number; y: number; content: React.ReactNode } | null;

function SvgTooltip({ tip }: { tip: TooltipState }) {
  if (!tip) return null;
  /* ajusta para não sair da tela */
  const offX = tip.x + 180 > window.innerWidth ? -194 : 12;
  const offY = tip.y + 20 > window.innerHeight ? -20 : 12;
  return (
    <div
      style={{
        position: 'fixed', left: tip.x + offX, top: tip.y + offY,
        pointerEvents: 'none', zIndex: 9999,
        background: '#0a1018', borderRadius: 12, padding: '10px 14px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.07)',
        minWidth: 160, maxWidth: 220,
      }}
    >
      {tip.content}
    </div>
  );
}

function RoscaStatus({ dados, total }: { dados: AnalyticsPoint[]; total: number }) {
  const cx = 80, cy = 80, r = 60, ir = 38;
  const gap = 0.04;
  const [tip, setTip] = useState<TooltipState>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const arc = (startAngle: number, endAngle: number, ro: number, ri: number) => {
    const s = { x: cx + Math.cos(startAngle) * ro, y: cy + Math.sin(startAngle) * ro };
    const e = { x: cx + Math.cos(endAngle) * ro, y: cy + Math.sin(endAngle) * ro };
    const si = { x: cx + Math.cos(endAngle) * ri, y: cy + Math.sin(endAngle) * ri };
    const ei = { x: cx + Math.cos(startAngle) * ri, y: cy + Math.sin(startAngle) * ri };
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${ro} ${ro} 0 ${large} 1 ${e.x} ${e.y} L ${si.x} ${si.y} A ${ri} ${ri} 0 ${large} 0 ${ei.x} ${ei.y} Z`;
  };

  let angle = -Math.PI / 2;
  const fatias = dados.map(item => {
    const pct = total > 0 ? item.value / total : 0;
    const span = pct * 2 * Math.PI - gap;
    const start = angle + gap / 2;
    const end = start + Math.max(span, 0);
    angle += pct * 2 * Math.PI;
    return { ...item, start, end, pct };
  });

  const hovItem = fatias.find(f => f.name === hovered);

  return (
    <div className="flex flex-col gap-4">
      <SvgTooltip tip={tip} />

      <div className="flex justify-center">
        <svg viewBox="0 0 160 160" style={{ width: 160, height: 160, overflow: 'visible' }}
          onMouseLeave={() => { setTip(null); setHovered(null); }}>
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={r - ir} />
          ) : fatias.map(f => f.pct > 0 && (
            <path
              key={f.name}
              d={arc(f.start, f.end, hovered === f.name ? r + 5 : r, ir)}
              fill={statusColor(f.name)}
              opacity={hovered && hovered !== f.name ? 0.4 : 0.92}
              style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
              onMouseEnter={e => {
                setHovered(f.name);
                setTip({
                  x: e.clientX, y: e.clientY,
                  content: (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(f.name), flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{f.name}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Ocorrências</span>
                        <strong style={{ fontSize: 13, color: '#fff' }}>{f.value}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Participação</span>
                        <strong style={{ fontSize: 13, color: statusColor(f.name) }}>{Math.round(f.pct * 100)}%</strong>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${f.pct * 100}%`, background: statusColor(f.name), borderRadius: 99 }} />
                      </div>
                    </div>
                  ),
                });
              }}
              onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)}
            />
          ))}

          {/* centro: mostra item hovered ou total */}
          {hovItem ? (
            <>
              <text x={cx} y={cy - 10} textAnchor="middle" fontSize={18} fontWeight={900} fill={statusColor(hovItem.name)}>{hovItem.value}</text>
              <text x={cx} y={cy + 6} textAnchor="middle" fontSize={8} fontWeight={700} fill="#94a3b8" letterSpacing={0.8}>ocorrências</text>
              <text x={cx} y={cy + 18} textAnchor="middle" fontSize={14} fontWeight={900} fill={statusColor(hovItem.name)}>{Math.round(hovItem.pct * 100)}%</text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize={22} fontWeight={900} fill="#0f172a">{total}</text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fontWeight={700} fill="#94a3b8" letterSpacing={1}>total</text>
            </>
          )}
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {dados.map(item => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isHov = hovered === item.name;
          const cor = statusColor(item.name);
          return (
            <div
              key={item.name}
              style={{
                borderRadius: 12,
                padding: '10px 12px',
                background: isHov ? `${cor}0e` : '#f8fafc',
                border: `1px solid ${isHov ? cor + '35' : '#f1f5f9'}`,
                transition: 'all 0.18s ease',
                cursor: 'default',
                boxShadow: isHov ? `0 2px 12px ${cor}18` : 'none',
              }}
              onMouseEnter={() => setHovered(item.name)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: cor, flexShrink: 0, boxShadow: isHov ? `0 0 6px ${cor}` : 'none', transition: 'box-shadow 0.2s' }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: cor, background: `${cor}15`, borderRadius: 99, padding: '1px 7px', border: `1px solid ${cor}25`, fontFamily: 'monospace' }}>{pct}%</span>
                <strong style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', minWidth: 16, textAlign: 'right' }}>{item.value}</strong>
              </div>
              <div style={{ height: 4, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 99, transition: 'width 0.5s cubic-bezier(.22,1,.36,1)', boxShadow: isHov ? `0 0 6px ${cor}60` : 'none' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProducaoAcumulada({ total, unit, mediaRegistro, registros, concluidos, cor }: {
  total: number; unit: string; mediaRegistro: number;
  registros: number; concluidos: number; cor: string;
}) {
  const pct = registros > 0 ? Math.round((concluidos / registros) * 100) : 0;
  const abertos = registros - concluidos;

  const fmtN = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v);
  const barColor = pct >= 100 ? '#16a34a' : pct >= 75 ? cor : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* número grande com halo */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '20px 0 16px',
        background: `radial-gradient(ellipse at 50% 0%, ${cor}10 0%, transparent 70%)`,
        borderRadius: 16,
      }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8' }}>
          {unit} executados
        </span>
        <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: cor, textShadow: `0 0 40px ${cor}40` }}>
          {total > 0 ? fmtN(total) : '—'}
        </span>
        {mediaRegistro > 0 ? (
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#64748b',
            background: '#f8fafc', borderRadius: 99, padding: '3px 12px',
            border: '1px solid #e2e8f0',
          }}>
            média {fmtN(mediaRegistro)} {unit} / ocorrência
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>sem medição registrada</span>
        )}
      </div>

      {/* barra de conclusão */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{concluidos} concluídas</span>
            {abertos > 0 && <span style={{ fontSize: 11, color: '#94a3b8' }}>· {abertos} em aberto</span>}
          </div>
          <span style={{
            fontSize: 13, fontWeight: 900, color: barColor,
            background: `${barColor}15`, borderRadius: 99, padding: '2px 10px',
            border: `1px solid ${barColor}30`, fontFamily: 'monospace',
          }}>{pct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: 99,
            background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
            transition: 'width 0.8s cubic-bezier(.22,1,.36,1)',
            boxShadow: `0 0 10px ${barColor}50`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>0</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{registros} registros</span>
        </div>
      </div>
    </div>
  );
}

type DiaPoint = { data: string; total: number; concluidos: number; area: number };

function CurvaDiaria({ dados, cor }: { dados: DiaPoint[]; cor: string }) {
  const W = 900, H = 260, padL = 32, padR = 16, padT = 12, padB = 28;
  const w = W - padL - padR;
  const h = H - padT - padB;
  const maxVal = Math.max(...dados.map(d => d.total), 1);
  const n = dados.length;
  const [tip, setTip] = useState<TooltipState>(null);
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  const x = (i: number) => padL + (i / Math.max(n - 1, 1)) * w;
  const y = (v: number) => padT + h - (v / maxVal) * h;

  const polyline = (key: 'total' | 'concluidos') =>
    dados.map((d, i) => `${x(i)},${y(d[key])}`).join(' ');

  const area = (key: 'total' | 'concluidos') => {
    const pts = dados.map((d, i) => `${x(i)},${y(d[key])}`).join(' ');
    return `M ${x(0)},${y(dados[0][key])} L ${pts} L ${x(n - 1)},${padT + h} L ${x(0)},${padT + h} Z`;
  };

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i));
  const step = Math.ceil(n / 10);
  const xTicks = dados.filter((_, i) => i % step === 0 || i === n - 1);

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR').format(v);
  const fmtDec = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v);

  const showTip = (e: React.MouseEvent, d: DiaPoint, i: number) => {
    const abertos = d.total - d.concluidos;
    const taxa = d.total > 0 ? Math.round((d.concluidos / d.total) * 100) : 0;
    setHovIdx(i);
    setTip({
      x: e.clientX, y: e.clientY,
      content: (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Dia {d.data}
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor }} />
                Registros
              </span>
              <strong style={{ fontSize: 13, color: '#fff' }}>{fmt(d.total)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
                Concluídos
              </span>
              <strong style={{ fontSize: 13, color: '#4ade80' }}>{fmt(d.concluidos)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }} />
                Em aberto
              </span>
              <strong style={{ fontSize: 13, color: abertos > 0 ? '#fb923c' : '#94a3b8' }}>{fmt(abertos)}</strong>
            </div>
            {d.area > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>Produção</span>
                <strong style={{ fontSize: 13, color: '#c4b5fd' }}>{fmtDec(d.area)}</strong>
              </div>
            )}
          </div>
          {d.total > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Taxa de conclusão</span>
                <strong style={{ fontSize: 14, color: taxa >= 80 ? '#4ade80' : taxa >= 50 ? '#fbbf24' : '#f87171' }}>{taxa}%</strong>
              </div>
              <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.1)', marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${taxa}%`, background: taxa >= 80 ? '#16a34a' : taxa >= 50 ? '#f59e0b' : '#dc2626', borderRadius: 99 }} />
              </div>
            </>
          )}
        </div>
      ),
    });
  };

  return (
    <div style={{ width: '100%' }} onMouseLeave={() => { setTip(null); setHovIdx(null); }}>
      <SvgTooltip tip={tip} />

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260, overflow: 'visible' }}>
        <defs>
          <linearGradient id="cg-total" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.22} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cg-done" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* grid horizontal */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#e2e8f0" strokeDasharray="4 6" />
            <text x={padL - 4} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{v}</text>
          </g>
        ))}

        {/* linha vertical do hover */}
        {hovIdx !== null && (
          <line x1={x(hovIdx)} y1={padT} x2={x(hovIdx)} y2={padT + h} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 4" />
        )}

        {/* áreas preenchidas */}
        <path d={area('total')} fill="url(#cg-total)" />
        <path d={area('concluidos')} fill="url(#cg-done)" />

        {/* linhas */}
        <polyline points={polyline('total')} fill="none" stroke={cor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={polyline('concluidos')} fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* pontos */}
        {dados.map((d, i) => d.total > 0 ? (
          <circle key={i} cx={x(i)} cy={y(d.total)} r={hovIdx === i ? 6 : 4}
            fill="#fff" stroke={cor} strokeWidth={2} style={{ transition: 'r 0.1s' }} />
        ) : null)}
        {dados.map((d, i) => d.concluidos > 0 ? (
          <circle key={`c${i}`} cx={x(i)} cy={y(d.concluidos)} r={hovIdx === i ? 6 : 4}
            fill="#fff" stroke="#16a34a" strokeWidth={2} style={{ transition: 'r 0.1s' }} />
        ) : null)}

        {/* zonas de hover invisíveis por coluna */}
        {dados.map((d, i) => (
          <rect
            key={`h${i}`}
            x={x(i) - w / n / 2} y={padT}
            width={w / n} height={h}
            fill="transparent"
            style={{ cursor: d.total > 0 ? 'crosshair' : 'default' }}
            onMouseEnter={e => showTip(e, d, i)}
            onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : t)}
          />
        ))}

        {/* eixo X */}
        {xTicks.map((d, i) => {
          const idx = dados.indexOf(d);
          return <text key={i} x={x(idx)} y={H - 6} textAnchor="middle" fontSize={10} fill="#94a3b8">{d.data}</text>;
        })}
      </svg>

      {/* legenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4, justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke={cor} strokeWidth="2.5" /></svg>
          Registros
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <svg width="20" height="3"><line x1="0" y1="1.5" x2="20" y2="1.5" stroke="#16a34a" strokeWidth="2.5" /></svg>
          Concluídos
        </span>
      </div>
    </div>
  );
}

export function ServicoAnalytics({ entityId, centroId, config, year, month }: Props) {
  const [data, setData] = useState<Analytics | null>(null);
  const [rows, setRows] = useState<RegistroDiarioRow[]>([]);
  const [propMap, setPropMap] = useState<PropMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [analytics, detail, registros] = await Promise.all([
          tenantApi.centrosCusto.analytics(entityId, centroId, year, month),
          tenantApi.centrosCusto.get(entityId, centroId),
          tenantApi.centrosCusto.listRegistros(entityId, centroId, year, month),
        ]);
        const nextPropMap: PropMap = {};
        detail.propriedadesConfig.forEach((configItem) => {
          nextPropMap[configItem.propriedade.nome] = configItem.propriedadeId;
        });
        if (active) {
          setData(analytics);
          setRows(registros.rows);
          setPropMap(nextPropMap);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Erro ao carregar análises');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [centroId, entityId, month, year]);

  const labelMes = useMemo(() => monthName(year, month), [month, year]);
  const summary = data?.resumo ?? { total: 0, concluidos: 0, taxaConclusao: 0, totalArea: 0 };
  const openItems = Math.max(summary.total - summary.concluidos, 0);
  const badge = performanceBadge(summary.taxaConclusao);
  const activeDays = data?.producaoDiaria.filter((item: ProductionPoint) => item.total > 0).length ?? 0;
  const averageDaily = activeDays > 0 ? summary.total / activeDays : 0;
  const peak = data?.producaoDiaria.reduce<ProductionPoint | null>((best, item: ProductionPoint) => {
    if (!best || item.total > best.total) return item;
    return best;
  }, null);
  const statusTotal = data?.porStatus.reduce((sum: number, item: AnalyticsPoint) => sum + item.value, 0) ?? 0;
  const sheet = useMemo(() => computeSheetMetrics(rows, propMap, config), [config, propMap, rows]);
  const producaoTotal = sheet.producao || summary.totalArea;
  const unit = metricUnit(config.slug);
  const metricTitle = shortMetricLabel(config.slug);

  if (loading) {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-[18px] bg-white shadow-sm" />
        ))}
      </div>
    );
  }

  if (error) return <div className="tn-alert m-6">{error}</div>;
  if (!data || summary.total === 0) return <div className="p-6"><EmptyState color={config.cor} /></div>;

  return (
    <div className="space-y-5 p-6">
      <section
        className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_70px_rgba(10,26,26,0.10)]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      >
        <div className="mb-4 rounded-[18px] border border-slate-200/80 bg-white/88 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: config.cor }}>
                Controle do mês
              </p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">
                {config.nome}: produção, pendências e repasses operacionais.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cls('rounded-full px-3 py-1 text-xs font-bold ring-1', badge.className)}>
                {badge.label}
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 font-mono text-[11px] font-bold capitalize text-blue-700 ring-1 ring-blue-200">
                {labelMes}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-[18px] border border-slate-200 bg-white/90 p-5 shadow-[0_14px_38px_rgba(10,26,26,0.08)] backdrop-blur">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: config.cor }}>
                <Sparkles size={14} />
              </span>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: config.cor }}>
                Potencial do serviço
              </p>
            </div>
            <div className="relative mx-auto h-56 max-w-72">
              <Speedometer value={summary.taxaConclusao} color={config.cor} />
            </div>
            <div className="mt-4 space-y-2">
              {[
                ['Concluídas', formatMetric(summary.concluidos), '#16a34a'],
                ['Em aberto', formatMetric(openItems), '#f97316'],
                [metricLabel(config.slug), `${formatMetric(producaoTotal)} ${unit}`, config.cor],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between rounded-[10px] border border-slate-200 bg-white px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    {label}
                  </span>
                  <strong className="text-sm font-black text-slate-950">{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Total do mês" value={formatMetric(summary.total)} helper="Ocorrências registradas" badge="volume" icon={<Activity size={23} />} color={config.cor} />
              <KpiCard label="Concluídas" value={formatMetric(summary.concluidos)} helper={`${summary.taxaConclusao}% do total`} badge="entrega" icon={<CheckCircle2 size={23} />} color="#16a34a" />
              <KpiCard label={metricLabel(config.slug)} value={formatMetric(producaoTotal)} helper={`Total consolidado em ${unit}`} badge="medição" icon={<TrendingUp size={23} />} color="#7c3aed" />
              <KpiCard label="Em aberto" value={formatMetric(openItems)} helper={openItems === 0 ? 'Sem pendências no período' : 'Pendentes de conclusão'} badge={openItems === 0 ? 'ok' : 'alerta'} icon={openItems === 0 ? <Target size={23} /> : <AlertTriangle size={23} />} color={openItems === 0 ? '#16a34a' : '#f97316'} />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-[14px] border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                  <Clock3 size={14} style={{ color: config.cor }} />
                  Horas trabalhadas
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <strong className="text-xl font-black text-slate-950">{formatMetric(sheet.horas)}</strong>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 font-mono text-[10px] font-black text-emerald-700">
                    {sheet.hasHoras ? 'OK' : 'N/C'}
                  </span>
                </div>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                  <Camera size={14} style={{ color: config.cor }} />
                  Registros com foto
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <strong className="text-xl font-black text-slate-950">{formatMetric(sheet.comFoto)}</strong>
                  <span className="rounded-full bg-blue-50 px-2 py-1 font-mono text-[10px] font-black text-blue-700">
                    evidencias
                  </span>
                </div>
              </div>
              <div className="rounded-[14px] border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                <p className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                  <Zap size={14} style={{ color: config.cor }} />
                  Produtividade média
                </p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <strong className="text-xl font-black text-slate-950">{formatMetric(sheet.produtividade)}</strong>
                  <span className="rounded-full bg-orange-50 px-2 py-1 font-mono text-[10px] font-black text-orange-700">
                    {unit}/h
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Descartes irregulares" value={formatMetric(sheet.irregulares)} helper={sheet.hasIrregular ? 'Ocorrências marcadas como irregulares' : 'Campo de descarte não configurado'} badge="risco" icon={<AlertTriangle size={23} />} color="#dc2626" />
              <KpiCard label="Média por registro" value={formatMetric(sheet.mediaProducao)} helper={`${unit} por ocorrência`} badge="ticket" icon={<Target size={23} />} color="#2563eb" />
              <KpiCard label="Horas médias" value={formatMetric(sheet.mediaHoras)} helper="Por registro no período" badge="média" icon={<Clock3 size={23} />} color="#f97316" />
              <KpiCard label="Pico de produção" value={peak?.data ?? '--'} helper={peak ? `${peak.total} registros no dia` : 'Sem pico no período'} badge="pico" icon={<Gauge size={23} />} color="#0891b2" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <Panel eyebrow="Curva diária" title="Registros e conclusões por dia" icon={<Activity size={18} />}>
          <CurvaDiaria dados={data.producaoDiaria} cor={config.cor} />
        </Panel>

        <Panel eyebrow="Produção acumulada" title={metricLabel(config.slug)} icon={<TrendingUp size={18} />}>
          <ProducaoAcumulada
            total={producaoTotal}
            unit={unit}
            mediaRegistro={sheet.mediaProducao}
            registros={summary.total}
            concluidos={summary.concluidos}
            cor={config.cor}
          />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel eyebrow="Status geral" title="Distribuição da produção" icon={<PieChartIcon size={18} />}>
          <RoscaStatus dados={data.porStatus} total={statusTotal} />
        </Panel>

        <Panel eyebrow="Território" title="Bairros mais atendidos" icon={<MapPin size={18} />}>
          <Ranking data={data.porBairro} color={config.cor} emptyText="Nenhum bairro informado no período." />
        </Panel>

        <Panel eyebrow="Equipe" title="Produção por turma" icon={<Users size={18} />}>
          <EquipeCard dados={data.porEquipe} unit={unit} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <Panel eyebrow="Meta vs realizado" title="Planejamento do mês" icon={<Target size={18} />}>
          <MetaVsRealizado
            entityId={entityId}
            centroId={centroId}
            year={year}
            month={month}
            realizado={{
              registros: summary.total,
              producao: producaoTotal,
              horas: sheet.horas,
              produtividade: sheet.produtividade,
              mediaDaily: averageDaily,
              mediaProducao: sheet.mediaProducao,
              mediaHoras: sheet.mediaHoras,
            }}
            unit={unit}
            metricLabel={metricLabel(config.slug)}
          />
        </Panel>

        <Panel eyebrow="Ranking completo" title="Bairros atendidos com produção e horas" icon={<MapPin size={18} />}>
          <RankingBairros bairros={sheet.bairros} metricTitle={metricTitle} unit={unit} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel eyebrow="Modalidade" title="Tipo de serviço" icon={<Layers3 size={18} />}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.porTipo.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 18, left: 24, bottom: 4 }}>
                <CartesianGrid strokeDasharray="4 8" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={132} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Registros" radius={[0, 8, 8, 0]} fill="#7c3aed" barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel eyebrow="Origem" title="Entrada de demandas" icon={<Route size={18} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.porOrigem.length === 0 ? (
              <p className="rounded-[12px] bg-slate-50 p-4 text-sm text-[var(--tn-muted)] sm:col-span-2">Nenhuma origem informada no período.</p>
            ) : (
              data.porOrigem.slice(0, 6).map((item: AnalyticsPoint, index: number) => (
                <div key={item.name} className="rounded-[14px] border border-slate-100 bg-slate-50 p-4 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[11px] text-white" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}>
                      <Clock3 size={17} />
                    </span>
                    <strong className="text-2xl text-slate-900">{item.value}</strong>
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-slate-600" title={item.name}>{item.name}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Tabela analítica" title={`Por ${config.slug === 'coleta-entulhos' ? 'tipo de resíduo' : 'tipo de serviço'}`} icon={<Layers3 size={18} />}>
        <div className="overflow-auto rounded-[14px] border border-slate-100">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="bg-slate-50 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">{metricTitle}</th>
                <th className="px-3 py-2 text-right">% Qtd</th>
                <th className="px-3 py-2 text-right">% {metricTitle}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sheet.tipos.map((item) => (
                <tr key={item.name} className="transition hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-800">{item.name}</td>
                  <td className="px-3 py-2 text-right font-bold">{item.qtd}</td>
                  <td className="px-3 py-2 text-right">{formatMetric(item.producao)}</td>
                  <td className="px-3 py-2 text-right">{formatMetric(item.pctQtd)}%</td>
                  <td className="px-3 py-2 text-right">{formatMetric(item.pctProducao)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
