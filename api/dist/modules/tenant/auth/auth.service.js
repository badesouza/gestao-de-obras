import bcrypt from 'bcryptjs';
import { JWT_SCOPE_TENANT, TENANT_ROLE_ADMIN, } from '../../../shared/constants.js';
import { AppError } from '../../../shared/errors.js';
import { hashPassword } from '../../platform/auth/auth.service.js';
import { getTenantUserPermissions, writeTenantAudit, } from '../audit/audit.service.js';
/** Authenticates a tenant user within entity context */
export async function loginTenantUser(prisma, input, metadata) {
    const entity = await prisma.entity.findUnique({
        where: { id: input.entityId },
    });
    if (!entity) {
        throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
    }
    if (entity.status !== 'ACTIVE') {
        throw new AppError(403, 'ENTITY_INACTIVE', 'Entidade suspensa');
    }
    const user = await prisma.tenantUser.findUnique({
        where: {
            entityId_email: {
                entityId: input.entityId,
                email: input.email.toLowerCase(),
            },
        },
        include: { role: true },
    });
    if (!user || user.status !== 'ACTIVE') {
        if (user) {
            await writeTenantAudit(prisma, {
                entityId: input.entityId,
                userId: user.id,
                action: 'AUTH_LOGIN_FAILURE',
                resource: 'auth',
                metadata: { email: input.email, ...metadata },
            });
        }
        throw new AppError(401, 'UNAUTHORIZED', 'Credenciais inválidas');
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
        await writeTenantAudit(prisma, {
            entityId: input.entityId,
            userId: user.id,
            action: 'AUTH_LOGIN_FAILURE',
            resource: 'auth',
            metadata: { email: input.email, ...metadata },
        });
        throw new AppError(401, 'UNAUTHORIZED', 'Credenciais inválidas');
    }
    await prisma.tenantUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    await writeTenantAudit(prisma, {
        entityId: input.entityId,
        userId: user.id,
        action: 'AUTH_LOGIN_SUCCESS',
        resource: 'auth',
        metadata: metadata,
    });
    const permissions = await getTenantUserPermissions(prisma, user.id);
    return {
        userId: user.id,
        email: user.email,
        name: user.name,
        entityId: user.entityId,
        entityName: entity.name,
        roleCode: user.role.code,
        roleName: user.role.name,
        permissions,
    };
}
/** Returns authenticated tenant user profile */
export async function getTenantUserProfile(prisma, userId, entityId) {
    const user = await prisma.tenantUser.findUnique({
        where: { id: userId },
        include: {
            role: true,
            entity: { select: { id: true, name: true, status: true } },
        },
    });
    if (!user || user.entityId !== entityId || user.status !== 'ACTIVE') {
        throw new AppError(401, 'UNAUTHORIZED', 'Usuário inválido');
    }
    if (user.entity.status !== 'ACTIVE') {
        throw new AppError(403, 'ENTITY_INACTIVE', 'Entidade suspensa');
    }
    const permissions = await getTenantUserPermissions(prisma, user.id);
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        entity: user.entity,
        role: {
            code: user.role.code,
            name: user.role.name,
        },
        permissions,
    };
}
/** Records tenant logout in audit trail */
export async function logoutTenantUser(prisma, userId, entityId, metadata) {
    await writeTenantAudit(prisma, {
        entityId,
        userId,
        action: 'AUTH_LOGOUT',
        resource: 'auth',
        metadata: metadata,
    });
}
/** Builds JWT payload for tenant scope */
export function buildTenantTokenPayload(userId, email, entityId, roleCode) {
    return {
        sub: userId,
        email,
        entityId,
        roleCode,
        scope: JWT_SCOPE_TENANT,
    };
}
/** Creates the first tenant administrator for an entity */
export async function bootstrapTenantAdmin(prisma, entityId, input) {
    const entity = await prisma.entity.findUnique({ where: { id: entityId } });
    if (!entity) {
        throw new AppError(404, 'NOT_FOUND', 'Entidade não encontrada');
    }
    const adminRole = await prisma.tenantRole.findUnique({
        where: { code: TENANT_ROLE_ADMIN },
    });
    if (!adminRole) {
        throw new AppError(500, 'CONFIG_ERROR', 'Perfil Administrador não configurado');
    }
    const existingAdmin = await prisma.tenantUser.findFirst({
        where: { entityId, roleId: adminRole.id, status: 'ACTIVE' },
    });
    if (existingAdmin) {
        throw new AppError(409, 'ADMIN_EXISTS', 'Entidade já possui administrador ativo');
    }
    const passwordHash = await hashPassword(input.password);
    const user = await prisma.tenantUser.create({
        data: {
            entityId,
            roleId: adminRole.id,
            name: input.name.trim(),
            email: input.email.toLowerCase(),
            passwordHash,
        },
        include: { role: true },
    });
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
    };
}
export { hashPassword };
//# sourceMappingURL=auth.service.js.map