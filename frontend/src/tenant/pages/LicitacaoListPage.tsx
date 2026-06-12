import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { tenantApi, type Licitacao } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Modal de edição de licitação ────────────────────────────── */
function EditLicitacaoModal({ licitacao, entityId, onClose, onSaved }: {
  licitacao: Licitacao;
  entityId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [identificacao, setIdentificacao] = useState(licitacao.identificacao);
  const [objeto, setObjeto] = useState(licitacao.objeto ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificacao.trim() || objeto.trim().length < 3) return;
    setSaving(true);
    setError('');
    try {
      await tenantApi.licitacoes.update(entityId, licitacao.id, {
        identificacao: identificacao.trim(),
        objeto: objeto.trim(),
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
    boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s',
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
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 2 }}>Editar licitação</p>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>Atualizar dados</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Identificação <span style={{ color: '#dc2626' }}>*</span>
            </span>
            <input type="text" value={identificacao} onChange={e => setIdentificacao(e.target.value)} required placeholder="Ex.: 001/2025" style={fieldStyle(!!identificacao)}
              onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
              onBlur={e => { e.target.style.borderColor = identificacao ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Objeto <span style={{ color: '#dc2626' }}>*</span>
            </span>
            <textarea value={objeto} onChange={e => setObjeto(e.target.value)} required rows={3} placeholder="Descrição do objeto licitado"
              style={{ ...fieldStyle(!!objeto), resize: 'vertical', lineHeight: 1.5 }}
              onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px #2563eb15'; }}
              onBlur={e => { e.currentTarget.style.borderColor = objeto ? '#2563eb60' : '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }} />
          </label>

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
export function LicitacaoListPage() {
  const { entityId } = useTenant();
  const canManage = useTenantPermission('licitacoes.manage');
  const { toasts, showToast, closeToast } = useToast();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [hovRow, setHovRow] = useState<string | null>(null);
  const [editingLic, setEditingLic] = useState<Licitacao | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Licitacao | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await tenantApi.licitacoes.list(entityId, new URLSearchParams());
      setLicitacoes(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [entityId]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const nome = confirmDelete.identificacao;
    try {
      await tenantApi.licitacoes.delete(entityId, confirmDelete.id);
      setConfirmDelete(null);
      showToast(`Licitação "${nome}" excluída com sucesso.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = licitacoes.filter(l =>
    !search ||
    l.identificacao.toLowerCase().includes(search.toLowerCase()) ||
    l.objeto?.toLowerCase().includes(search.toLowerCase())
  );

  const ativas = licitacoes.filter(l => l.status === 'ACTIVE').length;
  const inativas = licitacoes.length - ativas;

  return (
    <div className="tn-page">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Hero */}
      <div className="tn-hero-light" style={{ borderLeftColor: '#2563eb' }}>
        <div className="tn-hero-light-glow" />
        <div className="tn-hero-light-inner">
          <div className="tn-hero-light-left">
            <div className="tn-hero-light-kicker">
              <span className="tn-hero-light-dot" style={{ background: '#2563eb' }} />
              Gestão contratual
            </div>
            <h2 className="tn-hero-light-title">Licitações</h2>
            <p className="tn-hero-light-desc">
              Processos licitatórios e catálogo de itens importados por contrato.
            </p>
          </div>
          {canManage && (
            <div className="tn-hero-light-right">
              <Link to={`/t/${entityId}/licitacoes/new`}>
                <button type="button" className="tn-btn-blue" style={{ height: 38, fontSize: 13 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Nova licitação
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="tn-stats">
        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Total</div>
          <div className="tn-stat-value">{loading ? '…' : licitacoes.length}</div>
          <div className="tn-stat-desc">Processos cadastrados</div>
          <div className="tn-stat-badge"><i />Contratos</div>
        </div>
        <div className="tn-stat tone-green">
          <div className="tn-stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Ativas</div>
          <div className="tn-stat-value">{loading ? '…' : ativas}</div>
          <div className="tn-stat-desc">Em vigência</div>
          <div className="tn-stat-badge"><i />Ativas</div>
        </div>
        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Inativas</div>
          <div className="tn-stat-value">{loading ? '…' : inativas}</div>
          <div className="tn-stat-desc">Encerradas</div>
          <div className="tn-stat-badge"><i />Inativas</div>
        </div>
        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Total de itens</div>
          <div className="tn-stat-value">
            {loading ? '…' : licitacoes.reduce((s, l) => s + l.activeItemCount, 0)}
          </div>
          <div className="tn-stat-desc">Itens ativos</div>
          <div className="tn-stat-badge"><i />Itens</div>
        </div>
      </div>

      {error && <div className="tn-alert">{error}</div>}

      {/* Painel com lista */}
      <div className="tn-panel">
        <div className="tn-panel-head">
          <div className="tn-panel-head-left">
            <span>Processos licitatórios</span>
            <h3>Todas as licitações</h3>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar licitação…"
              style={{
                paddingLeft: 32, paddingRight: 12, height: 36, fontSize: 12, fontWeight: 500,
                border: '1.5px solid #e2e8f0', borderRadius: 10, outline: 'none',
                color: '#334155', background: '#fafafa', width: 220,
              }}
            />
          </div>
        </div>

        {loading && (
          <div className="tn-skeleton">
            {[1,2,3].map(n => <div key={n} className="tn-skeleton-row" />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="tn-empty">
            <div className="tn-empty-icon" style={{ fontSize: 36 }}>📋</div>
            <strong>{search ? 'Nenhuma licitação encontrada' : 'Nenhuma licitação cadastrada'}</strong>
            <span style={{ fontSize: 12, color: 'var(--tn-muted)', marginTop: 4 }}>
              {search ? 'Tente outro termo.' : 'Clique em "Nova licitação" para começar.'}
            </span>
            {canManage && !search && (
              <Link to={`/t/${entityId}/licitacoes/new`}>
                <button type="button" className="tn-btn-blue" style={{ marginTop: 8, height: 38, fontSize: 13 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Nova licitação
                </button>
              </Link>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ padding: '4px 0' }}>
            {filtered.map((lic, idx) => {
              const active = lic.status === 'ACTIVE';
              const isHov = hovRow === lic.id;
              return (
                <div
                  key={lic.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 20px',
                    borderBottom: idx < filtered.length - 1 ? '1px solid #f8fafc' : 'none',
                    transition: 'background 0.12s',
                    background: isHov ? '#f8fafc' : 'transparent',
                  }}
                  onMouseEnter={() => setHovRow(lic.id)}
                  onMouseLeave={() => setHovRow(null)}
                >
                  {/* Área clicável que leva para o detalhe */}
                  <Link
                    to={`/t/${entityId}/licitacoes/${lic.id}`}
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}
                  >
                    {/* ícone */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                      background: active ? '#eff6ff' : '#f8fafc',
                      border: `1.5px solid ${active ? '#bfdbfe' : '#e2e8f0'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: active ? '#2563eb' : '#94a3b8',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </div>

                    {/* conteúdo */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                          {lic.identificacao}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '1px 8px',
                          color: active ? '#16a34a' : '#64748b',
                          background: active ? '#f0fdf4' : '#f8fafc',
                          border: `1px solid ${active ? '#bbf7d0' : '#e2e8f0'}`,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#16a34a' : '#94a3b8', display: 'inline-block' }} />
                          {active ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      {lic.objeto && (
                        <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>
                          {lic.objeto}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {formatDate(lic.createdAt)}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          {lic.createdBy.name}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#2563eb',
                          background: '#eff6ff', borderRadius: 99, padding: '1px 7px',
                          border: '1px solid #bfdbfe',
                        }}>
                          {lic.activeItemCount} {lic.activeItemCount === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* botões de ação */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          title="Editar licitação"
                          onClick={e => { e.stopPropagation(); setEditingLic(lic); }}
                          className="tn-icon-btn"
                          style={{ opacity: isHov ? 1 : 0, transition: 'opacity 0.15s' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Excluir licitação"
                          onClick={e => { e.stopPropagation(); setConfirmDelete(lic); }}
                          className="tn-icon-btn sv-btn-excluir"
                          style={{ opacity: isHov ? 1 : 0, transition: 'opacity 0.15s' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal editar */}
      {editingLic && (
        <EditLicitacaoModal
          licitacao={editingLic}
          entityId={entityId}
          onClose={() => setEditingLic(null)}
          onSaved={() => { setEditingLic(null); void load(); }}
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
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>Excluir licitação?</h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                A licitação <strong style={{ color: '#0f172a' }}>{confirmDelete.identificacao}</strong> e todos os seus itens serão removidos permanentemente. Esta ação não pode ser desfeita.
              </p>
              <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
                <button type="button" onClick={() => setConfirmDelete(null)} className="tn-btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                <button type="button" onClick={() => void handleDelete()} disabled={deleting}
                  style={{ flex: 1, height: 38, fontSize: 13, fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: deleting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {deleting ? 'Excluindo…' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  );
}
