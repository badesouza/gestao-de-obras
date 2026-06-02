import type { PrismaClient } from '../../../../generated/prisma/index.js';
import type { UpsertRegistroDiarioRequest } from './registro-diario.schema.js';
/** Lists registro diario rows for a month */
export declare function listRegistrosDiarios(prisma: PrismaClient, entityId: string, centroId: string, year: number, month: number): Promise<{
    year: number;
    month: number;
    rows: {
        id: string;
        data: string;
        lat: number | null;
        lng: number | null;
        enderecoGeocodificado: string | null;
        values: Record<string, import("./cell-value.validator.js").CellValueOutput | null>;
    }[];
}>;
/** Creates a registro diario row */
export declare function createRegistroDiario(prisma: PrismaClient, actorId: string, entityId: string, centroId: string, input: UpsertRegistroDiarioRequest): Promise<{
    id: string;
    data: string;
    lat: number | null;
    lng: number | null;
    enderecoGeocodificado: string | null;
    values: Record<string, import("./cell-value.validator.js").CellValueOutput | null>;
}>;
/** Updates a registro diario row */
export declare function updateRegistroDiario(prisma: PrismaClient, actorId: string, entityId: string, centroId: string, registroId: string, input: UpsertRegistroDiarioRequest): Promise<{
    id: string;
    data: string;
    lat: number | null;
    lng: number | null;
    enderecoGeocodificado: string | null;
    values: Record<string, import("./cell-value.validator.js").CellValueOutput | null>;
}>;
/** Deletes a registro diario row */
export declare function deleteRegistroDiario(prisma: PrismaClient, actorId: string, entityId: string, centroId: string, registroId: string): Promise<void>;
//# sourceMappingURL=registro-diario.service.d.ts.map