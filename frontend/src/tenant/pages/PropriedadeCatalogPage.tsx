import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, tenantApi, type Propriedade, type PropriedadeTipo } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useTenant } from '../TenantContext';
import { TenantPageHeader } from '../components/TenantPageHeader';

const TIPO_OPTIONS: { value: PropriedadeTipo; label: string; help: string }[] = [
  { value: 'TEXTO', label: 'Texto', help: 'Texto livre curto' },
  { value: 'DATA', label: 'Data', help: 'Data (YYYY-MM-DD)' },
  { value: 'VALOR', label: 'Valor', help: 'Número decimal' },
  { value: 'BOOLEAN', label: 'Sim/Não', help: 'Checkbox booleano' },
  { value: 'ITEM_LICITACAO', label: 'Item (único)', help: 'Um item de licitação' },
  { value: 'ITENS_LICITACAO', label: 'Itens (múltiplos)', help: 'Vários itens de licitação' },
];

/** Manages reusable propriedades catalog */
export function PropriedadeCatalogPage() {
  const { entityId } = useTenant();
  const [items, setItems] = useState<Propriedade[]>([]);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<PropriedadeTipo>('TEXTO');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await tenantApi.centrosCusto.propriedades.list(entityId);
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [entityId]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await tenantApi.centrosCusto.propriedades.create(entityId, { nome, tipo });
      setNome('');
      setTipo('TEXTO');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await tenantApi.centrosCusto.propriedades.update(entityId, id, { status: 'INACTIVE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <TenantPageHeader
        title="Catálogo de propriedades"
        description="Defina colunas reutilizáveis para o registro diário dos centros de custo."
        actions={
          <Link to={`/t/${entityId}/centros-custo`}>
            <Button variant="secondary">Voltar</Button>
          </Link>
        }
      />

      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          <Input label="Nome da propriedade" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--color-ink)]">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as PropriedadeTipo)}
              className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-3"
            >
              {TIPO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.help}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Adicionar propriedade'}
          </Button>
        </form>
      </Card>

      {loading ? <p className="text-sm text-[var(--color-muted)]">Carregando…</p> : null}

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-wrap items-center justify-between gap-3 bg-white p-4">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{item.nome}</p>
              <p className="text-xs text-[var(--color-muted)]">
                {item.tipo} · {item.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
              </p>
            </div>
            {item.status === 'ACTIVE' ? (
              <Button variant="secondary" type="button" onClick={() => void handleDeactivate(item.id)}>
                Desativar
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
