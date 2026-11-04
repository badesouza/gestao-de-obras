import type { FastifyRequest, FastifyReply } from 'fastify';
import { JWT_SCOPE_PLATFORM } from '../shared/constants.js';
import { sendError } from '../shared/errors.js';
import { sessaoValida } from '../seguranca/sessao-versao.js';

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
    /* Cinturão: operador ativo e versão da sessão igual à do banco (sair soma 1) */
    const operador = await request.server.prisma.platformOperator.findUnique({
      where: { id: request.user.sub },
      select: { status: true, sessaoVersao: true },
    });
    if (!sessaoValida(request.user, operador && { ativo: operador.status === 'ACTIVE', sessaoVersao: operador.sessaoVersao })) {
      return sendError(reply, 401, 'SESSAO_ENCERRADA', 'Sua sessão foi encerrada. Entre de novo.');
    }
  } catch {
    return sendError(reply, 401, 'UNAUTHORIZED', 'Não autenticado');
  }
}
