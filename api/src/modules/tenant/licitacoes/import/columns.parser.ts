export type ImportColumnKey = 'categoria' | 'descricao' | 'unidade' | 'valor';

export interface ParsedImportRow {
  line: number;
  categoria: string | null;
  descricao: string;
  unidade: string;
  valor: string | null;
}

export interface ColumnLineCounts {
  name: ImportColumnKey;
  lineCount: number;
}

/** Splits textarea content into non-empty lines, ignoring trailing blank lines */
export function splitColumnLines(content: string | undefined): string[] {
  if (!content) return [];
  const lines = content.split(/\r?\n/).map((line) => line.trim());

  let end = lines.length;
  while (end > 0 && lines[end - 1] === '') {
    end -= 1;
  }
  return lines.slice(0, end);
}

/** Returns true when optional column has at least one non-empty line */
export function isColumnUsed(lines: string[]): boolean {
  return lines.some((line) => line.length > 0);
}

/** Validates line parity across used columns and builds aligned rows */
export function parseColumnsInput(columns: Partial<Record<ImportColumnKey, string>>): {
  rows: ParsedImportRow[];
  mismatch?: ColumnLineCounts[];
} {
  const descricaoLines = splitColumnLines(columns.descricao);
  const unidadeLines = splitColumnLines(columns.unidade);
  const categoriaLines = splitColumnLines(columns.categoria);
  const valorLines = splitColumnLines(columns.valor);

  if (descricaoLines.length === 0 || unidadeLines.length === 0) {
    return { rows: [] };
  }

  const usedColumns: Array<{ name: ImportColumnKey; lines: string[] }> = [
    { name: 'descricao', lines: descricaoLines },
    { name: 'unidade', lines: unidadeLines },
  ];

  if (isColumnUsed(categoriaLines)) {
    usedColumns.push({ name: 'categoria', lines: categoriaLines });
  }
  if (isColumnUsed(valorLines)) {
    usedColumns.push({ name: 'valor', lines: valorLines });
  }

  const counts = usedColumns.map((col) => ({
    name: col.name,
    lineCount: col.lines.length,
  }));
  const expectedCount = counts[0]?.lineCount ?? 0;
  const mismatch = counts.filter((col) => col.lineCount !== expectedCount);

  if (mismatch.length > 0) {
    return { rows: [], mismatch: counts };
  }

  const rows: ParsedImportRow[] = [];
  for (let i = 0; i < expectedCount; i += 1) {
    rows.push({
      line: i + 1,
      categoria: isColumnUsed(categoriaLines) ? (categoriaLines[i] ?? '') : null,
      descricao: descricaoLines[i] ?? '',
      unidade: unidadeLines[i] ?? '',
      valor: isColumnUsed(valorLines) ? (valorLines[i] ?? '') : null,
    });
  }

  return { rows };
}
