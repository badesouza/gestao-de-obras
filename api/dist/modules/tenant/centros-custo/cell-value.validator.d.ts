import type { PropriedadeTipo } from '../../../../generated/prisma/index.js';
export interface CellValueInput {
    text?: string;
    date?: string;
    decimal?: string;
    boolean?: boolean;
    itemIds?: string[];
}
export interface CellValueOutput {
    text?: string | null;
    date?: string | null;
    decimal?: string | null;
    boolean?: boolean | null;
    itemIds?: string[];
}
export interface PersistedCellValue {
    valorTexto: string | null;
    valorData: Date | null;
    valorDecimal: string | null;
    valorBoolean: boolean | null;
    itemIds: string[];
}
/** Parses YYYY-MM-DD into UTC date */
export declare function parseDateOnly(iso: string): Date;
/** Formats Date to YYYY-MM-DD */
export declare function formatDateOnly(date: Date): string;
/** Validates and normalizes cell input for a property type */
export declare function validateCellValue(tipo: PropriedadeTipo, input: CellValueInput | undefined | null): PersistedCellValue;
/** Maps persisted cell to API output */
export declare function cellToOutput(tipo: PropriedadeTipo, row: {
    valorTexto: string | null;
    valorData: Date | null;
    valorDecimal: {
        toString(): string;
    } | null;
    valorBoolean: boolean | null;
    itens: Array<{
        licitacaoItemId: string;
    }>;
} | null): CellValueOutput | null;
/** Checks if a marker property value counts as active for production stats */
export declare function isMarkerSatisfied(tipo: PropriedadeTipo, row: {
    valorTexto: string | null;
    valorData: Date | null;
    valorBoolean: boolean | null;
} | null): boolean;
/** Validates date range pairs */
export declare function validateDateRanges(input: {
    dataPrevistaInicio?: string | null;
    dataPrevistaFim?: string | null;
    dataRealizadaInicio?: string | null;
    dataRealizadaFim?: string | null;
}): void;
/** Returns first and last day of month as Date (UTC) */
export declare function getMonthDateRange(year: number, month: number): {
    start: Date;
    end: Date;
    daysInMonth: number;
};
//# sourceMappingURL=cell-value.validator.d.ts.map