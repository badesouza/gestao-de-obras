import 'dotenv/config';
import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import './plugins/auth-tenant.js';
import { registerPrisma } from './plugins/prisma.js';
import { registerPlatformAuthRoutes } from './modules/platform/auth/auth.routes.js';
import { registerCnpjRoutes } from './modules/platform/entities/cnpj.routes.js';
import { registerPlatformEntityRoutes } from './modules/platform/entities/entity.routes.js';
import { registerUploadRoutes } from './modules/platform/uploads/upload.routes.js';
import { registerPublicRoutes } from './modules/public/public.routes.js';
import { registerTenantRoutes } from './modules/tenant/tenant.routes.js';

/** Bootstraps the Fastify API server */
async function start() {
  const fastify = Fastify({
    logger: true,
    bodyLimit: 5 * 1024 * 1024,
  });

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  });

  await fastify.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  await registerPrisma(fastify);

  fastify.get('/health', async () => ({ status: 'ok' }));

  await fastify.register(
    async (app) => {
      await registerPlatformAuthRoutes(app);
      await registerPlatformEntityRoutes(app);
      await registerCnpjRoutes(app);
      await registerUploadRoutes(app);
    },
    { prefix: '/api/platform/v1' },
  );

  await fastify.register(registerPublicRoutes, {
    prefix: '/api/public/v1',
  });

  await fastify.register(registerTenantRoutes, {
    prefix: '/api/tenant/v1',
  });

  const port = Number(process.env.PORT ?? 3000);
  await fastify.listen({ port, host: '0.0.0.0' });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
