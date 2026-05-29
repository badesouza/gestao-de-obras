import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  getTenantToken,
  tenantApi,
  type TenantSession,
} from '../lib/api-client';
import { TenantProvider } from './TenantContext';
import { TenantLayout } from './layouts/TenantLayout';

/** Protects tenant routes — redirects to entity login if unauthenticated */
export function TenantGuard() {
  const { id: entityId } = useParams<{ id: string }>();
  const [state, setState] = useState<
    'loading' | 'ok' | 'denied' | 'forbidden'
  >('loading');
  const [session, setSession] = useState<TenantSession | null>(null);

  useEffect(() => {
    if (!entityId) {
      setState('denied');
      return;
    }

    const token = getTenantToken(entityId);
    if (!token) {
      setState('denied');
      return;
    }

    tenantApi
      .me(entityId)
      .then((profile) => {
        if (profile.entity.id !== entityId) {
          setState('forbidden');
          return;
        }
        setSession(profile);
        setState('ok');
      })
      .catch(() => setState('denied'));
  }, [entityId]);

  if (!entityId) {
    return <Navigate to="/" replace />;
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
        <p>Carregando…</p>
      </div>
    );
  }

  if (state === 'forbidden') {
    return <Navigate to={`/t/${entityId}/forbidden`} replace />;
  }

  if (state === 'denied' || !session) {
    return <Navigate to={`/t/${entityId}/login`} replace />;
  }

  return (
    <TenantProvider entityId={entityId} session={session}>
      <TenantLayout>
        <Outlet />
      </TenantLayout>
    </TenantProvider>
  );
}
