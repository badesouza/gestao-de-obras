import type { LicitacaoStatus, PrismaClient } from '../../../../generated/prisma/index.js';
interface UserRef {
    id: string;
    name: string;
}
export interface LicitacaoItemDto {
    id: string;
    licitacaoId: string;
    categoria: string | null;
    descricao: string;
    unidadeMedida: string;
    valorUnitario: string | null;
    status: LicitacaoStatus;
    createdAt: string;
    createdBy: UserRef;
}
/** Lists items for a licitacao */
export declare function listLicitacaoItems(prisma: PrismaClient, entityId: string, licitacaoId: string, query: {
    search?: string;
    categoria?: string;
    includeInactive?: boolean;
    page: number;
    pageSize: number;
}): Promise<{
    items: LicitacaoItemDto[];
    total: number;
    page: number;
    pageSize: number;
}>;
/** Imports items from spreadsheet buffer */
export declare function importItemsFromSpreadsheet(prisma: PrismaClient, actorId: string, entityId: string, licitacaoId: string, buffer: Buffer, filename: string): Promise<{
    importedCount: number;
    licitacaoId: string;
}>;
/** Imports items from column textareas */
export declare function importItemsFromColumns(prisma: PrismaClient, actorId: string, entityId: string, licitacaoId: string, columns: Partial<Record<'categoria' | 'descricao' | 'unidade' | 'valor', string>>): Promise<{
    importedCount: number;
    licitacaoId: string;
}>;
/** Deactivates a licitacao item (idempotent) */
export declare function deactivateLicitacaoItem(prisma: PrismaClient, actorId: string, entityId: string, licitacaoId: string, itemId: string): Promise<LicitacaoItemDto>;
export {};
//# sourceMappingURL=item.service.d.ts.map