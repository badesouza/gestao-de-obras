import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { clearTenantToken, tenantApi } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { TenantSidebar } from '../components/TenantSidebar';
import { formatTodayPtBr } from '../utils/format';
import { getInitials } from '../utils/format';

const PAGE_TITLES: Record<string, string> = {
  dashboard:       'Dashboard',
  servicos:        'Serviços Urbanos',
  'servicos/:slug': 'Serviços Urbanos',
  compras:         'Compras',
  users:           'Usuários',
  licitacoes:      'Licitações',
  'centros-custo':        'Centros de Custo',
  'cadastros-auxiliares': 'Cadastros Auxiliares',
};

function usePageTitle(entityId: string | undefined): string {
  const location = useLocation();
  if (!entityId) return 'Painel';
  const segment = location.pathname.split(`/t/${entityId}/`)[1]?.split('/')[0];
  return PAGE_TITLES[segment ?? ''] ?? 'Painel';
}

export function TenantLayout({ children }: { children?: React.ReactNode }) {
  const { id: entityId } = useParams<{ id: string }>();
  const { session } = useTenant();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = usePageTitle(entityId);

  const handleLogout = async () => {
    if (!entityId) return;
    try { await tenantApi.logout(entityId); } catch { /* ignore */ }
    clearTenantToken(entityId);
    navigate(`/t/${entityId}/login`);
  };

  return (
    <div className="tn-shell">
      {/* Desktop sidebar */}
      <aside className="tn-sidebar" style={{ display: undefined }}>
        <TenantSidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <button
            type="button"
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }}
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 240 }}>
            <TenantSidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="tn-main">
        {/* Topbar */}
        <div className="tn-topbar">

          {/* Esquerda — breadcrumb */}
          <div className="tn-topbar-left">
            <button
              type="button"
              className="tn-topbar-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Menu"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="tn-topbar-breadcrumb">
              <span className="tn-topbar-entity">{session.entity.name.split(' ')[0]}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.3, flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span className="tn-topbar-page">{pageTitle}</span>
            </div>
          </div>

          {/* Centro — busca */}
          <div className="tn-topbar-search-wrap">
            <svg className="tn-topbar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="tn-topbar-search"
              placeholder="Buscar…"
              readOnly
            />
            <kbd className="tn-topbar-kbd">⌘K</kbd>
          </div>

          {/* Direita — ações */}
          <div className="tn-topbar-right">

            {/* Data */}
            <div className="tn-topbar-date-pill">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>{formatTodayPtBr()}</span>
            </div>

            {/* Notificações */}
            <button type="button" className="tn-topbar-notif" aria-label="Notificações">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <span className="tn-topbar-notif-dot" />
            </button>

            {/* Divisor */}
            <div className="tn-topbar-divider" />

            {/* Usuário */}
            <div className="tn-topbar-user">
              <div className="tn-topbar-user-avatar">{getInitials(session.name)}</div>
              <div className="tn-topbar-user-info">
                <span className="tn-topbar-user-name">{session.name.split(' ')[0]}</span>
                <span className="tn-topbar-user-role">Admin</span>
              </div>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.35 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            {/* Sair */}
            <button type="button" className="tn-logout-btn" onClick={handleLogout} title="Sair">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>

          </div>
        </div>

        {/* Content */}
        <div className="tn-content">
          {children ?? <Outlet />}
        </div>
      </div>
    </div>
  );
}
