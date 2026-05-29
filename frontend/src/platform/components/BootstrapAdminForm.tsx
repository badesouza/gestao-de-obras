import { useState } from 'react';
import { ApiError, entityBootstrapApi } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

interface BootstrapAdminFormProps {
  entityId: string;
  onCreated: () => void;
}

/** Form to create the first tenant administrator from platform */
export function BootstrapAdminForm({ entityId, onCreated }: BootstrapAdminFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await entityBootstrapApi.bootstrapAdmin(entityId, { name, email, password });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar administrador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 className="mb-2 font-semibold text-[var(--color-ink)]">
        Primeiro administrador tenant
      </h3>
      <p className="mb-4 text-sm text-[var(--color-muted)]">
        Crie a conta inicial de administrador para esta entidade acessar o sistema.
      </p>
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
        {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando…' : 'Criar administrador'}
        </Button>
      </form>
    </Card>
  );
}
