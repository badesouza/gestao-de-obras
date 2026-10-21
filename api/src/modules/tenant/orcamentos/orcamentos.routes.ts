import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, handleAppError } from '../../../shared/errors.js';
import { PERMISSION_CENTROS_CUSTO_VIEW } from '../../../shared/constants.js';
import { carregarAtor, requireAcesso, requireTenantAuth, requireTenantPermission } from '../../../plugins/auth-tenant.js';
import {
  MAX_FOTOS_ORCAMENTO, acaoOrcamento, adicionarFotos, atualizarOrcamento, criarOrcamento, gerarPedidos,
  lerFotoOrcamento, listarOrcamentos, obterOrcamento, removerFoto, resumoOrcamentos,
} from './orcamentos.service.js';

function validar<T>(schema: z.ZodType<T>, dados: unknown): T {
  const r = schema.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    throw new AppError(400, 'VALIDATION_ERROR', p?.message ?? 'Dados inválidos', { campo: p?.path.join('.') });
  }
  return r.data;
}

const quantidade = z.union([z.string(), z.number()])
  .transform(v => String(v).replace(',', '.'))
  .refine(v => Number.isFinite(Number(v)) && Number(v) > 0, 'Informe uma quantidade maior que zero');

const orcamentoSchema = z.object({
  titulo: z.string().trim().min(3, 'Dê um título ao orçamento').max(200),
  descricao: z.string().trim().max(2000).optional().nullable(),
  bairro: z.string().trim().max(150).optional().nullable(),
  logradouro: z.string().trim().max(300).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  servicoSlug: z.string().trim().min(1, 'Escolha o serviço').max(80),
  servicoNome: z.string().trim().min(1).max(160),
  centroDeCustoId: z.string().uuid().optional().nullable(),
  itens: z.array(z.object({
    licitacaoItemId: z.string().uuid(),
    quantidade,
    servicoSlug: z.string().trim().max(80).optional().nullable(),
    servicoNome: z.string().trim().max(160).optional().nullable(),
    centroDeCustoId: z.string().uuid().optional().nullable(),
  })).max(200),
});

const TIPOS_FOTO = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function registerOrcamentosRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const podeVer = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_VIEW)];
  const podeLancar = [tenantAuth, requireAcesso(fastify.prisma, 'compras.orcar', 'compras.lancar')];

  const ator = async (userId: string) => {
    const a = await carregarAtor(fastify.prisma, userId);
    if (!a) throw new AppError(401, 'UNAUTHORIZED', 'Usuário inválido');
    return a;
  };

  fastify.get('/orcamentos', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { status } = validar(z.object({
        status: z.enum(['RASCUNHO', 'EM_REVISAO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'CONVERTIDO', 'CANCELADO']).optional(),
      }), req.query);
      return reply.send(await listarOrcamentos(fastify.prisma, req.user.entityId!, status));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/orcamentos/resumo', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await resumoOrcamentos(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/orcamentos/fotos/:fotoId', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { fotoId } = req.params as { fotoId: string };
      const f = await lerFotoOrcamento(fastify.prisma, req.user.entityId!, fotoId);
      return reply.header('Content-Type', f.mimeType).header('Cache-Control', 'private, max-age=86400').send(f.dados);
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/orcamentos/:id', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await obterOrcamento(fastify.prisma, req.user.entityId!, (req.params as { id: string }).id)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/orcamentos', { preHandler: podeLancar }, async (req, reply) => {
    try { return reply.code(201).send(await criarOrcamento(fastify.prisma, req.user.entityId!, req.user.sub, validar(orcamentoSchema, req.body))); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/orcamentos/:id', { preHandler: podeLancar }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await atualizarOrcamento(fastify.prisma, req.user.entityId!, req.user.sub, id, validar(orcamentoSchema, req.body)));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/orcamentos/:id/fotos', { preHandler: podeLancar }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const fotos: { nome: string; mimeType: string; dados: Buffer }[] = [];
      for await (const parte of req.parts()) {
        if (parte.type !== 'file') continue;
        const buf = await parte.toBuffer();
        if (!TIPOS_FOTO.has(parte.mimetype)) continue;
        if (fotos.length < MAX_FOTOS_ORCAMENTO) fotos.push({ nome: parte.filename || 'foto.jpg', mimeType: parte.mimetype, dados: buf });
      }
      if (!fotos.length) throw new AppError(400, 'VALIDATION_ERROR', 'Envie ao menos uma foto (JPG, PNG ou WEBP)');
      return reply.send(await adicionarFotos(fastify.prisma, req.user.entityId!, id, fotos));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/orcamentos/:id/fotos/:fotoId', { preHandler: podeLancar }, async (req, reply) => {
    try {
      const { id, fotoId } = req.params as { id: string; fotoId: string };
      return reply.send(await removerFoto(fastify.prisma, req.user.entityId!, id, fotoId));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/orcamentos/:id/fluxo', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { acao, motivo } = validar(z.object({
        acao: z.enum(['enviar', 'revisar', 'aprovar', 'devolver', 'cancelar'], { message: 'Ação inválida' }),
        motivo: z.string().trim().max(1000).optional(),
      }), req.body);
      return reply.send(await acaoOrcamento(fastify.prisma, req.user.entityId!, await ator(req.user.sub), id, acao, motivo));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/orcamentos/:id/gerar-pedido', { preHandler: podeLancar }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await gerarPedidos(fastify.prisma, req.user.entityId!, req.user.sub, id));
    } catch (e) { return handleAppError(reply, e); }
  });
}
