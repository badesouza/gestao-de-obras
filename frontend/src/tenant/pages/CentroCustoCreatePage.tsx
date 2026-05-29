import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, tenantApi } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { LicitacaoLinker } from '../components/centros-custo/LicitacaoLinker';
import { useTenant } from '../TenantContext';
import { TenantPageHeader } from '../components/TenantPageHeader';

/** Creates a new centro de custo */
export function CentroCustoCreatePage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [selectedLicitacaoId, setSelectedLicitacaoId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const centro = await tenantApi.centrosCusto.create(entityId, {
        nome,
        licitacaoIds: selectedLicitacaoId ? [selectedLicitacaoId] : [],
      });
      navigate(`/t/${entityId}/centros-custo/${centro.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <TenantPageHeader
        title="Novo centro de custo"
        description="Cadastre a obra ou frente de serviço. Datas e demais ajustes podem ser feitos na edição."
      />
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Pavimentação Av. Central"
            required
          />

          <LicitacaoLinker
            entityId={entityId}
            value={selectedLicitacaoId}
            onChange={setSelectedLicitacaoId}
          />

          {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando…' : 'Cadastrar centro'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
