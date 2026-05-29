import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi, type TenantUser } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useTenant, useTenantPermission } from '../TenantContext';
import { TenantPageHeader } from '../components/TenantPageHeader';

/** Lists tenant users */
export function TenantUserListPage() {
  const { entityId } = useTenant();
  const canManage = useTenantPermission('users.manage');
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await tenantApi.users.list(entityId, new URLSearchParams());
        setUsers(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [entityId]);

  return (
    <div className="space-y-6">
      <TenantPageHeader
        title="Usuários"
        description="Contas com acesso administrativo e operacional nesta entidade."
        actions={
          canManage ? (
            <Link to={`/t/${entityId}/users/new`}>
              <Button>Novo usuário</Button>
            </Link>
          ) : null
        }
      />

      {loading ? <p className="text-sm text-[var(--color-muted)]">Carregando…</p> : null}
      {error ? <p className="text-[var(--color-error)]">{error}</p> : null}

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="flex flex-wrap items-center justify-between gap-4 bg-white">
            <div>
              <h3 className="font-semibold text-[var(--color-ink)]">{user.name}</h3>
              <p className="text-sm text-[var(--color-muted)]">
                {user.email} · {user.role.name} ·{' '}
                {user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
              </p>
            </div>
            <Link to={`/t/${entityId}/users/${user.id}`}>
              <Button variant="secondary">Detalhes</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
