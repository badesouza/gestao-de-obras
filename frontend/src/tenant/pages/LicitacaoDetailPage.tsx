import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, tenantApi, type Licitacao, type LicitacaoItem } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ColumnsImportPanel } from '../components/ColumnsImportPanel';
import {
  ImportInstructions,
  useImportTemplateDownload,
} from '../components/ImportInstructions';
import { SpreadsheetImportPanel } from '../components/SpreadsheetImportPanel';
import { useTenant, useTenantPermission } from '../TenantContext';
import { TenantPageHeader } from '../components/TenantPageHeader';

type ImportTab = 'spreadsheet' | 'columns';

/** Formats decimal string to pt-BR currency display */
function formatValor(value: string | null): string {
  if (!value) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Licitacao detail with items list and import panels */
export function LicitacaoDetailPage() {
  const { entityId } = useTenant();
  const { licitacaoId = '' } = useParams<{ licitacaoId: string }>();
  const canManage = useTenantPermission('licitacoes.manage');
  const canImport = useTenantPermission('licitacoes.items.import');
  const canDeactivate = useTenantPermission('licitacoes.items.deactivate');
  const downloadTemplate = useImportTemplateDownload();

  const [licitacao, setLicitacao] = useState<Licitacao | null>(null);
  const [items, setItems] = useState<LicitacaoItem[]>([]);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>('spreadsheet');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (includeInactive) params.set('includeInactive', 'true');

      const [lic, itemsResult] = await Promise.all([
        tenantApi.licitacoes.get(entityId, licitacaoId),
        tenantApi.licitacoes.listItems(entityId, licitacaoId, params),
      ]);
      setLicitacao(lic);
      setItems(itemsResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [entityId, licitacaoId, search, includeInactive]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleDeactivateLicitacao = async () => {
    if (!window.confirm('Desativar esta licitação?')) return;
    try {
      const updated = await tenantApi.licitacoes.deactivate(entityId, licitacaoId);
      setLicitacao(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desativar');
    }
  };

  const handleDeactivateItem = async (itemId: string) => {
    if (!window.confirm('Desativar este item?')) return;
    try {
      await tenantApi.licitacoes.deactivateItem(entityId, licitacaoId, itemId);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desativar item');
    }
  };

  if (loading && !licitacao) {
    return <p className="text-sm text-[var(--color-muted)]">Carregando…</p>;
  }

  if (!licitacao) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--color-error)]">{error || 'Licitação não encontrada'}</p>
        <Link to={`/t/${entityId}/licitacoes`}>
          <Button variant="secondary">Voltar</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <TenantPageHeader
        title={licitacao.identificacao}
        description={licitacao.objeto}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/t/${entityId}/licitacoes`}>
              <Button variant="secondary">Voltar</Button>
            </Link>
            {canManage && licitacao.status === 'ACTIVE' ? (
              <Button variant="secondary" onClick={() => void handleDeactivateLicitacao()}>
                Desativar licitação
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="grid gap-2 bg-white p-5 text-sm md:grid-cols-2">
        <p>
          <span className="text-[var(--color-muted)]">Status:</span>{' '}
          {licitacao.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
        </p>
        <p>
          <span className="text-[var(--color-muted)]">Itens ativos:</span>{' '}
          {licitacao.activeItemCount}
        </p>
        <p>
          <span className="text-[var(--color-muted)]">Cadastro:</span>{' '}
          {new Date(licitacao.createdAt).toLocaleString('pt-BR')}
        </p>
        <p>
          <span className="text-[var(--color-muted)]">Cadastrado por:</span>{' '}
          {licitacao.createdBy.name}
        </p>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Itens</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              label="Buscar descrição"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[200px]"
            />
            <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Incluir inativos
            </label>
          </div>
        </div>

        {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}

        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Categoria</th>
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-4 py-3 font-semibold">Unidade</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {canDeactivate ? <th className="px-4 py-3 font-semibold" /> : null}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={canDeactivate ? 6 : 5} className="px-4 py-6 text-[var(--color-muted)]">
                    Nenhum item encontrado.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-hairline)] last:border-0">
                    <td className="px-4 py-3">{item.categoria ?? '—'}</td>
                    <td className="px-4 py-3">{item.descricao}</td>
                    <td className="px-4 py-3">{item.unidadeMedida}</td>
                    <td className="px-4 py-3">{formatValor(item.valorUnitario)}</td>
                    <td className="px-4 py-3">
                      {item.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </td>
                    {canDeactivate ? (
                      <td className="px-4 py-3">
                        {item.status === 'ACTIVE' ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleDeactivateItem(item.id)}
                          >
                            Desativar
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canImport && licitacao.status === 'ACTIVE' ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Importar itens</h2>
          <ImportInstructions
            onDownload={(format) => {
              void downloadTemplate(format).catch((err) => {
                setError(err instanceof Error ? err.message : 'Erro ao baixar modelo');
              });
            }}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant={importTab === 'spreadsheet' ? 'primary' : 'secondary'}
              onClick={() => setImportTab('spreadsheet')}
            >
              Planilha
            </Button>
            <Button
              type="button"
              variant={importTab === 'columns' ? 'primary' : 'secondary'}
              onClick={() => setImportTab('columns')}
            >
              Colunas (textarea)
            </Button>
          </div>

          <Card className="bg-white p-5">
            {importTab === 'spreadsheet' ? (
              <SpreadsheetImportPanel licitacaoId={licitacaoId} onSuccess={() => void loadData()} />
            ) : (
              <ColumnsImportPanel licitacaoId={licitacaoId} onSuccess={() => void loadData()} />
            )}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
