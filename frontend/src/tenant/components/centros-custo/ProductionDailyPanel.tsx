import { useEffect, useState } from 'react';
import { tenantApi, type ProducaoDiariaDia } from '../../../lib/api-client';
import { Card } from '../../../components/ui/Card';

interface ProductionDailyPanelProps {
  entityId: string;
  centroId: string;
  year: number;
  month: number;
}

/** Shows aggregated daily production counts */
export function ProductionDailyPanel({
  entityId,
  centroId,
  year,
  month,
}: ProductionDailyPanelProps) {
  const [days, setDays] = useState<ProducaoDiariaDia[]>([]);
  const [markersConfigured, setMarkersConfigured] = useState({ inicio: false, conclusao: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await tenantApi.centrosCusto.getProducao(entityId, centroId, year, month);
        setDays(result.days);
        setMarkersConfigured(result.markersConfigured);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar produção');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [centroId, entityId, month, year]);

  if (loading) return <p className="text-sm text-[var(--color-muted)]">Carregando produção…</p>;
  if (error) return <p className="text-[var(--color-error)]">{error}</p>;

  return (
    <div className="space-y-4">
      {!markersConfigured.inicio || !markersConfigured.conclusao ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Configure marcadores de início e conclusão nas propriedades do centro para contagem de
          iniciadas e concluídas.
        </Card>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--color-canvas)] text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Dia</th>
              <th className="px-3 py-2 font-medium">Cadastradas</th>
              <th className="px-3 py-2 font-medium">Iniciadas</th>
              <th className="px-3 py-2 font-medium">Concluídas</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day} className="border-t border-[var(--color-hairline)]">
                <td className="px-3 py-2">{day.day}</td>
                <td className="px-3 py-2">{day.cadastradas}</td>
                <td className="px-3 py-2">{day.iniciadas}</td>
                <td className="px-3 py-2">{day.concluidas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
