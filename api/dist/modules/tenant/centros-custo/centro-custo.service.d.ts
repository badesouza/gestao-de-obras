import type { CentroCustoStatus, PrismaClient } from '../../../../generated/prisma/index.js';
import type { CreateCentroCustoRequest, PropriedadesConfigRequest, UpdateCentroCustoRequest } from './centro-custo.schema.js';
interface UserRef {
    id: string;
    name: string;
}
/** Ensures centro exists, belongs to entity and is active for mutations */
export declare function getCentroForEntity(prisma: PrismaClient, entityId: string, centroId: string): Promise<{
    licitacoes: ({
        licitacao: {
            id: string;
            status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
            identificacao: string;
        };
    } & {
        createdAt: Date;
        entityId: string;
        licitacaoId: string;
        centroCustoId: string;
    })[];
    createdBy: {
        id: string;
        name: string;
    };
    propriedadeConfigs: ({
        propriedade: {
            id: string;
            createdAt: Date;
            entityId: string;
            status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
            updatedAt: Date;
            createdByUserId: string;
            nome: string;
            tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
        };
    } & {
        id: string;
        createdAt: Date;
        entityId: string;
        updatedAt: Date;
        centroCustoId: string;
        propriedadeId: string;
        columnOrder: number;
        productionRole: import("../../../../generated/prisma/index.js").$Enums.PropriedadeProductionRole;
        active: boolean;
    })[];
} & {
    id: string;
    createdAt: Date;
    entityId: string;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    updatedAt: Date;
    createdByUserId: string;
    nome: string;
    dataPrevistaInicio: Date | null;
    dataPrevistaFim: Date | null;
    dataRealizadaInicio: Date | null;
    dataRealizadaFim: Date | null;
}>;
export declare function assertCentroActive(prisma: PrismaClient, entityId: string, centroId: string): Promise<{
    licitacoes: ({
        licitacao: {
            id: string;
            status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
            identificacao: string;
        };
    } & {
        createdAt: Date;
        entityId: string;
        licitacaoId: string;
        centroCustoId: string;
    })[];
    createdBy: {
        id: string;
        name: string;
    };
    propriedadeConfigs: ({
        propriedade: {
            id: string;
            createdAt: Date;
            entityId: string;
            status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
            updatedAt: Date;
            createdByUserId: string;
            nome: string;
            tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
        };
    } & {
        id: string;
        createdAt: Date;
        entityId: string;
        updatedAt: Date;
        centroCustoId: string;
        propriedadeId: string;
        columnOrder: number;
        productionRole: import("../../../../generated/prisma/index.js").$Enums.PropriedadeProductionRole;
        active: boolean;
    })[];
} & {
    id: string;
    createdAt: Date;
    entityId: string;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    updatedAt: Date;
    createdByUserId: string;
    nome: string;
    dataPrevistaInicio: Date | null;
    dataPrevistaFim: Date | null;
    dataRealizadaInicio: Date | null;
    dataRealizadaFim: Date | null;
}>;
/** Lists centros de custo */
export declare function listCentrosCusto(prisma: PrismaClient, entityId: string, query: {
    search?: string;
    status?: CentroCustoStatus;
    page: number;
    pageSize: number;
}): Promise<{
    items: {
        id: string;
        nome: string;
        dataPrevistaInicio: string | null;
        dataPrevistaFim: string | null;
        dataRealizadaInicio: string | null;
        dataRealizadaFim: string | null;
        status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
        licitacaoCount: number;
        propriedadeCount: number;
        createdAt: string;
        createdBy: UserRef;
    }[];
    total: number;
    page: number;
    pageSize: number;
}>;
/** Creates centro de custo */
export declare function createCentroCusto(prisma: PrismaClient, actorId: string, entityId: string, input: CreateCentroCustoRequest): Promise<{
    entity: {
        id: string;
        name: string;
    };
    licitacoes: {
        id: string;
        identificacao: string;
        status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
    }[];
    propriedadesConfig: {
        propriedadeId: string;
        columnOrder: number;
        productionRole: import("../../../../generated/prisma/index.js").$Enums.PropriedadeProductionRole;
        active: boolean;
        propriedade: {
            id: string;
            nome: string;
            tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
            status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
        };
    }[];
    id: string;
    nome: string;
    dataPrevistaInicio: string | null;
    dataPrevistaFim: string | null;
    dataRealizadaInicio: string | null;
    dataRealizadaFim: string | null;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    licitacaoCount: number;
    propriedadeCount: number;
    createdAt: string;
    createdBy: UserRef;
}>;
/** Gets centro detail */
export declare function getCentroCustoById(prisma: PrismaClient, entityId: string, centroId: string): Promise<{
    entity: {
        id: string;
        name: string;
    };
    licitacoes: {
        id: string;
        identificacao: string;
        status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
    }[];
    propriedadesConfig: {
        propriedadeId: string;
        columnOrder: number;
        productionRole: import("../../../../generated/prisma/index.js").$Enums.PropriedadeProductionRole;
        active: boolean;
        propriedade: {
            id: string;
            nome: string;
            tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
            status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
        };
    }[];
    id: string;
    nome: string;
    dataPrevistaInicio: string | null;
    dataPrevistaFim: string | null;
    dataRealizadaInicio: string | null;
    dataRealizadaFim: string | null;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    licitacaoCount: number;
    propriedadeCount: number;
    createdAt: string;
    createdBy: UserRef;
}>;
/** Updates centro de custo */
export declare function updateCentroCusto(prisma: PrismaClient, actorId: string, entityId: string, centroId: string, input: UpdateCentroCustoRequest): Promise<{
    entity: {
        id: string;
        name: string;
    };
    licitacoes: {
        id: string;
        identificacao: string;
        status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
    }[];
    propriedadesConfig: {
        propriedadeId: string;
        columnOrder: number;
        productionRole: import("../../../../generated/prisma/index.js").$Enums.PropriedadeProductionRole;
        active: boolean;
        propriedade: {
            id: string;
            nome: string;
            tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
            status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
        };
    }[];
    id: string;
    nome: string;
    dataPrevistaInicio: string | null;
    dataPrevistaFim: string | null;
    dataRealizadaInicio: string | null;
    dataRealizadaFim: string | null;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    licitacaoCount: number;
    propriedadeCount: number;
    createdAt: string;
    createdBy: UserRef;
}>;
/** Deactivates centro de custo */
export declare function deactivateCentroCusto(prisma: PrismaClient, actorId: string, entityId: string, centroId: string): Promise<{
    entity: {
        id: string;
        name: string;
    };
    licitacoes: {
        id: string;
        identificacao: string;
        status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
    }[];
    propriedadesConfig: {
        propriedadeId: string;
        columnOrder: number;
        productionRole: import("../../../../generated/prisma/index.js").$Enums.PropriedadeProductionRole;
        active: boolean;
        propriedade: {
            id: string;
            nome: string;
            tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
            status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
        };
    }[];
    id: string;
    nome: string;
    dataPrevistaInicio: string | null;
    dataPrevistaFim: string | null;
    dataRealizadaInicio: string | null;
    dataRealizadaFim: string | null;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    licitacaoCount: number;
    propriedadeCount: number;
    createdAt: string;
    createdBy: UserRef;
}>;
/** Sets licitacoes for centro */
export declare function setCentroCustoLicitacoes(prisma: PrismaClient, actorId: string, entityId: string, centroId: string, licitacaoIds: string[]): Promise<{
    entity: {
        id: string;
        name: string;
    };
    licitacoes: {
        id: string;
        identificacao: string;
        status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
    }[];
    propriedadesConfig: {
        propriedadeId: string;
        columnOrder: number;
        productionRole: import("../../../../generated/prisma/index.js").$Enums.PropriedadeProductionRole;
        active: boolean;
        propriedade: {
            id: string;
            nome: string;
            tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
            status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
        };
    }[];
    id: string;
    nome: string;
    dataPrevistaInicio: string | null;
    dataPrevistaFim: string | null;
    dataRealizadaInicio: string | null;
    dataRealizadaFim: string | null;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    licitacaoCount: number;
    propriedadeCount: number;
    createdAt: string;
    createdBy: UserRef;
}>;
/** Sets propriedades config for centro */
export declare function setPropriedadesConfig(prisma: PrismaClient, actorId: string, entityId: string, centroId: string, input: PropriedadesConfigRequest): Promise<{
    entity: {
        id: string;
        name: string;
    };
    licitacoes: {
        id: string;
        identificacao: string;
        status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
    }[];
    propriedadesConfig: {
        propriedadeId: string;
        columnOrder: number;
        productionRole: import("../../../../generated/prisma/index.js").$Enums.PropriedadeProductionRole;
        active: boolean;
        propriedade: {
            id: string;
            nome: string;
            tipo: import("../../../../generated/prisma/index.js").$Enums.PropriedadeTipo;
            status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
        };
    }[];
    id: string;
    nome: string;
    dataPrevistaInicio: string | null;
    dataPrevistaFim: string | null;
    dataRealizadaInicio: string | null;
    dataRealizadaFim: string | null;
    status: import("../../../../generated/prisma/index.js").$Enums.CentroCustoStatus;
    licitacaoCount: number;
    propriedadeCount: number;
    createdAt: string;
    createdBy: UserRef;
}>;
export {};
//# sourceMappingURL=centro-custo.service.d.ts.map