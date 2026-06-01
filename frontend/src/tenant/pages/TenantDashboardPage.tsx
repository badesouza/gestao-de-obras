import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';
import { formatTodayPtBr } from '../utils/format';
import { MapaServicos } from '../components/MapaServicos';

export function TenantDashboardPage() {
  const { entityId, session } = useTenant();
  const canManageUsers = useTenantPermission('users.manage');
  const canViewLic     = useTenantPermission('licitacoes.view');
  const canViewCC      = useTenantPermission('centros_custo.view');
  const [data, setData] = useState<Awaited<ReturnType<typeof tenantApi.dashboard>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    tenantApi.dashboard(entityId).then(setData).catch((err) =>
      setError(err instanceof Error ? err.message : 'Erro ao carregar'),
    );
  }, [entityId]);

  if (error) {
    return (
      <div className="tn-page">
        <div className="tn-alert">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="tn-page">
        <div className="tn-stats">
          {[1,2,3,4].map((n) => (
            <div key={n} className="tn-skeleton-row" style={{ height: 110, borderRadius: 14, borderBottom: 'none' }} />
          ))}
        </div>
      </div>
    );
  }

  const inactiveUsers = Math.max(data.stats.usersTotal - data.stats.usersActive, 0);
  const isActive = data.entity.status === 'ACTIVE';

  const quickLinks = [
    canManageUsers && { to: `/t/${entityId}/users/new`,    label: 'Cadastrar usuário',    icon: '👤' },
    canViewLic     && { to: `/t/${entityId}/licitacoes`,   label: 'Ver licitações',       icon: '📋' },
    canViewCC      && { to: `/t/${entityId}/centros-custo`,label: 'Centros de custo',     icon: '🏗' },
    { to: `/t/${entityId}/users`,                           label: 'Gerenciar usuários',   icon: '⚙️' },
  ].filter(Boolean) as { to: string; label: string; icon: string }[];

  return (
    <div className="tn-page">

      {/* ── Hero ── */}
      <div className="tn-hero-light">
        <div className="tn-hero-light-glow" />
        <div className="tn-hero-light-inner">
          <div className="tn-hero-light-left">
            <div className="tn-hero-light-kicker">
              <span className="tn-hero-light-dot" />
              Painel operacional
            </div>
            <h2 className="tn-hero-light-title">
              Bem-vindo(a),&nbsp;<span>{session.name.split(' ')[0]}</span>
            </h2>
            <p className="tn-hero-light-desc">
              {data.entity.name}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Stats ── */}
      <div className="tn-stats">

        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Usuários ativos</div>
          <div className="tn-stat-value">{data.stats.usersActive}</div>
          <div className="tn-stat-desc">Contas habilitadas</div>
          <div className="tn-stat-badge"><i />Acesso liberado</div>
        </div>

        <div className="tn-stat tone-green">
          <div className="tn-stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Total de usuários</div>
          <div className="tn-stat-value">{data.stats.usersTotal}</div>
          <div className="tn-stat-desc">Cadastrados nesta entidade</div>
          <div className="tn-stat-badge"><i />Cadastrados</div>
        </div>

        <div className="tn-stat tone-blue">
          <div className="tn-stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Usuários inativos</div>
          <div className="tn-stat-value">{inactiveUsers}</div>
          <div className="tn-stat-desc">Contas desabilitadas</div>
          <div className="tn-stat-badge"><i />Inativo</div>
        </div>

        <div className={`tn-stat ${isActive ? 'tone-green' : 'tone-rose'}`}>
          <div className="tn-stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div className="tn-stat-kicker">Status da entidade</div>
          <div className="tn-stat-value" style={{ fontSize: 22, paddingTop: 6 }}>
            {isActive ? 'Ativa' : 'Suspensa'}
          </div>
          <div className="tn-stat-desc">Situação operacional</div>
          <div className="tn-stat-badge"><i />{isActive ? 'Operando' : 'Suspensa'}</div>
        </div>

      </div>

      {/* ── Mapa de Serviços ── */}
      <div className="tn-panel tn-panel-mapa" style={{ marginBottom: 16 }}>
        <div className="tn-panel-head">
          <div className="tn-panel-head-left">
            <span>Operação urbana</span>
            <h3>Mapa de Serviços</h3>
          </div>
          <Link to={`/t/${entityId}/servicos`} className="tn-btn-secondary" style={{ fontSize: 12, height: 32 }}>
            Ver serviços
          </Link>
        </div>
        <MapaServicos height={380} showFilters={true} />
      </div>

      {/* ── Grid: roadmap + quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>

        {/* Roadmap */}
        <div className="tn-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left">
              <span>Desenvolvimento</span>
              <h3>Próximos módulos</h3>
            </div>
            <span className="tn-chip dot-blue"><i />Em desenvolvimento</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 13, color: 'var(--tn-muted)', marginBottom: 12 }}>
              Roadmap funcional do sistema de gestão de obras públicas.
            </p>
            <div className="tn-roadmap">
              {[
                { label: 'Cadastro de obras',        done: false },
                { label: 'Contratos e aditivos',     done: false },
                { label: 'Medições e fiscalização',  done: false },
                { label: 'Relatórios financeiros',   done: false },
                { label: 'Diário de obras',          done: false },
                { label: 'Gestão de cronograma',     done: false },
              ].map(({ label }) => (
                <div key={label} className="tn-roadmap-item">
                  <span className="tn-roadmap-dot" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick access */}
        <div className="tn-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left">
              <span>Atalhos</span>
              <h3>Acesso rápido</h3>
            </div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div className="tn-quick-actions">
              {quickLinks.map(({ to, label, icon }) => (
                <Link key={to} to={to} className="tn-quick-link">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <span>{label}</span>
                  </span>
                  <svg className="tn-quick-link-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
