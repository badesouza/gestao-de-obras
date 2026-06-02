import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tenantApi, type CentroCusto } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StatusDot({ status }: { status: 'ACTIVE' | 'INACTIVE' }) {
  return status === 'ACTIVE'
    ? <span className="tn-chip dot-blue"><i />Ativo</span>
    : <span className="tn-chip dot-gray"><i />Inativo</span>;
}

export function CentroCustoListPage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const canManage = useTenantPermission('centros_custo.manage');
  const canManagePropriedades = useTenantPermission('centros_custo.propriedades.manage');
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        const result = await tenantApi.centrosCusto.list(entityId, new URLSearchParams());
        setCentros(result.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar');
      } finally { setLoading(false); }
    };
    void load();
  }, [entityId]);

  const ativos   = centros.filter(c => c.status === 'ACTIVE').length;
  const inativos = centros.filter(c => c.status === 'INACTIVE').length;
  const comLicit = centros.filter(c => c.licitacaoCount > 0).length;

  return (
    <div className="tn-page">

      {/* Hero */}
      <div className="tn-hero-light">
        <div className="tn-hero-light-glow" />
        <div className="tn-hero-light-inner">
          <div className="tn-hero-light-left">
            <div className="tn-hero-light-kicker">
              <span className="tn-hero-light-dot" />
              Gestão de obras
            </div>
            <h2 className="tn-hero-light-title">Centros <span>de Custo</span></h2>
            <p className="tn-hero-light-desc">
              Obras e frentes de serviço com registro diário de produção.
            </p>
          </div>
          <div className="tn-hero-light-actions">
            {canManagePropriedades && (
              <Link to={`/t/${entityId}/centros-custo/propriedades`} className="tn-btn-secondary">
                Catálogo de propriedades
              </Link>
            )}
            {canManage && (
              <Link to={`/t/${entityId}/centros-custo/new`} className="tn-btn-blue" style={{ height: 40, fontSize: 13 }}>
                + Novo centro
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="tn-kpi-row">
        <div className="tn-kpi-card">
          <div className="tn-kpi-icon tn-kpi-icon-blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div className="tn-kpi-info">
            <span className="tn-kpi-label">Total</span>
            <strong className="tn-kpi-val">{centros.length}</strong>
          </div>
        </div>
        <div className="tn-kpi-card">
          <div className="tn-kpi-icon tn-kpi-icon-green">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="tn-kpi-info">
            <span className="tn-kpi-label">Ativos</span>
            <strong className="tn-kpi-val">{ativos}</strong>
          </div>
        </div>
        <div className="tn-kpi-card">
          <div className="tn-kpi-icon tn-kpi-icon-gray">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div className="tn-kpi-info">
            <span className="tn-kpi-label">Inativos</span>
            <strong className="tn-kpi-val">{inativos}</strong>
          </div>
        </div>
        <div className="tn-kpi-card">
          <div className="tn-kpi-icon tn-kpi-icon-amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="tn-kpi-info">
            <span className="tn-kpi-label">Com licitação</span>
            <strong className="tn-kpi-val">{comLicit}</strong>
          </div>
        </div>
      </div>

      {/* Painel principal */}
      <div className="tn-panel">
        <div className="tn-panel-head">
          <div className="tn-panel-head-left">
            <span>Cadastro</span>
            <h3>Centros cadastrados</h3>
          </div>
          <span className="tn-chip dot-blue"><i />{ativos} ativo{ativos !== 1 ? 's' : ''}</span>
        </div>

        {error && <div className="tn-alert" style={{ margin: '0 16px 12px' }}>{error}</div>}

        {loading ? (
          <div className="tn-skeleton">
            {[1, 2, 3, 4].map(n => <div key={n} className="tn-skeleton-row" />)}
          </div>
        ) : centros.length === 0 ? (
          <div className="tn-empty" style={{ padding: '48px 24px' }}>
            <div className="tn-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <strong>Nenhum centro de custo cadastrado</strong>
            <span>Crie o primeiro para começar a registrar produção.</span>
            {canManage && (
              <Link to={`/t/${entityId}/centros-custo/new`} className="tn-btn-blue"
                style={{ height: 38, fontSize: 13, marginTop: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                + Novo centro
              </Link>
            )}
          </div>
        ) : (
          <div className="cad-list">
            {centros.map((centro, idx) => (
              <div
                key={centro.id}
                className="cc-list-item"
                style={{ '--item-delay': `${idx * 0.04}s` } as React.CSSProperties}
                onClick={() => navigate(`/t/${entityId}/centros-custo/${centro.id}`)}
              >
                <div className={`cad-item-dot ${centro.status === 'ACTIVE' ? 'cad-dot-green' : 'cad-dot-gray'}`} />

                <div className="cc-list-item-main">
                  <span className="cc-list-item-nome">{centro.nome}</span>
                  <span className="cc-list-item-meta">
                    Cadastro {formatDate(centro.createdAt)} · {centro.createdBy.name}
                  </span>
                </div>

                <div className="cc-list-item-badges">
                  {centro.licitacaoCount > 0 ? (
                    <span className="tn-chip dot-blue"><i />{centro.licitacaoCount} licitação</span>
                  ) : (
                    <span className="tn-chip dot-gray" style={{ opacity: 0.55 }}><i />Sem licitação</span>
                  )}
                  <span className="tn-chip dot-neutral"><i />{centro.propriedadeCount} prop.</span>
                  <StatusDot status={centro.status} />
                </div>

                <div className="cc-list-item-arrow">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
