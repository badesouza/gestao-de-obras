import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tenantApi, mapaApi, type CentroCustoDetail, type PropriedadeConfig, type RegistroDiarioRow } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { SERVICOS_CONFIG, CENTRO_IDS, type ServicoConfig } from './servico-config';
import { ServicoInstrucoesDrawer } from '../components/ServicoInstrucoesDrawer';
import { NovaOcorrenciaModal } from '../components/NovaOcorrenciaModal';
import { ModalConclusao, type DadosConclusao } from '../components/ModalConclusao';
import { OrdemServicoModal } from '../components/OrdemServicoModal';
import { ServicoAnalytics } from '../components/ServicoAnalytics';
import { PlanejamentoAnual } from '../components/PlanejamentoAnual';
import { ServicoSolicitacoesPanel } from '../components/ServicoSolicitacoesPanel';

/* ── helpers ─────────────────────────────────────────────────────── */
function hoje(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatDataBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function nomeMes(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function getStatusChip(status: string | undefined) {
  if (!status) return { cls: 'dot-gray', label: '—' };
  const s = status.toLowerCase();
  if (s.includes('conclu')) return { cls: 'dot-green', label: status };
  if (s.includes('andamento') || s.includes('aberta')) return { cls: 'dot-blue', label: status };
  if (s.includes('cancel') || s.includes('pendent')) return { cls: 'dot-red', label: status };
  return { cls: 'dot-gray', label: status };
}

function getCellText(row: RegistroDiarioRow, propId: string): string {
  const v = row.values[propId];
  if (!v) return '—';
  if (v.text !== undefined) return v.text || '—';
  if (v.decimal !== undefined) return v.decimal;
  if (v.boolean !== undefined) return v.boolean ? 'Sim' : 'Não';
  if (v.date !== undefined) return formatDataBr(v.date);
  return '—';
}

/* ── componente principal ─────────────────────────────────────────── */
export function ServicoDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { entityId, session } = useTenant();

  const config: ServicoConfig | undefined = SERVICOS_CONFIG[slug ?? ''];
  const centroId = CENTRO_IDS[slug ?? ''];

  const { toasts, showToast, closeToast } = useToast();
  const [centro, setCentro] = useState<CentroCustoDetail | null>(null);
  const [rows, setRows] = useState<RegistroDiarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [{ year, month }, setPeriodo] = useState(hoje);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<RegistroDiarioRow | null>(null);
  const [ajudaOpen, setAjudaOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [rowConcluindo, setRowConcluindo] = useState<RegistroDiarioRow | null>(null);
  const [rowOS, setRowOS] = useState<RegistroDiarioRow | null>(null);
  const [aba, setAba] = useState<'registros' | 'analises' | 'planejamento' | 'solicitacoes'>('registros');

  /* mapa nome→id das propriedades */
  const propMap = useRef<Record<string, string>>({});
  const propConfigs = useRef<PropriedadeConfig[]>([]);

  const load = useCallback(async () => {
    if (!centroId) return;
    setLoading(true);
    setError('');
    try {
      const [det, reg] = await Promise.all([
        tenantApi.centrosCusto.get(entityId, centroId),
        tenantApi.centrosCusto.listRegistros(entityId, centroId, year, month),
      ]);
      setCentro(det);
      propConfigs.current = det.propriedadesConfig;
      propMap.current = {};
      det.propriedadesConfig.forEach((pc) => {
        propMap.current[pc.propriedade.nome] = pc.propriedadeId;
      });
      setRows(reg.rows.sort((a, b) => b.data.localeCompare(a.data)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [entityId, centroId, year, month]);

  useEffect(() => { void load(); }, [load]);

  /* encontrar ID da propriedade Status */
  const statusPropId = propMap.current['Status'] ?? Object.values(propMap.current).find((_, k) =>
    Object.keys(propMap.current)[k] === 'Status'
  );
  void statusPropId;

  /* concluir ocorrência — abre modal de conclusão */
  const handleConfirmarConclusao = async (dados: DadosConclusao) => {
    if (!rowConcluindo) return;
    const pid = Object.entries(propMap.current).find(([nome]) => nome === 'Status')?.[1];
    const pidObs = Object.entries(propMap.current).find(([nome]) => nome === 'Observações')?.[1];
    const pidFiscal = Object.entries(propMap.current).find(([nome]) => nome === 'Fiscal Responsável')?.[1];
    if (!pid) return;

    const obsTexto = [
      dados.observacoesFiscal,
      `Vistoria: ${dados.dataVistoria} | Fiscal: ${dados.nomeFiscal} | Qualidade: ${dados.qualidade}`,
    ].filter(Boolean).join('\n');

    const novosValues: Record<string, { text?: string }> = {
      ...rowConcluindo.values,
      [pid]: { text: dados.statusFinal },
    };
    if (pidObs) novosValues[pidObs] = { text: obsTexto };
    if (pidFiscal) novosValues[pidFiscal] = { text: dados.nomeFiscal };

    await tenantApi.centrosCusto.updateRegistro(entityId, centroId, rowConcluindo.id, {
      data: rowConcluindo.data,
      values: novosValues,
    });

    /* salvar coords da vistoria do fiscal se confirmadas */
    if (dados.lat != null && dados.lng != null) {
      await mapaApi.salvarCoords(entityId, rowConcluindo.id, dados.lat, dados.lng, dados.enderecoConfirmado);
    }

    setRowConcluindo(null);
    await load();
  };

  /* reabrir ocorrência */
  const handleReabrir = async (row: RegistroDiarioRow) => {
    const pid = Object.entries(propMap.current).find(([nome]) => nome === 'Status')?.[1];
    if (!pid) return;
    setSaving(row.id);
    try {
      await tenantApi.centrosCusto.updateRegistro(entityId, centroId, row.id, {
        data: row.data,
        values: { ...row.values, [pid]: { text: 'Em Andamento' } },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao reabrir');
    } finally {
      setSaving(null);
    }
  };

  /* excluir */
  const handleDelete = async (id: string) => {
    setSaving(id);
    try {
      await tenantApi.centrosCusto.deleteRegistro(entityId, centroId, id);
      setConfirmDelete(null);
      showToast('Ocorrência excluída com sucesso.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setSaving(null);
    }
  };

  /* mês anterior / próximo */
  const mudarMes = (delta: number) => {
    setPeriodo(({ year: y, month: m }) => {
      let nm = m + delta;
      let ny = y;
      if (nm < 1) { nm = 12; ny--; }
      if (nm > 12) { nm = 1; ny++; }
      return { year: ny, month: nm };
    });
  };

  if (!config || !centroId) {
    return (
      <div className="tn-page">
        <div className="tn-alert">Serviço não encontrado.</div>
      </div>
    );
  }

  /* resumo do mês */
  const total = rows.length;
  const concluidas = rows.filter(r => {
    const pid = Object.entries(propMap.current).find(([n]) => n === 'Status')?.[1];
    return pid && r.values[pid]?.text?.toLowerCase().includes('conclu');
  }).length;
  const abertas = total - concluidas;

  /* colunas para exibir na lista: bairro, logradouro, tipo, métrica principal, status */
  const colsToShow = config.camposPrincipais
    .map(nome => ({ nome, id: propMap.current[nome] }))
    .filter(c => c.id);

  return (
    <div className="tn-page">

      {/* Breadcrumb */}
      <Link to={`/t/${entityId}/servicos`} className="tn-back-link">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Serviços Urbanos
      </Link>

      {/* Hero */}
      <div className="tn-hero-light" style={{ borderLeftColor: config.cor }}>
        <div className="tn-hero-light-glow" />
        <div className="tn-hero-light-inner">
          <div className="tn-hero-light-left">
            <div className="tn-hero-light-kicker">
              <span className="tn-hero-light-dot" style={{ background: config.cor }} />
              Serviço Urbano
            </div>
            <h2 className="tn-hero-light-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: config.cor, display: 'flex', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${config.cor} 12%, transparent)`, borderRadius: 8, flexShrink: 0 }}>
                {config.icon}
              </span>
              <span>{config.nome}</span>
            </h2>
            <p className="tn-hero-light-desc">{config.descricao}</p>
          </div>
          <div className="tn-hero-light-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="tn-btn-secondary"
              onClick={() => setAjudaOpen(true)}
              title="Ver instruções de uso"
              style={{ gap: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Instruções
            </button>
            <button
              type="button"
              className="tn-btn-blue"
              style={{ height: 38, fontSize: 13 }}
              onClick={() => { setEditRow(null); setModalOpen(true); }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nova Ocorrência
            </button>
          </div>
        </div>
      </div>

      {/* Stats do mês */}
      <div className="tn-stats">
        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Total do mês</div>
          <div className="tn-stat-value">{loading ? '…' : total}</div>
          <div className="tn-stat-desc">Ocorrências registradas</div>
          <div className="tn-stat-badge"><i />Registradas</div>
        </div>
        <div className="tn-stat tone-green">
          <div className="tn-stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Concluídas</div>
          <div className="tn-stat-value">{loading ? '…' : concluidas}</div>
          <div className="tn-stat-desc">Serviços finalizados</div>
          <div className="tn-stat-badge"><i />Concluídas</div>
        </div>
        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Em aberto</div>
          <div className="tn-stat-value">{loading ? '…' : abertas}</div>
          <div className="tn-stat-desc">Pendentes de conclusão</div>
          <div className="tn-stat-badge"><i />Pendentes</div>
        </div>
        <div className="tn-stat tone-rose">
          <div className="tn-stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Período</div>
          <div className="tn-stat-value" style={{ fontSize: 16, paddingTop: 8, textTransform: 'capitalize' }}>
            {loading ? '…' : nomeMes(month, year)}
          </div>
          <div className="tn-stat-desc">Mês de referência</div>
          <div className="tn-stat-badge"><i />{year}</div>
        </div>
      </div>

      {/* Abas */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="sv-abas">
        <button
          type="button"
          className={`sv-aba${aba === 'registros' ? ' is-active' : ''}`}
          onClick={() => setAba('registros')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Registros
        </button>
        <button
          type="button"
          className={`sv-aba${aba === 'analises' ? ' is-active' : ''}`}
          onClick={() => setAba('analises')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Análises
        </button>
        <button
          type="button"
          className={`sv-aba${aba === 'planejamento' ? ' is-active' : ''}`}
          onClick={() => setAba('planejamento')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Planejamento
        </button>
        <button
          type="button"
          className={`sv-aba${aba === 'solicitacoes' ? ' is-active' : ''}`}
          onClick={() => setAba('solicitacoes')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="21" r="1"/>
            <circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 002 1.58h8.77a2 2 0 001.95-1.57L21 8H5.12"/>
          </svg>
          Solicitacoes
        </button>
      </div>
        {aba === 'analises' ? <div className="sv-month-nav self-start sm:self-auto">
          <button type="button" className="sv-month-btn" onClick={() => mudarMes(-1)} title="Mes anterior">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span className="sv-month-label" style={{ textTransform: 'capitalize' }}>
            {nomeMes(month, year)}
          </span>
          <button type="button" className="sv-month-btn" onClick={() => mudarMes(1)} title="Proximo mes">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div> : null}
      </div>

      {/* Painel de análises */}
      {aba === 'analises' && (
        <div className="tn-panel" style={{ padding: 0 }}>
          <ServicoAnalytics
            entityId={entityId}
            centroId={centroId}
            config={config}
            year={year}
            month={month}
          />
        </div>
      )}

      {/* Painel de planejamento */}
      {aba === 'planejamento' && (
        <PlanejamentoAnual
          entityId={entityId}
          centroId={centroId}
          config={config}
          year={year}
        />
      )}

      {aba === 'solicitacoes' && (
        <ServicoSolicitacoesPanel config={config} />
      )}

      {/* Painel principal */}
      {aba === 'registros' && <div className="tn-panel">
        <div className="tn-panel-head">
          <div className="tn-panel-head-left">
            <span>Registro operacional</span>
            <h3>Ocorrências — {nomeMes(month, year)}</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Navegação de mês */}
            <div className="sv-month-nav">
              <button type="button" className="sv-month-btn" onClick={() => mudarMes(-1)} title="Mês anterior">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <span className="sv-month-label" style={{ textTransform: 'capitalize' }}>
                {nomeMes(month, year)}
              </span>
              <button type="button" className="sv-month-btn" onClick={() => mudarMes(1)} title="Próximo mês">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
            <button
              type="button"
              className="tn-btn-blue"
              style={{ height: 36, fontSize: 13 }}
              onClick={() => { setEditRow(null); setModalOpen(true); }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nova
            </button>
          </div>
        </div>

        {error && <div className="tn-alert" style={{ margin: '12px 16px' }}>{error}</div>}

        {/* Loading */}
        {loading && (
          <div className="tn-skeleton">
            {[1,2,3,4].map(n => <div key={n} className="tn-skeleton-row" />)}
          </div>
        )}

        {/* Vazio */}
        {!loading && rows.length === 0 && (
          <div className="tn-empty">
            <div className="tn-empty-icon" style={{ color: config.cor, fontSize: 36 }}>
              {config.icon}
            </div>
            <strong>Nenhuma ocorrência em {nomeMes(month, year)}</strong>
            <button
              type="button"
              className="tn-btn-blue"
              style={{ marginTop: 8, height: 38, fontSize: 13 }}
              onClick={() => { setEditRow(null); setModalOpen(true); }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Registrar primeira ocorrência
            </button>
            <span style={{ fontSize: 12, color: 'var(--tn-muted)', marginTop: 4 }}>Clique em "Nova Ocorrência" para registrar o primeiro serviço do mês.</span>
          </div>
        )}

        {/* Lista de ocorrências */}
        {!loading && rows.length > 0 && (
          <div className="sv-ocorrencias-list">

            {/* Cabeçalho da tabela */}
            <div className="sv-ocorrencias-header">
              <div className="sv-oc-col sv-oc-col-data">Data</div>
              {colsToShow.map(c => (
                <div key={c.id} className="sv-oc-col">{c.nome}</div>
              ))}
              <div className="sv-oc-col sv-oc-col-status">Status</div>
              <div className="sv-oc-col sv-oc-col-acoes">Ações</div>
            </div>

            {rows.map((row, idx) => {
              const pid = Object.entries(propMap.current).find(([n]) => n === 'Status')?.[1];
              const statusVal = pid ? (row.values[pid]?.text ?? '') : '';
              const chip = getStatusChip(statusVal);
              const isConcluida = statusVal.toLowerCase().includes('conclu');
              const isSaving = saving === row.id;

              return (
                <div
                  key={row.id}
                  className={`sv-ocorrencia-row${isConcluida ? ' is-concluida' : ''}`}
                  style={{ '--item-delay': `${idx * 0.04}s` } as React.CSSProperties}
                >
                  {/* Barra lateral colorida por status */}
                  <div className="sv-oc-bar" style={{
                    background: isConcluida ? 'var(--tn-green)' : config.cor
                  }} />

                  <div className="sv-oc-col sv-oc-col-data">
                    <strong>{formatDataBr(row.data)}</strong>
                  </div>

                  {colsToShow.map(c => (
                    <div key={c.id} className="sv-oc-col">
                      <span>{getCellText(row, c.id)}</span>
                    </div>
                  ))}

                  <div className="sv-oc-col sv-oc-col-status">
                    <span className={`tn-chip ${chip.cls}`}>
                      <i />{chip.label || 'Aberta'}
                    </span>
                  </div>

                  <div className="sv-oc-col sv-oc-col-acoes">
                    {/* Visualizar OS */}
                    <button
                      type="button"
                      className="tn-icon-btn sv-btn-os"
                      title="Visualizar / Imprimir OS"
                      onClick={() => setRowOS(row)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                    </button>

                    {/* Editar */}
                    <button
                      type="button"
                      className="tn-icon-btn"
                      title="Editar"
                      onClick={() => { setEditRow(row); setModalOpen(true); }}
                      disabled={isSaving}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>

                    {/* Concluir / Reabrir */}
                    {!isConcluida ? (
                      <button
                        type="button"
                        className="tn-icon-btn sv-btn-concluir"
                        title="Registrar conclusão"
                        onClick={() => setRowConcluindo(row)}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sv-spin">
                            <path d="M21 12a9 9 0 11-6.219-8.56"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tn-icon-btn sv-btn-reabrir"
                        title="Reabrir ocorrência"
                        onClick={() => handleReabrir(row)}
                        disabled={isSaving}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="1 4 1 10 7 10"/>
                          <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                        </svg>
                      </button>
                    )}

                    {/* Excluir */}
                    <button
                      type="button"
                      className="tn-icon-btn sv-btn-excluir"
                      title="Excluir"
                      onClick={() => setConfirmDelete(row.id)}
                      disabled={isSaving}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="sv-modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="sv-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="sv-confirm-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3>Excluir ocorrência?</h3>
            <p>Esta ação não pode ser desfeita.</p>
            <div className="sv-confirm-actions">
              <button type="button" className="tn-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                type="button"
                className="sv-btn-danger"
                onClick={() => handleDelete(confirmDelete)}
                disabled={saving === confirmDelete}
              >
                {saving === confirmDelete ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova / editar ocorrência */}
      {modalOpen && centro && (
        <NovaOcorrenciaModal
          config={config}
          centro={centro}
          propMap={propMap.current}
          editRow={editRow}
          entityId={entityId}
          municipalityName={session.entity.municipalityName}
          uf={session.entity.uf}
          onClose={() => { setModalOpen(false); setEditRow(null); }}
          onSaved={() => { setModalOpen(false); setEditRow(null); void load(); }}
        />
      )}

      {/* Modal de OS — visualizar/imprimir */}
      {rowOS && (
        <OrdemServicoModal
          row={rowOS}
          config={config}
          propConfigs={propConfigs.current}
          onClose={() => setRowOS(null)}
        />
      )}

      {/* Modal de conclusão / baixa */}
      {rowConcluindo && (
        <ModalConclusao
          registroId={rowConcluindo.id}
          centroCustoNome={config.nome}
          cor={config.cor}
          data={rowConcluindo.data}
          bairro={(() => { const pid = propMap.current['Bairro / Localidade']; return pid ? rowConcluindo.values[pid]?.text ?? '' : ''; })()}
          logradouro={(() => { const pid = propMap.current['Logradouro / Referência']; return pid ? rowConcluindo.values[pid]?.text ?? '' : ''; })()}
          lat={rowConcluindo.lat}
          lng={rowConcluindo.lng}
          onClose={() => setRowConcluindo(null)}
          onConfirm={handleConfirmarConclusao}
        />
      )}

      {/* Drawer de instruções */}
      <ServicoInstrucoesDrawer
        slug={ajudaOpen ? (slug ?? null) : null}
        nomeServico={config.nome}
        corServico={config.cor}
        onClose={() => setAjudaOpen(false)}
      />

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  );
}
