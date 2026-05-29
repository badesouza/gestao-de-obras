import { useEffect, useState } from 'react';
import { tenantApi, type ItemSearchResult } from '../../../lib/api-client';

interface ItemPickerComboboxProps {
  entityId: string;
  centroId: string;
  multiple: boolean;
  value: string[];
  onChange: (itemIds: string[]) => void;
  disabled?: boolean;
}

/** Async search combobox for licitacao items */
export function ItemPickerCombobox({
  entityId,
  centroId,
  multiple,
  value,
  onChange,
  disabled,
}: ItemPickerComboboxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await tenantApi.centrosCusto.searchItens(entityId, centroId, query || undefined);
        setResults(result.items);
        setLabels((prev) => {
          const next = { ...prev };
          for (const item of result.items) {
            next[item.id] = `${item.descricao} (${item.licitacaoIdentificacao})`;
          }
          return next;
        });
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [centroId, entityId, query]);

  const toggleItem = (id: string) => {
    if (multiple) {
      onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
      return;
    }
    onChange(value.includes(id) ? [] : [id]);
  };

  return (
    <div className="min-w-[12rem] space-y-1">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar item…"
        disabled={disabled}
        className="w-full rounded border border-[var(--color-hairline)] px-2 py-1 text-xs"
      />
      {value.length > 0 ? (
        <p className="text-xs text-[var(--color-muted)]">
          {value.map((id) => labels[id] ?? id).join('; ')}
        </p>
      ) : null}
      <ul className="max-h-32 overflow-y-auto rounded border border-[var(--color-hairline)] bg-white text-xs">
        {results.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleItem(item.id)}
              className={`block w-full px-2 py-1 text-left hover:bg-[var(--color-canvas)] ${
                value.includes(item.id) ? 'bg-[var(--color-accent-soft)]' : ''
              }`}
            >
              {item.descricao} · {item.unidadeMedida} · {item.licitacaoIdentificacao}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
