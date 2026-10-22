import type { Prisma, PrismaClient } from '../../../generated/prisma/index.js';
import { pode, type QuemAge } from '../../shared/acessos.js';
import { filtroEscopoOS } from '../tenant/ordens/ordens.service.js';

/* ── Central de Solicitações · pedidos internos ────────────────────
   OS abertas no escritório ou em campo (fiscal / coordenador) que
   passam pelo crivo do responsável antes de ir para a equipe.
   O munícipe continua em central.service (pedido → vira OS).        */

const CAMPOS = ['Bairro / Localidade', 'Logradouro / Referência', 'Observações', 'Tipo de Serviço'] as const;

/** Só os serviços que a pessoa atende (administrador ou caixa "Ver todos os serviços" = todos) */
const filtroServicos = filtroEscopoOS;

/** Passou (ou está passando) pela Central: aguardando, aprovada pelo responsável ou recusada */
const PELA_CENTRAL: Prisma.RegistroDiarioWhereInput = {
  origem: { in: ['ESCRITORIO', 'CAMPO'] },
  OR: [{ etapa: 'AGUARDANDO_APROVACAO' }, { aprovadoEm: { not: null } }, { recusadoEm: { not: null } }],
};

export async function listarInternas(prisma: PrismaClient, entityId: string, ator: QuemAge & { id: string }) {
  const escopo = await filtroServicos(prisma, ator);
  const rows = await prisma.registroDiario.findMany({
    where: { entityId, ...escopo, ...PELA_CENTRAL },
    select: {
      id: true, numeroOS: true, origem: true, etapa: true, data: true, createdAt: true,
      lat: true, lng: true, enderecoGeocodificado: true, centroCustoId: true,
      aprovadoEm: true, recusadoEm: true, motivoRecusa: true, executadoEm: true, finalizadoEm: true,
      centroCusto: { select: { nome: true } },
      createdBy: { select: { name: true, role: { select: { code: true, name: true } } } },
      aprovadoPor: { select: { name: true } },
      recusadoPor: { select: { name: true } },
      valores: { where: { propriedade: { nome: { in: [...CAMPOS] } } }, select: { valorTexto: true, propriedade: { select: { nome: true } } } },
      midias: { where: { tipo: 'foto' }, select: { id: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  return rows.map(r => {
    const v = (nome: typeof CAMPOS[number]) => r.valores.find(x => x.propriedade.nome === nome)?.valorTexto?.trim() || null;
    const situacao = r.etapa === 'AGUARDANDO_APROVACAO' ? 'AGUARDANDO' : r.recusadoEm ? 'RECUSADO' : 'OS';
    return {
      id: r.id,
      numeroOS: r.numeroOS,
      origem: r.origem as 'ESCRITORIO' | 'CAMPO',
      etapa: r.etapa,
      situacao,
      centroCustoId: r.centroCustoId,
      servicoNome: r.centroCusto.nome,
      tipoServico: v('Tipo de Serviço'),
      bairro: v('Bairro / Localidade'),
      logradouro: v('Logradouro / Referência') ?? r.enderecoGeocodificado,
      descricao: v('Observações'),
      lat: r.lat, lng: r.lng,
      fotos: r.midias.map(m => m.id),
      autor: r.createdBy.name,
      autorPapel: r.createdBy.role.code,
      autorPerfil: r.createdBy.role.name,
      data: r.data.toISOString().slice(0, 10),
      createdAt: r.createdAt.toISOString(),
      analisadoEm: (r.recusadoEm ?? r.aprovadoEm)?.toISOString() ?? null,
      analisadoPor: (r.recusadoEm ? r.recusadoPor?.name : r.aprovadoPor?.name) ?? null,
      motivoRecusa: r.motivoRecusa,
      executadoEm: r.executadoEm?.toISOString() ?? null,
      finalizadoEm: r.finalizadoEm?.toISOString() ?? null,
    };
  });
}

/** Quanto está parado esperando análise (selo do menu) */
export async function contarPendentes(prisma: PrismaClient, entityId: string, ator: QuemAge & { id: string }) {
  const escopo = await filtroServicos(prisma, ator);
  const [municipe, internas] = await Promise.all([
    prisma.solicitacaoMunicipe.count({ where: { entityId, status: 'NOVA' } }),
    prisma.registroDiario.count({ where: { entityId, ...escopo, origem: { in: ['ESCRITORIO', 'CAMPO'] }, etapa: 'AGUARDANDO_APROVACAO' } }),
  ]);
  return { municipe, internas, novas: municipe + internas };
}

export function poderesCentral(ator: QuemAge) {
  return { podeTriar: pode(ator, 'os.triar'), podeAprovar: pode(ator, 'os.aprovar') };
}
