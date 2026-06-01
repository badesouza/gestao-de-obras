import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { entityApi, type Entity } from '../../lib/api-client';
import { formatCnpj } from '../../lib/masks';

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function EntityListPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        const result = await entityApi.list(params);
        setEntities(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [search, status]);

  const total    = entities.length;
  const active   = entities.filter((e) => e.status === 'ACTIVE').length;
  const inactive = entities.filter((e) => e.status === 'INACTIVE').length;
  const activeFilterCount = [search, status].filter(Boolean).length;

  const toggle = (id: string) => setExpandedId((p) => (p === id ? null : id));

  return (
    <div className="pl-page">

      {/* ── Header ── */}
      <div className="pl-page-head">
        <div>
          <p className="pl-eyebrow">Plataforma</p>
          <h2 className="pl-page-title">Entidades</h2>
          <p className="pl-page-desc">Órgãos cadastrados como tenants no sistema</p>
        </div>
        <Link to="/platform/entities/new" className="pl-btn-primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nova entidade
        </Link>
      </div>

      {/* ── Stats — estilo SISLOC ── */}
      <div className="pl-stats">

        <div className="pl-stat tone-blue">
          <div className="pl-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div className="pl-stat-kicker">Total cadastrado</div>
          <div className="pl-stat-value">{loading ? '—' : total}</div>
          <div className="pl-stat-desc">Entidades na plataforma</div>
          <div className="pl-stat-badge"><i />Carteira ativa</div>
        </div>

        <div className="pl-stat tone-green">
          <div className="pl-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="pl-stat-kicker">Ativas</div>
          <div className="pl-stat-value">{loading ? '—' : active}</div>
          <div className="pl-stat-desc">Em operação</div>
          <div className="pl-stat-badge"><i />Operando</div>
        </div>

        <div className="pl-stat tone-slate">
          <div className="pl-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <div className="pl-stat-kicker">Inativas</div>
          <div className="pl-stat-value">{loading ? '—' : inactive}</div>
          <div className="pl-stat-desc">Suspensas</div>
          <div className="pl-stat-badge"><i />Suspensas</div>
        </div>

      </div>

      {/* ── Panel ── */}
      <div className="pl-panel">

        {/* Panel header */}
        <div className="pl-panel-head">
          <div className="pl-panel-head-left">
            <span>Cadastro operacional</span>
            <h3>Entidades cadastradas</h3>
          </div>
          <div className="pl-panel-head-right">
            <button
              type="button"
              className={`pl-filter-btn ${filtersOpen ? 'is-open' : ''}`}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              Filtros
              {activeFilterCount > 0 && (
                <span className="pl-filter-count">{activeFilterCount}</span>
              )}
              <svg className="pl-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {filtersOpen && (
          <div className="pl-filterbar">
            <div className="pl-filterbar-inner">
              <div className="pl-search-wrap">
                <svg className="pl-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  className="pl-search"
                  placeholder="Buscar por nome, CNPJ ou município…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className="pl-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
              {activeFilterCount > 0 && (
                <button type="button" className="pl-clear-btn" onClick={() => { setSearch(''); setStatus(''); }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div className="pl-alert">⚠ {error}</div>}

        {/* Skeleton */}
        {loading && (
          <div className="pl-skeleton">
            {[1,2,3].map((n) => <div key={n} className="pl-skeleton-row" />)}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && entities.length === 0 && (
          <div className="pl-empty">
            <div className="pl-empty-icon">🏗</div>
            <strong>Nenhuma entidade encontrada</strong>
            <span>
              Ajuste os filtros ou{' '}
              <Link to="/platform/entities/new" style={{ textDecoration: 'underline' }}>
                cadastre a primeira entidade
              </Link>
            </span>
          </div>
        )}

        {/* Accordion list */}
        {!loading && entities.length > 0 && (
          <div className="pl-accordion-list">
            {entities.map((entity, idx) => {
              const isOpen   = expandedId === entity.id;
              const isActive = entity.status === 'ACTIVE';

              return (
                <div
                  key={entity.id}
                  className={`pl-acc-item ${isOpen ? 'is-open' : ''} ${isActive ? 'status-active' : 'status-inactive'}`}
                  style={{ '--item-delay': `${idx * 0.04}s` } as React.CSSProperties}
                >
                  {/* Head */}
                  <div className="pl-acc-head" onClick={() => toggle(entity.id)}>

                    <div className="pl-acc-avatar">{initials(entity.name)}</div>

                    <div className="pl-acc-main">
                      <strong>{entity.name}</strong>
                      <span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        {entity.municipalityName
                          ? `${entity.municipalityName}${entity.uf ? ` · ${entity.uf}` : ''}`
                          : 'Localidade não informada'}
                      </span>
                    </div>

                    {/* Coluna: CNPJ */}
                    {entity.cnpj && (
                      <div className="pl-acc-col">
                        <span className="pl-acc-col-label">CNPJ</span>
                        <span className="pl-acc-col-val">{formatCnpj(entity.cnpj)}</span>
                      </div>
                    )}

                    {/* Coluna: Status chip */}
                    <div className="pl-acc-col">
                      <span className="pl-acc-col-label">Status</span>
                      <span className={`pl-chip ${isActive ? 'dot-green' : 'dot-gray'}`}>
                        <i />{isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="pl-acc-actions" onClick={(e) => e.stopPropagation()}>
                      <Link
                        to={`/platform/entities/${entity.id}`}
                        className="pl-icon-btn"
                        title="Editar"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </Link>
                    </div>

                    <div className="pl-acc-chevron">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  {/* Body expandido */}
                  {isOpen && (
                    <div className="pl-acc-body">
                      <div className="pl-acc-body-grid">
                        <div className="pl-acc-body-field">
                          <span>Razão Social</span>
                          <strong>{entity.name}</strong>
                        </div>
                        <div className="pl-acc-body-field">
                          <span>CNPJ</span>
                          <strong>{entity.cnpj ? formatCnpj(entity.cnpj) : '—'}</strong>
                        </div>
                        <div className="pl-acc-body-field">
                          <span>Município / UF</span>
                          <strong>
                            {entity.municipalityName
                              ? `${entity.municipalityName}${entity.uf ? `/${entity.uf}` : ''}`
                              : '—'}
                          </strong>
                        </div>
                        <div className="pl-acc-body-field">
                          <span>Status</span>
                          <strong>
                            <span className={`pl-chip ${isActive ? 'dot-green' : 'dot-gray'}`}>
                              <i />{isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </strong>
                        </div>
                        {entity.email && (
                          <div className="pl-acc-body-field">
                            <span>E-mail</span>
                            <strong>{entity.email}</strong>
                          </div>
                        )}
                        {entity.phone && (
                          <div className="pl-acc-body-field">
                            <span>Telefone</span>
                            <strong>{entity.phone}</strong>
                          </div>
                        )}
                      </div>
                      <div className="pl-acc-body-actions">
                        <Link to={`/platform/entities/${entity.id}`} className="pl-btn-secondary">
                          Abrir detalhes
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
