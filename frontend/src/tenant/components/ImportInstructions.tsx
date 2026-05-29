import { ApiError, tenantApi } from '../../lib/api-client';
import { Button } from '../../components/ui/Button';
import { useTenant } from '../TenantContext';

interface ImportInstructionsProps {
  onDownload: (format: 'csv' | 'xlsx') => void;
}

/** Displays clear import instructions for licitacao items */
export function ImportInstructions({ onDownload }: ImportInstructionsProps) {
  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5 text-sm text-[var(--color-ink-soft)]">
      <div>
        <h3 className="font-semibold text-[var(--color-ink)]">Como importar itens</h3>
        <p className="mt-1">
          Use planilha (.csv UTF-8 ou .xlsx) ou cole colunas nos campos de texto. Cada linha
          representa um item (produto ou serviço).
        </p>
      </div>

      <div>
        <p className="font-medium text-[var(--color-ink)]">Colunas aceitas</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <strong>categoria</strong> — opcional
          </li>
          <li>
            <strong>descricao</strong> — obrigatório
          </li>
          <li>
            <strong>unidade</strong> — obrigatório (ex.: un, m², kg)
          </li>
          <li>
            <strong>valor</strong> — opcional (formato decimal, ex.: 32,50)
          </li>
        </ul>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-hairline)]">
              <th className="py-2 pr-3 font-semibold">categoria</th>
              <th className="py-2 pr-3 font-semibold">descricao</th>
              <th className="py-2 pr-3 font-semibold">unidade</th>
              <th className="py-2 font-semibold">valor</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--color-hairline)]">
              <td className="py-2 pr-3">Material</td>
              <td className="py-2 pr-3">Cimento CP II</td>
              <td className="py-2 pr-3">saco 50kg</td>
              <td className="py-2">32,50</td>
            </tr>
            <tr>
              <td className="py-2 pr-3">Serviço</td>
              <td className="py-2 pr-3">Execução de alvenaria</td>
              <td className="py-2 pr-3">m²</td>
              <td className="py-2">85,00</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        No modo <strong>colunas</strong>, cada textarea deve ter o mesmo número de linhas nas
        colunas preenchidas. Linhas vazias no final são ignoradas.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => onDownload('csv')}>
          Baixar modelo CSV
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDownload('xlsx')}>
          Baixar modelo XLSX
        </Button>
      </div>
    </div>
  );
}

/** Triggers template download and saves file locally */
export function useImportTemplateDownload() {
  const { entityId } = useTenant();

  return async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await tenantApi.licitacoes.downloadTemplate(entityId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `modelo-itens-licitacao.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      throw err instanceof ApiError ? err : new Error('Erro ao baixar modelo');
    }
  };
}
