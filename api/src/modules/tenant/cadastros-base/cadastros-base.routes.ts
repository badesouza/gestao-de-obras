import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError, handleAppError } from '../../../shared/errors.js';
import { PERMISSION_CENTROS_CUSTO_VIEW } from '../../../shared/constants.js';
import { requireAcesso, requireTenantAuth, requireTenantPermission } from '../../../plugins/auth-tenant.js';
import { saveCoatOfArmsUpload } from '../../platform/uploads/upload.service.js';
import {
  atualizarBairro, colarBairros, criarBairro, criarMacrozona, definirBrasao, listarLugares,
  obterOrgao, removerBairro, removerMacrozona, renomearMacrozona, resumoCadastros, salvarOrgao,
} from './cadastros-base.service.js';
import { atualizarFrota, criarFrota, listarFrota, removerFrota, servicosSemCentro } from './frota.service.js';

const texto = (max: number) => z.string().max(max).nullable().optional();

const orgaoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do órgão').max(200),
  cnpj: texto(20),
  secretario: texto(160),
  telefone: texto(30),
  email: z.string().trim().email('E-mail inválido').max(160).nullable().optional().or(z.literal('')),
  endereco: texto(300),
});

const bairroSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do bairro').max(150),
  macrozonaId: z.string().uuid().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

const nomeSchema = z.object({ nome: z.string().trim().min(1, 'Informe o nome').max(150) });

/** Módulo 1 — Cadastros em 6 passos: resumo, Órgão e Lugares */
export async function registerCadastrosBaseRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const podeVer = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_VIEW)];
  const podeOrgao = [tenantAuth, requireAcesso(fastify.prisma, 'cad.orgao')];
  const podeLugares = [tenantAuth, requireAcesso(fastify.prisma, 'cad.lugares')];
  const podeFrota = [tenantAuth, requireAcesso(fastify.prisma, 'cad.veiculos')];

  fastify.get('/cadastros/resumo', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await resumoCadastros(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  /* ── Órgão ── */
  fastify.get('/cadastros/orgao', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await obterOrgao(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/cadastros/orgao', { preHandler: podeOrgao }, async (req, reply) => {
    try {
      const d = orgaoSchema.parse(req.body);
      return reply.send(await salvarOrgao(fastify.prisma, req.user.entityId!, { ...d, email: d.email || null }));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/cadastros/orgao/brasao', { preHandler: podeOrgao }, async (req, reply) => {
    try {
      const file = await req.file();
      if (!file) throw new AppError(400, 'VALIDATION_ERROR', 'Arquivo não enviado');
      const url = await saveCoatOfArmsUpload(file);
      return reply.send(await definirBrasao(fastify.prisma, req.user.entityId!, url));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/cadastros/orgao/brasao', { preHandler: podeOrgao }, async (req, reply) => {
    try { return reply.send(await definirBrasao(fastify.prisma, req.user.entityId!, null)); }
    catch (e) { return handleAppError(reply, e); }
  });

  /* ── Lugares ── */
  fastify.get('/cadastros/lugares', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await listarLugares(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/cadastros/lugares/macrozonas', { preHandler: podeLugares }, async (req, reply) => {
    try { return reply.code(201).send(await criarMacrozona(fastify.prisma, req.user.entityId!, nomeSchema.parse(req.body).nome)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/cadastros/lugares/macrozonas/:id', { preHandler: podeLugares }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await renomearMacrozona(fastify.prisma, req.user.entityId!, id, nomeSchema.parse(req.body).nome));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/cadastros/lugares/macrozonas/:id', { preHandler: podeLugares }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await removerMacrozona(fastify.prisma, req.user.entityId!, id);
      return reply.code(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/cadastros/lugares/bairros', { preHandler: podeLugares }, async (req, reply) => {
    try { return reply.code(201).send(await criarBairro(fastify.prisma, req.user.entityId!, bairroSchema.parse(req.body))); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/cadastros/lugares/bairros/:id', { preHandler: podeLugares }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await atualizarBairro(fastify.prisma, req.user.entityId!, id, bairroSchema.parse(req.body)));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/cadastros/lugares/bairros/:id', { preHandler: podeLugares }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await removerBairro(fastify.prisma, req.user.entityId!, id));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/cadastros/lugares/bairros/colar', { preHandler: podeLugares }, async (req, reply) => {
    try {
      const d = z.object({
        texto: z.string().max(20000),
        macrozonaId: z.string().uuid().nullable().optional(),
      }).parse(req.body);
      return reply.send(await colarBairros(fastify.prisma, req.user.entityId!, d.texto.split(/\r?\n/), d.macrozonaId ?? null));
    } catch (e) { return handleAppError(reply, e); }
  });

  /* ── Veículos e equipamentos ── */
  const tipoFrota = z.enum(['VEICULO', 'EQUIPAMENTO']);
  const frotaSchema = z.object({
    tipo: tipoFrota,
    nome: z.string().trim().min(1, 'Informe como a equipe chama').max(150),
    subtipo: z.string().max(80).nullable().optional(),
    placa: z.string().max(20).nullable().optional(),
    patrimonio: z.string().max(40).nullable().optional(),
    equipeId: z.string().uuid().nullable().optional(),
  });

  fastify.get('/cadastros/frota', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { tipo } = z.object({ tipo: tipoFrota.default('VEICULO') }).parse(req.query);
      return reply.send(await listarFrota(fastify.prisma, req.user.entityId!, tipo));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/cadastros/frota', { preHandler: podeFrota }, async (req, reply) => {
    try { return reply.code(201).send(await criarFrota(fastify.prisma, req.user.entityId!, frotaSchema.parse(req.body))); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/cadastros/frota/:id', { preHandler: podeFrota }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await atualizarFrota(fastify.prisma, req.user.entityId!, id, frotaSchema.parse(req.body)));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/cadastros/frota/:id', { preHandler: podeFrota }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await removerFrota(fastify.prisma, req.user.entityId!, id));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/cadastros/centros/pendencias', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send({ servicosSemCentro: await servicosSemCentro(fastify.prisma, req.user.entityId!) }); }
    catch (e) { return handleAppError(reply, e); }
  });
}
