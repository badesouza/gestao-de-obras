import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, tenantApi } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useTenant } from '../TenantContext';

const ROLES = [
  { code: 'ADMIN', name: 'Administrador' },
  { code: 'ENGINEER', name: 'Engenheiro/Fiscal' },
  { code: 'OPERATOR', name: 'Operador' },
] as const;

/** Creates a tenant user */
export function TenantUserCreatePage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleCode, setRoleCode] = useState<(typeof ROLES)[number]['code']>('OPERATOR');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await tenantApi.users.create(entityId, {
        name,
        email,
        password,
        roleCode,
      });
      navigate(`/t/${entityId}/users/${user.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-2xl font-semibold text-[var(--color-ink)]">Novo usuário</h2>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Perfil</span>
            <select
              className="h-11 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4"
              value={roleCode}
              onChange={(e) =>
                setRoleCode(e.target.value as (typeof ROLES)[number]['code'])
              }
            >
              {ROLES.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando…' : 'Cadastrar usuário'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
