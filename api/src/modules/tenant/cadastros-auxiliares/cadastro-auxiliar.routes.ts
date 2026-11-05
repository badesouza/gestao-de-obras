import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import { requireTela, requireTenantAuth } from '../../../plugins/auth-tenant.js';
import { PERMISSION_CENTROS_CUSTO_MANAGE, PERMISSION_CENTROS_CUSTO_VIEW } from '../../../shared/constants.js';
import {
  listCadastros,
  createCadastro,
  updateCadastro,
  deleteCadastro,
  saveBairroCoords,
  listBairrosComCoords,
  type CadastroTipo,
} from './cadastro-auxiliar.service.js';

const TIPOS_VALIDOS = ['BAIRRO', 'EQUIPE', 'VEICULO', 'EQUIPAMENTO', 'MACROZONA'] as const;

const createSchema = z.object({
  tipo: z.enum(TIPOS_VALIDOS),
  nome: z.string().min(1).max(150),
});

const updateSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
  macrozonaId: z.string().uuid().nullable().optional(),
});

const listQuerySchema = z.object({
  tipo: z.enum(TIPOS_VALIDOS).optional(),
});

export async function registerCadastroAuxiliarRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  /* Cinturão (linha 5): a regra do menu da tela que usa cada rota, conferida no servidor.
     Modo observação: quem seria barrado só vai para o log até OBRAS_BLOQUEAR_TELAS=true. */
  /* listas de bairros/equipes: abrir OS, Central de Solicitações, Orçamentos (menu: centros_custo.view) */
  const podeVer = [tenantAuth, requireTela(fastify.prisma, 'Cadastros auxiliares (ver)', PERMISSION_CENTROS_CUSTO_VIEW)];
  /* gravar: tela antiga Cadastros Auxiliares (fora do menu) = passos de Cadastros (Lugares, Veículos…) */
  const podeGerir = [tenantAuth, requireTela(fastify.prisma, 'Cadastros auxiliares (gravar)', PERMISSION_CENTROS_CUSTO_MANAGE)];

  /* GET /cadastros-auxiliares?tipo=BAIRRO */
  fastify.get('/cadastros-auxiliares', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { tipo } = listQuerySchema.parse(req.query);
      const result = await listCadastros(
        fastify.prisma,
        req.user.entityId!,
        tipo as CadastroTipo | undefined,
      );
      return reply.send(result);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* POST /cadastros-auxiliares */
  fastify.post('/cadastros-auxiliares', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const body = createSchema.parse(req.body);
      const item = await createCadastro(fastify.prisma, req.user.entityId!, body);
      return reply.status(201).send(item);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* PATCH /cadastros-auxiliares/:id */
  fastify.patch('/cadastros-auxiliares/:id', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = updateSchema.parse(req.body);
      const item = await updateCadastro(fastify.prisma, req.user.entityId!, id, body);
      return reply.send(item);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* DELETE /cadastros-auxiliares/:id */
  fastify.delete('/cadastros-auxiliares/:id', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      await deleteCadastro(fastify.prisma, req.user.entityId!, id);
      return reply.status(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });

  /* GET /cadastros-auxiliares/bairros-coords — lista bairros com lat/lng */
  fastify.get('/cadastros-auxiliares/bairros-coords', { preHandler: podeVer }, async (req, reply) => {
    try {
      const result = await listBairrosComCoords(fastify.prisma, req.user.entityId!);
      return reply.send(result);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* PATCH /cadastros-auxiliares/:id/coords — salva lat/lng de um bairro */
  fastify.patch('/cadastros-auxiliares/:id/coords', { preHandler: podeGerir }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { lat, lng } = z.object({
        lat: z.number(),
        lng: z.number(),
      }).parse(req.body);
      const item = await saveBairroCoords(fastify.prisma, req.user.entityId!, id, lat, lng);
      return reply.send(item);
    } catch (e) { return handleAppError(reply, e); }
  });
}
