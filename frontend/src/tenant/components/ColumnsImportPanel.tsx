import { useMemo, useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { useTenant } from '../TenantContext';
import { tenantApi } from '../../lib/api-client';

interface ColumnsImportPanelProps {
  licitacaoId: string;
  onSuccess: () => void;
}

type ColumnKey = 'categoria' | 'descricao' | 'unidade' | 'quantidade' | 'valor';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  categoria: 'Categoria (opcional)',
  descricao: 'Descrição (obrigatório)',
  unidade: 'Unidade (obrigatório)',
  quantidade: 'Quantidade (opcional)',
  valor: 'Valor (opcional)',
};

/** Counts non-trailing empty lines in textarea content */
function countLines(value: string): number {
  const lines = value.split(/\r?\n/).map((line) => line.trim());
  let end = lines.length;
  while (end > 0 && lines[end - 1] === '') {
    end -= 1;
  }
  return end;
}

/** Column textarea import panel with client-side parity preview */
export function ColumnsImportPanel({ licitacaoId, onSuccess }: ColumnsImportPanelProps) {
  const { entityId } = useTenant();
  const [columns, setColumns] = useState<Record<ColumnKey, string>>({
    categoria: '',
    descricao: '',
    unidade: '',
    quantidade: '',
    valor: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const lineCounts = useMemo(
    () =>
      (Object.keys(columns) as ColumnKey[]).map((key) => ({
        key,
        count: countLines(columns[key]),
      })),
    [columns],
  );

  const parityColumns = lineCounts.filter((col) => col.count > 0);
  const parityOk =
    parityColumns.length === 0 ||
    parityColumns.every((col) => col.count === parityColumns[0]?.count);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (countLines(columns.descricao) === 0 || countLines(columns.unidade) === 0) {
      setError('Descrição e unidade são obrigatórias com ao menos uma linha cada.');
      return;
    }

    if (!parityOk) {
      setError('As colunas preenchidas devem ter o mesmo número de linhas.');
      return;
    }

    setLoading(true);
    try {
      const payload: Partial<Record<ColumnKey, string>> = {};
      for (const key of Object.keys(columns) as ColumnKey[]) {
        if (countLines(columns[key]) > 0 || key === 'descricao' || key === 'unidade') {
          payload[key] = columns[key];
        }
      }
      const result = await tenantApi.licitacoes.importColumns(entityId, licitacaoId, payload);
      setSuccess(`${result.importedCount} item(ns) importado(s) com sucesso.`);
      setColumns({ categoria: '', descricao: '', unidade: '', quantidade: '', valor: '' });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'IMPORT_COLUMN_MISMATCH') {
        const cols = err.body.details?.columns as Array<{ name: string; lineCount: number }> | undefined;
        const detail = cols?.map((c) => `${c.name}: ${c.lineCount} linha(s)`).join(', ');
        setError(`${err.message}${detail ? ` (${detail})` : ''}`);
      } else if (err instanceof ApiError && err.body.details?.lineErrors) {
        const lines = (err.body.details.lineErrors as Array<{ line: number; message: string }>)
          .slice(0, 5)
          .map((e) => `Linha ${e.line}: ${e.message}`)
          .join('; ');
        setError(`${err.message}. ${lines}`);
      } else {
        setError(err instanceof ApiError ? err.message : 'Erro na importação');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(columns) as ColumnKey[]).map((key) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--color-ink)]">
              {COLUMN_LABELS[key]}{' '}
              <span className="text-[var(--color-muted)]">({countLines(columns[key])} linha(s))</span>
            </span>
            <textarea
              rows={8}
              value={columns[key]}
              onChange={(e) => setColumns((prev) => ({ ...prev, [key]: e.target.value }))}
              className="min-h-[140px] rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-white px-3 py-2 font-mono text-xs"
              placeholder={key === 'descricao' ? 'Item 1\nItem 2' : undefined}
            />
          </label>
        ))}
      </div>

      {!parityOk ? (
        <p className="text-sm text-[var(--color-error)]">
          Colunas divergentes — ajuste para que todas tenham a mesma quantidade de linhas.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? 'Importando…' : 'Importar colunas'}
      </Button>
    </form>
  );
}
