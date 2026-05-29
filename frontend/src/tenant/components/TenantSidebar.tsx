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
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 13h7V4H4v9zm9 7h7v-9h-7v9zM4 20h7v-5H4v5zm9-11h7V4h-7v7z" strokeLinejoin="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M2 19a6 6 0 0 1 12 0M10 19a6 6 0 0 1 12 0" strokeLinecap="round" />
    </svg>
  );
}

function IconLicitacoes() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 4h8l1 2h3v14H4V6h3l1-2z" strokeLinejoin="round" />
      <path d="M8 10h8M8 14h5" strokeLinecap="round" />
    </svg>
  );
}

function IconCentrosCusto() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 20V8l8-4 8 4v12" strokeLinejoin="round" />
      <path d="M9 20v-6h6v6M9 12h6" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { to: 'dashboard', label: 'Dashboard', permission: 'dashboard.view', icon: <IconDashboard /> },
  { to: 'licitacoes', label: 'Licitações', permission: 'licitacoes.view', icon: <IconLicitacoes /> },
  {
    to: 'centros-custo',
    label: 'Centros de Custo',
    permission: 'centros_custo.view',
    icon: <IconCentrosCusto />,
  },
  { to: 'users', label: 'Usuários', permission: 'users.view', icon: <IconUsers /> },
];

interface TenantSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

/** Full-height tenant navigation sidebar */
export function TenantSidebar({ mobile = false, onNavigate }: TenantSidebarProps) {
  const { id: entityId } = useParams<{ id: string }>();
  const { session } = useTenant();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter((item) =>
    session.permissions.includes(item.permission),
  );

  const isActive = (path: string) =>
    location.pathname.includes(`/t/${entityId}/${path}`);

  return (
    <div
      className={`flex h-full flex-col bg-[var(--color-surface-dark)] text-[var(--color-on-dark)] ${
        mobile ? 'w-full' : 'w-[var(--sidebar-width)]'
      }`}
    >
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-brand-ochre)]">
            {getInitials(session.entity.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {session.entity.name}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-on-dark-soft)]">
              Gestão de Obras Públicas
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Menu principal">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-on-dark-soft)]">
          Operação
        </p>
        {visibleItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={`/t/${entityId}/${item.to}`}
              onClick={onNavigate}
              className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition ${
                active
                  ? 'bg-white/10 text-white ring-1 ring-inset ring-white/10'
                  : 'text-[var(--color-on-dark-soft)] hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={active ? 'text-[var(--color-brand-ochre)]' : ''}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-white/5 px-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold">
            {getInitials(session.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{session.name}</p>
            <p className="truncate text-xs text-[var(--color-on-dark-soft)]">
              {session.role.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
