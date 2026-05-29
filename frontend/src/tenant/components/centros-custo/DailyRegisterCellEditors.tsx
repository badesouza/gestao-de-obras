import type { CellValue, PropriedadeTipo } from '../../../lib/api-client';
import { ItemPickerCombobox } from './ItemPickerCombobox';

interface CellEditorProps {
  tipo: PropriedadeTipo;
  value: CellValue;
  onChange: (value: CellValue) => void;
  entityId: string;
  centroId: string;
  disabled?: boolean;
}

/** Renders cell editor by propriedade tipo */
export function DailyRegisterCellEditor({
  tipo,
  value,
  onChange,
  entityId,
  centroId,
  disabled,
}: CellEditorProps) {
  switch (tipo) {
    case 'TEXTO':
      return (
        <input
          type="text"
          value={value.text ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.target.value })}
          className="w-full min-w-[8rem] rounded border border-[var(--color-hairline)] px-2 py-1 text-sm"
        />
      );
    case 'DATA':
      return (
        <input
          type="date"
          value={value.date ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ date: e.target.value })}
          className="w-full rounded border border-[var(--color-hairline)] px-2 py-1 text-sm"
        />
      );
    case 'VALOR':
      return (
        <input
          type="text"
          inputMode="decimal"
          value={value.decimal ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ decimal: e.target.value })}
          className="w-full min-w-[6rem] rounded border border-[var(--color-hairline)] px-2 py-1 text-sm"
        />
      );
    case 'BOOLEAN':
      return (
        <input
          type="checkbox"
          checked={value.boolean === true}
          disabled={disabled}
          onChange={(e) => onChange({ boolean: e.target.checked })}
          className="h-4 w-4"
        />
      );
    case 'ITEM_LICITACAO':
      return (
        <ItemPickerCombobox
          entityId={entityId}
          centroId={centroId}
          multiple={false}
          value={value.itemIds ?? []}
          onChange={(itemIds) => onChange({ itemIds })}
          disabled={disabled}
        />
      );
    case 'ITENS_LICITACAO':
      return (
        <ItemPickerCombobox
          entityId={entityId}
          centroId={centroId}
          multiple
          value={value.itemIds ?? []}
          onChange={(itemIds) => onChange({ itemIds })}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}

/** Formats cell value for read-only display */
export function formatCellDisplay(tipo: PropriedadeTipo, value: CellValue): string {
  switch (tipo) {
    case 'TEXTO':
      return value.text ?? '';
    case 'DATA':
      return value.date ?? '';
    case 'VALOR':
      return value.decimal ?? '';
    case 'BOOLEAN':
      return value.boolean ? 'Sim' : '';
    case 'ITEM_LICITACAO':
    case 'ITENS_LICITACAO':
      return value.itemIds?.length ? `${value.itemIds.length} item(ns)` : '';
    default:
      return '';
  }
}
