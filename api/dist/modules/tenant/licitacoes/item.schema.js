import { z } from 'zod';
import { parseDecimalValue } from './import/value.parser.js';
export const importRowSchema = z.object({
    line: z.number().int().positive(),
    categoria: z.string().max(100).nullable(),
    descricao: z.string().min(1, 'Descrição é obrigatória').max(500),
    unidade: z.string().min(1, 'Unidade é obrigatória').max(50),
    quantidade: z.string().nullable(),
    valor: z.string().nullable(),
});
/** Validates parsed import rows and returns normalized items or line errors */
export function validateImportRows(rows) {
    const items = [];
    const lineErrors = [];
    for (const row of rows) {
        const descricao = row.descricao.trim();
        const unidade = row.unidade.trim();
        const categoria = row.categoria?.trim() || null;
        if (!descricao) {
            lineErrors.push({ line: row.line, field: 'descricao', message: 'Descrição é obrigatória' });
            continue;
        }
        if (!unidade) {
            lineErrors.push({ line: row.line, field: 'unidade', message: 'Unidade é obrigatória' });
            continue;
        }
        if (categoria && categoria.length > 100) {
            lineErrors.push({ line: row.line, field: 'categoria', message: 'Categoria excede 100 caracteres' });
            continue;
        }
        let quantidade = null;
        if (row.quantidade?.trim()) {
            const parsed = parseDecimalValue(row.quantidade);
            if (parsed === null) {
                quantidade = null;
            }
            else if (Number.isNaN(parsed) || parsed < 0) {
                lineErrors.push({ line: row.line, field: 'quantidade', message: 'Quantidade invalida' });
                continue;
            }
            else {
                quantidade = parsed.toFixed(4);
            }
        }
        let valorUnitario = null;
        if (row.valor?.trim()) {
            const parsed = parseDecimalValue(row.valor);
            if (parsed === null) {
                valorUnitario = null;
            }
            else if (Number.isNaN(parsed) || parsed < 0) {
                lineErrors.push({ line: row.line, field: 'valor', message: 'Valor inválido' });
                continue;
            }
            else {
                valorUnitario = parsed.toFixed(4);
            }
        }
        items.push({
            line: row.line,
            categoria,
            descricao,
            unidadeMedida: unidade,
            quantidade,
            valorUnitario,
        });
    }
    return { items, lineErrors };
}
export const importColumnsRequestSchema = z.object({
    columns: z.object({
        categoria: z.string().optional(),
        descricao: z.string().optional(),
        unidade: z.string().optional(),
        quantidade: z.string().optional(),
        valor: z.string().optional(),
    }),
});
//# sourceMappingURL=item.schema.js.map