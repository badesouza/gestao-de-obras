import type { PrismaClient } from '../../../../generated/prisma/index.js';
import {
  formatDateOnly,
  getMonthDateRange,
  isMarkerSatisfied,
} from './cell-value.validator.js';
import { getCentroForEntity } from './centro-custo.service.js';

/** Aggregates daily production stats for a centro in a month */
export async function getProducaoDiaria(
  prisma: PrismaClient,
  entityId: string,
  centroId: string,
  year: number,
  month: number,
) {
  const centro = await getCentroForEntity(prisma, entityId, centroId);
  const { start, end, daysInMonth } = getMonthDateRange(year, month);

  const configs = centro.propriedadeConfigs.filter((c) => c.active);
  const inicioConfig = configs.find((c) => c.productionRole === 'INICIO');
  const conclusaoConfig = configs.find((c) => c.productionRole === 'CONCLUSAO');

  const registros = await prisma.registroDiario.findMany({
    where: {
      centroCustoId: centroId,
      entityId,
      data: { gte: start, lte: end },
    },
    include: {
      valores: {
        include: { itens: true },
      },
    },
  });

  const byDay = new Map<number, typeof registros>();
  for (const registro of registros) {
    const day = registro.data.getUTCDate();
    const list = byDay.get(day) ?? [];
    list.push(registro);
    byDay.set(day, list);
  }

  const days = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const rows = byDay.get(day) ?? [];
    let iniciadas = 0;
    let concluidas = 0;

    for (const registro of rows) {
      if (inicioConfig) {
        const valor = registro.valores.find(
          (v) => v.propriedadeId === inicioConfig.propriedadeId,
        );
        if (
          isMarkerSatisfied(inicioConfig.propriedade.tipo, valor ?? null)
        ) {
          iniciadas += 1;
        }
      }
      if (conclusaoConfig) {
        const valor = registro.valores.find(
          (v) => v.propriedadeId === conclusaoConfig.propriedadeId,
        );
        if (
          isMarkerSatisfied(conclusaoConfig.propriedade.tipo, valor ?? null)
        ) {
          concluidas += 1;
        }
      }
    }

    days.push({
      day,
      date: formatDateOnly(date),
      cadastradas: rows.length,
      iniciadas,
      concluidas,
    });
  }

  return {
    year,
    month,
    days,
    markersConfigured: {
      inicio: Boolean(inicioConfig),
      conclusao: Boolean(conclusaoConfig),
    },
  };
}
