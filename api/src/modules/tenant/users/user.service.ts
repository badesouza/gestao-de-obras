import type {
  Prisma,
  PrismaClient,
  TenantUser,
  TenantUserStatus,
} from '../../../../generated/prisma/index.js';
import { TENANT_ROLE_ADMIN } from '../../../shared/constants.js';
import { AppError } from '../../../shared/errors.js';
import { hashPassword } from '../../platform/auth/auth.service.js';
import { writeTenantAudit } from '../audit/audit.service.js';
import { validatePassword } from '../auth/password.utils.js';
import type {
  CreateTenantUserRequest,
  UpdateTenantUserRequest,
} from './user.schema.js';

export interface TenantUserDto {
  id: string;
  name: string;
  email: string;
  status: TenantUserStatus;
  role: { code: string; name: string };
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Maps tenant user to API response */
function toUserDto(user: TenantUser & { role: { code: string; name: string } }): TenantUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    role: { code: user.role.code, name: user.role.name },
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** Resolves role by code */
async function getRoleByCode(prisma: PrismaClient, roleCode: string) {
  const role = await prisma.tenantRole.findUnique({ where: { code: roleCode } });
  if (!role) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Perfil inválido');
  }
  return role;
}

/** Ensures entity still has at least one active admin */
async function assertNotLastAdmin(
  prisma: PrismaClient,
  entityId: string,
  userId: string,
) {
  const adminRole = await prisma.tenantRole.findUnique({
    where: { code: TENANT_ROLE_ADMIN },
  });
  if (!adminRole) return;

  const user = await prisma.tenantUser.findUnique({ where: { id: userId } });
  if (!user || user.roleId !== adminRole.id || user.status !== 'ACTIVE') return;

  const activeAdmins = await prisma.tenantUser.count({
    where: {
      entityId,
      roleId: adminRole.id,
      status: 'ACTIVE',
    },
  });

  if (activeAdmins <= 1) {
    throw new AppError(
      409,
      'LAST_ADMIN',
      'Não é possível desativar o último administrador ativo',
    );
  }
}

/** Lists users for the current entity */
export async function listTenantUsers(
  prisma: PrismaClient,
  entityId: string,
  query: { search?: string; status?: TenantUserStatus; page: number; pageSize: number },
) {
  const where = {
    entityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, data] = await Promise.all([
    prisma.tenantUser.count({ where }),
    prisma.tenantUser.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    data: data.map(toUserDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    },
  };
}

/** Gets a tenant user scoped to entity */
export async function getTenantUserById(
  prisma: PrismaClient,
  entityId: string,
  userId: string,
) {
  const user = await prisma.tenantUser.findFirst({
    where: { id: userId, entityId },
    include: { role: true },
  });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');
  }
  return toUserDto(user);
}

/** Creates a tenant user in the current entity */
export async function createTenantUser(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  input: CreateTenantUserRequest,
) {
  validatePassword(input.password);
  const role = await getRoleByCode(prisma, input.roleCode);

  const existing = await prisma.tenantUser.findUnique({
    where: {
      entityId_email: {
        entityId,
        email: input.email.toLowerCase(),
      },
    },
  });
  if (existing) {
    throw new AppError(409, 'EMAIL_DUPLICATE', 'E-mail já cadastrado nesta entidade');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.tenantUser.create({
    data: {
      entityId,
      roleId: role.id,
      name: input.name.trim(),
      email: input.email.toLowerCase(),
      passwordHash,
    },
    include: { role: true },
  });

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'USER_CREATED',
    resource: 'user',
    newValue: toUserDto(user) as unknown as Prisma.InputJsonValue,
  });

  return toUserDto(user);
}

/** Updates tenant user profile/role */
export async function updateTenantUser(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  userId: string,
  input: UpdateTenantUserRequest,
) {
  const existing = await prisma.tenantUser.findFirst({
    where: { id: userId, entityId },
    include: { role: true },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');
  }

  const role = input.roleCode
    ? await getRoleByCode(prisma, input.roleCode)
    : null;

  if (
    existing.role.code === TENANT_ROLE_ADMIN &&
    role &&
    role.code !== TENANT_ROLE_ADMIN &&
    existing.status === 'ACTIVE'
  ) {
    await assertNotLastAdmin(prisma, entityId, userId);
  }

  const updated = await prisma.tenantUser.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(role ? { roleId: role.id } : {}),
    },
    include: { role: true },
  });

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'USER_UPDATED',
    resource: 'user',
    previousValue: toUserDto(existing) as unknown as Prisma.InputJsonValue,
    newValue: toUserDto(updated) as unknown as Prisma.InputJsonValue,
  });

  return toUserDto(updated);
}

/** Activates or deactivates a tenant user */
export async function updateTenantUserStatus(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  userId: string,
  status: TenantUserStatus,
) {
  const existing = await prisma.tenantUser.findFirst({
    where: { id: userId, entityId },
    include: { role: true },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');
  }

  if (status === 'INACTIVE') {
    await assertNotLastAdmin(prisma, entityId, userId);
  }

  if (existing.status === status) {
    return toUserDto(existing);
  }

  const updated = await prisma.tenantUser.update({
    where: { id: userId },
    data: { status },
    include: { role: true },
  });

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    resource: 'user',
    previousValue: { status: existing.status },
    newValue: { status: updated.status },
  });

  return toUserDto(updated);
}

/** Resets password for a tenant user */
export async function resetTenantUserPassword(
  prisma: PrismaClient,
  actorId: string,
  entityId: string,
  userId: string,
  password: string,
) {
  validatePassword(password);

  const existing = await prisma.tenantUser.findFirst({
    where: { id: userId, entityId },
    include: { role: true },
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');
  }

  const passwordHash = await hashPassword(password);
  await prisma.tenantUser.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await writeTenantAudit(prisma, {
    entityId,
    userId: actorId,
    action: 'USER_PASSWORD_RESET',
    resource: 'user',
    metadata: { targetUserId: userId },
  });

  return toUserDto(existing);
}

/** Checks if entity has an active administrator */
export async function entityHasAdmin(prisma: PrismaClient, entityId: string) {
  const adminRole = await prisma.tenantRole.findUnique({
    where: { code: TENANT_ROLE_ADMIN },
  });
  if (!adminRole) return false;

  const count = await prisma.tenantUser.count({
    where: { entityId, roleId: adminRole.id, status: 'ACTIVE' },
  });
  return count > 0;
}
