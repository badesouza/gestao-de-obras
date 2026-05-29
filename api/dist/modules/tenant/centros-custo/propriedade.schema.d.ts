import { z } from 'zod';
export declare const createPropriedadeSchema: z.ZodObject<{
    nome: z.ZodString;
    tipo: z.ZodEnum<{
        TEXTO: "TEXTO";
        DATA: "DATA";
        VALOR: "VALOR";
        BOOLEAN: "BOOLEAN";
        ITEM_LICITACAO: "ITEM_LICITACAO";
        ITENS_LICITACAO: "ITENS_LICITACAO";
    }>;
}, z.core.$strip>;
export declare const updatePropriedadeSchema: z.ZodObject<{
    nome: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodLiteral<"INACTIVE">>;
}, z.core.$strip>;
export type CreatePropriedadeRequest = z.infer<typeof createPropriedadeSchema>;
export type UpdatePropriedadeRequest = z.infer<typeof updatePropriedadeSchema>;
//# sourceMappingURL=propriedade.schema.d.ts.map