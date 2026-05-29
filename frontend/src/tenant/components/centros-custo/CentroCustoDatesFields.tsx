import { Input } from '../../../components/ui/Input';

interface CentroCustoDatesFieldsProps {
  dataPrevistaInicio: string;
  dataPrevistaFim: string;
  dataRealizadaInicio: string;
  dataRealizadaFim: string;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

/** Date fields for planned and actual centro de custo periods */
export function CentroCustoDatesFields({
  dataPrevistaInicio,
  dataPrevistaFim,
  dataRealizadaInicio,
  dataRealizadaFim,
  onChange,
  disabled,
}: CentroCustoDatesFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Período previsto</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Início previsto"
            type="date"
            value={dataPrevistaInicio}
            onChange={(e) => onChange('dataPrevistaInicio', e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Fim previsto"
            type="date"
            value={dataPrevistaFim}
            onChange={(e) => onChange('dataPrevistaFim', e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Período realizado</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Início realizado"
            type="date"
            value={dataRealizadaInicio}
            onChange={(e) => onChange('dataRealizadaInicio', e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Fim realizado"
            type="date"
            value={dataRealizadaFim}
            onChange={(e) => onChange('dataRealizadaFim', e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
