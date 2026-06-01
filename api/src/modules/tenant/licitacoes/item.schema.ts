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

export type ImportRowInput = z.infer<typeof importRowSchema>;

export interface ValidatedImportItem {
  line: number;
  categoria: string | null;
  descricao: string;
  unidadeMedida: string;
  quantidade: string | null;
  valorUnitario: string | null;
}

export interface ImportLineError {
  line: number;
  field: string;
  message: string;
}

/** Validates parsed import rows and returns normalized items or line errors */
export function validateImportRows(rows: ImportRowInput[]): {
  items: ValidatedImportItem[];
  lineErrors: ImportLineError[];
} {
  const items: ValidatedImportItem[] = [];
  const lineErrors: ImportLineError[] = [];

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

    let quantidade: string | null = null;
    if (row.quantidade?.trim()) {
      const parsed = parseDecimalValue(row.quantidade);
      if (parsed === null) {
        quantidade = null;
      } else if (Number.isNaN(parsed) || parsed < 0) {
        lineErrors.push({ line: row.line, field: 'quantidade', message: 'Quantidade invalida' });
        continue;
      } else {
        quantidade = parsed.toFixed(4);
      }
    }

    let valorUnitario: string | null = null;
    if (row.valor?.trim()) {
      const parsed = parseDecimalValue(row.valor);
      if (parsed === null) {
        valorUnitario = null;
      } else if (Number.isNaN(parsed) || parsed < 0) {
        lineErrors.push({ line: row.line, field: 'valor', message: 'Valor inválido' });
        continue;
      } else {
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
