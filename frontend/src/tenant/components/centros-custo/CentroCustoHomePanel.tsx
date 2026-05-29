import type { CentroCustoDetail, Licitacao } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { CentroCustoDatesFields } from './CentroCustoDatesFields';
import { LicitacaoLinker } from './LicitacaoLinker';
import { PropriedadeConfigPanel } from './PropriedadeConfigPanel';

interface CentroCustoHomePanelProps {
  entityId: string;
  centroId: string;
  centro: CentroCustoDetail;
  selectedLicitacaoId: string | null;
  linkedLicitacaoInitial: Licitacao | null;
  dataPrevistaInicio: string;
  dataPrevistaFim: string;
  dataRealizadaInicio: string;
  dataRealizadaFim: string;
  error: string;
  savingEdit: boolean;
  canManage: boolean;
  onLicitacaoChange: (id: string | null) => void;
  onDateChange: (field: string, value: string) => void;
  onSave: () => void;
  onReload: () => void;
}

/** Home tab content: edit centro and propriedades config */
export function CentroCustoHomePanel({
  entityId,
  centroId,
  centro,
  selectedLicitacaoId,
  linkedLicitacaoInitial,
  dataPrevistaInicio,
  dataPrevistaFim,
  dataRealizadaInicio,
  dataRealizadaFim,
  error,
  savingEdit,
  canManage,
  onLicitacaoChange,
  onDateChange,
  onSave,
  onReload,
}: CentroCustoHomePanelProps) {
  if (!canManage) {
    return (
      <Card className="bg-white p-6 text-sm text-[var(--color-muted)]">
        Você tem acesso somente leitura a este centro de custo.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 bg-white p-4">
        <h3 className="font-semibold text-[var(--color-ink)]">Editar centro</h3>
        {error ? <p className="text-sm text-[var(--color-error)]">{error}</p> : null}

        <CentroCustoDatesFields
          dataPrevistaInicio={dataPrevistaInicio}
          dataPrevistaFim={dataPrevistaFim}
          dataRealizadaInicio={dataRealizadaInicio}
          dataRealizadaFim={dataRealizadaFim}
          onChange={onDateChange}
        />

        <LicitacaoLinker
          entityId={entityId}
          value={selectedLicitacaoId}
          onChange={onLicitacaoChange}
          initialItem={linkedLicitacaoInitial}
        />

        <Button type="button" disabled={savingEdit} onClick={onSave}>
          {savingEdit ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </Card>

      <PropriedadeConfigPanel
        entityId={entityId}
        centroId={centroId}
        currentConfig={centro.propriedadesConfig}
        onSaved={onReload}
      />
    </div>
  );
}
