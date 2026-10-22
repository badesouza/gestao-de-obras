import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import { requireAcesso, requireTenantAuth } from '../../../plugins/auth-tenant.js';
import { buildTenantTokenPayload } from '../auth/auth.service.js';
import {
  adicionarMembro, atualizarPessoa, consultarLink, criarEquipe, criarPessoa, definirSituacao, gerarLink,
  listarEquipes, listarPessoas, obterAcessos, removerEquipe, removerMembro, salvarAcessos, salvarEquipe, usarLink, excluirPessoa } from './pessoas.service.js';

const pessoaSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome completo').max(200),
  email: z.string().trim().email('E-mail inválido').max(200),
  celular: z.string().max(30).nullable().optional(),
  modelo: z.enum(['ADMIN', 'SECRETARIO', 'COORDENADOR', 'ENGINEER', 'FISCAL', 'COMPRAS', 'CONSULTA']),
  equipeIds: z.array(z.string().uuid()).max(50).optional(),
  liderEquipeId: z.string().uuid().nullable().optional(),
  servicoIds: z.array(z.string().uuid()).max(100).nullable().optional(),
});

const equipeSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da equipe').max(150),
  liderUserId: z.string().uuid().nullable(),
  veiculoId: z.string().uuid().nullable(),
});

/** Passo 3 — Pessoas: usuários, acessos por caixa, link de senha e equipes */
export async function registerPessoasRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const podePessoas = [tenantAuth, requireAcesso(fastify.prisma, 'cad.pessoas')];

  fastify.get('/pessoas', { preHandler: podePessoas }, async (req, reply) => {
    try { return reply.send(await listarPessoas(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/pessoas', { preHandler: podePessoas }, async (req, reply) => {
    try { return reply.code(201).send(await criarPessoa(fastify.prisma, req.user.entityId!, req.user.sub, pessoaSchema.parse(req.body))); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/pessoas/:id', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await atualizarPessoa(fastify.prisma, req.user.entityId!, req.user.sub, id, pessoaSchema.parse(req.body)));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/pessoas/:id', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await excluirPessoa(fastify.prisma, req.user.entityId!, req.user.sub, id));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.patch('/pessoas/:id/situacao', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { ativo } = z.object({ ativo: z.boolean() }).parse(req.body);
      await definirSituacao(fastify.prisma, req.user.entityId!, req.user.sub, id, ativo);
      return reply.code(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/pessoas/:id/link', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await gerarLink(fastify.prisma, req.user.entityId!, req.user.sub, id));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/pessoas/:id/acessos', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await obterAcessos(fastify.prisma, req.user.entityId!, id));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/pessoas/:id/acessos', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const d = z.object({ adminGeral: z.boolean(), acessos: z.array(z.string().max(40)).max(100) }).parse(req.body);
      return reply.send(await salvarAcessos(fastify.prisma, req.user.entityId!, req.user.sub, id, d));
    } catch (e) { return handleAppError(reply, e); }
  });

  /* ── Equipes ── */
  fastify.get('/equipes-campo', { preHandler: podePessoas }, async (req, reply) => {
    try { return reply.send(await listarEquipes(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/equipes-campo', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { nome } = z.object({ nome: z.string().trim().min(1, 'Informe o nome da equipe').max(150) }).parse(req.body);
      return reply.code(201).send(await criarEquipe(fastify.prisma, req.user.entityId!, nome));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/equipes-campo/:id', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await salvarEquipe(fastify.prisma, req.user.entityId!, id, equipeSchema.parse(req.body)));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/equipes-campo/:id', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await removerEquipe(fastify.prisma, req.user.entityId!, id);
      return reply.code(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/equipes-campo/:id/membros', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const d = z.object({ nome: z.string().trim().min(1, 'Informe o nome').max(150), funcao: z.string().trim().max(100).default('') }).parse(req.body);
      return reply.code(201).send(await adicionarMembro(fastify.prisma, req.user.entityId!, id, d));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/equipes-campo/membros/:membroId', { preHandler: podePessoas }, async (req, reply) => {
    try {
      const { membroId } = req.params as { membroId: string };
      await removerMembro(fastify.prisma, req.user.entityId!, membroId);
      return reply.code(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });
}

/** Página pública do link: a pessoa cria a própria senha e já entra (sem login) */
export async function registerLinkAcessoPublicRoutes(fastify: FastifyInstance) {
  fastify.get('/acesso/:token', async (req, reply) => {
    try {
      const { token } = req.params as { token: string };
      return reply.send(await consultarLink(fastify.prisma, token));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/acesso/:token', async (req, reply) => {
    try {
      const { token } = req.params as { token: string };
      const { senha } = z.object({ senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres').max(200) }).parse(req.body);
      const r = await usarLink(fastify.prisma, token, senha);
      const jwt = await reply.jwtSign(
        buildTenantTokenPayload(r.userId, r.email, r.entityId, r.roleCode),
        { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
      );
      return reply.send({ token: jwt, entityId: r.entityId });
    } catch (e) { return handleAppError(reply, e); }
  });
}
