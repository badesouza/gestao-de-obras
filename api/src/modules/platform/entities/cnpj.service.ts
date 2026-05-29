import { AppError } from '../../../shared/errors.js';
import { sanitizeCnpj, validateCnpj } from './entity.utils.js';

interface OpenCnpjPhone {
  ddd: string;
  numero: string;
  is_fax?: boolean;
}

interface OpenCnpjPartner {
  nome_socio?: string;
  nome_representante?: string;
  qualificacao_socio?: string;
}

interface OpenCnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  email?: string;
  uf?: string;
  municipio?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  telefones?: OpenCnpjPhone[];
  QSA?: OpenCnpjPartner[];
}

export interface CnpjLookupResult {
  cnpj: string;
  name: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  legalRepresentativeName: string | null;
  uf: string | null;
  municipalityName: string | null;
  address: string | null;
}

/** Formats address parts from OpenCNPJ response */
function formatAddress(data: OpenCnpjResponse): string | null {
  const parts = [
    data.tipo_logradouro,
    data.logradouro,
    data.numero ? `nº ${data.numero}` : null,
    data.complemento,
    data.bairro,
    data.cep ? `CEP ${data.cep}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Picks first non-fax phone from OpenCNPJ */
function formatPhone(phones: OpenCnpjPhone[] | undefined): string | null {
  if (!phones?.length) return null;
  const phone = phones.find((p) => !p.is_fax) ?? phones[0];
  if (!phone) return null;
  return `${phone.ddd}${phone.numero}`.replace(/\D/g, '');
}

/** Picks legal representative from QSA partners */
function pickLegalRepresentative(partners: OpenCnpjPartner[] | undefined): string | null {
  if (!partners?.length) return null;

  const withRepresentative = partners.find((p) => p.nome_representante?.trim());
  if (withRepresentative?.nome_representante?.trim()) {
    return withRepresentative.nome_representante.trim();
  }

  const director = partners.find((p) =>
    p.qualificacao_socio?.toLowerCase().includes('diretor'),
  );
  if (director?.nome_socio?.trim()) {
    return director.nome_socio.trim();
  }

  return partners[0]?.nome_socio?.trim() ?? null;
}

/** Fetches company data from OpenCNPJ API */
export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult> {
  const cnpj = sanitizeCnpj(rawCnpj);
  if (!cnpj || !validateCnpj(cnpj)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'CNPJ inválido');
  }

  const response = await fetch(`https://api.opencnpj.org/${cnpj}`);
  if (response.status === 404) {
    throw new AppError(404, 'NOT_FOUND', 'CNPJ não encontrado na Receita Federal');
  }
  if (!response.ok) {
    throw new AppError(502, 'EXTERNAL_API_ERROR', 'Falha ao consultar CNPJ');
  }

  const data = (await response.json()) as OpenCnpjResponse;

  return {
    cnpj,
    name: data.razao_social?.trim() || data.nome_fantasia?.trim() || '',
    tradeName: data.nome_fantasia?.trim() || null,
    email: data.email?.trim().toLowerCase() || null,
    phone: formatPhone(data.telefones),
    legalRepresentativeName: pickLegalRepresentative(data.QSA),
    uf: data.uf?.trim().toUpperCase() || null,
    municipalityName: data.municipio?.trim() || null,
    address: formatAddress(data),
  };
}
