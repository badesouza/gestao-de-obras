export type ImportColumnKey = 'categoria' | 'descricao' | 'unidade' | 'quantidade' | 'valor';
export interface ParsedImportRow {
    line: number;
    categoria: string | null;
    descricao: string;
    unidade: string;
    quantidade: string | null;
    valor: string | null;
}
export interface ColumnLineCounts {
    name: ImportColumnKey;
    lineCount: number;
}
/** Splits textarea content into non-empty lines, ignoring trailing blank lines */
export declare function splitColumnLines(content: string | undefined): string[];
/** Returns true when optional column has at least one non-empty line */
export declare function isColumnUsed(lines: string[]): boolean;
/** Validates line parity across used columns and builds aligned rows */
export declare function parseColumnsInput(columns: Partial<Record<ImportColumnKey, string>>): {
    rows: ParsedImportRow[];
    mismatch?: ColumnLineCounts[];
};
//# sourceMappingURL=columns.parser.d.ts.map