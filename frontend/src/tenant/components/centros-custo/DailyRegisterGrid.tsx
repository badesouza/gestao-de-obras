import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  tenantApi,
  type CellValue,
  type PropriedadeConfig,
  type RegistroDiarioRow,
} from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DailyRegisterCellEditor, formatCellDisplay } from './DailyRegisterCellEditors';

interface DailyRegisterGridProps {
  entityId: string;
  centroId: string;
  year: number;
  month: number;
  configs: PropriedadeConfig[];
  canEdit: boolean;
  onConfigureProperties?: () => void;
}

type GridRow = {
  key: string;
  id?: string;
  data: string;
  values: Record<string, CellValue>;
  isNew: boolean;
};

type RowSnapshot = { data: string; values: Record<string, CellValue> };

function todayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function emptyRow(): GridRow {
  return { key: `new-${Date.now()}-${Math.random()}`, data: todayIso(), values: {}, isNew: true };
}

function toGridRow(row: RegistroDiarioRow): GridRow {
  return { key: row.id, id: row.id, data: row.data, values: { ...row.values }, isNew: false };
}

function serializeRow(row: Pick<GridRow, 'data' | 'values'>): string {
  return JSON.stringify({ data: row.data, values: row.values });
}

/** Excel-style inline daily register grid with batch save */
export function DailyRegisterGrid({
  entityId,
  centroId,
  year,
  month,
  configs,
  canEdit,
  onConfigureProperties,
}: DailyRegisterGridProps) {
  const activeConfigs = useMemo(
    () => configs.filter((c) => c.active).sort((a, b) => a.columnOrder - b.columnOrder),
    [configs],
  );
  const inactiveCount = configs.filter((c) => !c.active).length;

  const [gridRows, setGridRows] = useState<GridRow[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, RowSnapshot>>({});
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await tenantApi.centrosCusto.listRegistros(entityId, centroId, year, month);
      const rows = result.rows.map(toGridRow);
      setGridRows(rows);
      setSavedSnapshot(
        Object.fromEntries(
          result.rows.map((row) => [row.id, { data: row.data, values: { ...row.values } }]),
        ),
      );
      setPendingDeletes([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  }, [centroId, entityId, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (pendingDeletes.length > 0) return true;
    if (gridRows.some((row) => row.isNew)) return true;
    return gridRows.some((row) => {
      if (!row.id || row.isNew) return false;
      const saved = savedSnapshot[row.id];
      if (!saved) return true;
      return serializeRow(row) !== serializeRow(saved);
    });
  }, [gridRows, pendingDeletes, savedSnapshot]);

  const updateRow = (key: string, patch: Partial<GridRow>) => {
    setGridRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const updateCell = (key: string, propriedadeId: string, value: CellValue) => {
    setGridRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, values: { ...row.values, [propriedadeId]: value } } : row,
      ),
    );
  };

  const addRow = () => {
    setGridRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (row: GridRow) => {
    if (row.isNew) {
      setGridRows((prev) => prev.filter((r) => r.key !== row.key));
      return;
    }
    if (!row.id) return;
    if (!window.confirm('Excluir esta linha? A exclusão será confirmada ao salvar.')) return;
    setPendingDeletes((prev) => (prev.includes(row.id!) ? prev : [...prev, row.id!]));
    setGridRows((prev) => prev.filter((r) => r.key !== row.key));
  };

  const saveAll = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError('');
    try {
      for (const registroId of pendingDeletes) {
        await tenantApi.centrosCusto.deleteRegistro(entityId, centroId, registroId);
      }

      for (const row of gridRows) {
        if (row.isNew) {
          await tenantApi.centrosCusto.createRegistro(entityId, centroId, {
            data: row.data,
            values: row.values,
          });
          continue;
        }
        if (!row.id) continue;
        const saved = savedSnapshot[row.id];
        if (saved && serializeRow(row) === serializeRow(saved)) continue;
        await tenantApi.centrosCusto.updateRegistro(entityId, centroId, row.id, {
          data: row.data,
          values: row.values,
        });
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar registros');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (!isDirty) return;
    if (!window.confirm('Descartar todas as alterações não salvas?')) return;
    void load();
  };

  if (loading) return <p className="text-sm text-[var(--color-muted)]">Carregando registros…</p>;

  return (
    <div className="space-y-4">
      {activeConfigs.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Nenhuma coluna de propriedade ativa</p>
          <p className="mt-1">
            Você ainda pode lançar registros pela coluna <strong>Data</strong>. Para colunas
            adicionais, vá à aba Home, adicione propriedades ao centro e clique em{' '}
            <strong>Salvar configuração</strong>.
          </p>
          {onConfigureProperties ? (
            <button
              type="button"
              onClick={onConfigureProperties}
              className="mt-2 text-sm font-medium text-[var(--color-brand-ochre)] hover:underline"
            >
              Ir para configuração na Home →
            </button>
          ) : null}
        </Card>
      ) : null}

      {inactiveCount > 0 ? (
        <p className="text-xs text-[var(--color-muted)]">
          {inactiveCount} propriedade(s) configurada(s) porém inativa(s) — ative na aba Home para
          exibir como coluna.
        </p>
      ) : null}

      {!canEdit ? (
        <Card className="bg-white p-4 text-sm text-[var(--color-muted)]">
          Você pode visualizar os registros, mas não possui permissão para editar (
          <code className="text-xs">centros_custo.registros.edit</code>).
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]">
          Planilha de registro — {gridRows.length} linha(s) no mês
          {isDirty ? ' · alterações pendentes' : ''}
        </p>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={addRow}>
              + Adicionar linha
            </Button>
            {isDirty ? (
              <Button type="button" variant="secondary" onClick={discardChanges} disabled={saving}>
                Descartar
              </Button>
            ) : null}
            <Button type="button" onClick={() => void saveAll()} disabled={!isDirty || saving}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--color-canvas)]">
              <th className="sticky left-0 z-10 min-w-[9rem] border-b border-r border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-left font-semibold">
                Data
              </th>
              {activeConfigs.map((config) => (
                <th
                  key={config.propriedadeId}
                  className="min-w-[10rem] border-b border-r border-[var(--color-hairline)] px-3 py-2 text-left font-semibold last:border-r-0"
                >
                  {config.propriedade.nome}
                </th>
              ))}
              {canEdit ? (
                <th className="min-w-[5rem] border-b border-[var(--color-hairline)] px-3 py-2 text-left font-semibold">
                  Ações
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {gridRows.length === 0 ? (
              <tr>
                <td
                  colSpan={activeConfigs.length + (canEdit ? 2 : 1)}
                  className="px-3 py-8 text-center text-[var(--color-muted)]"
                >
                  Nenhum registro neste mês.
                  {canEdit ? ' Clique em "Adicionar linha" para começar.' : null}
                </td>
              </tr>
            ) : null}
            {gridRows.map((row, index) => (
              <tr
                key={row.key}
                className={`border-b border-[var(--color-hairline)] ${
                  index % 2 === 0 ? 'bg-white' : 'bg-[var(--color-canvas)]/40'
                }`}
              >
                <td className="sticky left-0 z-10 border-r border-[var(--color-hairline)] bg-inherit px-2 py-1">
                  {canEdit ? (
                    <input
                      type="date"
                      value={row.data}
                      onChange={(e) => updateRow(row.key, { data: e.target.value })}
                      className="w-full rounded border border-[var(--color-hairline)] bg-white px-2 py-1.5 text-sm"
                    />
                  ) : (
                    <span className="px-1 py-1.5">{row.data}</span>
                  )}
                </td>
                {activeConfigs.map((config) => (
                  <td
                    key={config.propriedadeId}
                    className="border-r border-[var(--color-hairline)] px-2 py-1 align-top last:border-r-0"
                  >
                    {canEdit ? (
                      <DailyRegisterCellEditor
                        tipo={config.propriedade.tipo}
                        value={row.values[config.propriedadeId] ?? {}}
                        onChange={(value) => updateCell(row.key, config.propriedadeId, value)}
                        entityId={entityId}
                        centroId={centroId}
                      />
                    ) : (
                      <span className="block px-1 py-1.5">
                        {formatCellDisplay(
                          config.propriedade.tipo,
                          row.values[config.propriedadeId] ?? {},
                        )}
                      </span>
                    )}
                  </td>
                ))}
                {canEdit ? (
                  <td className="px-2 py-1 align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(row)}
                      disabled={saving}
                      className="text-xs text-[var(--color-error)] hover:underline disabled:opacity-50"
                    >
                      {row.isNew ? 'Remover' : 'Excluir'}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
