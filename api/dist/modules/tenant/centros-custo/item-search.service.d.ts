import type { PrismaClient } from '../../../../generated/prisma/index.js';
/** Searches active licitacao items for linked licitacoes on a centro */
export declare function searchItensForCentro(prisma: PrismaClient, entityId: string, centroId: string, query: {
    q?: string;
    limit: number;
}): Promise<{
    items: {
        id: string;
        descricao: string;
        unidadeMedida: string;
        licitacaoIdentificacao: string;
    }[];
}>;
//# sourceMappingURL=item-search.service.d.ts.map