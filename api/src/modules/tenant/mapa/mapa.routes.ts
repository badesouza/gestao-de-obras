import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleAppError } from '../../../shared/errors.js';
import { requireTenantAuth } from '../../../plugins/auth-tenant.js';
import { registrarEnderecoDescoberto } from '../enderecos/endereco-descoberto.service.js';

const geocodeQuerySchema = z.object({
  q: z.string().min(1),
});

const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
});

const mapaQuerySchema = z.object({
  year:  z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  centroCustoId: z.string().uuid().optional(),
});

const salvarCoordsSchema = z.object({
  registroId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  enderecoGeocodificado: z.string().optional(),
});

export async function registerMapaRoutes(fastify: FastifyInstance) {
  const tenantAuth = requireTenantAuth(fastify.prisma);

  /* ── GET /mapa/geocode?q=endereco ─────────────────────────────── */
  fastify.get('/mapa/geocode', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { q } = geocodeQuerySchema.parse(req.query);

      const url = `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q,
          format: 'json',
          limit: '5',
          countrycodes: 'br',
          addressdetails: '1',
        });

      const res = await fetch(url, {
        headers: { 'User-Agent': 'GestaoObrasItaberaba/1.0 (admin@prefeitura.gov.br)' },
      });

      if (!res.ok) {
        return reply.status(502).send({ error: 'Erro ao consultar geocodificação' });
      }

      const data = await res.json() as Array<{
        lat: string;
        lon: string;
        display_name: string;
        importance: number;
      }>;

      const results = data.map(r => ({
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        label: r.display_name,
        importance: r.importance,
      }));

      return reply.send({ results });
    } catch (e) {
      return handleAppError(reply, e);
    }
  });

  /* ── GET /mapa/reverse?lat=&lng= ─────────────────────────────── */
  fastify.get('/mapa/reverse', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { lat, lng } = reverseGeocodeQuerySchema.parse(req.query);

      const url = `https://nominatim.openstreetmap.org/reverse?` +
        new URLSearchParams({
          lat: String(lat),
          lon: String(lng),
          format: 'json',
          addressdetails: '1',
          'accept-language': 'pt-BR',
        });

      const res = await fetch(url, {
        headers: { 'User-Agent': 'GestaoObras/1.0 (contato@sistema.gov.br)' },
      });

      if (!res.ok) {
        return reply.status(502).send({ error: 'Erro ao consultar geocodificação reversa' });
      }

      const data = await res.json() as {
        display_name: string;
        address: {
          road?: string;
          suburb?: string;
          neighbourhood?: string;
          city_district?: string;
          quarter?: string;
          village?: string;
          town?: string;
          city?: string;
        };
      };

      const addr = data.address ?? {};
      const logradouro = addr.road ?? null;
      const bairro = addr.suburb ?? addr.neighbourhood ?? addr.city_district ?? addr.quarter ?? null;

      return reply.send({
        label: data.display_name,
        logradouro,
        bairro,
      });
    } catch (e) {
      return handleAppError(reply, e);
    }
  });

  /* ── GET /mapa/bairro-mais-proximo?lat=&lng= ─────────────────── */
  fastify.get('/mapa/bairro-mais-proximo', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { lat, lng } = reverseGeocodeQuerySchema.parse(req.query);
      const entityId = req.user.entityId!;

      const bairros = await fastify.prisma.cadastroAuxiliar.findMany({
        where: { entityId, tipo: 'BAIRRO', ativo: true, lat: { not: null }, lng: { not: null } },
        select: { id: true, nome: true, lat: true, lng: true },
      });

      if (bairros.length === 0) return reply.send({ bairro: null, distancia: null });

      /* distância haversine em metros */
      const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
          Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      };

      let melhor = { nome: '', distancia: Infinity };
      for (const b of bairros) {
        const dist = haversine(lat, lng, b.lat!, b.lng!);
        if (dist < melhor.distancia) melhor = { nome: b.nome, distancia: dist };
      }

      /* só retorna se estiver dentro de 5km */
      const RAIO_MAX = 5000;
      if (melhor.distancia > RAIO_MAX) return reply.send({ bairro: null, distancia: melhor.distancia });

      return reply.send({ bairro: melhor.nome, distancia: Math.round(melhor.distancia) });
    } catch (e) { return handleAppError(reply, e); }
  });

  /* ── PATCH /mapa/registros/:id/coords ─────────────────────────── */
  fastify.patch('/mapa/registros/:id/coords', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const body = salvarCoordsSchema.omit({ registroId: true }).parse(req.body);

      const entityId = req.user.entityId!;

      const registro = await fastify.prisma.registroDiario.findFirst({
        where: { id, entityId },
        include: {
          valores: {
            where: {
              propriedade: { nome: { in: ['Bairro / Localidade', 'Logradouro / Referência'] } },
            },
            select: {
              valorTexto: true,
              propriedade: { select: { nome: true } },
            },
          },
        },
      });
      if (!registro) return reply.status(404).send({ error: 'Registro não encontrado' });

      const updated = await fastify.prisma.registroDiario.update({
        where: { id },
        data: {
          lat: body.lat,
          lng: body.lng,
          enderecoGeocodificado: body.enderecoGeocodificado,
        },
      });

      /* Mapear bairro e logradouro dos valores do registro */
      const valMap: Record<string, string> = {};
      registro.valores.forEach(v => {
        if (v.valorTexto) valMap[v.propriedade.nome] = v.valorTexto;
      });
      const bairro     = valMap['Bairro / Localidade'] ?? '';
      const logradouro = valMap['Logradouro / Referência'] ?? '';

      /* Gravar endereço descoberto de forma assíncrona — não bloqueia resposta */
      if (bairro && logradouro) {
        void registrarEnderecoDescoberto(fastify.prisma, {
          entityId,
          bairro,
          logradouro,
          lat: body.lat,
          lng: body.lng,
        });
      }

      return reply.send({ id: updated.id, lat: updated.lat, lng: updated.lng });
    } catch (e) {
      return handleAppError(reply, e);
    }
  });

  /* ── GET /mapa/pins?year=&month=&centroCustoId= ───────────────── */
  fastify.get('/mapa/pins', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const query = mapaQuerySchema.parse(req.query);
      const entityId = req.user.entityId!;

      const now = new Date();
      const year  = query.year  ?? now.getFullYear();
      const month = query.month ?? (now.getMonth() + 1);

      const startDate = new Date(year, month - 1, 1);
      const endDate   = new Date(year, month, 0);

      const registros = await fastify.prisma.registroDiario.findMany({
        where: {
          entityId,
          lat: { not: null },
          lng: { not: null },
          data: { gte: startDate, lte: endDate },
          ...(query.centroCustoId ? { centroCustoId: query.centroCustoId } : {}),
        },
        select: {
          id: true,
          data: true,
          lat: true,
          lng: true,
          enderecoGeocodificado: true,
          centroCusto: { select: { id: true, nome: true } },
          valores: {
            where: {
              propriedade: { nome: { in: ['Status', 'Bairro / Localidade', 'Logradouro / Referência', 'Tipo de Serviço'] } },
            },
            select: {
              valorTexto: true,
              propriedade: { select: { nome: true } },
            },
          },
        },
        orderBy: { data: 'desc' },
        take: 500,
      });

      const pins = registros.map(r => {
        const valMap: Record<string, string> = {};
        r.valores.forEach(v => {
          if (v.valorTexto) valMap[v.propriedade.nome] = v.valorTexto;
        });
        return {
          id: r.id,
          lat: r.lat!,
          lng: r.lng!,
          data: r.data.toISOString().slice(0, 10),
          endereco: r.enderecoGeocodificado,
          centroCusto: r.centroCusto,
          status: valMap['Status'] ?? '',
          bairro: valMap['Bairro / Localidade'] ?? '',
          logradouro: valMap['Logradouro / Referência'] ?? '',
          tipoServico: valMap['Tipo de Serviço'] ?? '',
        };
      });

      return reply.send({ pins, year, month });
    } catch (e) {
      return handleAppError(reply, e);
    }
  });

  /* ── POST /mapa/registros/:id/midias ─── upload de foto/vídeo ─── */
  fastify.post('/mapa/registros/:id/midias', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const entityId = req.user.entityId!;

      const registro = await fastify.prisma.registroDiario.findFirst({
        where: { id, entityId }, select: { id: true },
      });
      if (!registro) return reply.status(404).send({ error: 'Registro não encontrado' });

      const data = await req.file();
      if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

      const mime = data.mimetype;
      const tipo = mime.startsWith('video/') ? 'video' : 'foto';
      const buffer = await data.toBuffer();
      const MAX = tipo === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (buffer.length > MAX) return reply.status(413).send({ error: `Arquivo muito grande (max ${MAX / 1024 / 1024}MB)` });

      const midia = await fastify.prisma.registroMidia.create({
        data: { registroDiarioId: id, entityId, tipo, nomeArquivo: data.filename || `upload.${tipo === 'video' ? 'mp4' : 'jpg'}`, mimeType: mime, tamanhoBytes: buffer.length, dados: buffer as unknown as Uint8Array<ArrayBuffer> },
        select: { id: true, tipo: true, nomeArquivo: true, mimeType: true, tamanhoBytes: true, createdAt: true },
      });
      return reply.status(201).send(midia);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* ── GET /mapa/registros/:id/midias ── */
  fastify.get('/mapa/registros/:id/midias', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const entityId = req.user.entityId!;
      const midias = await fastify.prisma.registroMidia.findMany({
        where: { registroDiarioId: id, entityId },
        select: { id: true, tipo: true, nomeArquivo: true, mimeType: true, tamanhoBytes: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      return reply.send({ midias });
    } catch (e) { return handleAppError(reply, e); }
  });

  /* ── GET /mapa/midias/:midiaId ─── servir arquivo ── */
  fastify.get('/mapa/midias/:midiaId', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { midiaId } = req.params as { midiaId: string };
      const entityId = req.user.entityId!;
      const midia = await fastify.prisma.registroMidia.findFirst({
        where: { id: midiaId, entityId },
        select: { dados: true, mimeType: true, nomeArquivo: true },
      });
      if (!midia) return reply.status(404).send({ error: 'Mídia não encontrada' });
      return reply
        .header('Content-Type', midia.mimeType)
        .header('Content-Disposition', `inline; filename="${midia.nomeArquivo}"`)
        .header('Cache-Control', 'private, max-age=86400')
        .send(midia.dados);
    } catch (e) { return handleAppError(reply, e); }
  });

  /* ── DELETE /mapa/midias/:midiaId ── */
  fastify.delete('/mapa/midias/:midiaId', { preHandler: [tenantAuth] }, async (req, reply) => {
    try {
      const { midiaId } = req.params as { midiaId: string };
      const entityId = req.user.entityId!;
      const midia = await fastify.prisma.registroMidia.findFirst({
        where: { id: midiaId, entityId }, select: { id: true },
      });
      if (!midia) return reply.status(404).send({ error: 'Mídia não encontrada' });
      await fastify.prisma.registroMidia.delete({ where: { id: midiaId } });
      return reply.status(204).send();
    } catch (e) { return handleAppError(reply, e); }
  });
}
