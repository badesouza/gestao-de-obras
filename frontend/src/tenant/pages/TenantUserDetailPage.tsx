import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, tenantApi, type TenantUser } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useTenant, useTenantPermission } from '../TenantContext';

const ROLES = [
  { code: 'ADMIN', name: 'Administrador' },
  { code: 'ENGINEER', name: 'Engenheiro/Fiscal' },
  { code: 'OPERATOR', name: 'Operador' },
] as const;

/** Tenant user detail and edit */
export function TenantUserDetailPage() {
  const { entityId } = useTenant();
  const { userId } = useParams<{ userId: string }>();
  const canManage = useTenantPermission('users.manage');
  const [user, setUser] = useState<TenantUser | null>(null);
  const [name, setName] = useState('');
  const [roleCode, setRoleCode] = useState('OPERATOR');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const data = await tenantApi.users.get(entityId, userId);
      setUser(data);
      setName(data.name);
      setRoleCode(data.role.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [entityId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) return;
    setError('');
    try {
      const updated = await tenantApi.users.update(entityId, userId, {
        name,
        roleCode,
      });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    const next = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await tenantApi.users.updateStatus(entityId, user.id, next);
    setUser(updated);
  };

  const handleResetPassword = async () => {
    if (!userId || !password) return;
    setError('');
    try {
      await tenantApi.users.resetPassword(entityId, userId, password);
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao redefinir senha');
    }
  };

  if (loading) return <p>Carregando…</p>;
  if (error && !user) {
    return (
      <Card>
        <p className="text-[var(--color-error)]">{error}</p>
        <Link to={`/t/${entityId}/users`} className="mt-4 inline-block underline">
          Voltar
        </Link>
      </Card>
    );
  }
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to={`/t/${entityId}/users`} className="text-sm text-[var(--color-muted)] underline">
            ← Usuários
          </Link>
          <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{user.name}</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
          </p>
        </div>
        {canManage ? (
          <Button variant="secondary" type="button" onClick={handleToggleStatus}>
            {user.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
          </Button>
        ) : null}
      </div>

      {canManage ? (
        <>
          <Card>
            <h3 className="mb-4 font-semibold text-[var(--color-ink)]">Editar cadastro</h3>
            <form className="flex flex-col gap-4" onSubmit={handleUpdate}>
              <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-[var(--color-ink)]">Perfil</span>
                <select
                  className="h-11 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4"
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value)}
                >
                  {ROLES.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
              <Button type="submit">Salvar alterações</Button>
            </form>
          </Card>

          <Card>
            <h3 className="mb-4 font-semibold text-[var(--color-ink)]">Redefinir senha</h3>
            <div className="flex flex-col gap-4">
              <Input
                label="Nova senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={handleResetPassword}>
                Redefinir senha
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">{user.email}</p>
          <p className="text-sm text-[var(--color-muted)]">Perfil: {user.role.name}</p>
        </Card>
      )}
    </div>
  );
}
