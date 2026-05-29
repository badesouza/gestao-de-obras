import type { LicitacaoStatus, PrismaClient } from '../../../../generated/prisma/index.js';
import type { CreateLicitacaoRequest } from './licitacao.schema.js';
interface UserRef {
    id: string;
    name: string;
}
export interface LicitacaoDto {
    id: string;
    identificacao: string;
    objeto: string;
    status: LicitacaoStatus;
    createdAt: string;
    createdBy: UserRef;
    activeItemCount: number;
}
/** Ensures entity exists and is active before licitacao mutations */
export declare function assertEntityActive(prisma: PrismaClient, entityId: string): Promise<{
    id: string;
    createdAt: Date;
    name: string;
    email: string | null;
    status: import("../../../../generated/prisma/index.js").$Enums.EntityStatus;
    updatedAt: Date;
    cnpj: string | null;
    phone: string | null;
    legalRepresentativeName: string | null;
    uf: string | null;
    municipalityId: number | null;
    municipalityName: string | null;
    address: string | null;
    coatOfArmsUrl: string | null;
}>;
/** Loads licitacao scoped to entity or throws */
export declare function getLicitacaoForEntity(prisma: PrismaClient, entityId: string, licitacaoId: string): Promise<{
    createdBy: {
        id: string;
        name: string;
    };
} & {
    id: string;
    createdAt: Date;
    entityId: string;
    status: import("../../../../generated/prisma/index.js").$Enums.LicitacaoStatus;
    updatedAt: Date;
    identificacao: string;
    objeto: string;
    createdByUserId: string;
}>;
/** Creates a licitacao for the current entity */
export declare function createLicitacao(prisma: PrismaClient, actorId: string, entityId: string, input: CreateLicitacaoRequest): Promise<LicitacaoDto>;
/** Lists licitacoes for the current entity */
export declare function listLicitacoes(prisma: PrismaClient, entityId: string, query: {
    search?: string;
    status?: LicitacaoStatus;
    page: number;
    pageSize: number;
}): Promise<{
    items: LicitacaoDto[];
    total: number;
    page: number;
    pageSize: number;
}>;
/** Gets licitacao detail scoped to entity */
export declare function getLicitacaoById(prisma: PrismaClient, entityId: string, licitacaoId: string): Promise<LicitacaoDto>;
/** Deactivates a licitacao (idempotent) */
export declare function deactivateLicitacao(prisma: PrismaClient, actorId: string, entityId: string, licitacaoId: string): Promise<LicitacaoDto>;
export {};
//# sourceMappingURL=licitacao.service.d.ts.map