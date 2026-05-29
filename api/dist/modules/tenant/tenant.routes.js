import { registerTenantAuthRoutes } from './auth/auth.routes.js';
import { registerTenantDashboardRoutes } from './dashboard/dashboard.routes.js';
import { registerCentroCustoRoutes } from './centros-custo/centro-custo.routes.js';
import { registerLicitacaoRoutes } from './licitacoes/licitacao.routes.js';
import { registerTenantUserRoutes } from './users/user.routes.js';
/** Registers all tenant API routes under /api/tenant/v1 */
export async function registerTenantRoutes(fastify) {
    await registerTenantAuthRoutes(fastify);
    await registerTenantDashboardRoutes(fastify);
    await registerTenantUserRoutes(fastify);
    await registerLicitacaoRoutes(fastify);
    await registerCentroCustoRoutes(fastify);
}
//# sourceMappingURL=tenant.routes.js.map