import { Card } from '../../../components/ui/Card';

/** Placeholder for future performance metrics */
export function PerformancePanelPlaceholder() {
  return (
    <Card className="bg-white p-8 text-center">
      <h3 className="text-lg font-semibold text-[var(--color-ink)]">Painel de desempenho</h3>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Indicadores e comparativos de desempenho estão em definição e serão disponibilizados em uma
        versão futura.
      </p>
    </Card>
  );
}
