import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import { requireTenantAuth } from '../../../plugins/auth-tenant.js';
import { listFornecedores, createFornecedor, updateFornecedor } from './fornecedor.service.js';

const createSchema = z.object({
  razaoSocial: z.string().min(2).max(250),
  cnpj:     z.string().max(18).optional(),
  contato:  z.string().max(150).optional(),
  telefone: z.string().max(30).optional(),
  email:    z.string().email().optional().or(z.literal('')),
});

const updateSchema = z.object({
  razaoSocial: z.string().min(2).max(250).optional(),
  cnpj:     z.string().max(18).optional(),
  contato:  z.string().max(150).optional(),
  telefone: z.string().max(30).optional(),
  email:    z.string().email().optional().or(z.literal('')),
  ativo:    z.boolean().optional(),
});

export async function registerFornecedorRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);

  /* GET /fornecedores?q=texto */
  fastify.get('/fornecedores', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { q } = z.object({ q: z.string().optional() }).parse(req.query);
      const items = await listFornecedores(fastify.prisma, req.user.entityId!, q);
      return reply.send({ items });
    } catch (e) { return handleAppError(reply, e); }
  });

  /* POST /fornecedores */
  fastify.post('/fornecedores', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const body = createSchema.parse(req.body);
      const item = await createFornecedor(fastify.prisma, req.user.entityId!, body);
      return reply.status(201).send(item);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* PATCH /fornecedores/:id */
  fastify.patch('/fornecedores/:id', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = updateSchema.parse(req.body);
      const item = await updateFornecedor(fastify.prisma, req.user.entityId!, id, body);
      return reply.send(item);
    } catch (e) { return handleAppError(reply, e); }
  });
}
