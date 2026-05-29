/** Normalizes spreadsheet header to internal field key */
export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const HEADER_ALIASES: Record<string, 'categoria' | 'descricao' | 'unidade' | 'valor'> = {
  categoria: 'categoria',
  category: 'categoria',
  descricao: 'descricao',
  description: 'descricao',
  unidade: 'unidade',
  'unidade de medida': 'unidade',
  un: 'unidade',
  valor: 'valor',
  'valor unitario': 'valor',
  preco: 'valor',
};

/** Maps a normalized header to an internal column key, or null if unknown */
export function mapHeaderToField(header: string): 'categoria' | 'descricao' | 'unidade' | 'valor' | null {
  const normalized = normalizeHeader(header);
  return HEADER_ALIASES[normalized] ?? null;
}
