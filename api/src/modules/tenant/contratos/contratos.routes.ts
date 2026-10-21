import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, handleAppError } from '../../../shared/errors.js';
import { PERMISSION_LICITACOES_MANAGE, PERMISSION_LICITACOES_VIEW, PERMISSION_CENTROS_CUSTO_VIEW } from '../../../shared/constants.js';
import { requireTenantAuth, requireTenantPermission } from '../../../plugins/auth-tenant.js';
import {
  MODALIDADES, TIPOS_DOCUMENTO, TIPOS_LICITACAO, adicionarItem, anexarDocumento, atualizarContrato, atualizarLote,
  consultarCnpj, contratosAVencer, criarAditivo, criarContrato, criarLote, desfazerAditivo, estruturaDaLicitacao,
  lerDocumento, reativarContrato, removerContrato, removerDocumento, removerLote, salvarDadosProcesso, vincularItens,
} from './contratos.service.js';

function validar<T>(schema: z.ZodType<T>, dados: unknown): T {
  const r = schema.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    throw new AppError(400, 'VALIDATION_ERROR', p?.message ?? 'Dados inválidos', { campo: p?.path.join('.') });
  }
  return r.data;
}

const data = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg);
/* aceita 1.234,56 · 1234,56 · 1234.56 */
const decimal = (msg: string) => z.union([z.string(), z.number()])
  .transform(v => { const s = String(v).trim(); return s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s; })
  .refine(v => v === '' || Number.isFinite(Number(v)), msg)
  .transform(v => (v === '' ? null : v));
const textoOpc = (max: number) => z.string().trim().max(max).optional().nullable();

const processoSchema = z.object({
  numeroProcesso: textoOpc(60),
  modalidade: z.enum(MODALIDADES, { message: 'Escolha a modalidade da lista' }).optional().nullable(),
  tipo: z.enum(TIPOS_LICITACAO).optional().nullable(),
  dataHomologacao: data('Data de homologação inválida').optional().nullable(),
});

const fornecedorNovoSchema = z.object({
  cnpj: textoOpc(18),
  razaoSocial: z.string().trim().min(3, 'Informe a razão social do fornecedor').max(250),
  nomeFantasia: textoOpc(250),
  telefone: textoOpc(30),
  email: textoOpc(150),
  endereco: textoOpc(400),
});

const contratoSchema = z.object({
  numero: z.string().trim().min(1, 'Informe o número do contrato').max(60),
  vigenciaDe: data('Informe o início da vigência'),
  vigenciaAte: data('Informe o fim da vigência'),
  valor: decimal('Valor inválido').optional().nullable(),
  fornecedorId: z.string().uuid().optional().nullable(),
  fornecedorNovo: fornecedorNovoSchema.optional().nullable(),
  primeiroLote: z.object({ numero: z.string().trim().min(1).max(20), descricao: textoOpc(300) }).optional().nullable(),
});

const loteSchema = z.object({ numero: z.string().trim().min(1, 'Informe o número do lote').max(20), descricao: textoOpc(300) });

const itemSchema = z.object({
  categoria: textoOpc(100),
  descricao: z.string().trim().min(2, 'Informe a descrição do item').max(500),
  marca: textoOpc(120),
  unidade: z.string().trim().min(1, 'Informe a unidade').max(50),
  quantidade: decimal('Quantidade inválida').optional().nullable(),
  valorUnitario: decimal('Valor unitário inválido').optional().nullable(),
});

const aditivoSchema = z.object({
  tipo: z.enum(['PRAZO', 'VALOR', 'QUANTIDADE'], { message: 'Escolha o tipo do aditivo' }),
  numero: z.string().trim().min(1, 'Informe o número do aditivo').max(40),
  dataPublicacao: data('Informe a data de publicação'),
  novaVigencia: data('Nova vigência inválida').optional().nullable(),
  percentual: decimal('Percentual inválido').optional().nullable(),
  loteId: z.string().uuid().optional().nullable(),
  observacao: textoOpc(1000),
});

