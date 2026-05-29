import { Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getPlatformToken, platformApi } from '../lib/api-client';
import { PlatformLayout } from './layouts/PlatformLayout';

/** Protects platform routes — redirects to login if unauthenticated */
export function PlatformGuard() {
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    const token = getPlatformToken();
    if (!token) {
      setState('denied');
      return;
    }
    platformApi
      .me()
      .then(() => setState('ok'))
      .catch(() => setState('denied'));
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
        <p>Carregando…</p>
      </div>
    );
  }

  if (state === 'denied') {
    return <Navigate to="/platform/login" replace />;
  }

  return (
    <PlatformLayout>
      <Outlet />
    </PlatformLayout>
  );
}
