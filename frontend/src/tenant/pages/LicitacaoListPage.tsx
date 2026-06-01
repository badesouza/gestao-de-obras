import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi, type Licitacao } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function LicitacaoListPage() {
  const { entityId } = useTenant();
  const canManage = useTenantPermission('licitacoes.manage');
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
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
    void load();
  }, [entityId]);

  const filtered = licitacoes.filter(l =>
    !search ||
    l.identificacao.toLowerCase().includes(search.toLowerCase()) ||
    l.objeto?.toLowerCase().includes(search.toLowerCase())
  );

  const ativas = licitacoes.filter(l => l.status === 'ACTIVE').length;
  const inativas = licitacoes.length - ativas;

  return (
    <div className="tn-page">

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
          {/* busca */}
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
              return (
                <Link
                  key={lic.id}
                  to={`/t/${entityId}/licitacoes/${lic.id}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 20px',
                      borderBottom: idx < filtered.length - 1 ? '1px solid #f8fafc' : 'none',
                      transition: 'background 0.12s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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

                    {/* seta */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
