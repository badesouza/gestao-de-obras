import { useEffect, useState } from 'react';
import {
  tenantApi,
  type Propriedade,
  type PropriedadeConfig,
  type PropriedadeProductionRole,
} from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

interface ConfigDraftItem {
  propriedadeId: string;
  columnOrder: number;
  productionRole: PropriedadeProductionRole;
  active: boolean;
}

interface PropriedadeConfigPanelProps {
  entityId: string;
  centroId: string;
  currentConfig: PropriedadeConfig[];
  onSaved: () => void;
}

/** Configures propriedades order and production markers for a centro */
export function PropriedadeConfigPanel({
  entityId,
  centroId,
  currentConfig,
  onSaved,
}: PropriedadeConfigPanelProps) {
  const [catalog, setCatalog] = useState<Propriedade[]>([]);
  const [items, setItems] = useState<ConfigDraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const result = await tenantApi.centrosCusto.propriedades.list(entityId);
      setCatalog(result.items.filter((p) => p.status === 'ACTIVE'));
    };
    void load();
  }, [entityId]);

  useEffect(() => {
    if (currentConfig.length > 0) {
      setItems(
        currentConfig.map((c) => ({
          propriedadeId: c.propriedadeId,
          columnOrder: c.columnOrder,
          productionRole: c.productionRole,
          active: c.active,
        })),
      );
    }
  }, [currentConfig]);

  const addItem = (propriedadeId: string) => {
    if (items.some((i) => i.propriedadeId === propriedadeId)) return;
    setItems((prev) => [
      ...prev,
      {
        propriedadeId,
        columnOrder: prev.length,
        productionRole: 'NONE',
        active: true,
      },
    ]);
  };

  const updateItem = (propriedadeId: string, patch: Partial<ConfigDraftItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.propriedadeId === propriedadeId ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (propriedadeId: string) => {
    setItems((prev) => prev.filter((i) => i.propriedadeId !== propriedadeId));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await tenantApi.centrosCusto.setPropriedadesConfig(entityId, centroId, items);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const available = catalog.filter((p) => !items.some((i) => i.propriedadeId === p.id));
  const hasUnsavedItems = items.length > 0 && JSON.stringify(items) !== JSON.stringify(
    currentConfig.map((c) => ({
      propriedadeId: c.propriedadeId,
      columnOrder: c.columnOrder,
      productionRole: c.productionRole,
      active: c.active,
    })),
  );

  return (
    <Card className="space-y-4 bg-white p-4">
      <h3 className="font-semibold text-[var(--color-ink)]">Propriedades do centro</h3>
      <p className="text-sm text-[var(--color-muted)]">
        Defina as colunas da planilha de registro diário. Após adicionar ou alterar, clique em{' '}
        <strong>Salvar configuração</strong>.
      </p>
      {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}

      {catalog.length === 0 ? (
        <p className="rounded border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 text-sm text-[var(--color-muted)]">
          Nenhuma propriedade no catálogo. Crie propriedades em{' '}
          <strong>Centros de Custo → Catálogo de propriedades</strong> antes de configurar colunas
          aqui.
        </p>
      ) : null}

      {available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map((prop) => (
            <Button key={prop.id} variant="secondary" type="button" onClick={() => addItem(prop.id)}>
              + {prop.nome}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const prop = catalog.find((p) => p.id === item.propriedadeId);
          if (!prop) return null;
          return (
            <div
              key={item.propriedadeId}
              className="flex flex-wrap items-center gap-3 rounded border border-[var(--color-hairline)] p-3 text-sm"
            >
              <span className="min-w-[8rem] font-medium">{prop.nome}</span>
              <label className="flex items-center gap-1">
                Ordem
                <input
                  type="number"
                  min={0}
                  value={item.columnOrder}
                  onChange={(e) =>
                    updateItem(item.propriedadeId, { columnOrder: Number(e.target.value) })
                  }
                  className="w-16 rounded border px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-1">
                Marcador
                <select
                  value={item.productionRole}
                  onChange={(e) =>
                    updateItem(item.propriedadeId, {
                      productionRole: e.target.value as PropriedadeProductionRole,
                    })
                  }
                  className="rounded border px-2 py-1"
                >
                  <option value="NONE">Nenhum</option>
                  <option value="INICIO">Início</option>
                  <option value="CONCLUSAO">Conclusão</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={(e) => updateItem(item.propriedadeId, { active: e.target.checked })}
                />
                Ativa
              </label>
              <button
                type="button"
                className="text-xs text-[var(--color-error)]"
                onClick={() => removeItem(item.propriedadeId)}
              >
                Remover
              </button>
            </div>
          );
        })}
      </div>

      {hasUnsavedItems ? (
        <p className="text-sm font-medium text-amber-800">
          Alterações pendentes — salve a configuração para usar as colunas no Registro diário.
        </p>
      ) : null}

      <Button type="button" disabled={saving} onClick={() => void handleSave()}>
        {saving ? 'Salvando…' : 'Salvar configuração'}
      </Button>
    </Card>
  );
}
