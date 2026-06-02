import { z } from 'zod';
import { PERMISSION_CENTROS_CUSTO_MANAGE, PERMISSION_CENTROS_CUSTO_PROPRIEDADES_MANAGE, PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT, PERMISSION_CENTROS_CUSTO_VIEW, } from '../../../shared/constants.js';
import { handleAppError } from '../../../shared/errors.js';
import { requireTenantAuth, requireTenantPermission, } from '../../../plugins/auth-tenant.js';
import { createCentroCustoSchema, propriedadesConfigSchema, setLicitacoesSchema, updateCentroCustoSchema, updateCentroCustoStatusSchema, } from './centro-custo.schema.js';
import { createCentroCusto, deactivateCentroCusto, getCentroCustoById, listCentrosCusto, setCentroCustoLicitacoes, setPropriedadesConfig, updateCentroCusto, } from './centro-custo.service.js';
import { searchItensForCentro } from './item-search.service.js';
import { getProducaoDiaria } from './production.service.js';
import { createPropriedadeSchema, updatePropriedadeSchema, } from './propriedade.schema.js';
import { createPropriedade, listPropriedades, updatePropriedade, } from './propriedade.service.js';
import { monthQuerySchema, upsertRegistroDiarioSchema, } from './registro-diario.schema.js';
import { createRegistroDiario, deleteRegistroDiario, listRegistrosDiarios, updateRegistroDiario, } from './registro-diario.service.js';
const listQuerySchema = z.object({
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const itemSearchQuerySchema = z.object({
    q: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
/** Registers centros de custo, propriedades and registro diario routes */
export async function registerCentroCustoRoutes(fastify) {
    const tenantAuth = requireTenantAuth(fastify.prisma);
    const canView = [
        tenantAuth,
        requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_VIEW),
    ];
    const canManage = [
        tenantAuth,
        requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_MANAGE),
    ];
    const canManagePropriedades = [
        tenantAuth,
        requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_PROPRIEDADES_MANAGE),
    ];
    const canEditRegistros = [
        tenantAuth,
        requireTenantPermission(fastify.prisma, PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT),
    ];
    fastify.get('/centros-custo', { preHandler: canView }, async (request, reply) => {
        try {
            const query = listQuerySchema.parse(request.query);
            const result = await listCentrosCusto(fastify.prisma, request.user.entityId, query);
            return reply.send(result);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.post('/centros-custo', { preHandler: canManage }, async (request, reply) => {
        try {
            const body = createCentroCustoSchema.parse(request.body);
            const centro = await createCentroCusto(fastify.prisma, request.user.sub, request.user.entityId, body);
            return reply.code(201).send(centro);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.get('/centros-custo/propriedades', { preHandler: canView }, async (request, reply) => {
        try {
            const result = await listPropriedades(fastify.prisma, request.user.entityId);
            return reply.send(result);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.post('/centros-custo/propriedades', { preHandler: canManagePropriedades }, async (request, reply) => {
        try {
            const body = createPropriedadeSchema.parse(request.body);
            const propriedade = await createPropriedade(fastify.prisma, request.user.sub, request.user.entityId, body);
            return reply.code(201).send(propriedade);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.patch('/centros-custo/propriedades/:id', { preHandler: canManagePropriedades }, async (request, reply) => {
        try {
            const { id } = request.params;
            const body = updatePropriedadeSchema.parse(request.body);
            const propriedade = await updatePropriedade(fastify.prisma, request.user.sub, request.user.entityId, id, body);
            return reply.send(propriedade);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.get('/centros-custo/:id', { preHandler: canView }, async (request, reply) => {
        try {
            const { id } = request.params;
            const centro = await getCentroCustoById(fastify.prisma, request.user.entityId, id);
            return reply.send(centro);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.patch('/centros-custo/:id', { preHandler: canManage }, async (request, reply) => {
        try {
            const { id } = request.params;
            const body = updateCentroCustoSchema.parse(request.body);
            const centro = await updateCentroCusto(fastify.prisma, request.user.sub, request.user.entityId, id, body);
            return reply.send(centro);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.patch('/centros-custo/:id/status', { preHandler: canManage }, async (request, reply) => {
        try {
            const { id } = request.params;
            updateCentroCustoStatusSchema.parse(request.body);
            const centro = await deactivateCentroCusto(fastify.prisma, request.user.sub, request.user.entityId, id);
            return reply.send(centro);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.put('/centros-custo/:id/licitacoes', { preHandler: canManage }, async (request, reply) => {
        try {
            const { id } = request.params;
            const body = setLicitacoesSchema.parse(request.body);
            const centro = await setCentroCustoLicitacoes(fastify.prisma, request.user.sub, request.user.entityId, id, body.licitacaoIds);
            return reply.send(centro);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.put('/centros-custo/:id/propriedades-config', { preHandler: canManage }, async (request, reply) => {
        try {
            const { id } = request.params;
            const body = propriedadesConfigSchema.parse(request.body);
            const centro = await setPropriedadesConfig(fastify.prisma, request.user.sub, request.user.entityId, id, body);
            return reply.send(centro);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.get('/centros-custo/:id/registros', { preHandler: canView }, async (request, reply) => {
        try {
            const { id } = request.params;
            const query = monthQuerySchema.parse(request.query);
            const result = await listRegistrosDiarios(fastify.prisma, request.user.entityId, id, query.year, query.month);
            return reply.send(result);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.post('/centros-custo/:id/registros', { preHandler: canEditRegistros }, async (request, reply) => {
        try {
            const { id } = request.params;
            const body = upsertRegistroDiarioSchema.parse(request.body);
            const row = await createRegistroDiario(fastify.prisma, request.user.sub, request.user.entityId, id, body);
            return reply.code(201).send(row);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.patch('/centros-custo/:id/registros/:registroId', { preHandler: canEditRegistros }, async (request, reply) => {
        try {
            const { id, registroId } = request.params;
            const body = upsertRegistroDiarioSchema.parse(request.body);
            const row = await updateRegistroDiario(fastify.prisma, request.user.sub, request.user.entityId, id, registroId, body);
            return reply.send(row);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.delete('/centros-custo/:id/registros/:registroId', { preHandler: canEditRegistros }, async (request, reply) => {
        try {
            const { id, registroId } = request.params;
            await deleteRegistroDiario(fastify.prisma, request.user.sub, request.user.entityId, id, registroId);
            return reply.code(204).send();
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.get('/centros-custo/:id/producao', { preHandler: canView }, async (request, reply) => {
        try {
            const { id } = request.params;
            const query = monthQuerySchema.parse(request.query);
            const result = await getProducaoDiaria(fastify.prisma, request.user.entityId, id, query.year, query.month);
            return reply.send(result);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    fastify.get('/centros-custo/:id/itens-busca', { preHandler: canView }, async (request, reply) => {
        try {
            const { id } = request.params;
            const query = itemSearchQuerySchema.parse(request.query);
            const result = await searchItensForCentro(fastify.prisma, request.user.entityId, id, { q: query.q, limit: query.limit });
            return reply.send(result);
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    /* ── GET /centros-custo/:id/analytics ─────────────────────────── */
    fastify.get('/centros-custo/:id/analytics', { preHandler: canView }, async (request, reply) => {
        try {
            const { id } = request.params;
            const query = monthQuerySchema.parse(request.query);
            const entityId = request.user.entityId;
            const now = new Date();
            const year = query.year ?? now.getFullYear();
            const month = query.month ?? (now.getMonth() + 1);
            /* usar UTC para evitar mismatch de timezone no filtro */
            const startDate = new Date(Date.UTC(year, month - 1, 1));
            const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
            const endDate = new Date(Date.UTC(year, month - 1, daysInMonth));
            /* todos os registros do período com seus valores */
            const registros = await fastify.prisma.registroDiario.findMany({
                where: { centroCustoId: id, entityId, data: { gte: startDate, lte: endDate } },
                select: {
                    id: true,
                    data: true,
                    valores: {
                        select: {
                            valorTexto: true,
                            valorDecimal: true,
                            propriedade: { select: { nome: true } },
                        },
                    },
                },
                orderBy: { data: 'asc' },
            });
            /* ── agregar por dia ── */
            const porDia = {};
            for (let d = 1; d <= daysInMonth; d++) {
                const key = String(d).padStart(2, '0');
                porDia[key] = { data: key, total: 0, concluidos: 0, area: 0 };
            }
            /* contadores */
            const porBairro = {};
            const porStatus = {};
            const porTipo = {};
            const porOrigem = {};
            const porEquipe = {};
            let totalArea = 0;
            let totalConcluidos = 0;
            registros.forEach(reg => {
                /* @db.Date + parseDateOnly usa Date.UTC → ISO sempre tem dia correto em UTC */
                const isoStr = reg.data instanceof Date ? reg.data.toISOString() : String(reg.data);
                const dia = isoStr.slice(8, 10);
                const valMap = {};
                reg.valores.forEach(v => {
                    if (v.valorTexto != null)
                        valMap[v.propriedade.nome] = v.valorTexto;
                    if (v.valorDecimal != null)
                        valMap[v.propriedade.nome] = Number(v.valorDecimal);
                });
                const status = String(valMap['Status'] ?? 'Aberta');
                const bairro = String(valMap['Bairro / Localidade'] ?? '');
                const tipo = String(valMap['Tipo de Serviço'] ?? valMap['Tipo de Resíduo'] ?? '');
                const origem = String(valMap['Origem da Demanda'] ?? '');
                const equipe = String(valMap['Equipe / Turma'] ?? '');
                const horas = Number(valMap['Horas Trabalhadas'] ?? valMap['Horas Trabalhadas Tapa'] ?? 0) || 0;
                /* tenta cada nome possível de campo de produção */
                const areaRaw = valMap['Área Roçada (m²)'] ??
                    valMap['Área Roçada (m²)'] ??
                    valMap['Área Executada (m²)'] ??
                    valMap['Área Executada (m²)'] ??
                    valMap['Volume Coletado (m³)'] ??
                    valMap['Volume Coletado (m³)'] ??
                    valMap['Área Pintada (m²)'] ??
                    valMap['Área Pintada (m²)'] ??
                    valMap['Extensão Executada (m)'] ??
                    valMap['Extensão Executada (m)'] ??
                    0;
                const area = Number(areaRaw) || 0;
                if (porDia[dia]) {
                    porDia[dia].total++;
                    porDia[dia].area += area;
                    if (status.toLowerCase().includes('conclu')) {
                        porDia[dia].concluidos++;
                        totalConcluidos++;
                    }
                }
                totalArea += area;
                if (bairro)
                    porBairro[bairro] = (porBairro[bairro] ?? 0) + 1;
                if (status)
                    porStatus[status] = (porStatus[status] ?? 0) + 1;
                if (tipo)
                    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
                if (origem)
                    porOrigem[origem] = (porOrigem[origem] ?? 0) + 1;
                if (equipe) {
                    const eq = porEquipe[equipe] ?? { registros: 0, area: 0, horas: 0 };
                    eq.registros++;
                    eq.area += area;
                    eq.horas += horas;
                    porEquipe[equipe] = eq;
                }
            });
            const toArr = (obj, limit = 10) => Object.entries(obj)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, limit);
            const equipeArr = Object.entries(porEquipe)
                .map(([name, v]) => ({ name, registros: v.registros, area: Math.round(v.area * 10) / 10, horas: Math.round(v.horas * 10) / 10 }))
                .sort((a, b) => b.registros - a.registros)
                .slice(0, 10);
            return reply.send({
                resumo: {
                    total: registros.length,
                    concluidos: totalConcluidos,
                    taxaConclusao: registros.length > 0 ? Math.round((totalConcluidos / registros.length) * 100) : 0,
                    totalArea: Math.round(totalArea * 10) / 10,
                },
                producaoDiaria: Object.values(porDia),
                porBairro: toArr(porBairro),
                porStatus: toArr(porStatus),
                porTipo: toArr(porTipo),
                porOrigem: toArr(porOrigem),
                porEquipe: equipeArr,
                year,
                month,
            });
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    /* ── GET /centros-custo/:id/metas/ano ──────────────────────────── */
    fastify.get('/centros-custo/:id/metas/ano', { preHandler: canView }, async (request, reply) => {
        try {
            const { id } = request.params;
            const entityId = request.user.entityId;
            const year = Number(request.query.year ?? new Date().getFullYear());
            const rows = await fastify.prisma.$queryRaw `
          SELECT month, meta_registros, meta_producao, meta_horas
          FROM metas_servico
          WHERE entity_id = ${entityId}
            AND centro_custo_id = ${id}
            AND year = ${year}
          ORDER BY month
        `;
            /* indexa por mês para facilitar no frontend */
            const byMonth = {};
            rows.forEach(r => {
                byMonth[Number(r.month)] = {
                    metaRegistros: r.meta_registros != null ? Number(r.meta_registros) : null,
                    metaProducao: r.meta_producao != null ? Number(r.meta_producao) : null,
                    metaHoras: r.meta_horas != null ? Number(r.meta_horas) : null,
                };
            });
            return reply.send({ year, metas: byMonth });
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    /* ── PUT /centros-custo/:id/metas/ano — salva múltiplos meses de uma vez ── */
    const metasAnoSchema = z.object({
        year: z.number().int().min(2000).max(2100),
        metas: z.record(z.coerce.number().int().min(1).max(12), z.object({
            metaRegistros: z.number().nonnegative().nullable().optional(),
            metaProducao: z.number().nonnegative().nullable().optional(),
            metaHoras: z.number().nonnegative().nullable().optional(),
        })),
    });
    fastify.put('/centros-custo/:id/metas/ano', { preHandler: canEditRegistros }, async (request, reply) => {
        try {
            const { id } = request.params;
            const entityId = request.user.entityId;
            const body = metasAnoSchema.parse(request.body);
            for (const [monthStr, meta] of Object.entries(body.metas)) {
                const month = Number(monthStr);
                await fastify.prisma.$executeRaw `
            INSERT INTO metas_servico
              (id, entity_id, centro_custo_id, year, month, meta_registros, meta_producao, meta_horas, updated_at)
            VALUES (
              gen_random_uuid()::text, ${entityId}, ${id},
              ${body.year}, ${month},
              ${meta.metaRegistros ?? null},
              ${meta.metaProducao ?? null},
              ${meta.metaHoras ?? null},
              now()
            )
            ON CONFLICT (entity_id, centro_custo_id, year, month)
            DO UPDATE SET
              meta_registros = EXCLUDED.meta_registros,
              meta_producao  = EXCLUDED.meta_producao,
              meta_horas     = EXCLUDED.meta_horas,
              updated_at     = now()
          `;
            }
            return reply.send({ ok: true });
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    /* ── GET /centros-custo/:id/metas ───────────────────────────────── */
    fastify.get('/centros-custo/:id/metas', { preHandler: canView }, async (request, reply) => {
        try {
            const { id } = request.params;
            const query = monthQuerySchema.parse(request.query);
            const entityId = request.user.entityId;
            const now = new Date();
            const year = query.year ?? now.getFullYear();
            const month = query.month ?? (now.getMonth() + 1);
            const meta = await fastify.prisma.$queryRaw `
          SELECT meta_registros, meta_producao, meta_horas
          FROM metas_servico
          WHERE entity_id = ${entityId}
            AND centro_custo_id = ${id}
            AND year = ${year}
            AND month = ${month}
          LIMIT 1
        `;
            const row = meta[0] ?? null;
            return reply.send({
                year, month,
                metaRegistros: row?.meta_registros != null ? Number(row.meta_registros) : null,
                metaProducao: row?.meta_producao != null ? Number(row.meta_producao) : null,
                metaHoras: row?.meta_horas != null ? Number(row.meta_horas) : null,
            });
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
    /* ── PUT /centros-custo/:id/metas ───────────────────────────────── */
    const metaSchema = z.object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
        metaRegistros: z.number().nonnegative().nullable().optional(),
        metaProducao: z.number().nonnegative().nullable().optional(),
        metaHoras: z.number().nonnegative().nullable().optional(),
    });
    fastify.put('/centros-custo/:id/metas', { preHandler: canEditRegistros }, async (request, reply) => {
        try {
            const { id } = request.params;
            const entityId = request.user.entityId;
            const body = metaSchema.parse(request.body);
            await fastify.prisma.$executeRaw `
          INSERT INTO metas_servico
            (id, entity_id, centro_custo_id, year, month, meta_registros, meta_producao, meta_horas, updated_at)
          VALUES (
            gen_random_uuid()::text, ${entityId}, ${id},
            ${body.year}, ${body.month},
            ${body.metaRegistros ?? null},
            ${body.metaProducao ?? null},
            ${body.metaHoras ?? null},
            now()
          )
          ON CONFLICT (entity_id, centro_custo_id, year, month)
          DO UPDATE SET
            meta_registros = EXCLUDED.meta_registros,
            meta_producao  = EXCLUDED.meta_producao,
            meta_horas     = EXCLUDED.meta_horas,
            updated_at     = now()
        `;
            return reply.send({ ok: true });
        }
        catch (error) {
            return handleAppError(reply, error);
        }
    });
}
//# sourceMappingURL=centro-custo.routes.js.map