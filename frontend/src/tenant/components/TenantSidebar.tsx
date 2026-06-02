import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTenant } from '../TenantContext';
import { getInitials } from '../utils/format';

interface NavItem {
  to: string;
  label: string;
  permission: string;
  icon: React.ReactNode;
}

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function IconLicitacoes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  );
}

function IconCentrosCusto() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

function IconCadastros() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function IconServicos() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  );
}

function IconCompras() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="21" r="1"/>
      <circle cx="19" cy="21" r="1"/>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 002 1.58h8.77a2 2 0 001.95-1.57L21 8H5.12"/>
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { to: 'dashboard',           label: 'Dashboard',        permission: 'dashboard.view',     icon: <IconDashboard /> },
  { to: 'cadastros-auxiliares',label: 'Cadastros',         permission: 'centros_custo.view', icon: <IconCadastros /> },
  { to: 'centros-custo',       label: 'Centro de Custos',  permission: 'centros_custo.view', icon: <IconCentrosCusto /> },
  { to: 'servicos',            label: 'Serviços Urbanos',  permission: 'centros_custo.view', icon: <IconServicos /> },
  { to: 'licitacoes',          label: 'Licitações',        permission: 'licitacoes.view',    icon: <IconLicitacoes /> },
  { to: 'compras',             label: 'Compras',           permission: 'centros_custo.view', icon: <IconCompras /> },
  { to: 'users',               label: 'Usuários',          permission: 'users.view',         icon: <IconUsers /> },
];

interface TenantSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function TenantSidebar({ mobile = false, onNavigate }: TenantSidebarProps) {
  const { id: entityId } = useParams<{ id: string }>();
  const { session } = useTenant();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const expanded = hovered || pinned;

  const visibleItems = NAV_ITEMS.filter((item) =>
    session.permissions.includes(item.permission),
  );

  const isActive = (path: string) =>
    location.pathname.includes(`/t/${entityId}/${path}`);

  /* desafixar ao clicar fora */
  useEffect(() => {
    if (mobile) return;
    const handler = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobile]);

  /* desafixar ao navegar */
  useEffect(() => {
    if (!mobile) setPinned(false);
  }, [location.pathname, mobile]);

  if (mobile) {
    return (
      <div className="tn-sidebar" style={{ width: '100%', height: '100%' }}>
        <div className="tn-sidebar-header">
          <div className="tn-sidebar-brand">
            <div className="tn-sidebar-avatar">{getInitials(session.entity.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="tn-sidebar-brand-name">{session.entity.name.split(' ')[0]}</div>
              <div className="tn-sidebar-brand-sub">Gestão de Obras</div>
            </div>
          </div>
        </div>
        <nav className="tn-nav">
          <div className="tn-nav-section">Operação</div>
          {visibleItems.map((item) => (
            <Link key={item.to} to={`/t/${entityId}/${item.to}`} onClick={onNavigate}
              className={`tn-nav-link ${isActive(item.to) ? 'active' : ''}`}>
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>
        <div className="tn-sidebar-footer">
          <div className="tn-user-card">
            <div className="tn-user-avatar">{getInitials(session.name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="tn-user-name">{session.name}</div>
              <div className="tn-user-role">{session.role.name}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className={`tn-sidebar tn-sidebar-collapsible ${expanded ? 'is-expanded' : 'is-collapsed'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setPinned(true)}
    >
      {/* Brand */}
      <div className="tn-sidebar-header">
        <div className="tn-sidebar-brand">
          <div className="tn-sidebar-avatar" style={{ flexShrink: 0 }}>{getInitials(session.entity.name)}</div>
          <div className="tn-sidebar-brand-text">
            <div className="tn-sidebar-brand-name">{session.entity.name.split(' ')[0]}</div>
            <div className="tn-sidebar-brand-sub">Gestão de Obras</div>
          </div>
        </div>
        {expanded && (
          <button
            type="button"
            className="tn-sidebar-close-btn"
            onClick={(e) => { e.stopPropagation(); setPinned(false); setHovered(false); }}
            title="Minimizar"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="tn-nav">
        <div className="tn-nav-section">Operação</div>
        {visibleItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={`/t/${entityId}/${item.to}`}
              onClick={onNavigate}
              className={`tn-nav-link ${active ? 'active' : ''}`}
              title={!expanded ? item.label : undefined}
            >
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              <span className="tn-nav-link-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="tn-sidebar-footer">
        <div className="tn-user-card">
          <div className="tn-user-avatar" style={{ flexShrink: 0 }}>{getInitials(session.name)}</div>
          <div className="tn-sidebar-brand-text" style={{ minWidth: 0, flex: 1 }}>
            <div className="tn-user-name">{session.name}</div>
            <div className="tn-user-role">{session.role.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
