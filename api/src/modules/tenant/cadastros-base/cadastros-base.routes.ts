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
import {
  atualizarFrota, criarFrota, criarTipoFrota, listarFrota, listarTiposFrota, removerFrota, removerTipoFrota, renomearTipoFrota, servicosSemCentro,
} from './frota.service.js';
import { LOCAIS, MOMENTOS, TIPOS_CAMPO, baseFicha, criarServico, excluirServico, listarServicos, obterFicha, salvarFicha, salvarOrigens } from './servicos-ficha.service.js';
import { PASSOS_FLUXO, obterFluxo, salvarFluxo } from './fluxo.service.js';
import { ORIGENS_OS } from '../ordens/ordens.service.js';

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
  const podeServicos = [tenantAuth, requireAcesso(fastify.prisma, 'cad.servicos')];
  const podeFluxo = [tenantAuth, requireAcesso(fastify.prisma, 'cad.regras')];

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
    tipoFrotaId: z.string().uuid().nullable().optional(),
    placa: z.string().max(20).nullable().optional(),
    patrimonio: z.string().max(40).nullable().optional(),
    equipeId: z.string().uuid().nullable().optional(),
    servicoIds: z.array(z.string().min(1)).default([]),
    /** cadastrado de dentro da janela de um serviço novo: o vínculo é gravado quando o serviço for salvo */
    vincularDepois: z.boolean().optional(),
  });

  /* tipos (Veículos, Máquinas, Equipamentos, Móveis…), criados e ajustados de dentro da janela */
  const nomeTipo = z.object({ nome: z.string().trim().min(2, 'Informe o nome do tipo').max(80) });
  fastify.get('/cadastros/frota-tipos', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send({ tipos: await listarTiposFrota(fastify.prisma, req.user.entityId!) }); }
    catch (e) { return handleAppError(reply, e); }
  });
  fastify.post('/cadastros/frota-tipos', { preHandler: podeFrota }, async (req, reply) => {
    try { return reply.code(201).send(await criarTipoFrota(fastify.prisma, req.user.entityId!, nomeTipo.parse(req.body).nome)); }
    catch (e) { return handleAppError(reply, e); }
  });
  fastify.put('/cadastros/frota-tipos/:id', { preHandler: podeFrota }, async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      return reply.send(await renomearTipoFrota(fastify.prisma, req.user.entityId!, id, nomeTipo.parse(req.body).nome));
    } catch (e) { return handleAppError(reply, e); }
  });
  fastify.delete('/cadastros/frota-tipos/:id', { preHandler: podeFrota }, async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      return reply.send(await removerTipoFrota(fastify.prisma, req.user.entityId!, id));
    } catch (e) { return handleAppError(reply, e); }
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

  /* ── Serviços e ficha do serviço ── */
  const tipoServico = z.enum(['MANUTENCAO', 'CONSTRUCAO']);
  const usoSchema = z.object({ usa: z.boolean(), obrigatorio: z.boolean() });
  const fichaSchema = z.object({
    nome: z.string().trim().min(2, 'Informe o nome do serviço').max(200),
    ativo: z.boolean(),
    tipoServico,
    cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').nullable(),
    prazoDias: z.number().int().min(1, 'Prazo mínimo de 1 dia').max(365).nullable(),
    subtipos: z.array(z.string().max(80)).max(60),
    municipePode: z.boolean(),
    nomeMunicipe: z.string().max(200).nullable(),
    centroDeCustoId: z.string().uuid().nullable(),
    camposComuns: z.object({
      local: z.object({ tipo: z.enum(LOCAIS), lista: z.array(z.string().max(160)).max(200) }),
      origem: usoSchema, equipe: usoSchema, veiculo: usoSchema, fotos: usoSchema, observacoes: usoSchema,
      equipamentos: z.array(z.string().uuid()).max(200),
    }),
    campos: z.array(z.object({
      nome: z.string().max(120),
      detalhe: z.string().max(300).nullable().optional(),
      tipo: z.enum(TIPOS_CAMPO),
      opcoes: z.array(z.string().max(120)).max(120).optional(),
      momento: z.enum(MOMENTOS),
      obrigatorio: z.boolean(),
    })).max(40),
  });

  fastify.get('/cadastros/servicos', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await listarServicos(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/cadastros/servicos', { preHandler: podeServicos }, async (req, reply) => {
    try {
      const d = z.object({ nome: z.string().trim().min(2, 'Informe o nome do serviço').max(200), tipoServico }).parse(req.body);
      return reply.code(201).send(await criarServico(fastify.prisma, req.user.entityId!, req.user.sub, d.nome, d.tipoServico));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/cadastros/servicos-base', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await baseFicha(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/cadastros/servicos/:id', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await obterFicha(fastify.prisma, req.user.entityId!, id));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/cadastros/servicos/:id', { preHandler: podeServicos }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await salvarFicha(fastify.prisma, req.user.entityId!, req.user.sub, id, fichaSchema.parse(req.body)));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/cadastros/origens', { preHandler: podeServicos }, async (req, reply) => {
    try {
      const d = z.object({ origens: z.array(z.string().max(80)).max(40) }).parse(req.body);
      return reply.send(await salvarOrigens(fastify.prisma, req.user.entityId!, req.user.sub, d.origens));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.delete('/cadastros/servicos/:id', { preHandler: podeServicos }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      return reply.send(await excluirServico(fastify.prisma, req.user.entityId!, req.user.sub, id));
    } catch (e) { return handleAppError(reply, e); }
  });

  /* ── Fluxo e aprovações ── */
  fastify.get('/cadastros/fluxo', { preHandler: podeVer }, async (req, reply) => {
    try { return reply.send(await obterFluxo(fastify.prisma, req.user.entityId!)); }
    catch (e) { return handleAppError(reply, e); }
  });

  fastify.put('/cadastros/fluxo', { preHandler: podeFluxo }, async (req, reply) => {
    try {
      const passos = Object.keys(PASSOS_FLUXO) as [string, ...string[]];
      const d = z.object({
        config: z.object({
          exigeAprovacaoOS: z.boolean(),
          aprovacaoOrigens: z.array(z.enum(ORIGENS_OS)).max(3),
          exigeConferencia: z.boolean(),
          conferenciaPropriaBloqueada: z.boolean(),
          exigeRevisaoCompra: z.boolean(),
          exigeAprovacaoCompra: z.boolean(),
          pedidoSoDeOrcamento: z.boolean(),
          metaDias: z.number().int().min(1, 'Prazo mínimo de 1 dia').max(90, 'Prazo máximo de 90 dias'),
        }),
        passos: z.partialRecord(z.enum(passos), z.array(z.string().uuid()).max(500)),
      }).parse(req.body);
      return reply.send(await salvarFluxo(fastify.prisma, req.user.entityId!, req.user.sub, d));
    } catch (e) { return handleAppError(reply, e); }
  });
}
