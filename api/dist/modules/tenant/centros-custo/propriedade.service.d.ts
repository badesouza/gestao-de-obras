import type { CentroCustoStatus, PrismaClient, PropriedadeTipo } from '../../../../generated/prisma/index.js';
import type { CreatePropriedadeRequest, UpdatePropriedadeRequest } from './propriedade.schema.js';
export interface PropriedadeDto {
    id: string;
    nome: string;
    tipo: PropriedadeTipo;
    status: CentroCustoStatus;
    createdAt: string;
    createdBy: {
        id: string;
        name: string;
    };
}
/** Lists propriedades catalog */
export declare function listPropriedades(prisma: PrismaClient, entityId: string): Promise<{
    items: {
        id: string;
        nome: string;
        tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
        status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
        createdAt: string;
        createdBy: {
            id: string;
            name: string;
        };
    }[];
}>;
/** Creates propriedade in catalog */
export declare function createPropriedade(prisma: PrismaClient, actorId: string, entityId: string, input: CreatePropriedadeRequest): Promise<{
    id: string;
    nome: string;
    tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    createdAt: string;
    createdBy: {
        id: string;
        name: string;
    };
}>;
/** Updates propriedade (nome or deactivate); tipo is immutable after use */
export declare function updatePropriedade(prisma: PrismaClient, actorId: string, entityId: string, propriedadeId: string, input: UpdatePropriedadeRequest): Promise<{
    id: string;
    nome: string;
    tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    createdAt: string;
    createdBy: {
        id: string;
        name: string;
    };
}>;
/** Gets propriedade by id scoped to entity */
export declare function getPropriedadeById(prisma: PrismaClient, entityId: string, propriedadeId: string): Promise<{
    createdBy: {
        id: string;
        name: string;
    };
} & {
    id: string;
    createdAt: Date;
    entityId: string;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    updatedAt: Date;
    createdByUserId: string;
    nome: string;
    tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
}>;
//# sourceMappingURL=propriedade.service.d.ts.map