export async function registerContratosRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const podeVer = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_LICITACOES_VIEW)];
  const podeGerir = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_LICITACOES_MANAGE)];
  const podeVerObras = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_VIEW)];
  const e = (req: { user: { entityId?: string | null } }) => req.user.entityId!;
  const id = (req: { params: unknown }, k = 'id') => (req.params as Record<string, string>)[k]!;

  fastify.get('/licitacoes/:id/estrutura', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await estruturaDaLicitacao(fastify.prisma, e(req), id(req))); } catch (err) { return handleAppError(reply, err); }
  });
  fastify.put('/licitacoes/:id/processo', { preHandler: podeGerir }, async (req, reply) => {
    try { await salvarDadosProcesso(fastify.prisma, e(req), req.user.sub, id(req), validar(processoSchema, req.body)); return reply.code(204).send(); }
    catch (err) { return handleAppError(reply, err); }
  });
  fastify.get('/licitacoes-modalidades', { preHandler: podeVer }, async (_req, reply) => reply.send({ modalidades: MODALIDADES, tipos: TIPOS_LICITACAO }));
  fastify.get('/contratos/a-vencer', { preHandler: podeVerObras }, async (req, reply) => {
    try { return reply.send(await contratosAVencer(fastify.prisma, e(req))); } catch (err) { return handleAppError(reply, err); }
  });

  fastify.get('/fornecedores/cnpj/:cnpj', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await consultarCnpj(fastify.prisma, e(req), id(req, 'cnpj'))); } catch (err) { return handleAppError(reply, err); }
  });

  /* contratos */
  fastify.post('/licitacoes/:id/contratos', { preHandler: podeGerir }, async (req, reply) => {
    try { return reply.code(201).send(await criarContrato(fastify.prisma, e(req), req.user.sub, id(req), validar(contratoSchema, req.body))); }
    catch (err) { return handleAppError(reply, err); }
  });
  fastify.put('/contratos/:id', { preHandler: podeGerir }, async (req, reply) => {
    try { await atualizarContrato(fastify.prisma, e(req), req.user.sub, id(req), validar(contratoSchema, req.body)); return reply.code(204).send(); }
    catch (err) { return handleAppError(reply, err); }
  });
  fastify.delete('/contratos/:id', { preHandler: podeGerir }, async (req, reply) => {
    try { return reply.send(await removerContrato(fastify.prisma, e(req), req.user.sub, id(req))); } catch (err) { return handleAppError(reply, err); }
  });
  fastify.post('/contratos/:id/reativar', { preHandler: podeGerir }, async (req, reply) => {
    try { await reativarContrato(fastify.prisma, e(req), req.user.sub, id(req)); return reply.code(204).send(); } catch (err) { return handleAppError(reply, err); }
  });

  /* lotes e itens */
  fastify.post('/contratos/:id/lotes', { preHandler: podeGerir }, async (req, reply) => {
    try { return reply.code(201).send(await criarLote(fastify.prisma, e(req), id(req), validar(loteSchema, req.body))); } catch (err) { return handleAppError(reply, err); }
  });
  fastify.put('/lotes/:id', { preHandler: podeGerir }, async (req, reply) => {
    try { await atualizarLote(fastify.prisma, e(req), id(req), validar(loteSchema, req.body)); return reply.code(204).send(); } catch (err) { return handleAppError(reply, err); }
  });
  fastify.delete('/lotes/:id', { preHandler: podeGerir }, async (req, reply) => {
    try { await removerLote(fastify.prisma, e(req), id(req)); return reply.code(204).send(); } catch (err) { return handleAppError(reply, err); }
  });
  fastify.post('/lotes/:id/itens', { preHandler: podeGerir }, async (req, reply) => {
    try { return reply.code(201).send(await adicionarItem(fastify.prisma, e(req), req.user.sub, id(req), validar(itemSchema, req.body))); }
    catch (err) { return handleAppError(reply, err); }
  });
  fastify.post('/lotes/:id/vincular', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { itemIds } = validar(z.object({ itemIds: z.array(z.string().uuid()).min(1, 'Escolha ao menos um item').max(2000) }), req.body);
      return reply.send(await vincularItens(fastify.prisma, e(req), req.user.sub, id(req), itemIds));
    } catch (err) { return handleAppError(reply, err); }
  });

  /* aditivos */
  fastify.post('/contratos/:id/aditivos', { preHandler: podeGerir }, async (req, reply) => {
    try { return reply.code(201).send(await criarAditivo(fastify.prisma, e(req), req.user.sub, id(req), validar(aditivoSchema, req.body))); }
    catch (err) { return handleAppError(reply, err); }
  });
  fastify.delete('/aditivos/:id', { preHandler: podeGerir }, async (req, reply) => {
    try { await desfazerAditivo(fastify.prisma, e(req), req.user.sub, id(req)); return reply.code(204).send(); } catch (err) { return handleAppError(reply, err); }
  });

  /* documentos: /documentos-contratacao?licitacaoId= | contratoId= | aditivoId= */
  fastify.post('/documentos-contratacao', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const alvo = validar(z.object({
        licitacaoId: z.string().uuid().optional(), contratoId: z.string().uuid().optional(), aditivoId: z.string().uuid().optional(),
      }).refine(a => [a.licitacaoId, a.contratoId, a.aditivoId].filter(Boolean).length === 1, 'Informe onde anexar'), req.query);
      const arq = await req.file();
      if (!arq) throw new AppError(400, 'VALIDATION_ERROR', 'Envie o arquivo');
      const dados = await arq.toBuffer();
      if (!TIPOS_DOCUMENTO.has(arq.mimetype)) throw new AppError(400, 'VALIDATION_ERROR', 'Use PDF ou imagem (JPG, PNG)');
      return reply.code(201).send(await anexarDocumento(fastify.prisma, e(req), req.user.sub, alvo, { nome: arq.filename || 'documento.pdf', mimeType: arq.mimetype, dados }));
    } catch (err) { return handleAppError(reply, err); }
  });
  fastify.get('/documentos-contratacao/:id', { preHandler: podeVer }, async (req, reply) => {
    try {
      const d = await lerDocumento(fastify.prisma, e(req), id(req));
      return reply
        .header('Content-Type', d.mimeType)
        .header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(d.nome)}`)
        .header('Cache-Control', 'private, max-age=3600')
        .send(d.dados);
    } catch (err) { return handleAppError(reply, err); }
  });
  fastify.delete('/documentos-contratacao/:id', { preHandler: podeGerir }, async (req, reply) => {
    try { await removerDocumento(fastify.prisma, e(req), req.user.sub, id(req)); return reply.code(204).send(); } catch (err) { return handleAppError(reply, err); }
  });
}
