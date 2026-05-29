import { handleAppError } from '../../../shared/errors.js';
import { requireTenantAuth, } from '../../../plugins/auth-tenant.js';
import { buildTenantTokenPayload, getTenantUserProfile, loginTenantUser, logoutTenantUser, } from './auth.service.js';
import { tenantLoginSchema } from './auth.schema.js';
/** Registers tenant authentication routes */
export async function registerTenantAuthRoutes(fastify) {
    const tenantAuth = requireTenantAuth(fastify.prisma);
    fastify.post('/auth/login', async (request, reply) => {
        try {
            const body = tenantLoginSchema.parse(request.body);
            const result = await loginTenantUser(fastify.prisma, body, {
                ip: request.ip,
                userAgent: request.headers['user-agent'],
            });
            const token = await reply.jwtSign(buildTenantTokenPayload(result.userId, result.email, result.entityId, result.roleCode), { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' });
            return reply.send({
                token,
                expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
                user: {
                    id: result.userId,
                    name: result.name,
                    email: result.email,
                    role: { code: result.roleCode, name: result.roleName },
                    permissions: result.permissions,
                },
                entity: {
                    id: result.entityId,
                    name: result.entityName,
                },
            });
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.post('/auth/logout', { preHandler: tenantAuth }, async (request, reply) => {
        try {
            await logoutTenantUser(fastify.prisma, request.user.sub, request.user.entityId, { ip: request.ip });
            return reply.code(204).send();
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.get('/auth/me', { preHandler: tenantAuth }, async (request, reply) => {
        try {
            const profile = await getTenantUserProfile(fastify.prisma, request.user.sub, request.user.entityId);
            return reply.send(profile);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
}
//# sourceMappingURL=auth.routes.js.map