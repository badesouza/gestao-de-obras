import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi, type Licitacao } from '../../lib/api-client';
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

/** Lists tenant licitacoes */
export function LicitacaoListPage() {
  const { entityId } = useTenant();
  const canManage = useTenantPermission('licitacoes.manage');
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await tenantApi.licitacoes.list(entityId, new URLSearchParams());
        setLicitacoes(result.items);
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
        title="Licitações"
        description="Processos licitatórios e catálogo de itens (produtos e serviços) importados."
        actions={
          canManage ? (
            <Link to={`/t/${entityId}/licitacoes/new`}>
              <Button>Nova licitação</Button>
            </Link>
          ) : null
        }
      />

      {loading ? <p className="text-sm text-[var(--color-muted)]">Carregando…</p> : null}
      {error ? <p className="text-[var(--color-error)]">{error}</p> : null}

      {!loading && licitacoes.length === 0 ? (
        <Card className="bg-white p-6 text-sm text-[var(--color-muted)]">
          Nenhuma licitação cadastrada.
        </Card>
      ) : null}

      <div className="grid gap-4">
        {licitacoes.map((licitacao) => (
          <Card key={licitacao.id} className="flex flex-wrap items-center justify-between gap-4 bg-white">
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--color-ink)]">{licitacao.identificacao}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{licitacao.objeto}</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                {licitacao.activeItemCount} item(ns) ativo(s) · Cadastro {formatDate(licitacao.createdAt)} ·{' '}
                {licitacao.createdBy.name} ·{' '}
                {licitacao.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
              </p>
            </div>
            <Link to={`/t/${entityId}/licitacoes/${licitacao.id}`}>
              <Button variant="secondary">Detalhes</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
