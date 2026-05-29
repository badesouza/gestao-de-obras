import { handleAppError } from '../../../shared/errors.js';
import { requirePlatformAuth } from '../../../plugins/auth-platform.js';
import { lookupCnpj } from './cnpj.service.js';
/** Registers CNPJ lookup proxy routes */
export async function registerCnpjRoutes(fastify) {
    fastify.get('/cnpj/:cnpj', { preHandler: requirePlatformAuth }, async (request, reply) => {
        try {
            const { cnpj } = request.params;
            const result = await lookupCnpj(cnpj);
            return reply.send(result);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
}
//# sourceMappingURL=cnpj.routes.js.map