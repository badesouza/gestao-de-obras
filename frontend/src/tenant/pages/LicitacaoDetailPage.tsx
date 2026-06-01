import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { ApiError, tenantApi, type Licitacao, type LicitacaoItem } from '../../lib/api-client';
import { ColumnsImportPanel } from '../components/ColumnsImportPanel';
import { ImportInstructions, useImportTemplateDownload } from '../components/ImportInstructions';
import { SpreadsheetImportPanel } from '../components/SpreadsheetImportPanel';
import { useTenant, useTenantPermission } from '../TenantContext';

type ImportTab = 'spreadsheet' | 'columns';

function formatValor(value: string | null): string {
  if (!value) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQuantidade(value: string | null): string {
  if (!value) return 'â€”';
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px',
      color: active ? '#16a34a' : '#64748b',
      background: active ? '#f0fdf4' : '#f8fafc',
      border: `1px solid ${active ? '#bbf7d0' : '#e2e8f0'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#16a34a' : '#94a3b8', display: 'inline-block' }} />
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

/* ── Modal de edição de item ──────────────────────────────────── */
function EditItemModal({ item, licitacaoId, entityId, onClose, onSaved }: {
  item: LicitacaoItem;
  licitacaoId: string;
  entityId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoria, setCategoria] = useState(item.categoria ?? '');
  const [descricao, setDescricao] = useState(item.descricao);
  const [unidade, setUnidade] = useState(item.unidadeMedida);
  const [quantidade, setQuantidade] = useState(item.quantidade ?? '');
  const [valor, setValor] = useState(item.valorUnitario ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() || !unidade.trim()) return;
    setSaving(true);
    setError('');
    try {
      await tenantApi.licitacoes.updateItem(entityId, licitacaoId, item.id, {
        categoria: categoria.trim() || undefined,
        descricao: descricao.trim(),
        unidadeMedida: unidade.trim(),
        quantidade: quantidade.trim() ? quantidade.trim().replace(',', '.') : null,
        valorUnitario: valor.trim() ? valor.trim().replace(',', '.') : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      setSaving(false);
    }
  };

  const fieldStyle = (filled: boolean): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', fontSize: 13, fontWeight: 500,
    color: '#0f172a', border: `1.5px solid ${filled ? '#2563eb60' : '#e2e8f0'}`,
    borderRadius: 10, outline: 'none', background: '#fafafa',
    boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  });

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 2 }}>Editar item</p>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>Atualizar dados do item</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Categoria</span>
            <input type="text" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex.: LIMPEZA" style={fieldStyle(!!categoria)}
              onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
              onBlur={e => { e.target.style.borderColor = categoria ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Descrição <span style={{ color: '#dc2626' }}>*</span>
            </span>
            <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} required placeholder="Descrição do item" style={fieldStyle(!!descricao)}
              onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
              onBlur={e => { e.target.style.borderColor = descricao ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Unidade <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <input type="text" value={unidade} onChange={e => setUnidade(e.target.value)} required placeholder="Ex.: UN, M², H" style={fieldStyle(!!unidade)}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
                onBlur={e => { e.target.style.borderColor = unidade ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quantidade</span>
              <input type="text" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0,0000" style={fieldStyle(!!quantidade)}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
                onBlur={e => { e.target.style.borderColor = quantidade ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Valor unit.</span>
              <input type="text" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" style={fieldStyle(!!valor)}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
                onBlur={e => { e.target.style.borderColor = valor ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
            </label>
          </div>

          {error && (
            <div className="tn-alert" style={{ marginTop: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="tn-btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="tn-btn-blue" style={{ height: 38, fontSize: 13, flex: 1, opacity: saving ? 0.7 : 1 }}>
              {saving ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                  Salvando…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Salvar alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ── Página principal ─────────────────────────────────────────── */
export function LicitacaoDetailPage() {
  const { entityId } = useTenant();
  const { licitacaoId = '' } = useParams<{ licitacaoId: string }>();
  const canManage = useTenantPermission('licitacoes.manage');
  const canImport = useTenantPermission('licitacoes.items.import');
  const canDeactivate = useTenantPermission('licitacoes.items.deactivate');
  const downloadTemplate = useImportTemplateDownload();

  const [licitacao, setLicitacao] = useState<Licitacao | null>(null);
  const [items, setItems] = useState<LicitacaoItem[]>([]);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>('spreadsheet');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hovRow, setHovRow] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<LicitacaoItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LicitacaoItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (includeInactive) params.set('includeInactive', 'true');
      const [lic, itemsResult] = await Promise.all([
        tenantApi.licitacoes.get(entityId, licitacaoId),
        tenantApi.licitacoes.listItems(entityId, licitacaoId, params),
      ]);
      setLicitacao(lic);
      setItems(itemsResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [entityId, licitacaoId, search, includeInactive]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleDeactivateLicitacao = async () => {
    if (!window.confirm('Desativar esta licitação?')) return;
    try {
      const updated = await tenantApi.licitacoes.deactivate(entityId, licitacaoId);
      setLicitacao(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desativar');
    }
  };

  const handleDeactivateItem = async (itemId: string) => {
    try {
      await tenantApi.licitacoes.deactivateItem(entityId, licitacaoId, itemId);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desativar item');
    }
  };

  const handleDeleteItem = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await tenantApi.licitacoes.deleteItem(entityId, licitacaoId, confirmDelete.id);
      setConfirmDelete(null);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir item');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !licitacao) {
    return (
      <div className="tn-page">
        <div className="tn-skeleton">{[1,2,3].map(n => <div key={n} className="tn-skeleton-row" />)}</div>
      </div>
    );
  }

  if (!licitacao) {
    return (
      <div className="tn-page">
        <div className="tn-alert">{error || 'Licitação não encontrada'}</div>
        <Link to={`/t/${entityId}/licitacoes`} className="tn-back-link" style={{ marginTop: 12 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar para licitações
        </Link>
      </div>
    );
  }

  const isActive = licitacao.status === 'ACTIVE';

  return (
    <div className="tn-page">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <Link to={`/t/${entityId}/licitacoes`} className="tn-back-link">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Licitações
      </Link>

      <div className="tn-hero-light" style={{ borderLeftColor: isActive ? '#2563eb' : '#94a3b8' }}>
        <div className="tn-hero-light-glow" />
        <div className="tn-hero-light-inner">
          <div className="tn-hero-light-left">
            <div className="tn-hero-light-kicker">
              <span className="tn-hero-light-dot" style={{ background: isActive ? '#2563eb' : '#94a3b8' }} />
              Licitação
            </div>
            <h2 className="tn-hero-light-title">{licitacao.identificacao}</h2>
            {licitacao.objeto && <p className="tn-hero-light-desc">{licitacao.objeto}</p>}
          </div>
          <div className="tn-hero-light-right">
            <Link to={`/t/${entityId}/licitacoes`}>
              <button type="button" className="tn-btn-secondary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Voltar
              </button>
            </Link>
            {canManage && isActive && (
              <button type="button" className="tn-btn-secondary" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => void handleDeactivateLicitacao()}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Desativar licitação
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="tn-stats">
        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div className="tn-stat-kicker">Status</div>
          <div className="tn-stat-value" style={{ fontSize: 16, paddingTop: 6 }}><StatusBadge status={licitacao.status} /></div>
          <div className="tn-stat-desc">Situação atual</div>
        </div>
        <div className="tn-stat tone-green">
          <div className="tn-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div className="tn-stat-kicker">Itens ativos</div>
          <div className="tn-stat-value">{licitacao.activeItemCount}</div>
          <div className="tn-stat-desc">Itens disponíveis</div>
          <div className="tn-stat-badge"><i />Ativos</div>
        </div>
        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
          <div className="tn-stat-kicker">Cadastro</div>
          <div className="tn-stat-value" style={{ fontSize: 13, paddingTop: 8 }}>{new Date(licitacao.createdAt).toLocaleDateString('pt-BR')}</div>
          <div className="tn-stat-desc">{new Date(licitacao.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <div className="tn-stat-kicker">Cadastrado por</div>
          <div className="tn-stat-value" style={{ fontSize: 15, paddingTop: 8 }}>{licitacao.createdBy.name}</div>
          <div className="tn-stat-desc">Responsável</div>
        </div>
      </div>

      {error && <div className="tn-alert">{error}</div>}

      {/* Tabela de itens */}
      <div className="tn-panel">
        <div className="tn-panel-head">
          <div className="tn-panel-head-left">
            <span>Tabela de preços</span>
            <h3>Itens da licitação</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar descrição…"
                style={{ paddingLeft: 32, paddingRight: 12, height: 36, fontSize: 12, fontWeight: 500, border: '1.5px solid #e2e8f0', borderRadius: 10, outline: 'none', color: '#334155', background: '#fafafa', width: 200 }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} style={{ accentColor: '#2563eb', width: 14, height: 14 }} />
              Incluir inativos
            </label>
          </div>
        </div>

        {loading && <div className="tn-skeleton">{[1,2,3,4].map(n => <div key={n} className="tn-skeleton-row" />)}</div>}

        {!loading && items.length === 0 && (
          <div className="tn-empty">
            <div className="tn-empty-icon" style={{ fontSize: 32 }}>📄</div>
            <strong>Nenhum item encontrado</strong>
            <span style={{ fontSize: 12, color: 'var(--tn-muted)', marginTop: 4 }}>
              {search ? 'Tente outro termo de busca.' : 'Importe itens usando o painel abaixo.'}
            </span>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Categoria', 'Descrição', 'Unidade', 'Quantidade', 'Valor unit.', 'Status', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: i >= 2 ? 'center' : 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const active = item.status === 'ACTIVE';
                  const isHov = hovRow === item.id;
                  return (
                    <tr key={item.id}
                      onMouseEnter={() => setHovRow(item.id)}
                      onMouseLeave={() => setHovRow(null)}
                      style={{ borderBottom: '1px solid #f8fafc', background: isHov ? '#f8fafc' : 'transparent', opacity: active ? 1 : 0.55, transition: 'background 0.12s' }}>
                      <td style={{ padding: '11px 16px' }}>
                        {item.categoria
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', borderRadius: 99, padding: '2px 8px', border: '1px solid #bfdbfe' }}>{item.categoria}</span>
                          : <span style={{ color: '#e2e8f0' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#1e293b', fontWeight: 500 }}>{item.descricao}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', borderRadius: 99, padding: '2px 8px', border: '1px solid #e9d5ff' }}>{item.unidadeMedida}</span>
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 700, color: '#334155', fontFamily: 'monospace', fontSize: 13 }}>
                        {formatQuantidade(item.quantidade)}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace', fontSize: 13 }}>
                        R$ {formatValor(item.valorUnitario)}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'center' }}><StatusBadge status={item.status} /></td>

                      {/* ações */}
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {/* editar */}
                          {canDeactivate && (
                            <button type="button" title="Editar item" onClick={() => setEditingItem(item)}
                              className="tn-icon-btn"
                              style={{ opacity: isHov ? 1 : 0, transition: 'opacity 0.15s' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          )}
                          {/* desativar */}
                          {canDeactivate && active && (
                            <button type="button" title="Desativar item" onClick={() => void handleDeactivateItem(item.id)}
                              className="tn-icon-btn"
                              style={{ opacity: isHov ? 1 : 0, transition: 'opacity 0.15s', color: '#f59e0b' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            </button>
                          )}
                          {/* excluir */}
                          {canDeactivate && (
                            <button type="button" title="Excluir item" onClick={() => setConfirmDelete(item)}
                              className="tn-icon-btn sv-btn-excluir"
                              style={{ opacity: isHov ? 1 : 0, transition: 'opacity 0.15s' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Importar itens */}
      {canImport && isActive && (
        <div className="tn-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left">
              <span>Carga de dados</span>
              <h3>Importar itens</h3>
            </div>
          </div>
          <div style={{ padding: '0 20px 12px' }}>
            <ImportInstructions onDownload={format => { void downloadTemplate(format).catch(err => setError(err instanceof Error ? err.message : 'Erro ao baixar modelo')); }} />
          </div>
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
            {(['spreadsheet', 'columns'] as const).map(tab => (
              <button key={tab} type="button" onClick={() => setImportTab(tab)} className={`sv-aba${importTab === tab ? ' is-active' : ''}`}>
                {tab === 'spreadsheet' ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>Planilha</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>Colunas (textarea)</>
                )}
              </button>
            ))}
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            {importTab === 'spreadsheet'
              ? <SpreadsheetImportPanel licitacaoId={licitacaoId} onSuccess={() => void loadData()} />
              : <ColumnsImportPanel licitacaoId={licitacaoId} onSuccess={() => void loadData()} />}
          </div>
        </div>
      )}

      {/* Modal editar item */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          licitacaoId={licitacaoId}
          entityId={entityId}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); void loadData(); }}
        />
      )}

      {/* Modal confirmar exclusão */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>Excluir item?</h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                O item <strong style={{ color: '#0f172a' }}>{confirmDelete.descricao}</strong> será removido permanentemente. Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
                <button type="button" onClick={() => setConfirmDelete(null)} className="tn-btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                <button type="button" onClick={() => void handleDeleteItem()} disabled={deleting}
                  style={{ flex: 1, height: 38, fontSize: 13, fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: deleting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {deleting ? 'Excluindo…' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
