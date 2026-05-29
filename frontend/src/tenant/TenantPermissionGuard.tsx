import { Navigate, Outlet } from 'react-router-dom';
import { useTenantPermission } from './TenantContext';

interface TenantPermissionGuardProps {
  permission: string;
  children?: React.ReactNode;
}

/** Redirects to forbidden when tenant user lacks permission */
export function TenantPermissionGuard({
  permission,
  children,
}: TenantPermissionGuardProps) {
  const allowed = useTenantPermission(permission);

  if (!allowed) {
    return <Navigate to="../forbidden" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
