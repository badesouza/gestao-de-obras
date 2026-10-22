import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  getTenantToken,
  tenantApi,
  type TenantSession,
} from '../lib/api-client';
import { TenantProvider } from './TenantContext';
import { TenantLayout } from './layouts/TenantLayout';
import { lembrarTenant } from '../lib/offline/pwa';
import { SimboloSisObras } from '../components/marca/SimboloSisObras';

/** Protects tenant routes — redirects to entity login if unauthenticated */
export function TenantGuard() {
  const { id: entityId } = useParams<{ id: string }>();
  const [state, setState] = useState<
    'loading' | 'ok' | 'denied' | 'forbidden' | 'offline'
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
        lembrarTenant(entityId);
      })
      /* sem internet e sem dados guardados: não manda para o login à toa */
      .catch(() => setState(navigator.onLine ? 'denied' : 'offline'));
  }, [entityId]);

  if (!entityId) {
    return <Navigate to="/" replace />;
  }

  if (state === 'loading') {
    return (
      <div className="sbs-carga" role="status">
        <div>
          <SimboloSisObras tamanho={64} animacao="carregando" />
          <span>Carregando…</span>
        </div>
      </div>
    );
  }

  if (state === 'offline') {
    return (
      <div className="off-tela">
        <img src="/icons/icon-192.png" alt="" />
        <strong>Sem internet</strong>
        <span>Abra o sistema uma vez com internet neste aparelho. Depois disso ele passa a funcionar mesmo sem sinal.</span>
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
