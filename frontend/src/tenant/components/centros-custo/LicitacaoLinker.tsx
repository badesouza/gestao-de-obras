import { useEffect, useMemo, useState } from 'react';
import { tenantApi, type Licitacao } from '../../../lib/api-client';

interface LicitacaoLinkerProps {
  entityId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Licitação já vinculada (para exibir detalhes antes da busca) */
  initialItem?: Pick<Licitacao, 'id' | 'identificacao' | 'objeto' | 'activeItemCount' | 'createdBy'> | null;
  disabled?: boolean;
}

/** Formats ISO date to pt-BR */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Searchable picker to link a single licitação with rich context */
export function LicitacaoLinker({
  entityId,
  value,
  onChange,
  initialItem = null,
  disabled,
}: LicitacaoLinkerProps) {
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(!value);
  const [results, setResults] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<Map<string, Licitacao>>(new Map());

  useEffect(() => {
    if (!initialItem) return;
    setCatalog((prev) => new Map(prev).set(initialItem.id, initialItem as Licitacao));
  }, [initialItem]);

  useEffect(() => {
    if (!showSearch) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: 'ACTIVE', pageSize: '20' });
        if (query.trim()) params.set('search', query.trim());
        const result = await tenantApi.licitacoes.list(entityId, params);
        setResults(result.items);
        setCatalog((prev) => {
          const next = new Map(prev);
          for (const lic of result.items) next.set(lic.id, lic);
          return next;
        });
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [entityId, query, showSearch]);

  useEffect(() => {
    setShowSearch(!value);
  }, [value]);

  const selected = useMemo(
    () => (value ? (catalog.get(value) ?? null) : null),
    [catalog, value],
  );

  const availableResults = results.filter((lic) => lic.id !== value);

  const selectLicitacao = (lic: Licitacao) => {
    setCatalog((prev) => new Map(prev).set(lic.id, lic));
    onChange(lic.id);
    setQuery('');
    setShowSearch(false);
  };

  const clearLicitacao = () => {
    onChange(null);
    setQuery('');
    setShowSearch(true);
  };

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium text-[var(--color-ink)]">Licitação vinculada</span>

      {selected && !showSearch ? (
        <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3">
          <div className="min-w-0">
            <p className="font-medium text-[var(--color-ink)]">{selected.identificacao}</p>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{selected.objeto}</p>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              {selected.activeItemCount} item(ns) ativo(s) · Cadastro {formatDate(selected.createdAt)} ·{' '}
              {selected.createdBy.name}
            </p>
          </div>
          {!disabled ? (
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="text-xs text-[var(--color-brand-ochre)] hover:underline"
              >
                Alterar
              </button>
              <button
                type="button"
                onClick={clearLicitacao}
                className="text-xs text-[var(--color-error)] hover:underline"
              >
                Remover
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <input
              type="search"
              list="licitacao-search-hint"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, processo ou objeto…"
              disabled={disabled}
              className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-3"
            />
            <datalist id="licitacao-search-hint">
              {results.map((lic) => (
                <option key={lic.id} value={lic.identificacao}>
                  {lic.objeto.slice(0, 80)}
                </option>
              ))}
            </datalist>
            <span className="text-xs text-[var(--color-muted)]">
              Pesquise pelo número do processo e selecione na lista. Apenas uma licitação por centro.
            </span>
          </label>

          {query.trim() || results.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-white">
              <p className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-xs font-medium text-[var(--color-muted)]">
                {loading ? 'Buscando…' : `${availableResults.length} licitação(ões) encontrada(s)`}
              </p>
              <ul className="max-h-64 overflow-y-auto">
                {availableResults.length === 0 && !loading ? (
                  <li className="px-3 py-4 text-sm text-[var(--color-muted)]">
                    Nenhuma licitação disponível.
                  </li>
                ) : null}
                {availableResults.map((lic) => (
                  <li key={lic.id} className="border-t border-[var(--color-hairline)] first:border-t-0">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => selectLicitacao(lic)}
                      className="block w-full px-3 py-3 text-left transition hover:bg-[var(--color-canvas)]"
                    >
                      <p className="font-medium text-[var(--color-ink)]">{lic.identificacao}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{lic.objeto}</p>
                      <p className="mt-2 text-xs text-[var(--color-muted)]">
                        {lic.activeItemCount} item(ns) ativo(s) · Cadastro {formatDate(lic.createdAt)} ·{' '}
                        {lic.createdBy.name}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">Nenhuma licitação selecionada.</p>
          )}
        </>
      )}
    </div>
  );
}
