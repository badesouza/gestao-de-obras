import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  publicApi,
  setTenantToken,
  tenantApi,
} from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

/** Renders entity coat of arms when available */
function TenantCoatOfArms({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) return null;

  return (
    <div className="mb-4 flex justify-center">
      <img
        src={url}
        alt={alt}
        className="max-h-28 max-w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** Tenant login page scoped to entity UUID */
export function TenantLoginPage() {
  const { id: entityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entityName, setEntityName] = useState('');
  const [entityStatus, setEntityStatus] = useState<string | null>(null);
  const [coatOfArmsUrl, setCoatOfArmsUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    publicApi
      .getTenant(entityId)
      .then((tenant) => {
        setEntityName(tenant.name);
        setEntityStatus(tenant.status);
        setCoatOfArmsUrl(tenant.coatOfArmsUrl);
      })
      .catch(() => setNotFound(true));
  }, [entityId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entityId) return;
    setError('');
    setLoading(true);
    try {
      const result = await tenantApi.login(entityId, email, password);
      setTenantToken(entityId, result.token);
      navigate(`/t/${entityId}/dashboard`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível autenticar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
        <Card>
          <h1 className="text-xl font-semibold">Entidade não encontrada</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Verifique o link de acesso com o administrador.
          </p>
        </Card>
      </div>
    );
  }

  if (entityStatus === 'INACTIVE') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
        <Card className="w-full max-w-md text-center">
          <TenantCoatOfArms url={coatOfArmsUrl} alt={`Brasão de ${entityName}`} />
          <h1 className="text-xl font-semibold">{entityName}</h1>
          <p className="mt-2 text-sm text-[var(--color-error)]">
            Esta entidade está suspensa. Contate o administrador da plataforma.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
      <Card className="w-full max-w-md">
        <TenantCoatOfArms url={coatOfArmsUrl} alt={`Brasão de ${entityName}`} />
        <h1 className="mb-2 text-2xl font-semibold text-[var(--color-ink)]">
          {entityName || 'Carregando…'}
        </h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Acesso administrativo da entidade
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error ? (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
