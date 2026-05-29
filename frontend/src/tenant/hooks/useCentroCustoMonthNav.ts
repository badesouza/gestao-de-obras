import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type CentroCustoTab = 'home' | 'registro' | 'desempenho' | 'producao';

/** Syncs tab, year and month with URL search params */
export function useCentroCustoMonthNav() {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();

  const rawTab = searchParams.get('tab');
  const tab: CentroCustoTab =
    rawTab === 'registro' || rawTab === 'desempenho' || rawTab === 'producao' || rawTab === 'home'
      ? rawTab
      : 'home';
  const year = Number(searchParams.get('year') ?? now.getFullYear());
  const month = Number(searchParams.get('month') ?? now.getMonth() + 1);

  const setTab = useCallback(
    (nextTab: CentroCustoTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', nextTab);
        if (nextTab === 'registro' || nextTab === 'producao') {
          if (!next.get('year')) next.set('year', String(now.getFullYear()));
          if (!next.get('month')) next.set('month', String(now.getMonth() + 1));
        }
        return next;
      });
    },
    [now, setSearchParams],
  );

  const setMonth = useCallback(
    (nextYear: number, nextMonth: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('year', String(nextYear));
        next.set('month', String(nextMonth));
        if (!next.get('tab') || next.get('tab') === 'home') next.set('tab', 'registro');
        return next;
      });
    },
    [setSearchParams],
  );

  const goPrevMonth = useCallback(() => {
    const d = new Date(year, month - 2, 1);
    setMonth(d.getFullYear(), d.getMonth() + 1);
  }, [month, setMonth, year]);

  const goNextMonth = useCallback(() => {
    const d = new Date(year, month, 1);
    setMonth(d.getFullYear(), d.getMonth() + 1);
  }, [month, setMonth, year]);

  const monthLabel = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [month, year]);

  return { tab, year, month, monthLabel, setTab, setMonth, goPrevMonth, goNextMonth };
}
