import { servicosParaMunicipe } from '../tenant/cadastros-base/servicos-ficha.service.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError, handleAppError } from '../../shared/errors.js';
import { PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT, PERMISSION_CENTROS_CUSTO_VIEW } from '../../shared/constants.js';
import { requireTenantAuth, requireTenantPermission } from '../../plugins/auth-tenant.js';
import {
  consultarSolicitacao, converterEmOcorrencia, criarSolicitacao, lerFoto, listarBairros,
  listarSolicitacoes, novaSolicitacaoSchema, recusarSolicitacao, type FotoRecebida,
} from './central.service.js';

const MAX_FOTOS = 4;
const TIPOS_FOTO = new Set(['image/jpeg', 'image/png', 'image/webp']);

/* limite simples contra abuso: 6 pedidos a cada 15 min por IP */
const JANELA_MS = 15 * 60_000;
const LIMITE = 6;
const envios = new Map<string, number[]>();
function dentroDoLimite(ip: string) {
  const agora = Date.now();
  const lista = (envios.get(ip) ?? []).filter(t => agora - t < JANELA_MS);
  if (lista.length >= LIMITE) { envios.set(ip, lista); return false; }
  lista.push(agora);
  envios.set(ip, lista);
  if (envios.size > 5000) for (const [k, v] of envios) if (v.every(t => agora - t >= JANELA_MS)) envios.delete(k);
  return true;
}

/** Valida e devolve a primeira mensagem de erro de forma legível (400, não 500) */
function validar<T>(schema: z.ZodType<T>, dados: unknown): T {
  const r = schema.safeParse(dados);
  if (!r.success) {
    const p = r.error.issues[0];
    throw new AppError(400, 'VALIDATION_ERROR', p?.message ?? 'Dados inválidos', { campo: p?.path.join('.') });
  }
  return r.data;
}

const ipDe = (req: FastifyRequest) => (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;

/** Rotas públicas — o munícipe usa sem login (link / QR Code) */
export async function registerCentralPublicRoutes(fastify: FastifyInstance) {
  fastify.get('/tenants/:id/central', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const entity = await fastify.prisma.entity.findUnique({
        where: { id },
        select: { id: true, name: true, status: true, municipalityName: true, uf: true, coatOfArmsUrl: true },
      });
      if (!entity || entity.status !== 'ACTIVE') throw new AppError(404, 'NOT_FOUND', 'Prefeitura não encontrada');
      const [bairros, servicos] = await Promise.all([listarBairros(fastify.prisma, id), servicosParaMunicipe(fastify.prisma, id)]);
      return reply.send({
        entidade: { id: entity.id, nome: entity.name, municipio: entity.municipalityName, uf: entity.uf, brasaoUrl: entity.coatOfArmsUrl },
        bairros,
        servicos,
      });
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/tenants/:id/solicitacoes', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const ip = ipDe(req);
      if (!dentroDoLimite(`${id}:${ip}`)) {
        throw new AppError(429, 'TOO_MANY_REQUESTS', 'Muitos pedidos seguidos. Tente de novo em alguns minutos.');
      }
      let dadosBrutos: string | null = null;
      const fotos: FotoRecebida[] = [];
      for await (const parte of req.parts()) {
        if (parte.type === 'file') {
          if (!TIPOS_FOTO.has(parte.mimetype)) { await parte.toBuffer(); continue; }
          const buf = await parte.toBuffer();
          if (fotos.length < MAX_FOTOS) fotos.push({ mimeType: parte.mimetype, dados: buf });
        } else if (parte.fieldname === 'dados') {
          dadosBrutos = String(parte.value);
        }
      }
      if (!dadosBrutos) throw new AppError(400, 'VALIDATION_ERROR', 'Dados do pedido ausentes');
      let json: unknown;
      try { json = JSON.parse(dadosBrutos); } catch { throw new AppError(400, 'VALIDATION_ERROR', 'Dados do pedido inválidos'); }
      const entrada = validar(novaSolicitacaoSchema, json);
      const r = await criarSolicitacao(fastify.prisma, id, entrada, fotos, ip);
      return reply.code(201).send(r);
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/tenants/:id/solicitacoes/:protocolo', async (req, reply) => {
    try {
      const { id, protocolo } = req.params as { id: string; protocolo: string };
      const { telefone } = validar(z.object({ telefone: z.string().min(8, 'Informe o telefone') }), req.query);
      return reply.send(await consultarSolicitacao(fastify.prisma, id, protocolo, telefone));
    } catch (e) { return handleAppError(reply, e); }
  });
}

/** Rotas internas — a equipe analisa os pedidos */
export async function registerCentralTenantRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);
  const podeVer = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_VIEW)];
  const podeEditar = [tenantAuth, requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT)];

  fastify.get('/central-municipe', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { status } = validar(z.object({ status: z.enum(['NOVA', 'CONVERTIDA', 'RECUSADA']).optional() }), req.query);
      return reply.send(await listarSolicitacoes(fastify.prisma, req.user.entityId!, status));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/central-municipe/resumo', { preHandler: podeVer }, async (req, reply) => {
    try {
      const novas = await fastify.prisma.solicitacaoMunicipe.count({ where: { entityId: req.user.entityId!, status: 'NOVA' } });
      return reply.send({ novas });
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.get('/central-municipe/fotos/:fotoId', { preHandler: podeVer }, async (req, reply) => {
    try {
      const { fotoId } = req.params as { fotoId: string };
      const f = await lerFoto(fastify.prisma, req.user.entityId!, fotoId);
      return reply.header('Content-Type', f.mimeType).header('Cache-Control', 'private, max-age=86400').send(f.dados);
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/central-municipe/:id/converter', { preHandler: podeEditar }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { centroCustoId } = validar(z.object({ centroCustoId: z.string().uuid('Escolha o serviço') }), req.body);
      return reply.send(await converterEmOcorrencia(fastify.prisma, req.user.entityId!, req.user.sub, id, centroCustoId));
    } catch (e) { return handleAppError(reply, e); }
  });

  fastify.post('/central-municipe/:id/recusar', { preHandler: podeEditar }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { motivo } = validar(z.object({ motivo: z.string().trim().min(5, 'Explique o motivo').max(1000) }), req.body);
      await recusarSolicitacao(fastify.prisma, req.user.entityId!, req.user.sub, id, motivo);
      return reply.code(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });
}
