import { Button } from '../../../components/ui/Button';
import type { CentroCustoTab } from '../../hooks/useCentroCustoMonthNav';

interface CentroCustoTabsProps {
  tab: CentroCustoTab;
  monthLabel: string;
  onTabChange: (tab: CentroCustoTab) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const TABS: { id: CentroCustoTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'registro', label: 'Registro diário' },
  { id: 'desempenho', label: 'Desempenho' },
  { id: 'producao', label: 'Produção diária' },
];

/** Horizontal tabs and month navigation for centro detail */
export function CentroCustoTabs({
  tab,
  monthLabel,
  onTabChange,
  onPrevMonth,
  onNextMonth,
}: CentroCustoTabsProps) {
  const showMonthNav = tab === 'registro' || tab === 'producao';

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? 'bg-[var(--color-brand-ochre)] text-white'
                : 'bg-white text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] hover:bg-[var(--color-canvas)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {showMonthNav ? (
        <div className="flex items-center gap-2">
          <Button variant="secondary" type="button" onClick={onPrevMonth}>
            ‹
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium capitalize">{monthLabel}</span>
          <Button variant="secondary" type="button" onClick={onNextMonth}>
            ›
          </Button>
        </div>
      ) : null}
    </div>
  );
}
