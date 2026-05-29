/** Keeps only digits from input */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Formats CNPJ as 00.000.000/0000-00 */
export function formatCnpj(value: string): string {
  const digits = digitsOnly(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Formats Brazilian phone as (00) 00000-0000 or (00) 0000-0000 */
export function formatPhone(value: string): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/** Normalizes text for municipality name comparison */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Finds IBGE municipality id by name within a UF list */
export function matchMunicipalityId(
  municipalities: { id: number; nome: string }[],
  municipalityName: string | null,
): number | null {
  if (!municipalityName) return null;
  const target = normalizeText(municipalityName);
  const match = municipalities.find((m) => normalizeText(m.nome) === target);
  return match?.id ?? null;
}
