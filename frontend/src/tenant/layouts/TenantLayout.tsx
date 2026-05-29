import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { clearTenantToken, tenantApi } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { useTenant } from '../TenantContext';
import { TenantSidebar } from '../components/TenantSidebar';
import { formatTodayPtBr } from '../utils/format';

interface TenantLayoutProps {
  children?: React.ReactNode;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Usuários',
};

/** Resolves breadcrumb title from current route */
function usePageTitle(entityId: string | undefined): string {
  const location = useLocation();
  if (!entityId) return 'Painel';
  const segment = location.pathname.split(`/t/${entityId}/`)[1]?.split('/')[0];
  return PAGE_TITLES[segment ?? ''] ?? 'Painel';
}

/** Professional full-height tenant admin shell */
export function TenantLayout({ children }: TenantLayoutProps) {
  const { id: entityId } = useParams<{ id: string }>();
  const { session } = useTenant();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = usePageTitle(entityId);

  const handleLogout = async () => {
    if (!entityId) return;
    try {
      await tenantApi.logout(entityId);
    } catch {
      // ignore
    }
    clearTenantToken(entityId);
    navigate(`/t/${entityId}/login`);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-canvas)]">
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 border-r border-black/20 lg:flex">
        <TenantSidebar />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
            <TenantSidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-hairline)] bg-white/80 px-4 backdrop-blur-sm lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-hairline)] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                {session.entity.name}
              </p>
              <h1 className="truncate text-lg font-semibold text-[var(--color-ink)]">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <p className="text-sm capitalize text-[var(--color-muted)]">{formatTodayPtBr()}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-[var(--color-ink)]">{session.name}</p>
              <p className="text-xs text-[var(--color-muted)]">{session.role.name}</p>
            </div>
            <Button variant="secondary" type="button" onClick={handleLogout} className="h-10 px-4">
              Sair
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
