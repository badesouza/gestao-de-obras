import { useState } from 'react';
import { ApiError } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { useTenant } from '../TenantContext';
import { tenantApi } from '../../lib/api-client';

interface SpreadsheetImportPanelProps {
  licitacaoId: string;
  onSuccess: () => void;
}

/** Upload panel for spreadsheet-based item import */
export function SpreadsheetImportPanel({ licitacaoId, onSuccess }: SpreadsheetImportPanelProps) {
  const { entityId } = useTenant();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Selecione um arquivo .csv ou .xlsx');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await tenantApi.licitacoes.importSpreadsheet(entityId, licitacaoId, file);
      setSuccess(`${result.importedCount} item(ns) importado(s) com sucesso.`);
      setFile(null);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.body.details?.lineErrors) {
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
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-[var(--color-ink)]">Arquivo da planilha</span>
        <input
          type="file"
          accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="text-sm text-[var(--color-muted)] file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--color-accent-soft)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--color-brand-blue)]"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? 'Importando…' : 'Importar planilha'}
      </Button>
    </form>
  );
}
