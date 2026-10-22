import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, handleAppError } from '../../../shared/errors.js';
import { carregarAtor, requireAcesso, requireTenantAuth } from '../../../plugins/auth-tenant.js';
import { abrirOS, darBaixa, detalheOS, formOS, painelOS } from './os.service.js';

function validar<T>(schema: z.ZodType<T>, dados: unknown): T {
  const r = schema.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    throw new AppError(400, 'VALIDATION_ERROR', p?.message ?? 'Dados inválidos', { campo: p?.path.join('.') });
  }
  return r.data;
}

const valorCampo = z.union([z.string().max(2000), z.number(), z.boolean(), z.array(z.string().max(300)).max(50), z.null()]);
const resposta = z.object({ id: z.string().uuid().nullable(), nome: z.string().trim().min(1).max(120), tipo: z.string().max(20), valor: valorCampo });

export async function registerOsRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const ator = async (userId: string) => {
    const a = await carregarAtor(fastify.prisma, userId);
    if (!a) throw new AppError(401, 'UNAUTHORIZED', 'Usuário inválido');
    return a;
  };

  /* lista com indicadores (tela Ordens de Serviço e celular Minhas OS) */
  fastify.get('/os', { preHandler: [tenantAuth, requireAcesso(fastify.prisma, 'os.lista', 'os.minhas', 'os.central', 'os.abrir', 'os.baixa')] }, async (req, reply) => {
    try {
      const q = validar(z.object({
        etapa: z.string().max(30).optional(), servicoId: z.string().uuid().optional(), equipeId: z.string().uuid().optional(),
        origem: z.enum(['ESCRITORIO', 'CAMPO', 'MUNICIPE']).optional(), atrasadas: z.coerce.boolean().optional(), busca: z.string().max(100).optional(),
      }), req.query);
      return reply.send(await painelOS(fastify.prisma, req.user.entityId!, await ator(req.user.sub), q));
    } catch (e) { return handleAppError(reply, e); }
  });

  /* o que a janela Nova OS precisa: serviços (com a ficha), equipes, bairros, origens */
  fastify.get('/os/form', { preHandler: [tenantAuth, requireAcesso(fastify.prisma, 'os.abrir')] }, async (req, reply) => {
    try { return reply.send(await formOS(fastify.prisma, req.user.entityId!, await ator(req.user.sub))); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/os', { preHandler: [tenantAuth, requireAcesso(fastify.prisma, 'os.abrir')] }, async (req, reply) => {
    try {
      const d = validar(z.object({
        servicoId: z.string().uuid('Escolha o serviço'),
        equipeId: z.string({ message: 'Escolha a equipe' }).uuid('Escolha a equipe'),
        tipo: z.string().trim().max(120).nullable().optional(),
        bairro: z.string().trim().min(1, 'Informe o bairro').max(150),
        logradouro: z.string().trim().min(1, 'Informe a rua ou uma referência').max(300),
        lat: z.number().min(-90).max(90).nullable().optional(), lng: z.number().min(-180).max(180).nullable().optional(),
        origemDemanda: z.string().trim().max(80).nullable().optional(),
        observacoes: z.string().trim().max(2000).nullable().optional(),
        campos: z.array(resposta).max(60).optional(),
      }), req.body);
      const deCelular = /Mobi|Android|iPhone/i.test(req.headers['user-agent'] ?? '');
      return reply.code(201).send(await abrirOS(fastify.prisma, req.user.entityId!, await ator(req.user.sub), d, deCelular));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/os/:id', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { id } = validar(z.object({ id: z.string().uuid() }), req.params);
      return reply.send(await detalheOS(fastify.prisma, req.user.entityId!, await ator(req.user.sub), id));
    } catch (e) { return handleAppError(reply, e); }
  });

  /* baixa com foto: campos de baixa da ficha + quem trabalhou; depois vai para a conferência */
  fastify.post('/os/:id/baixa', { preHandler: [tenantAuth, requireAcesso(fastify.prisma, 'os.baixa')] }, async (req, reply) => {
    try {
      const { id } = validar(z.object({ id: z.string().uuid() }), req.params);
      const d = validar(z.object({
        campos: z.array(resposta).max(60).optional(),
        trabalharam: z.array(z.string().trim().max(150)).max(30).optional(),
        observacao: z.string().trim().max(1000).nullable().optional(),
      }), req.body);
      return reply.send(await darBaixa(fastify.prisma, req.user.entityId!, await ator(req.user.sub), id, d));
    } catch (e) { return handleAppError(reply, e); }
  });
}
