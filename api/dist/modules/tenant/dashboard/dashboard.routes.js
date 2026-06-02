import { handleAppError } from '../../../shared/errors.js';
import { PERMISSION_DASHBOARD_VIEW, } from '../../../shared/constants.js';
import { requireTenantAuth, requireTenantPermission, } from '../../../plugins/auth-tenant.js';
/** Registers tenant dashboard placeholder route */
export async function registerTenantDashboardRoutes(fastify) {
    const tenantAuth = requireTenantAuth(fastify.prisma);
    fastify.get('/dashboard', {
        preHandler: [
            tenantAuth,
            requireTenantPermission(fastify.prisma, PERMISSION_DASHBOARD_VIEW),
        ],
    }, async (request, reply) => {
        try {
            const entity = await fastify.prisma.entity.findUnique({
                where: { id: request.user.entityId },
                select: { id: true, name: true, status: true, coatOfArmsUrl: true, municipalityName: true, uf: true },
            });
            if (!entity) {
                return reply.code(404).send({ code: 'NOT_FOUND', message: 'Entidade não encontrada' });
            }
            const [usersTotal, usersActive] = await Promise.all([
                fastify.prisma.tenantUser.count({
                    where: { entityId: entity.id },
                }),
                fastify.prisma.tenantUser.count({
                    where: { entityId: entity.id, status: 'ACTIVE' },
                }),
            ]);
            return reply.send({
                entity,
                stats: {
                    usersTotal,
                    usersActive,
                },
                message: 'Dashboard operacional — módulos de obras em specs futuras.',
            });
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
}
//# sourceMappingURL=dashboard.routes.js.map