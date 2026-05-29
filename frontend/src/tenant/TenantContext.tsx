import { createContext, useContext } from 'react';
import type { TenantSession } from '../lib/api-client';

interface TenantContextValue {
  entityId: string;
  session: TenantSession;
}

const TenantContext = createContext<TenantContextValue | null>(null);

/** Provides tenant session to child routes */
export function TenantProvider({
  entityId,
  session,
  children,
}: TenantContextValue & { children: React.ReactNode }) {
  return (
    <TenantContext.Provider value={{ entityId, session }}>
      {children}
    </TenantContext.Provider>
  );
}

/** Reads current tenant session from context */
export function useTenant() {
  const value = useContext(TenantContext);
  if (!value) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return value;
}

/** Checks if current user has a permission */
export function useTenantPermission(permission: string): boolean {
  const { session } = useTenant();
  return session.permissions.includes(permission);
}
