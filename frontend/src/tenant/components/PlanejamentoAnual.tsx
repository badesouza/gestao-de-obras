import { useEffect, useState } from 'react';
import { tenantApi } from '../../lib/api-client';
import type { ServicoConfig } from '../pages/servico-config';
import { Aviso, Cartao, Carregando, Ic, Janela, type NomeIcone } from './sisobras/so';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
type Campo = keyof MetaMes;

const emptyDraft = (): DraftMes => ({ metaRegistros: '', metaProducao: '', metaHoras: '' });
const fmt = (v: number | null) => v != null ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v) : '—';
const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
const parse = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const COR: Record<Campo, string> = { metaRegistros: '#635BFF', metaProducao: '#0FB5C2', metaHoras: '#E8962A' };
const ICONE: Record<Campo, NomeIcone> = { metaRegistros: 'doc', metaProducao: 'sliders', metaHoras: 'relogio' };

/* ── Curva anual das metas (SVG, cores do SisObras) ── */
function GraficoAnual({ metas, cor, mesAtual }: { metas: (number | null)[]; cor: string; mesAtual: number }) {
  const [hov, setHov] = useState<number | null>(null);
  const valid = metas.filter(v => v != null) as number[];
  if (valid.length === 0) return <Aviso tom="plain" icone="sliders">Defina as metas para ver a curva do ano.</Aviso>;

  const W = 860, H = 210, padL = 48, padR = 20, padT = 24, padB = 32;
  const w = W - padL - padR, h = H - padT - padB;
  const maxVal = Math.max(...valid, 1) * 1.1;
  const x = (i: number) => padL + (i / 11) * w;
  const y = (v: number) => padT + h - (v / maxVal) * h;
  const pts = metas.map((v, i) => v != null ? { x: x(i), y: y(v) } : null).filter(Boolean) as { x: number; y: number }[];
  const curva = pts.length < 2 ? '' : pts.slice(1).reduce((d, c, i) => { const p = pts[i]; const cx = (p.x + c.x) / 2; return `${d} C ${cx} ${p.y} ${cx} ${c.y} ${c.x} ${c.y}`; }, `M ${pts[0].x} ${pts[0].y}`);
  const area = curva ? `M ${pts[0].x} ${padT + h} L ${pts[0].x} ${pts[0].y}${curva.slice(curva.indexOf(' C'))} L ${pts[pts.length - 1].x} ${padT + h} Z` : '';
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((maxVal / 4) * i));

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, overflow: 'visible' }} onMouseLeave={() => setHov(null)} role="img" aria-label="Curva de metas do ano">
        <defs>
          <linearGradient id="soPlanArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cor} stopOpacity={0.22} /><stop offset="100%" stopColor={cor} stopOpacity={0.01} /></linearGradient>
        </defs>
        {ticks.map(v => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line)" strokeDasharray={v ? '3 4' : undefined} />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={9.5} fontWeight={600} fill="var(--faint)" fontFamily="var(--font-mono)">{fmtK(v)}</text>
          </g>
        ))}
        <rect x={x(mesAtual - 1) - w / 24} y={padT} width={w / 12} height={h} fill="var(--brand-soft)" rx={6} />
        <path d={area} fill="url(#soPlanArea)" />
        <path d={curva} fill="none" stroke={cor} strokeWidth={3} strokeLinecap="round" pathLength={100} strokeDasharray={100} style={{ animation: 'os-draw 1.6s var(--ease) both', strokeDashoffset: 100 }} />
        {metas.map((_v, i) => <rect key={i} x={x(i) - w / 24} y={padT} width={w / 12} height={h + padB} fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHov(i)} />)}
        {hov !== null && metas[hov] != null && <line x1={x(hov)} y1={padT} x2={x(hov)} y2={padT + h} stroke={cor} strokeDasharray="4 3" opacity={0.6} />}
        {metas.map((v, i) => v != null
          ? <circle key={i} cx={x(i)} cy={y(v)} r={hov === i ? 7 : 4.5} fill="var(--surface)" stroke={cor} strokeWidth={hov === i ? 3 : 2} />
          : <circle key={i} cx={x(i)} cy={padT + h} r={2.5} fill="var(--line-2)" />)}
        {MESES.map((m, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fontWeight={i === mesAtual - 1 ? 800 : 600} fill={i === mesAtual - 1 ? 'var(--brand-ink)' : 'var(--muted)'}>{m}</text>)}
      </svg>
      {hov !== null && metas[hov] != null && (
        <div style={{ position: 'absolute', top: 0, left: `${(hov / 11) * 100}%`, transform: hov > 8 ? 'translateX(-100%)' : 'translateX(10px)', pointerEvents: 'none',
          background: 'var(--tip-bg)', color: 'var(--tip-fg)', borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow-lg)', minWidth: 120 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .7 }}>{MESES_FULL[hov]}</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: cor }}>{fmt(metas[hov])}</div>
        </div>
      )}
    </div>
  );
}

