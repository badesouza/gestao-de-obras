import * as XLSX from 'xlsx';
import { mapHeaderToField } from './header-normalizer.js';
import type { ParsedImportRow } from './columns.parser.js';

/** Parses CSV or XLSX buffer into normalized import rows */
export function parseSpreadsheetBuffer(
  buffer: Buffer,
  filename: string,
): ParsedImportRow[] {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    codepage: isCsv ? 65001 : undefined,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (matrix.length === 0) return [];

  const headerRow = matrix[0]?.map((cell) => String(cell ?? '')) ?? [];
  const fieldIndexes: Partial<Record<'categoria' | 'descricao' | 'unidade' | 'quantidade' | 'valor', number>> = {};

  for (let i = 0; i < headerRow.length; i += 1) {
    const field = mapHeaderToField(headerRow[i] ?? '');
    if (field && fieldIndexes[field] === undefined) {
      fieldIndexes[field] = i;
    }
  }

  if (fieldIndexes.descricao === undefined || fieldIndexes.unidade === undefined) {
    return [];
  }

  const rows: ParsedImportRow[] = [];
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const allEmpty = row.every((cell) => String(cell ?? '').trim() === '');
    if (allEmpty) continue;

    const getCell = (field: keyof typeof fieldIndexes): string => {
      const index = fieldIndexes[field];
      if (index === undefined) return '';
      return String(row[index] ?? '').trim();
    };

    rows.push({
      line: rowIndex + 1,
      categoria: fieldIndexes.categoria !== undefined ? getCell('categoria') || null : null,
      descricao: getCell('descricao'),
      unidade: getCell('unidade'),
      quantidade: fieldIndexes.quantidade !== undefined ? getCell('quantidade') || null : null,
      valor: fieldIndexes.valor !== undefined ? getCell('valor') || null : null,
    });
  }

  return rows;
}
