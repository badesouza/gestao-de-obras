import { Outlet, Link, useNavigate } from 'react-router-dom';
import { clearPlatformToken, platformApi } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';

interface PlatformLayoutProps {
  children?: React.ReactNode;
}

/** Platform admin shell with header navigation */
export function PlatformLayout({ children }: PlatformLayoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await platformApi.logout();
    } catch {
      // ignore — token may already be invalid
    }
    clearPlatformToken();
    navigate('/platform/login');
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-body)]">
      <header className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Plataforma
            </p>
            <h1 className="text-lg font-semibold text-[var(--color-ink)]">
              Gestão de Obras Públicas
            </h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              to="/platform/entities"
              className="text-sm font-medium text-[var(--color-ink)]"
            >
              Entidades
            </Link>
            <Button variant="secondary" type="button" onClick={handleLogout}>
              Sair
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
