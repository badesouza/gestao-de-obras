import type { PrismaClient } from '../../../../generated/prisma/index.js';
/** Aggregates daily production stats for a centro in a month */
export declare function getProducaoDiaria(prisma: PrismaClient, entityId: string, centroId: string, year: number, month: number): Promise<{
    year: number;
    month: number;
    days: {
        day: number;
        date: string;
        cadastradas: number;
        iniciadas: number;
        concluidas: number;
    }[];
    markersConfigured: {
        inicio: boolean;
        conclusao: boolean;
    };
}>;
//# sourceMappingURL=production.service.d.ts.map