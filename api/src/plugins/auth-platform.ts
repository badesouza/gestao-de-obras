import type { FastifyRequest, FastifyReply } from 'fastify';
import { JWT_SCOPE_PLATFORM } from '../shared/constants.js';
import { sendError } from '../shared/errors.js';

/** Verifies JWT and ensures platform scope */
export async function requirePlatformAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
    if (request.user.scope !== JWT_SCOPE_PLATFORM) {
      return sendError(reply, 403, 'FORBIDDEN', 'Acesso negado');
    }
  } catch {
    return sendError(reply, 401, 'UNAUTHORIZED', 'Não autenticado');
  }
}
