import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import { requireTela, requireTenantAuth } from '../../../plugins/auth-tenant.js';
import { PERMISSION_LICITACOES_MANAGE, PERMISSION_LICITACOES_VIEW } from '../../../shared/constants.js';
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
  /* Cinturão (linha 5): a regra do menu da tela que usa cada rota, conferida no servidor.
     Modo observação: quem seria barrado só vai para o log até OBRAS_BLOQUEAR_TELAS=true. */
  /* mesma regra das telas de Contratos (ver / cadastrar licitação e contrato) */
  const podeVer = [tenantAuth, requireTela(fastify.prisma, 'Fornecedores (ver)', PERMISSION_LICITACOES_VIEW)];
  const podeGerir = [tenantAuth, requireTela(fastify.prisma, 'Fornecedores (gravar)', PERMISSION_LICITACOES_MANAGE)];

  /* GET /fornecedores?q=texto */
  fastify.get('/fornecedores', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { q } = z.object({ q: z.string().optional() }).parse(req.query);
      const items = await listFornecedores(fastify.prisma, req.user.entityId!, q);
      return reply.send({ items });
    } catch (e) { return handleAppError(reply, e); }
  });

  /* POST /fornecedores */
  fastify.post('/fornecedores', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const body = createSchema.parse(req.body);
      const item = await createFornecedor(fastify.prisma, req.user.entityId!, body);
      return reply.status(201).send(item);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* PATCH /fornecedores/:id */
  fastify.patch('/fornecedores/:id', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = updateSchema.parse(req.body);
      const item = await updateFornecedor(fastify.prisma, req.user.entityId!, id, body);
      return reply.send(item);
    } catch (e) { return handleAppError(reply, e); }
  });
}
