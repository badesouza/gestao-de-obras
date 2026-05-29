import type { FastifyInstance } from 'fastify';
import { handleAppError } from '../../../shared/errors.js';
import { requirePlatformAuth } from '../../../plugins/auth-platform.js';
import { saveCoatOfArmsUpload } from './upload.service.js';

/** Registers platform upload routes */
export async function registerUploadRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/uploads/coat-of-arms',
    { preHandler: requirePlatformAuth },
    async (request, reply) => {
      try {
        const file = await request.file();
        if (!file) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Arquivo não enviado',
          });
        }

        const url = await saveCoatOfArmsUpload(file);
        return reply.send({ url });
      } catch (error) {
        return handleAppError(reply, error);
      }
    },
  );
}
