import { handleAppError } from '../../../shared/errors.js';
import { buildPlatformTokenPayload, getPlatformOperator, loginPlatformOperator, logoutPlatformOperator, } from './auth.service.js';
import { loginRequestSchema } from './auth.schema.js';
import { requirePlatformAuth } from '../../../plugins/auth-platform.js';
/** Registers platform authentication routes */
export async function registerPlatformAuthRoutes(fastify) {
    fastify.post('/auth/login', async (request, reply) => {
        try {
            const body = loginRequestSchema.parse(request.body);
            const result = await loginPlatformOperator(fastify.prisma, body, {
                ip: request.ip,
                userAgent: request.headers['user-agent'],
            });
            const token = await reply.jwtSign(buildPlatformTokenPayload(result.operatorId, result.email), { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' });
            return reply.send({
                token,
                expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
                operator: {
                    id: result.operatorId,
                    name: result.name,
                    email: result.email,
                    status: 'ACTIVE',
                },
            });
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.post('/auth/logout', { preHandler: requirePlatformAuth }, async (request, reply) => {
        try {
            await logoutPlatformOperator(fastify.prisma, request.user.sub, {
                ip: request.ip,
            });
            return reply.code(204).send();
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.get('/auth/me', { preHandler: requirePlatformAuth }, async (request, reply) => {
        try {
            const operator = await getPlatformOperator(fastify.prisma, request.user.sub);
            return reply.send(operator);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
}
//# sourceMappingURL=auth.routes.js.map