import type {
  Entity,
  EntityStatus,
  PlatformAuditLog,
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';
import { writePlatformAudit } from '../audit/audit.service.js';
import type {
  CreateEntityRequest,
  UpdateEntityRequest,
} from './entity.schema.js';
import {
  buildTenantAccessUrl,
  sanitizeCnpj,
  sanitizePhone,
  validateCnpj,
  validateUf,
} from './entity.utils.js';
import { persistCoatOfArmsUrl } from '../uploads/upload.service.js';

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
export function toEntityDto(entity: Entity): EntityDto {
  return {
    id: entity.id,
    name: entity.name,
    status: entity.status,
    cnpj: entity.cnpj,
    email: entity.email,
    phone: entity.phone,
    legalRepresentativeName: entity.legalRepresentativeName,
    uf: entity.uf,
    municipalityId: entity.municipalityId,
    municipalityName: entity.municipalityName,
    address: entity.address,
    coatOfArmsUrl: entity.coatOfArmsUrl,
    tenantAccessUrl: buildTenantAccessUrl(entity.id),
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

/** Checks CNPJ duplicate and throws or warns */
async function assertCnpjAllowed(
  prisma: PrismaClient,
  cnpj: string | null,
  acknowledge: boolean,
  excludeId?: string,
) {
  if (!cnpj) return;

  if (!validateCnpj(cnpj)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'CNPJ inválido');
  }

  const existing = await prisma.entity.findFirst({
    where: {
      cnpj,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });

  if (existing && !acknowledge) {
    throw new AppError(409, 'CNPJ_DUPLICATE', 'CNPJ já cadastrado', {
      existingEntityId: existing.id,
      existingEntityName: existing.name,
    });
  }
}

/** Builds Prisma data from entity input */
function mapEntityInput(input: CreateEntityRequest | UpdateEntityRequest) {
  validateUf(input.uf ?? null);

  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.cnpj !== undefined ? { cnpj: sanitizeCnpj(input.cnpj) } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: sanitizePhone(input.phone) } : {}),
    ...(input.legalRepresentativeName !== undefined
      ? {
          legalRepresentativeName: input.legalRepresentativeName?.trim() || null,
        }
      : {}),
    ...(input.uf !== undefined ? { uf: input.uf } : {}),
    ...(input.municipalityId !== undefined
      ? { municipalityId: input.municipalityId }
      : {}),
    ...(input.municipalityName !== undefined
      ? { municipalityName: input.municipalityName?.trim() || null }
      : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
  };
}

/** Creates a new tenant entity */
export async function createEntity(
  prisma: PrismaClient,
  operatorId: string,
  input: CreateEntityRequest,
) {
  const cnpj = sanitizeCnpj(input.cnpj);
  await assertCnpjAllowed(prisma, cnpj, input.acknowledgeCnpjDuplicate ?? false);
  validateUf(input.uf ?? null);

  const coatOfArmsUrl = await persistCoatOfArmsUrl(input.coatOfArmsUrl);

  const entity = await prisma.entity.create({
    data: {
      name: input.name.trim(),
      cnpj,
      email: input.email ?? null,
      phone: sanitizePhone(input.phone),
      legalRepresentativeName: input.legalRepresentativeName?.trim() || null,
      uf: input.uf ?? null,
      municipalityId: input.municipalityId ?? null,
      municipalityName: input.municipalityName?.trim() || null,
      address: input.address ?? null,
      coatOfArmsUrl,
    },
  });

  await writePlatformAudit(prisma, {
    operatorId,
    entityId: entity.id,
    action: 'ENTITY_CREATED',
    resource: 'entity',
    newValue: toEntityDto(entity) as unknown as Prisma.InputJsonValue,
  });

  return toEntityDto(entity);
}

/** Lists entities with search and pagination */
export async function listEntities(
  prisma: PrismaClient,
  query: {
    search?: string;
    status?: EntityStatus;
    page: number;
    pageSize: number;
  },
) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            ...(query.search.replace(/\D/g, '').length >= 3
              ? [{ cnpj: { contains: query.search.replace(/\D/g, '') } }]
              : []),
            {
              municipalityName: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}),
  };

  const [total, data] = await Promise.all([
    prisma.entity.count({ where }),
    prisma.entity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    data: data.map(toEntityDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    },
  };
}

/** Gets entity by id */
export async function getEntityById(prisma: PrismaClient, id: string) {
  const entity = await prisma.entity.findUnique({ where: { id } });
  if (!entity) {
    throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
  }
  return toEntityDto(entity);
}

/** Gets entity by id for public tenant context */
export async function getEntityPublicById(prisma: PrismaClient, id: string) {
  const entity = await prisma.entity.findUnique({ where: { id } });
  if (!entity) {
    throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
  }
  return {
    id: entity.id,
    name: entity.name,
    status: entity.status,
    coatOfArmsUrl: entity.coatOfArmsUrl,
  };
}

/** Updates entity cadastral fields */
export async function updateEntity(
  prisma: PrismaClient,
  operatorId: string,
  id: string,
  input: UpdateEntityRequest,
) {
  const existing = await prisma.entity.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
  }

  const cnpj =
    input.cnpj !== undefined ? sanitizeCnpj(input.cnpj) : existing.cnpj;
  await assertCnpjAllowed(
    prisma,
    cnpj,
    input.acknowledgeCnpjDuplicate ?? false,
    id,
  );

  const updated = await prisma.entity.update({
    where: { id },
    data: {
      ...mapEntityInput(input),
      ...(input.coatOfArmsUrl !== undefined
        ? { coatOfArmsUrl: await persistCoatOfArmsUrl(input.coatOfArmsUrl) }
        : {}),
    },
  });

  await writePlatformAudit(prisma, {
    operatorId,
    entityId: id,
    action: 'ENTITY_UPDATED',
    resource: 'entity',
    previousValue: toEntityDto(existing) as unknown as Prisma.InputJsonValue,
    newValue: toEntityDto(updated) as unknown as Prisma.InputJsonValue,
  });

  return toEntityDto(updated);
}

/** Activates or deactivates an entity */
export async function updateEntityStatus(
  prisma: PrismaClient,
  operatorId: string,
  id: string,
  status: EntityStatus,
) {
  const existing = await prisma.entity.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
  }

  if (existing.status === status) {
    return toEntityDto(existing);
  }

  const updated = await prisma.entity.update({
    where: { id },
    data: { status },
  });

  await writePlatformAudit(prisma, {
    operatorId,
    entityId: id,
    action: status === 'ACTIVE' ? 'ENTITY_ACTIVATED' : 'ENTITY_DEACTIVATED',
    resource: 'entity',
    previousValue: { status: existing.status },
    newValue: { status: updated.status },
  });

  return toEntityDto(updated);
}

/** Lists audit logs for an entity */
export async function listEntityAuditLogs(
  prisma: PrismaClient,
  entityId: string,
  page: number,
  pageSize = 20,
) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } });
  if (!entity) {
    throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
  }

  const [total, data] = await Promise.all([
    prisma.platformAuditLog.count({ where: { entityId } }),
    prisma.platformAuditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: data.map((log: PlatformAuditLog) => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      previousValue: log.previousValue,
      newValue: log.newValue,
      operatorId: log.operatorId,
      createdAt: log.createdAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}
