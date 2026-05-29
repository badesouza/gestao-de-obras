import { z } from 'zod';
export declare const importRowSchema: z.ZodObject<{
    line: z.ZodNumber;
    categoria: z.ZodNullable<z.ZodString>;
    descricao: z.ZodString;
    unidade: z.ZodString;
    valor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ImportRowInput = z.infer<typeof importRowSchema>;
export interface ValidatedImportItem {
    line: number;
    categoria: string | null;
    descricao: string;
    unidadeMedida: string;
    valorUnitario: string | null;
}
export interface ImportLineError {
    line: number;
    field: string;
    message: string;
}
/** Validates parsed import rows and returns normalized items or line errors */
export declare function validateImportRows(rows: ImportRowInput[]): {
    items: ValidatedImportItem[];
    lineErrors: ImportLineError[];
};
export declare const importColumnsRequestSchema: z.ZodObject<{
    columns: z.ZodObject<{
        categoria: z.ZodOptional<z.ZodString>;
        descricao: z.ZodOptional<z.ZodString>;
        unidade: z.ZodOptional<z.ZodString>;
        valor: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=item.schema.d.ts.map