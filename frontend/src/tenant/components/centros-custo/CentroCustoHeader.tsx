import type { CentroCustoDetail } from '../../../lib/api-client';

interface CentroCustoHeaderProps {
  centro: CentroCustoDetail;
}

/** Displays entity and centro metadata on detail page */
export function CentroCustoHeader({ centro }: CentroCustoHeaderProps) {
  const formatDate = (value: string | null) =>
    value
      ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
      : '—';

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {centro.entity.name}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{centro.nome}</h2>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-[var(--color-muted)]">Previsto</p>
          <p>
            {formatDate(centro.dataPrevistaInicio)} → {formatDate(centro.dataPrevistaFim)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-muted)]">Realizado</p>
          <p>
            {formatDate(centro.dataRealizadaInicio)} → {formatDate(centro.dataRealizadaFim)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-muted)]">Licitação</p>
          <p>{centro.licitacoes[0]?.identificacao ?? 'Nenhuma'}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-muted)]">Cadastro</p>
          <p>
            {new Date(centro.createdAt).toLocaleDateString('pt-BR')} · {centro.createdBy.name}
          </p>
        </div>
      </div>
    </div>
  );
}
