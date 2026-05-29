import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, tenantApi } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useTenant } from '../TenantContext';
import { TenantPageHeader } from '../components/TenantPageHeader';

/** Creates a new licitacao */
export function LicitacaoCreatePage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const [identificacao, setIdentificacao] = useState('');
  const [objeto, setObjeto] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const licitacao = await tenantApi.licitacoes.create(entityId, {
        identificacao,
        objeto,
      });
      navigate(`/t/${entityId}/licitacoes/${licitacao.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <TenantPageHeader
        title="Nova licitação"
        description="Cadastre o processo licitatório antes de importar itens."
      />
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Identificação (número/processo)"
            value={identificacao}
            onChange={(e) => setIdentificacao(e.target.value)}
            placeholder="Ex.: 001/2026"
            required
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Objeto / descrição resumida</span>
            <textarea
              rows={4}
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              required
              minLength={3}
              className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-3"
            />
          </label>
          {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando…' : 'Cadastrar licitação'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
