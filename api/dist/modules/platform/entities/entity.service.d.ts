import type { Entity, EntityStatus, Prisma, PrismaClient } from '../../../../generated/prisma/index.js';
import type { CreateEntityRequest, UpdateEntityRequest } from './entity.schema.js';
export interface EntityDto {
    id: string;
    name: string;
    status: EntityStatus;
    cnpj: string | null;
    email: string | null;
    phone: string | null;
    legalRepresentativeName: string | null;
    uf: string | null;
    municipalityId: number | null;
    municipalityName: string | null;
    address: string | null;
    coatOfArmsUrl: string | null;
    tenantAccessUrl: string;
    createdAt: string;
    updatedAt: string;
}
/** Maps entity record to API response */
export declare function toEntityDto(entity: Entity): EntityDto;
/** Creates a new tenant entity */
export declare function createEntity(prisma: PrismaClient, operatorId: string, input: CreateEntityRequest): Promise<EntityDto>;
/** Lists entities with search and pagination */
export declare function listEntities(prisma: PrismaClient, query: {
    search?: string;
    status?: EntityStatus;
    page: number;
    pageSize: number;
}): Promise<{
    data: EntityDto[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}>;
/** Gets entity by id */
export declare function getEntityById(prisma: PrismaClient, id: string): Promise<EntityDto>;
/** Gets entity by id for public tenant context */
export declare function getEntityPublicById(prisma: PrismaClient, id: string): Promise<{
    id: string;
    name: string;
    status: import("../../../../generated/prisma/index.js").$Enums.EntityStatus;
    coatOfArmsUrl: string | null;
}>;
/** Updates entity cadastral fields */
export declare function updateEntity(prisma: PrismaClient, operatorId: string, id: string, input: UpdateEntityRequest): Promise<EntityDto>;
/** Activates or deactivates an entity */
export declare function updateEntityStatus(prisma: PrismaClient, operatorId: string, id: string, status: EntityStatus): Promise<EntityDto>;
/** Lists audit logs for an entity */
export declare function listEntityAuditLogs(prisma: PrismaClient, entityId: string, page: number, pageSize?: number): Promise<{
    data: {
        id: string;
        action: string;
        resource: string;
        previousValue: Prisma.JsonValue;
        newValue: Prisma.JsonValue;
        operatorId: string;
        createdAt: string;
    }[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}>;
//# sourceMappingURL=entity.service.d.ts.map