interface Props { entityId: string; centroId: string; config: ServicoConfig; year: number }

/** Aba Planejamento: metas do ano por mês (ocorrências, produção e horas) */
export function PlanejamentoAnual({ entityId, centroId, config, year }: Props) {
  const [metas, setMetas] = useState<Record<number, MetaMes>>({});
  const [draft, setDraft] = useState<Record<number, DraftMes>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState(year);
  const [indicador, setIndicador] = useState<Campo>('metaProducao');
  const mesAtual = new Date().getMonth() + 1;
  const unit = metricUnit(config.slug);
  const prodLabel = metricLabel(config.slug);

  useEffect(() => {
    setLoading(true);
    tenantApi.centrosCusto.getMetasAno(entityId, centroId, ano)
      .then(r => setMetas(r.metas ?? {}))
      .catch(() => setMetas({}))
      .finally(() => setLoading(false));
  }, [entityId, centroId, ano]);

  const abrirEdicao = () => {
    const d: Record<number, DraftMes> = {};
    for (let m = 1; m <= 12; m++) {
      const meta = metas[m];
      d[m] = {
        metaRegistros: meta?.metaRegistros != null ? String(meta.metaRegistros) : '',
        metaProducao: meta?.metaProducao != null ? String(meta.metaProducao) : '',
        metaHoras: meta?.metaHoras != null ? String(meta.metaHoras) : '',
      };
    }
    setDraft(d); setErro(''); setEditing(true);
  };
  const salvar = async () => {
    setSaving(true); setErro('');
    const corpo: Record<number, MetaMes> = {};
    for (let m = 1; m <= 12; m++) {
      const d = draft[m] ?? emptyDraft();
      corpo[m] = { metaRegistros: parse(d.metaRegistros), metaProducao: parse(d.metaProducao), metaHoras: parse(d.metaHoras) };
    }
    try {
      await tenantApi.centrosCusto.saveMetasAno(entityId, centroId, { year: ano, metas: corpo });
      setMetas(corpo); setEditing(false);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar as metas'); }
    finally { setSaving(false); }
  };
  const setCell = (m: number, f: keyof DraftMes, v: string) => setDraft(d => ({ ...d, [m]: { ...(d[m] ?? emptyDraft()), [f]: v } }));
  const totalMeta = (f: Campo) => Array.from({ length: 12 }, (_, i) => metas[i + 1]?.[f] ?? 0).reduce<number>((a, b) => a + (b ?? 0), 0);
  const linhas: { field: Campo; label: string; unit: string }[] = [
    { field: 'metaRegistros', label: 'Ocorrências', unit: 'ocorr.' },
    { field: 'metaProducao', label: prodLabel, unit },
    { field: 'metaHoras', label: 'Horas', unit: 'h' },
  ];
  const definidos = Object.values(metas).filter(m => m && (m.metaRegistros != null || m.metaProducao != null || m.metaHoras != null)).length;

  const navAno = (
    <div className="so-seg" role="group" aria-label="Ano" style={{ alignItems: 'center' }}>
      <button type="button" className="so-btn so-ghost sm" style={{ border: 0, background: 'transparent' }} onClick={() => setAno(a => a - 1)} aria-label="Ano anterior"><Ic n="voltar" /></button>
      <span className="mono" style={{ padding: '0 6px', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{ano}</span>
      <button type="button" className="so-btn so-ghost sm" style={{ border: 0, background: 'transparent' }} onClick={() => setAno(a => a + 1)} aria-label="Próximo ano"><Ic n="seta" /></button>
    </div>
  );

  return (
    <>
      <Cartao icone="relogio" titulo={`Metas de ${ano}`} meta={`${definidos} de 12 meses com meta · ${config.nome}`} ajuda="Ajuda: Planejamento"
        direita={<>{navAno}<button type="button" className="so-btn so-primary sm os-shine" onClick={abrirEdicao} disabled={loading}><Ic n="editar" />Editar metas</button></>}>
        {loading ? <Carregando texto="Carregando metas…" /> : (
          <div className="so-tw" style={{ overflowX: 'auto' }}>
            <table className="so-table os-rows" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th scope="col">Indicador</th>
                  {MESES.map((m, i) => {
                    const cur = i + 1 === mesAtual && ano === year;
                    return <th key={m} scope="col" style={{ textAlign: 'center', color: cur ? 'var(--brand-ink)' : undefined, boxShadow: cur ? 'inset 0 -2px 0 var(--brand)' : undefined }}>{m}</th>;
                  })}
                  <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ field, label, unit: u }) => {
                  const total = totalMeta(field);
                  return (
                    <tr key={field}>
                      <td data-l="Indicador">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span className="os-ic" style={{ '--k': `linear-gradient(135deg, ${COR[field]}, color-mix(in srgb, ${COR[field]} 70%, #fff))`, '--ks': COR[field], width: 28, height: 28, borderRadius: 9 } as React.CSSProperties}>
                            <Ic n={ICONE[field]} style={{ width: 14, height: 14, color: '#fff' }} />
                          </span>
                          <span><b style={{ display: 'block', fontSize: 12.5, color: 'var(--ink)' }}>{label}</b><small style={{ color: 'var(--muted)', fontSize: 10.5 }}>{u}</small></span>
                        </span>
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const v = metas[i + 1]?.[field] ?? null;
                        const cur = i + 1 === mesAtual && ano === year;
                        return (
                          <td key={i} data-l={MESES[i]} className="mono" style={{ textAlign: 'center', background: cur ? 'var(--brand-soft)' : undefined }}>
                            {v != null ? <span style={{ display: 'inline-block', minWidth: 46, padding: '4px 8px', borderRadius: 8, fontWeight: 700, color: COR[field], background: `color-mix(in srgb, ${COR[field]} 10%, transparent)` }}>{fmt(v)}</span>
                              : <span style={{ color: 'var(--faint)' }}>·</span>}
                          </td>
                        );
                      })}
                      <td data-l="Total" style={{ textAlign: 'right' }}>
                        {total > 0
                          ? <span className="os-pill" style={{ color: COR[field], background: `color-mix(in srgb, ${COR[field]} 12%, transparent)`, borderColor: `color-mix(in srgb, ${COR[field]} 30%, transparent)` }}><span className="mono">{fmt(total)}</span> <small style={{ fontWeight: 600, opacity: .75 }}>{u}</small></span>
                          : <span style={{ color: 'var(--faint)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <Cartao icone="sliders" tomIcone="cyan" titulo="Curva das metas" meta={`${linhas.find(l => l.field === indicador)?.label} · ${ano}`} ajuda="Ajuda: Curva das metas"
        direita={
          <div className="so-seg" role="radiogroup" aria-label="Indicador">
            {linhas.map(l => (
              <label key={l.field} className={indicador === l.field ? 'on' : ''}><input type="radio" name="indicador" checked={indicador === l.field} onChange={() => setIndicador(l.field)} />{l.label}</label>
            ))}
          </div>
        }>
        {!loading && <GraficoAnual metas={Array.from({ length: 12 }, (_, i) => metas[i + 1]?.[indicador] ?? null)} cor={COR[indicador]} mesAtual={mesAtual} />}
      </Cartao>

      {editing && (
        <Janela icone="editar" eyebrow={`Planejamento · ${config.nome}`} titulo={`Metas de ${ano}`} largura={1060}
          sub="Preencha só os meses que têm meta. Deixe em branco o que não vale." onFechar={() => setEditing(false)}
          rodape={<>
            <button type="button" className="so-btn so-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
            <button type="button" className="so-btn so-primary" onClick={salvar} disabled={saving}><Ic n="check" />{saving ? 'Salvando…' : 'Salvar metas'}</button>
          </>}>
          <div className="so-tw" style={{ overflowX: 'auto' }}>
            <table className="so-table" style={{ minWidth: 960 }}>
              <thead><tr><th scope="col">Indicador</th>{MESES.map(m => <th key={m} scope="col" style={{ textAlign: 'center' }}>{m}</th>)}</tr></thead>
              <tbody>
                {linhas.map(({ field, label, unit: u }) => (
                  <tr key={field}>
                    <td><b style={{ color: 'var(--ink)', fontSize: 12.5 }}>{label}</b><small style={{ display: 'block', color: 'var(--muted)' }}>{u}</small></td>
                    {Array.from({ length: 12 }, (_, i) => (
                      <td key={i} style={{ padding: '6px 3px' }}>
                        <span className="so-ctrl mono" style={{ height: 34 }}>
                          <input type="text" inputMode="decimal" aria-label={`${label} em ${MESES_FULL[i]}`} value={draft[i + 1]?.[field] ?? ''} placeholder="—"
                            onChange={e => setCell(i + 1, field, e.target.value)} style={{ textAlign: 'center', padding: '0 4px', width: '100%' }} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {erro && <Aviso tom="amber">{erro}</Aviso>}
        </Janela>
      )}
    </>
  );
}
