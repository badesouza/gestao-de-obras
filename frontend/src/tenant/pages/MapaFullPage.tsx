import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getTenantToken, tenantApi, type TenantSession } from '../../lib/api-client';
import { TenantProvider } from '../TenantContext';
import { MapaServicos } from '../components/MapaServicos';

export function MapaFullPage() {
  const { id: entityId } = useParams<{ id: string }>();
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [session, setSession] = useState<TenantSession | null>(null);

  useEffect(() => {
    if (!entityId) { setState('denied'); return; }
    const token = getTenantToken(entityId);
    if (!token) { setState('denied'); return; }
    tenantApi.me(entityId)
      .then(p => { setSession(p); setState('ok'); })
      .catch(() => setState('denied'));
  }, [entityId]);

  if (!entityId) return <Navigate to="/" replace />;
  if (state === 'loading') return null;
  if (state === 'denied' || !session) return <Navigate to={`/t/${entityId}/login`} replace />;

  return (
    <TenantProvider entityId={entityId} session={session}>
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <MapaServicos height={0} showFilters fullscreenMode />
      </div>
    </TenantProvider>
  );
}
