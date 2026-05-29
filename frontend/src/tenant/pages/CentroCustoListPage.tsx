import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi, type CentroCusto } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useTenant, useTenantPermission } from '../TenantContext';
import { TenantPageHeader } from '../components/TenantPageHeader';

/** Formats ISO date to pt-BR locale */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Lists tenant centros de custo */
export function CentroCustoListPage() {
  const { entityId } = useTenant();
  const canManage = useTenantPermission('centros_custo.manage');
  const canManagePropriedades = useTenantPermission('centros_custo.propriedades.manage');
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await tenantApi.centrosCusto.list(entityId, new URLSearchParams());
        setCentros(result.items);
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
        title="Centros de Custo"
        description="Obras e frentes de serviço com registro diário de produção."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManagePropriedades ? (
              <Link to={`/t/${entityId}/centros-custo/propriedades`}>
                <Button variant="secondary">Catálogo de propriedades</Button>
              </Link>
            ) : null}
            {canManage ? (
              <Link to={`/t/${entityId}/centros-custo/new`}>
                <Button>Novo centro</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {loading ? <p className="text-sm text-[var(--color-muted)]">Carregando…</p> : null}
      {error ? <p className="text-[var(--color-error)]">{error}</p> : null}

      {!loading && centros.length === 0 ? (
        <Card className="bg-white p-6 text-sm text-[var(--color-muted)]">
          Nenhum centro de custo cadastrado.
        </Card>
      ) : null}

      <div className="grid gap-4">
        {centros.map((centro) => (
          <Card key={centro.id} className="flex flex-wrap items-center justify-between gap-4 bg-white">
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--color-ink)]">{centro.nome}</h3>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {centro.licitacaoCount > 0 ? '1 licitação' : 'Sem licitação'} · {centro.propriedadeCount}{' '}
                propriedade(s) ativa(s) · Cadastro {formatDate(centro.createdAt)} · {centro.createdBy.name}{' '}
                {centro.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
              </p>
            </div>
            <Link to={`/t/${entityId}/centros-custo/${centro.id}`}>
              <Button variant="secondary">Detalhes</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
