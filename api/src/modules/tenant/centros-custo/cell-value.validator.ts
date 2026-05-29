import type { PropriedadeTipo } from '../../../../generated/prisma/index.js';
import { parseDecimalValue } from '../licitacoes/import/value.parser.js';
import { AppError } from '../../../shared/errors.js';

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
export function parseDateOnly(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Data inválida');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Data inválida');
  }
  return date;
}

/** Formats Date to YYYY-MM-DD */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Validates and normalizes cell input for a property type */
export function validateCellValue(
  tipo: PropriedadeTipo,
  input: CellValueInput | undefined | null,
): PersistedCellValue {
  const empty: PersistedCellValue = {
    valorTexto: null,
    valorData: null,
    valorDecimal: null,
    valorBoolean: null,
    itemIds: [],
  };

  if (!input) return empty;

  switch (tipo) {
    case 'TEXTO': {
      const text = input.text?.trim() ?? '';
      if (!text) return empty;
      if (text.length > 2000) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Texto excede 2000 caracteres');
      }
      return { ...empty, valorTexto: text };
    }
    case 'DATA': {
      if (!input.date?.trim()) return empty;
      return { ...empty, valorData: parseDateOnly(input.date) };
    }
    case 'VALOR': {
      if (!input.decimal?.trim()) return empty;
      const parsed = parseDecimalValue(input.decimal);
      if (parsed === null) return empty;
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Valor monetário inválido');
      }
      return { ...empty, valorDecimal: parsed.toFixed(4) };
    }
    case 'BOOLEAN':
      return { ...empty, valorBoolean: input.boolean === true };
    case 'ITEM_LICITACAO': {
      const ids = (input.itemIds ?? []).filter(Boolean);
      if (ids.length === 0) return empty;
      if (ids.length > 1) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Selecione apenas um item');
      }
      return { ...empty, itemIds: ids };
    }
    case 'ITENS_LICITACAO': {
      const ids = [...new Set((input.itemIds ?? []).filter(Boolean))];
      return { ...empty, itemIds: ids };
    }
    default:
      throw new AppError(422, 'VALIDATION_ERROR', 'Tipo de propriedade inválido');
  }
}

/** Maps persisted cell to API output */
export function cellToOutput(
  tipo: PropriedadeTipo,
  row: {
    valorTexto: string | null;
    valorData: Date | null;
    valorDecimal: { toString(): string } | null;
    valorBoolean: boolean | null;
    itens: Array<{ licitacaoItemId: string }>;
  } | null,
): CellValueOutput | null {
  if (!row) return null;

  switch (tipo) {
    case 'TEXTO':
      return row.valorTexto ? { text: row.valorTexto } : null;
    case 'DATA':
      return row.valorData ? { date: formatDateOnly(row.valorData) } : null;
    case 'VALOR':
      return row.valorDecimal ? { decimal: row.valorDecimal.toString() } : null;
    case 'BOOLEAN':
      return { boolean: row.valorBoolean === true };
    case 'ITEM_LICITACAO':
    case 'ITENS_LICITACAO':
      return row.itens.length > 0
        ? { itemIds: row.itens.map((i) => i.licitacaoItemId) }
        : null;
    default:
      return null;
  }
}

/** Checks if a marker property value counts as active for production stats */
export function isMarkerSatisfied(
  tipo: PropriedadeTipo,
  row: {
    valorTexto: string | null;
    valorData: Date | null;
    valorBoolean: boolean | null;
  } | null,
): boolean {
  if (!row) return false;
  if (tipo === 'BOOLEAN') return row.valorBoolean === true;
  if (tipo === 'DATA') return row.valorData != null;
  if (tipo === 'TEXTO') return (row.valorTexto?.trim().length ?? 0) > 0;
  return false;
}

/** Validates date range pairs */
export function validateDateRanges(input: {
  dataPrevistaInicio?: string | null;
  dataPrevistaFim?: string | null;
  dataRealizadaInicio?: string | null;
  dataRealizadaFim?: string | null;
}) {
  if (input.dataPrevistaInicio && input.dataPrevistaFim) {
    const start = parseDateOnly(input.dataPrevistaInicio);
    const end = parseDateOnly(input.dataPrevistaFim);
    if (end < start) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Data prevista fim deve ser >= início');
    }
  }
  if (input.dataRealizadaInicio && input.dataRealizadaFim) {
    const start = parseDateOnly(input.dataRealizadaInicio);
    const end = parseDateOnly(input.dataRealizadaFim);
    if (end < start) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Data realizada fim deve ser >= início');
    }
  }
}

/** Returns first and last day of month as Date (UTC) */
export function getMonthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end, daysInMonth: end.getUTCDate() };
}
