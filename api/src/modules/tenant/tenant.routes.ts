import type { FastifyInstance } from 'fastify';
import { registerTenantAuthRoutes } from './auth/auth.routes.js';
import { registerTenantDashboardRoutes } from './dashboard/dashboard.routes.js';
import { registerCentroCustoRoutes } from './centros-custo/centro-custo.routes.js';
import { registerLicitacaoRoutes } from './licitacoes/licitacao.routes.js';
import { registerTenantUserRoutes } from './users/user.routes.js';
import { registerCadastroAuxiliarRoutes } from './cadastros-auxiliares/cadastro-auxiliar.routes.js';
import { registerMapaRoutes } from './mapa/mapa.routes.js';
import { registerEnderecoDescobertoRoutes } from './enderecos/endereco-descoberto.routes.js';

/** Registers all tenant API routes under /api/tenant/v1 */
export async function registerTenantRoutes(fastify: FastifyInstance) {
  await registerTenantAuthRoutes(fastify);
  await registerTenantDashboardRoutes(fastify);
  await registerTenantUserRoutes(fastify);
  await registerLicitacaoRoutes(fastify);
  await registerCentroCustoRoutes(fastify);
  await registerCadastroAuxiliarRoutes(fastify);
  await registerMapaRoutes(fastify);
  await registerEnderecoDescobertoRoutes(fastify);
}
