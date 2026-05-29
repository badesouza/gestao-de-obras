import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, platformApi, setPlatformToken } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

/** Platform operator login page */
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@plataforma.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await platformApi.login(email, password);
      setPlatformToken(result.token);
      navigate('/platform/entities');
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-semibold text-[var(--color-ink)]">
          Área da Plataforma
        </h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Gestão de entidades (tenants)
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
