const TOKEN_KEY = 'platform_token';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Returns stored platform JWT */
export function getPlatformToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Persists platform JWT */
export function setPlatformToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Removes platform JWT */
export function clearPlatformToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Sets JSON content type only when the request carries a body */
function applyJsonContentType(headers: Headers, options: RequestInit) {
  if (options.body !== undefined && options.body !== null && options.body !== '') {
    headers.set('Content-Type', 'application/json');
  }
}

/** Performs an authenticated API request */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getPlatformToken();
  const headers = new Headers(options.headers);
  applyJsonContentType(headers, options);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data as ApiErrorBody);
  }

  return data as T;
}

export const platformApi = {
  login: (email: string, password: string) =>
    apiRequest<{ token: string; operator: { id: string; name: string; email: string } }>(
      '/api/platform/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  logout: () =>
    apiRequest<void>('/api/platform/v1/auth/logout', { method: 'POST' }),
  me: () =>
    apiRequest<{ id: string; name: string; email: string }>(
      '/api/platform/v1/auth/me',
    ),
};

export interface Entity {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  legalRepresentativeName: string | null;
  uf: string | null;
  municipalityId: number | null;
  municipalityName: string | null;
  address: string | null;
  coatOfArmsUrl: string | null;
  tenantAccessUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntityListResponse {
  data: Entity[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  previousValue: unknown;
  newValue: unknown;
  operatorId: string;
  createdAt: string;
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

export interface StateOption {
  id: number;
  sigla: string;
  nome: string;
}

export interface MunicipalityOption {
  id: number;
  nome: string;
}

export const entityApi = {
  list: (params: URLSearchParams) =>
    apiRequest<EntityListResponse>(`/api/platform/v1/entities?${params}`),
  get: (id: string) => apiRequest<Entity>(`/api/platform/v1/entities/${id}`),
  create: (body: Record<string, unknown>) =>
    apiRequest<Entity>('/api/platform/v1/entities', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Entity>(`/api/platform/v1/entities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  updateStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    apiRequest<Entity>(`/api/platform/v1/entities/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  auditLogs: (id: string, page = 1) =>
    apiRequest<{ data: AuditLog[]; pagination: { total: number } }>(
      `/api/platform/v1/entities/${id}/audit-logs?page=${page}`,
    ),
  lookupCnpj: (cnpj: string) =>
    apiRequest<CnpjLookupResult>(
      `/api/platform/v1/cnpj/${cnpj.replace(/\D/g, '')}`,
    ),
  uploadCoatOfArms: async (file: File) => {
    const token = getPlatformToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/platform/v1/uploads/coat-of-arms', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(response.status, data as ApiErrorBody);
    }
    return data as { url: string };
  },
};

export const localitiesApi = {
  states: () =>
    apiRequest<{ data: StateOption[] }>('/api/public/v1/localities/states'),
  municipalities: (uf: string) =>
    apiRequest<{ data: MunicipalityOption[] }>(
      `/api/public/v1/localities/states/${uf}/municipalities`,
    ),
};

export const publicApi = {
  getTenant: (id: string) =>
    apiRequest<{ id: string; name: string; status: string; coatOfArmsUrl: string | null }>(
      `/api/public/v1/tenants/${id}`,
    ),
};

/* ── Central do Munícipe ── */
export interface CentralPublica {
  entidade: { id: string; nome: string; municipio: string | null; uf: string | null; brasaoUrl: string | null };
  bairros: { nome: string; lat: number | null; lng: number | null }[];
}
export interface NovaSolicitacaoMunicipe {
  categoria: string; categoriaNome: string; descricao: string;
  bairro: string; logradouro: string; referencia?: string | null;
  lat?: number | null; lng?: number | null; precisaoM?: number | null;
  nome: string; telefone: string; cpf?: string | null; email?: string | null; aceite: true;
}
export type StatusSolicitacao = 'NOVA' | 'CONVERTIDA' | 'RECUSADA';
export interface AcompanhamentoSolicitacao {
  protocolo: string; status: StatusSolicitacao; categoriaNome: string; bairro: string; logradouro: string;
  criadoEm: string; analisadoEm: string | null; motivoRecusa: string | null;
  servicoStatus: string | null; servicoAtualizadoEm: string | null;
}
export interface SolicitacaoMunicipeItem {
  id: string; protocolo: string; categoria: string; categoriaNome: string; descricao: string;
  bairro: string; logradouro: string; referencia: string | null;
  lat: number | null; lng: number | null; precisaoM: number | null;
  nome: string; telefone: string; cpf: string | null; email: string | null;
  status: StatusSolicitacao; motivoRecusa: string | null; registroDiarioId: string | null; centroCustoId: string | null;
  analisadoPor: string | null; analisadoEm: string | null; createdAt: string; fotos: string[];
}

export const centralPublicaApi = {
  config: (entityId: string) => apiRequest<CentralPublica>(`/api/public/v1/tenants/${entityId}/central`),
  enviar: async (entityId: string, dados: NovaSolicitacaoMunicipe, fotos: File[]) => {
    const form = new FormData();
    form.append('dados', JSON.stringify(dados));
    fotos.forEach(f => form.append('fotos', f, f.name));
    const res = await fetch(`/api/public/v1/tenants/${entityId}/solicitacoes`, { method: 'POST', body: form });
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, corpo as ApiErrorBody);
    return corpo as { protocolo: string; criadoEm: string };
  },
  acompanhar: (entityId: string, protocolo: string, telefone: string) =>
    apiRequest<AcompanhamentoSolicitacao>(`/api/public/v1/tenants/${entityId}/solicitacoes/${encodeURIComponent(protocolo)}?telefone=${encodeURIComponent(telefone)}`),
};

export const centralApi = {
  listar: (entityId: string, status?: StatusSolicitacao) =>
    tenantRequest<{ resumo: { novas: number; convertidas: number; recusadas: number }; itens: SolicitacaoMunicipeItem[] }>(
      entityId, `/api/tenant/v1/central-municipe${status ? `?status=${status}` : ''}`),
  converter: (entityId: string, id: string, centroCustoId: string) =>
    tenantRequest<{ registroId: string }>(entityId, `/api/tenant/v1/central-municipe/${id}/converter`, {
      method: 'POST', body: JSON.stringify({ centroCustoId }),
    }),
  recusar: (entityId: string, id: string, motivo: string) =>
    tenantRequest<void>(entityId, `/api/tenant/v1/central-municipe/${id}/recusar`, {
      method: 'POST', body: JSON.stringify({ motivo }),
    }),
  resumo: (entityId: string) => tenantRequest<{ novas: number }>(entityId, '/api/tenant/v1/central-municipe/resumo'),
  fotoBlob: async (entityId: string, fotoId: string): Promise<string> => {
    const token = getTenantToken(entityId);
    const headers = new Headers({ 'X-Tenant-Id': entityId });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`/api/tenant/v1/central-municipe/fotos/${fotoId}`, { headers });
    if (!res.ok) throw new Error('Falha ao carregar foto');
    return URL.createObjectURL(await res.blob());
  },
};

const TENANT_TOKENS_KEY = 'tenant_tokens';

/** Returns stored tenant JWT for an entity */
export function getTenantToken(entityId: string): string | null {
  const raw = localStorage.getItem(TENANT_TOKENS_KEY);
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    return map[entityId] ?? null;
  } catch {
    return null;
  }
}

/** Persists tenant JWT for an entity */
export function setTenantToken(entityId: string, token: string): void {
  const raw = localStorage.getItem(TENANT_TOKENS_KEY);
  const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  map[entityId] = token;
  localStorage.setItem(TENANT_TOKENS_KEY, JSON.stringify(map));
}

/** Removes tenant JWT for an entity */
export function clearTenantToken(entityId: string): void {
  const raw = localStorage.getItem(TENANT_TOKENS_KEY);
  if (!raw) return;
  const map = JSON.parse(raw) as Record<string, string>;
  delete map[entityId];
  localStorage.setItem(TENANT_TOKENS_KEY, JSON.stringify(map));
}

/** Performs an authenticated tenant API request */
export async function tenantRequest<T>(
  entityId: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getTenantToken(entityId);
  const headers = new Headers(options.headers);
  applyJsonContentType(headers, options);
  headers.set('X-Tenant-Id', entityId);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data as ApiErrorBody);
  }

  return data as T;
}

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  isLiderEquipe: boolean;
  role: { code: string; name: string };
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantSession {
  id: string;
  name: string;
  email: string;
  status: string;
  entity: { id: string; name: string; status: string; municipalityName: string | null; uf: string | null };
  role: { code: string; name: string };
  permissions: string[];
  /** serviços (centros) que o usuário atende; null = todos */
  servicosPermitidos: string[] | null;
  obras: {
    podeAprovar: boolean; podeConferir: boolean; exigeAprovacaoOS: boolean; exigeConferencia: boolean; metaDias: number;
    podeRevisarCompra: boolean; podeAprovarCompra: boolean; exigeAprovacaoCompra: boolean;
  };
}

/* ── Sala de Situação ── */
export type Situacao = 'aberta' | 'execucao' | 'concluida' | 'cancelada';
export interface PainelFeedItem {
  id: string; servico: { id: string; nome: string }; bairro: string; logradouro: string; tipo: string;
  status: string; situacao: Situacao; etapa: Etapa; criadoEm: string; fiscal: string; fotoId: string | null; fotos: number;
  lat: number | null; lng: number | null;
}
export interface PainelData {
  agora: string;
  kpis: {
    abertas: number; emExecucao: number; atrasadas: number;
    concluidasSemana: number; concluidasSemanaAnterior: number;
    tempoMedioDias: number | null; metaDias: number;
    comFotoPct: number | null; semFoto: number; registradasHoje: number; totalMes: number;
  };
  serie: { data: string; registradas: number; concluidas: number }[];
  feed: PainelFeedItem[];
  alertas: {
    atrasadas: { total: number; itens: { id: string; servico: string; servicoId: string; bairro: string; dias: number }[] };
    gpsLonge: { total: number; itens: { id: string; servico: string; bairro: string; distanciaM: number }[] };
    semFoto: { total: number; itens: { id: string; servico: string; servicoId: string; bairro: string; criadoEm: string }[] };
  };
  porServico: { id: string; nome: string; abertas: number; execucao: number; concluidas: number; total: number }[];
  equipes: { nome: string; hoje: number; ultimo: string | null }[];
  fiscais: { total: number; nomes: string[] };
  pedidosMunicipeNovos: number;
  comprasPendentes: { emRevisao: number; aguardandoAprovacao: number; aprovadosParaEnviar: number };
}

export interface TenantDashboard {
  entity: { id: string; name: string; status: string; coatOfArmsUrl: string | null; municipalityName: string | null; uf: string | null };
  stats: { usersTotal: number; usersActive: number };
  message: string;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface Fornecedor {
  id: string;
  entityId: string;
  razaoSocial: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FornecedorRef {
  id: string;
  razaoSocial: string;
  cnpj: string | null;
}

export const fornecedorApi = {
  list: (entityId: string, q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    return tenantRequest<{ items: Fornecedor[] }>(entityId, `/api/tenant/v1/fornecedores${params}`);
  },
  create: (entityId: string, body: { razaoSocial: string; cnpj?: string; contato?: string; telefone?: string; email?: string }) =>
    tenantRequest<Fornecedor>(entityId, '/api/tenant/v1/fornecedores', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (entityId: string, id: string, body: Partial<{ razaoSocial: string; cnpj: string; contato: string; telefone: string; email: string; ativo: boolean }>) =>
    tenantRequest<Fornecedor>(entityId, `/api/tenant/v1/fornecedores/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export interface Licitacao {
  id: string;
  identificacao: string;
  objeto: string;
  status: 'ACTIVE' | 'INACTIVE';
  fornecedor: FornecedorRef | null;
  createdAt: string;
  createdBy: UserRef;
  activeItemCount: number;
  numeroProcesso?: string | null;
  modalidade?: string | null;
  tipo?: TipoLicitacao | null;
  dataHomologacao?: string | null;
  contratos?: { total: number; vigentes: number; vencendo: number; vencidos: number; proximoVencimento: string | null; fornecedores: string[] };
}

export type TipoLicitacao = 'MATERIAL' | 'SERVICO' | 'COMBUSTIVEL' | 'OBRA';

export interface LicitacaoItem {
  id: string;
  licitacaoId: string;
  categoria: string | null;
  descricao: string;
  unidadeMedida: string;
  quantidade: string | null;
  valorUnitario: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  createdBy: UserRef;
  saldo: {
    controleSaldo: boolean;
    quantidadeLicitada: string | null;
    quantidadeReservada: string;
    quantidadeRecebida: string;
    quantidadeDisponivel: string | null;
  };
}

export type SolicitacaoServicoStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CONSOLIDATED';
export type PedidoCompraStatus = 'DRAFT' | 'EM_REVISAO' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
export type AcaoPedido = 'enviar_revisao' | 'revisar' | 'aprovar' | 'devolver' | 'enviar_fornecedor';

export interface CompraSolicitacao {
  id: string;
  numero: string;
  servicoSlug: string;
  servicoNome: string;
  licitacaoId: string;
  licitacao: { id: string; identificacao: string };
  status: SolicitacaoServicoStatus;
  prioridade: string;
  justificativa: string;
  observacoes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserRef;
  valorTotal: string;
  itens: Array<{
    id: string;
    licitacaoItemId: string;
    categoria: string | null;
    descricao: string;
    unidadeMedida: string;
    valorUnitario: string;
    quantidade: string;
    valorTotal: string;
    observacoes: string | null;
  }>;
}

export interface PedidoCompra {
  id: string;
  numero: string;
  status: PedidoCompraStatus;
  observacoes: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserRef;
  enviadoRevisaoEm?: string | null;
  revisadoEm?: string | null;
  revisadoPor?: UserRef | null;
  aprovadoEm?: string | null;
  aprovadoPor?: UserRef | null;
  devolvidoEm?: string | null;
  devolvidoMotivo?: string | null;
  fornecedores?: string[];
  licitacoes?: string[];
  servicos?: string[];
  valorTotal: string;
  quantidadeTotal: string;
  quantidadeRecebida: string;
  itens: Array<{
    id: string;
    licitacaoItemId: string;
    categoria: string | null;
    licitacao: { id: string; identificacao: string; objeto: string };
    descricao: string;
    unidadeMedida: string;
    valorUnitario: string;
    quantidadeTotal: string;
    quantidadeRecebida: string;
    quantidadePendente: string;
    valorTotal: string;
    origens: Array<{
      id: string;
      solicitacaoServicoId: string;
      solicitacaoServicoItemId: string;
      servicoSlug: string;
      servicoNome: string;
      quantidade: string;
      valorTotal: string;
    }>;
    recebimentos: Array<{
      id: string;
      quantidade: string;
      recebidoEm: string;
      responsavel: string;
      observacoes: string | null;
      createdAt: string;
      createdBy: UserRef;
    }>;
  }>;
}

export interface ImportResult {
  importedCount: number;
  licitacaoId: string;
}

export type PropriedadeTipo =
  | 'TEXTO'
  | 'DATA'
  | 'VALOR'
  | 'BOOLEAN'
  | 'ITEM_LICITACAO'
  | 'ITENS_LICITACAO';

export type PropriedadeProductionRole = 'NONE' | 'INICIO' | 'CONCLUSAO';

export interface Propriedade {
  id: string;
  nome: string;
  tipo: PropriedadeTipo;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PropriedadeConfig {
  propriedadeId: string;
  columnOrder: number;
  productionRole: PropriedadeProductionRole;
  active: boolean;
  propriedade: Propriedade;
}

export interface CentroCusto {
  id: string;
  nome: string;
  dataPrevistaInicio: string | null;
  dataPrevistaFim: string | null;
  dataRealizadaInicio: string | null;
  dataRealizadaFim: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  licitacaoCount: number;
  propriedadeCount: number;
  createdAt: string;
  createdBy: UserRef;
}

export interface CentroCustoDetail extends CentroCusto {
  entity: { id: string; name: string };
  licitacoes: Array<{ id: string; identificacao: string; status: string }>;
  propriedadesConfig: PropriedadeConfig[];
}

export interface CellValue {
  text?: string;
  date?: string;
  decimal?: string;
  boolean?: boolean;
  itemIds?: string[];
}

export interface RegistroDiarioRow {
  id: string;
  data: string;
  lat?: number | null;
  lng?: number | null;
  enderecoGeocodificado?: string | null;
  values: Record<string, CellValue>;
  /* presentes na listagem do mês */
  criadoEm?: string;
  fiscal?: string;
  fotoId?: string | null;
  fotos?: number;
  numeroOS?: string | null;
  etapa?: Etapa;
  aprovadoEm?: string | null;
  aprovadoPor?: string | null;
  executadoEm?: string | null;
  executadoPor?: string | null;
  finalizadoEm?: string | null;
  finalizadoPor?: string | null;
  centroDeCusto?: { id: string; codigo: string; nome: string } | null;
}

/* ── Ordem de serviço: etapas, regras e vínculos ── */
export type Etapa = 'AGUARDANDO_APROVACAO' | 'REGISTRADA' | 'EXECUTADA' | 'FINALIZADA' | 'CANCELADA';
export type AcaoOS = 'aprovar' | 'executar' | 'finalizar' | 'reabrir' | 'cancelar';
export type PapelCodigo = 'ADMIN' | 'COORDENADOR' | 'FISCAL' | 'ENGINEER' | 'OPERATOR';
export interface ConfiguracaoObras {
  exigeAprovacaoOS: boolean; aprovadores: PapelCodigo[];
  exigeConferencia: boolean; conferentes: PapelCodigo[]; metaDias: number;
  exigeAprovacaoCompra: boolean; revisoresCompra: PapelCodigo[]; aprovadoresCompra: PapelCodigo[];
}

/* ── Centros de custo (onde a despesa é apropriada; diferente de serviço) ── */
export type TipoCentroDeCusto = 'SECRETARIA' | 'SETOR' | 'PROGRAMA' | 'OBRA' | 'OUTRO';
export interface CentroDeCusto {
  id: string; codigo: string; nome: string; tipo: TipoCentroDeCusto; descricao: string | null; responsavel: string | null;
  ativo: boolean; paiId: string | null; ocorrencias: number; ocorrenciasMes: number; valorComprometido: string;
  servicos: { id: string; nome: string }[];
}
type DadosCentroDeCusto = { codigo: string; nome: string; tipo: TipoCentroDeCusto; descricao?: string | null; responsavel?: string | null; ativo?: boolean; paiId?: string | null };
export const centrosDeCustoApi = {
  listar: (entityId: string) => tenantRequest<{ itens: CentroDeCusto[]; valorSemCentro: string }>(entityId, '/api/tenant/v1/centros-de-custo'),
  criar: (entityId: string, dados: DadosCentroDeCusto) => tenantRequest<CentroDeCusto>(entityId, '/api/tenant/v1/centros-de-custo', { method: 'POST', body: JSON.stringify(dados) }),
  atualizar: (entityId: string, id: string, dados: DadosCentroDeCusto) => tenantRequest<CentroDeCusto>(entityId, `/api/tenant/v1/centros-de-custo/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  remover: (entityId: string, id: string) => tenantRequest<{ removido: boolean; desativado: boolean }>(entityId, `/api/tenant/v1/centros-de-custo/${id}`, { method: 'DELETE' }),
  definirServicos: (entityId: string, id: string, servicoIds: string[]) => tenantRequest<void>(entityId, `/api/tenant/v1/centros-de-custo/${id}/servicos`, { method: 'PUT', body: JSON.stringify({ servicoIds }) }),
  vinculos: (entityId: string, slugs: Record<string, string>) =>
    tenantRequest<VinculoServico[]>(entityId, '/api/tenant/v1/centros-de-custo/vinculos/consulta', { method: 'POST', body: JSON.stringify({ slugs }) }),
  salvarVinculos: (entityId: string, vinculos: { servicoId: string; slug: string; centroDeCustoId: string | null }[], aplicarAntigos: boolean) =>
    tenantRequest<{ ocorrencias: number; solicitacoes: number; pedidos: number; orcamentos: number }>(entityId, '/api/tenant/v1/centros-de-custo/vinculos', { method: 'PUT', body: JSON.stringify({ vinculos, aplicarAntigos }) }),
  definirCentroDoServico: (entityId: string, servicoId: string, d: { centroDeCustoId: string | null; slug: string; aplicarAntigos: boolean }) =>
    tenantRequest<{ ocorrencias: number; solicitacoes: number; pedidos: number; orcamentos: number }>(entityId, `/api/tenant/v1/servicos/${servicoId}/centro-de-custo`, { method: 'PUT', body: JSON.stringify(d) }),
  estruturaSugerida: (entityId: string, d: { codigoSecretaria: string; nomeSecretaria: string }) =>
    tenantRequest<{ criados: { codigo: string; nome: string }[] }>(entityId, '/api/tenant/v1/centros-de-custo/estrutura-sugerida', { method: 'POST', body: JSON.stringify(d) }),
};
export interface VinculoServico {
  servicoId: string; nome: string; ativo: boolean; slug: string | null; centroDeCustoId: string | null;
  ocorrenciasSemCentro: number; comprasSemCentro: number;
}

/* ── Orçamentação: fotos do local + materiais dos contratos → pedido ── */
export type OrcamentoStatus = 'RASCUNHO' | 'EM_REVISAO' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'CONVERTIDO' | 'CANCELADO';
export type AcaoOrcamento = 'enviar' | 'revisar' | 'aprovar' | 'devolver' | 'cancelar';
type CentroCurto = { id: string; codigo: string; nome: string };
export interface OrcamentoResumo {
  id: string; numero: string; titulo: string; descricao: string | null;
  bairro: string | null; logradouro: string | null; lat: number | null; lng: number | null;
  servicoSlug: string | null; servicoNome: string | null; centroDeCusto: CentroCurto | null;
  status: OrcamentoStatus; valorTotal: string; qtdItens: number; qtdFotos: number;
  criadoEm: string; criadoPor: string; enviadoEm: string | null;
  revisadoEm: string | null; revisadoPor: string | null; revisadoPorId: string | null; aprovadoEm: string | null; aprovadoPor: string | null;
  devolvidoEm: string | null; devolvidoMotivo: string | null; convertidoEm: string | null;
  pedidos: { id: string; numero: string; status: PedidoCompraStatus }[];
  capaFotoId: string | null;
}
export interface OrcamentoItem {
  id: string; licitacaoItemId: string; descricao: string; unidade: string; categoria: string | null;
  valorUnitario: string; quantidade: string; valorTotal: string;
  servicoSlug: string | null; servicoNome: string | null; centroDeCusto: CentroCurto | null;
  licitacao: { id: string; identificacao: string; objeto: string; fornecedor: string | null };
}
export interface Orcamento extends OrcamentoResumo {
  itens: OrcamentoItem[];
  fotos: { id: string; nome: string; criadoEm: string }[];
}
export interface DadosOrcamento {
  titulo: string; descricao?: string | null; bairro?: string | null; logradouro?: string | null;
  lat?: number | null; lng?: number | null; servicoSlug: string; servicoNome: string; centroDeCustoId?: string | null;
  itens: { licitacaoItemId: string; quantidade: string; servicoSlug?: string | null; servicoNome?: string | null; centroDeCustoId?: string | null }[];
}
export interface ResumoOrcamentos {
  rascunho: number; emRevisao: number; aguardandoAprovacao: number; aprovados: number; convertidos: number;
  valorEmAberto: string; valorConvertidoMes: string;
}
export const orcamentosApi = {
  listar: (entityId: string) => tenantRequest<OrcamentoResumo[]>(entityId, '/api/tenant/v1/orcamentos'),
  resumo: (entityId: string) => tenantRequest<ResumoOrcamentos>(entityId, '/api/tenant/v1/orcamentos/resumo'),
  obter: (entityId: string, id: string) => tenantRequest<Orcamento>(entityId, `/api/tenant/v1/orcamentos/${id}`),
  criar: (entityId: string, dados: DadosOrcamento) => tenantRequest<Orcamento>(entityId, '/api/tenant/v1/orcamentos', { method: 'POST', body: JSON.stringify(dados) }),
  atualizar: (entityId: string, id: string, dados: DadosOrcamento) => tenantRequest<Orcamento>(entityId, `/api/tenant/v1/orcamentos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
  enviarFotos: (entityId: string, id: string, fotos: File[]) => {
    const form = new FormData();
    fotos.forEach(f => form.append('fotos', f, f.name));
    return tenantUpload<Orcamento>(entityId, `/api/tenant/v1/orcamentos/${id}/fotos`, form);
  },
  removerFoto: (entityId: string, id: string, fotoId: string) => tenantRequest<Orcamento>(entityId, `/api/tenant/v1/orcamentos/${id}/fotos/${fotoId}`, { method: 'DELETE' }),
  fluxo: (entityId: string, id: string, acao: AcaoOrcamento, motivo?: string) =>
    tenantRequest<Orcamento>(entityId, `/api/tenant/v1/orcamentos/${id}/fluxo`, { method: 'POST', body: JSON.stringify({ acao, ...(motivo ? { motivo } : {}) }) }),
  gerarPedido: (entityId: string, id: string) =>
    tenantRequest<{ pedidos: { id: string; numero: string }[]; orcamento: Orcamento }>(entityId, `/api/tenant/v1/orcamentos/${id}/gerar-pedido`, { method: 'POST' }),
  fotoBlob: async (entityId: string, fotoId: string): Promise<string> => {
    const token = getTenantToken(entityId);
    const headers = new Headers({ 'X-Tenant-Id': entityId });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`/api/tenant/v1/orcamentos/fotos/${fotoId}`, { headers });
    if (!res.ok) throw new Error('Falha ao carregar foto');
    return URL.createObjectURL(await res.blob());
  },
};

/* ── Contratos da licitação (padrão Object): contrato → lotes → itens, aditivos ── */
export type SituacaoVigencia = 'VIGENTE' | 'VENCENDO' | 'VENCIDO' | 'A_INICIAR';
export type TipoAditivo = 'PRAZO' | 'VALOR' | 'QUANTIDADE';
export interface ItemContrato {
  id: string; categoria: string | null; descricao: string; marca: string | null; unidade: string;
  quantidade: string | null; valorUnitario: string | null; valorTotal: string | null; status: 'ACTIVE' | 'INACTIVE';
  usado: string; recebido: string; disponivel: string | null; emUso: boolean;
}
export interface DocumentoRef { id: string; nome: string; tamanho?: number; criadoEm?: string }
export interface AditivoContrato {
  id: string; numero: string; tipo: TipoAditivo; dataPublicacao: string; vigenciaAnterior: string | null; novaVigencia: string | null;
  percentual: string | null; lote: string | null; valorAditivado: string; observacao: string | null; itensAfetados: number;
  criadoPor: string; criadoEm: string; arquivos: { id: string; nomeArquivo: string }[];
}
export interface ContratoLicitacao {
  id: string; numero: string; status: 'ACTIVE' | 'INACTIVE';
  fornecedor: { id: string; razaoSocial: string; cnpj: string | null; nomeFantasia: string | null } | null;
  vigenciaDe: string; vigenciaAte: string; vigenciaOriginal: string | null; situacao: SituacaoVigencia; diasRestantes: number;
  valor: string | null; valorItens: string; valorUsado: string; valorAditivado: string;
  lotes: { id: string; numero: string; descricao: string | null; valor: string; itens: ItemContrato[] }[];
  aditivos: AditivoContrato[];
  arquivos: DocumentoRef[];
}
export interface EstruturaLicitacao {
  id: string; identificacao: string; objeto: string; status: 'ACTIVE' | 'INACTIVE';
  numeroProcesso: string | null; modalidade: string | null; tipo: TipoLicitacao | null; dataHomologacao: string | null;
  fornecedorLegado: { id: string; razaoSocial: string; cnpj: string | null } | null;
  criadoPor: string; criadoEm: string; arquivos: DocumentoRef[];
  resumo: { contratos: number; vigentes: number; vencendo: number; vencidos: number; valorGlobal: string; valorUsado: string; itens: number };
  contratos: ContratoLicitacao[];
  itensSemContrato: ItemContrato[];
  modalidades: string[];
}
export interface FornecedorConsulta {
  origem: 'cadastro' | 'receita';
  fornecedor: { id: string | null; cnpj: string | null; razaoSocial: string; nomeFantasia: string | null; telefone: string | null; email: string | null; endereco: string | null; situacao?: string | null };
}
export interface DadosContratoForm {
  numero: string; vigenciaDe: string; vigenciaAte: string; valor?: string | null;
  fornecedorId?: string | null;
  fornecedorNovo?: { cnpj?: string | null; razaoSocial: string; nomeFantasia?: string | null; telefone?: string | null; email?: string | null; endereco?: string | null } | null;
  primeiroLote?: { numero: string; descricao?: string | null } | null;
}
export interface ContratoAVencer {
  id: string; numero: string; licitacaoId: string; licitacao: string; fornecedor: string | null; vigenciaAte: string;
  situacao: SituacaoVigencia; diasRestantes: number;
}
const V1 = '/api/tenant/v1';
type ColunasImport = Partial<Record<'categoria' | 'descricao' | 'unidade' | 'quantidade' | 'valor', string>>;
export const contratosApi = {
  estrutura: (entityId: string, licitacaoId: string) => tenantRequest<EstruturaLicitacao>(entityId, `${V1}/licitacoes/${licitacaoId}/estrutura`),
  modalidades: (entityId: string) => tenantRequest<{ modalidades: string[]; tipos: TipoLicitacao[] }>(entityId, `${V1}/licitacoes-modalidades`),
  salvarProcesso: (entityId: string, licitacaoId: string, d: { numeroProcesso?: string | null; modalidade?: string | null; tipo?: TipoLicitacao | null; dataHomologacao?: string | null }) =>
    tenantRequest<void>(entityId, `${V1}/licitacoes/${licitacaoId}/processo`, { method: 'PUT', body: JSON.stringify(d) }),
  consultarCnpj: (entityId: string, cnpj: string) => tenantRequest<FornecedorConsulta>(entityId, `${V1}/fornecedores/cnpj/${cnpj.replace(/\D/g, '')}`),
  criar: (entityId: string, licitacaoId: string, d: DadosContratoForm) => tenantRequest<{ id: string }>(entityId, `${V1}/licitacoes/${licitacaoId}/contratos`, { method: 'POST', body: JSON.stringify(d) }),
  atualizar: (entityId: string, id: string, d: DadosContratoForm) => tenantRequest<void>(entityId, `${V1}/contratos/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  remover: (entityId: string, id: string) => tenantRequest<{ removido: boolean; desativado: boolean }>(entityId, `${V1}/contratos/${id}`, { method: 'DELETE' }),
  reativar: (entityId: string, id: string) => tenantRequest<void>(entityId, `${V1}/contratos/${id}/reativar`, { method: 'POST' }),
  criarLote: (entityId: string, contratoId: string, d: { numero: string; descricao?: string | null }) => tenantRequest<{ id: string }>(entityId, `${V1}/contratos/${contratoId}/lotes`, { method: 'POST', body: JSON.stringify(d) }),
  atualizarLote: (entityId: string, id: string, d: { numero: string; descricao?: string | null }) => tenantRequest<void>(entityId, `${V1}/lotes/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  removerLote: (entityId: string, id: string) => tenantRequest<void>(entityId, `${V1}/lotes/${id}`, { method: 'DELETE' }),
  adicionarItem: (entityId: string, loteId: string, d: { categoria?: string | null; descricao: string; marca?: string | null; unidade: string; quantidade?: string | null; valorUnitario?: string | null }) =>
    tenantRequest<{ id: string }>(entityId, `${V1}/lotes/${loteId}/itens`, { method: 'POST', body: JSON.stringify(d) }),
  vincularItens: (entityId: string, loteId: string, itemIds: string[]) => tenantRequest<{ vinculados: number }>(entityId, `${V1}/lotes/${loteId}/vincular`, { method: 'POST', body: JSON.stringify({ itemIds }) }),
  importarPlanilha: (entityId: string, licitacaoId: string, loteId: string, file: File) => {
    const form = new FormData(); form.append('file', file);
    return tenantUpload<ImportResult>(entityId, `${V1}/licitacoes/${licitacaoId}/items/import/spreadsheet?loteId=${loteId}`, form);
  },
  importarColunas: (entityId: string, licitacaoId: string, loteId: string, columns: ColunasImport) =>
    tenantRequest<ImportResult>(entityId, `${V1}/licitacoes/${licitacaoId}/items/import/columns?loteId=${loteId}`, { method: 'POST', body: JSON.stringify({ columns }) }),
  criarAditivo: (entityId: string, contratoId: string, d: { tipo: TipoAditivo; numero: string; dataPublicacao: string; novaVigencia?: string | null; percentual?: string | null; loteId?: string | null; observacao?: string | null }) =>
    tenantRequest<{ id: string; valorAditivado: string }>(entityId, `${V1}/contratos/${contratoId}/aditivos`, { method: 'POST', body: JSON.stringify(d) }),
  desfazerAditivo: (entityId: string, id: string) => tenantRequest<void>(entityId, `${V1}/aditivos/${id}`, { method: 'DELETE' }),
  anexar: (entityId: string, alvo: { licitacaoId?: string; contratoId?: string; aditivoId?: string }, file: File) => {
    const form = new FormData(); form.append('arquivo', file, file.name);
    const q = new URLSearchParams(Object.entries(alvo).filter(([, v]) => !!v) as [string, string][]);
    return tenantUpload<{ id: string }>(entityId, `${V1}/documentos-contratacao?${q}`, form);
  },
  removerDocumento: (entityId: string, id: string) => tenantRequest<void>(entityId, `${V1}/documentos-contratacao/${id}`, { method: 'DELETE' }),
  abrirDocumento: async (entityId: string, id: string) => {
    const aba = window.open('', '_blank');
    const token = getTenantToken(entityId);
    const headers = new Headers({ 'X-Tenant-Id': entityId });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${V1}/documentos-contratacao/${id}`, { headers });
    if (!res.ok) { aba?.close(); throw new Error('Não foi possível abrir o documento'); }
    const url = URL.createObjectURL(await res.blob());
    if (aba) aba.location.href = url; else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  },
  aVencer: (entityId: string) => tenantRequest<ContratoAVencer[]>(entityId, `${V1}/contratos/a-vencer`),
  editarItem: (entityId: string, licitacaoId: string, itemId: string, d: { categoria?: string; marca?: string | null; descricao: string; unidadeMedida: string; quantidade?: string | null; valorUnitario?: string | null }) =>
    tenantRequest<unknown>(entityId, `${V1}/licitacoes/${licitacaoId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(d) }),
  excluirItem: (entityId: string, licitacaoId: string, itemId: string) => tenantRequest<unknown>(entityId, `${V1}/licitacoes/${licitacaoId}/items/${itemId}`, { method: 'DELETE' }),
};

export interface SaldoLicitacao {
  id: string; identificacao: string; objeto: string; fornecedor: string | null;
  valores: { contratado: string; pedido: string; reservado: string; recebido: string; disponivel: string };
  itens: {
    id: string; categoria: string | null; descricao: string; unidade: string; valorUnitario: string;
    contratado: string | null; pedido: string; reservado: string; recebido: string; disponivel: string | null;
    contrato: { id: string; numero: string; vigenciaAte: string; fornecedor: string | null; situacao: SituacaoVigencia; diasRestantes: number } | null;
    lote: string | null;
  }[];
}

export const ordensApi = {
  acao: (entityId: string, registroId: string, acao: AcaoOS, observacao?: string) =>
    tenantRequest<{ etapa: Etapa }>(entityId, `/api/tenant/v1/registros/${registroId}/etapa`, {
      method: 'POST', body: JSON.stringify({ acao, ...(observacao ? { observacao } : {}) }),
    }),
  config: (entityId: string) => tenantRequest<ConfiguracaoObras>(entityId, '/api/tenant/v1/configuracoes/obras'),
  salvarConfig: (entityId: string, cfg: ConfiguracaoObras) =>
    tenantRequest<ConfiguracaoObras>(entityId, '/api/tenant/v1/configuracoes/obras', { method: 'PUT', body: JSON.stringify(cfg) }),
  servicosDoUsuario: (entityId: string, userId: string) =>
    tenantRequest<{ centroIds: string[] }>(entityId, `/api/tenant/v1/users/${userId}/servicos`),
  definirServicos: (entityId: string, userId: string, centroIds: string[]) =>
    tenantRequest<{ centroIds: string[] }>(entityId, `/api/tenant/v1/users/${userId}/servicos`, { method: 'PUT', body: JSON.stringify({ centroIds }) }),
};

export interface ProducaoDiariaDia {
  day: number;
  date: string;
  cadastradas: number;
  iniciadas: number;
  concluidas: number;
}

export interface ItemSearchResult {
  id: string;
  descricao: string;
  unidadeMedida: string;
  licitacaoIdentificacao: string;
}

/** Performs tenant file upload without forcing JSON content type */
async function tenantUpload<T>(
  entityId: string,
  path: string,
  formData: FormData,
): Promise<T> {
  const token = getTenantToken(entityId);
  const headers = new Headers();
  headers.set('X-Tenant-Id', entityId);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { method: 'POST', headers, body: formData });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data as ApiErrorBody);
  }
  return data as T;
}

/** Downloads a tenant file (template) as Blob */
async function tenantDownloadBlob(entityId: string, path: string): Promise<Blob> {
  const token = getTenantToken(entityId);
  const headers = new Headers();
  headers.set('X-Tenant-Id', entityId);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data as ApiErrorBody);
  }
  return response.blob();
}

export const tenantApi = {
  login: (entityId: string, email: string, password: string) =>
    tenantRequest<{
      token: string;
      user: TenantUser;
      entity: { id: string; name: string };
    }>(entityId, '/api/tenant/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ entityId, email, password }),
    }),
  logout: (entityId: string) =>
    tenantRequest<void>(entityId, '/api/tenant/v1/auth/logout', { method: 'POST' }),
  me: (entityId: string) =>
    tenantRequest<TenantSession>(entityId, '/api/tenant/v1/auth/me'),
  dashboard: (entityId: string) =>
    tenantRequest<TenantDashboard>(entityId, '/api/tenant/v1/dashboard'),
  painel: (entityId: string) =>
    tenantRequest<PainelData>(entityId, '/api/tenant/v1/painel'),
  users: {
    list: (entityId: string, params: URLSearchParams) =>
      tenantRequest<{ data: TenantUser[]; pagination: { total: number } }>(
        entityId,
        `/api/tenant/v1/users?${params}`,
      ),
    get: (entityId: string, userId: string) =>
      tenantRequest<TenantUser>(entityId, `/api/tenant/v1/users/${userId}`),
    create: (entityId: string, body: Record<string, unknown>) =>
      tenantRequest<TenantUser>(entityId, '/api/tenant/v1/users', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (entityId: string, userId: string, body: Record<string, unknown>) =>
      tenantRequest<TenantUser>(entityId, `/api/tenant/v1/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    updateStatus: (
      entityId: string,
      userId: string,
      status: 'ACTIVE' | 'INACTIVE',
    ) =>
      tenantRequest<TenantUser>(entityId, `/api/tenant/v1/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    resetPassword: (entityId: string, userId: string, password: string) =>
      tenantRequest<TenantUser>(entityId, `/api/tenant/v1/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }),
  },
  licitacoes: {
    list: (entityId: string, params: URLSearchParams) =>
      tenantRequest<{ items: Licitacao[]; total: number; page: number; pageSize: number }>(
        entityId,
        `/api/tenant/v1/licitacoes?${params}`,
      ),
    get: (entityId: string, licitacaoId: string) =>
      tenantRequest<Licitacao>(entityId, `/api/tenant/v1/licitacoes/${licitacaoId}`),
    create: (entityId: string, body: { identificacao: string; objeto: string; fornecedorId?: string | null; numeroProcesso?: string | null; modalidade?: string | null; tipo?: TipoLicitacao | null; dataHomologacao?: string | null }) =>
      tenantRequest<Licitacao>(entityId, '/api/tenant/v1/licitacoes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (entityId: string, licitacaoId: string, body: { identificacao: string; objeto: string; fornecedorId?: string | null }) =>
      tenantRequest<Licitacao>(entityId, `/api/tenant/v1/licitacoes/${licitacaoId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (entityId: string, licitacaoId: string) =>
      tenantRequest<void>(entityId, `/api/tenant/v1/licitacoes/${licitacaoId}`, { method: 'DELETE' }),
    deactivate: (entityId: string, licitacaoId: string) =>
      tenantRequest<Licitacao>(entityId, `/api/tenant/v1/licitacoes/${licitacaoId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'INACTIVE' }),
      }),
    listItems: (entityId: string, licitacaoId: string, params: URLSearchParams) =>
      tenantRequest<{ items: LicitacaoItem[]; total: number; page: number; pageSize: number }>(
        entityId,
        `/api/tenant/v1/licitacoes/${licitacaoId}/items?${params}`,
      ),
    importSpreadsheet: (entityId: string, licitacaoId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return tenantUpload<ImportResult>(
        entityId,
        `/api/tenant/v1/licitacoes/${licitacaoId}/items/import/spreadsheet`,
        formData,
      );
    },
    importColumns: (
      entityId: string,
      licitacaoId: string,
      columns: Partial<Record<'categoria' | 'descricao' | 'unidade' | 'quantidade' | 'valor', string>>,
    ) =>
      tenantRequest<ImportResult>(
        entityId,
        `/api/tenant/v1/licitacoes/${licitacaoId}/items/import/columns`,
        {
          method: 'POST',
          body: JSON.stringify({ columns }),
        },
      ),
    deactivateItem: (entityId: string, licitacaoId: string, itemId: string) =>
      tenantRequest<LicitacaoItem>(
        entityId,
        `/api/tenant/v1/licitacoes/${licitacaoId}/items/${itemId}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: 'INACTIVE' }) },
      ),
    updateItem: (entityId: string, licitacaoId: string, itemId: string, body: { categoria?: string; descricao: string; unidadeMedida: string; quantidade?: string | null; valorUnitario?: string | null }) =>
      tenantRequest<LicitacaoItem>(
        entityId,
        `/api/tenant/v1/licitacoes/${licitacaoId}/items/${itemId}`,
        { method: 'PUT', body: JSON.stringify(body) },
      ),
    deleteItem: (entityId: string, licitacaoId: string, itemId: string) =>
      tenantRequest<void>(
        entityId,
        `/api/tenant/v1/licitacoes/${licitacaoId}/items/${itemId}`,
        { method: 'DELETE' },
      ),
    downloadTemplate: (entityId: string, format: 'csv' | 'xlsx') =>
      tenantDownloadBlob(
        entityId,
        `/api/tenant/v1/licitacoes/import-template?format=${format}`,
      ),
  },
  compras: {
    listSolicitacoes: (entityId: string, params: URLSearchParams) =>
      tenantRequest<{ items: CompraSolicitacao[]; total: number; page: number; pageSize: number }>(
        entityId,
        `/api/tenant/v1/compras/solicitacoes?${params}`,
      ),
    createSolicitacao: (entityId: string, body: {
      servicoSlug: string;
      servicoNome: string;
      licitacaoId: string;
      prioridade: 'Alta' | 'Media' | 'Baixa';
      justificativa: string;
      observacoes?: string | null;
      submit: boolean;
      centroDeCustoId?: string | null;
      itens: Array<{ licitacaoItemId: string; quantidade: string; observacoes?: string | null; servicoSlug?: string | null; servicoNome?: string | null; centroDeCustoId?: string | null }>;
    }) =>
      tenantRequest<CompraSolicitacao>(entityId, '/api/tenant/v1/compras/solicitacoes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    changeSolicitacaoStatus: (
      entityId: string,
      solicitacaoId: string,
      action: 'submit' | 'approve' | 'reject' | 'cancel',
    ) =>
      tenantRequest<CompraSolicitacao>(entityId, `/api/tenant/v1/compras/solicitacoes/${solicitacaoId}/${action}`, {
        method: 'POST',
      }),
    deleteSolicitacao: (entityId: string, solicitacaoId: string) =>
      tenantRequest<void>(entityId, `/api/tenant/v1/compras/solicitacoes/${solicitacaoId}`, {
        method: 'DELETE',
      }),
    listPedidos: (entityId: string, params: URLSearchParams) =>
      tenantRequest<{ items: PedidoCompra[]; total: number; page: number; pageSize: number }>(
        entityId,
        `/api/tenant/v1/compras/pedidos?${params}`,
      ),
    createPedidoFromSolicitacoes: (entityId: string, body: { solicitacaoIds: string[]; observacoes?: string | null; send: boolean }) =>
      tenantRequest<PedidoCompra>(entityId, '/api/tenant/v1/compras/pedidos/from-solicitacoes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    fluxoPedido: (entityId: string, pedidoId: string, acao: AcaoPedido, motivo?: string) =>
      tenantRequest<{ status: PedidoCompraStatus }>(entityId, `/api/tenant/v1/compras/pedidos/${pedidoId}/fluxo`, {
        method: 'POST', body: JSON.stringify({ acao, ...(motivo ? { motivo } : {}) }),
      }),
    saldos: (entityId: string) => tenantRequest<{ licitacoes: SaldoLicitacao[] }>(entityId, '/api/tenant/v1/compras/saldos'),
    sendPedido: (entityId: string, pedidoId: string) =>
      tenantRequest<PedidoCompra>(entityId, `/api/tenant/v1/compras/pedidos/${pedidoId}/send`, { method: 'POST' }),
    cancelPedido: (entityId: string, pedidoId: string) =>
      tenantRequest<PedidoCompra>(entityId, `/api/tenant/v1/compras/pedidos/${pedidoId}/cancel`, { method: 'POST' }),
    deletePedido: (entityId: string, pedidoId: string) =>
      tenantRequest<void>(entityId, `/api/tenant/v1/compras/pedidos/${pedidoId}`, { method: 'DELETE' }),
    createRecebimento: (entityId: string, pedidoId: string, body: {
      pedidoCompraItemId: string;
      quantidade: string;
      recebidoEm: string;
      responsavel: string;
      observacoes?: string | null;
    }) =>
      tenantRequest<PedidoCompra>(entityId, `/api/tenant/v1/compras/pedidos/${pedidoId}/recebimentos`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  centrosCusto: {
    list: (entityId: string, params: URLSearchParams) =>
      tenantRequest<{ items: CentroCusto[]; total: number; page: number; pageSize: number }>(
        entityId,
        `/api/tenant/v1/centros-custo?${params}`,
      ),
    get: (entityId: string, centroId: string) =>
      tenantRequest<CentroCustoDetail>(entityId, `/api/tenant/v1/centros-custo/${centroId}`),
    create: (
      entityId: string,
      body: {
        nome: string;
        dataPrevistaInicio?: string | null;
        dataPrevistaFim?: string | null;
        dataRealizadaInicio?: string | null;
        dataRealizadaFim?: string | null;
        licitacaoIds?: string[];
      },
    ) =>
      tenantRequest<CentroCustoDetail>(entityId, '/api/tenant/v1/centros-custo', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (entityId: string, centroId: string, body: Record<string, unknown>) =>
      tenantRequest<CentroCustoDetail>(entityId, `/api/tenant/v1/centros-custo/${centroId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deactivate: (entityId: string, centroId: string) =>
      tenantRequest<CentroCustoDetail>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: 'INACTIVE' }) },
      ),
    setLicitacoes: (entityId: string, centroId: string, licitacaoIds: string[]) =>
      tenantRequest<CentroCustoDetail>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/licitacoes`,
        { method: 'PUT', body: JSON.stringify({ licitacaoIds }) },
      ),
    setPropriedadesConfig: (
      entityId: string,
      centroId: string,
      items: Array<{
        propriedadeId: string;
        columnOrder: number;
        productionRole: PropriedadeProductionRole;
        active?: boolean;
      }>,
    ) =>
      tenantRequest<CentroCustoDetail>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/propriedades-config`,
        { method: 'PUT', body: JSON.stringify({ items }) },
      ),
    listRegistros: (entityId: string, centroId: string, year: number, month: number) =>
      tenantRequest<{ year: number; month: number; rows: RegistroDiarioRow[] }>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/registros?year=${year}&month=${month}`,
      ),
    createRegistro: (
      entityId: string,
      centroId: string,
      body: { data: string; values?: Record<string, CellValue>; centroDeCustoId?: string | null },
    ) =>
      tenantRequest<RegistroDiarioRow>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/registros`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    updateRegistro: (
      entityId: string,
      centroId: string,
      registroId: string,
      body: { data: string; values?: Record<string, CellValue>; centroDeCustoId?: string | null },
    ) =>
      tenantRequest<RegistroDiarioRow>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/registros/${registroId}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      ),
    deleteRegistro: (entityId: string, centroId: string, registroId: string) =>
      tenantRequest<void>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/registros/${registroId}`,
        { method: 'DELETE' },
      ),
    getProducao: (entityId: string, centroId: string, year: number, month: number) =>
      tenantRequest<{
        year: number;
        month: number;
        days: ProducaoDiariaDia[];
        markersConfigured: { inicio: boolean; conclusao: boolean };
      }>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/producao?year=${year}&month=${month}`,
      ),
    analytics: (entityId: string, centroId: string, year: number, month: number) =>
      tenantRequest<{
        resumo: { total: number; concluidos: number; taxaConclusao: number; totalArea: number; comFoto: number };
        producaoDiaria: { data: string; total: number; concluidos: number; area: number }[];
        porBairro:  { name: string; value: number }[];
        porStatus:  { name: string; value: number }[];
        porTipo:    { name: string; value: number }[];
        porOrigem:  { name: string; value: number }[];
        porEquipe:  { name: string; registros: number; area: number; horas: number }[];
        year: number; month: number;
      }>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/analytics?year=${year}&month=${month}`,
      ),
    getMetasAno: (entityId: string, centroId: string, year: number) =>
      tenantRequest<{
        year: number;
        metas: Record<number, { metaRegistros: number | null; metaProducao: number | null; metaHoras: number | null }>;
      }>(entityId, `/api/tenant/v1/centros-custo/${centroId}/metas/ano?year=${year}`),
    saveMetasAno: (entityId: string, centroId: string, body: { year: number; metas: Record<number, { metaRegistros: number | null; metaProducao: number | null; metaHoras: number | null }> }) =>
      tenantRequest<{ ok: boolean }>(entityId, `/api/tenant/v1/centros-custo/${centroId}/metas/ano`, {
        method: 'PUT', body: JSON.stringify(body),
      }),
    getMetas: (entityId: string, centroId: string, year: number, month: number) =>
      tenantRequest<{ year: number; month: number; metaRegistros: number | null; metaProducao: number | null; metaHoras: number | null }>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/metas?year=${year}&month=${month}`,
      ),
    saveMetas: (entityId: string, centroId: string, body: { year: number; month: number; metaRegistros: number | null; metaProducao: number | null; metaHoras: number | null }) =>
      tenantRequest<{ ok: boolean }>(entityId, `/api/tenant/v1/centros-custo/${centroId}/metas`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    searchItens: (entityId: string, centroId: string, q?: string, limit = 20) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('limit', String(limit));
      return tenantRequest<{ items: ItemSearchResult[] }>(
        entityId,
        `/api/tenant/v1/centros-custo/${centroId}/itens-busca?${params}`,
      );
    },
    propriedades: {
      list: (entityId: string) =>
        tenantRequest<{ items: Propriedade[] }>(
          entityId,
          '/api/tenant/v1/centros-custo/propriedades',
        ),
      create: (entityId: string, body: { nome: string; tipo: PropriedadeTipo }) =>
        tenantRequest<Propriedade>(entityId, '/api/tenant/v1/centros-custo/propriedades', {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      update: (
        entityId: string,
        propriedadeId: string,
        body: { nome?: string; status?: 'INACTIVE' },
      ) =>
        tenantRequest<Propriedade>(
          entityId,
          `/api/tenant/v1/centros-custo/propriedades/${propriedadeId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
        ),
    },
  },
};

export type CadastroAuxiliarTipo = 'BAIRRO' | 'EQUIPE' | 'VEICULO' | 'EQUIPAMENTO' | 'MACROZONA';

export interface CadastroAuxiliar {
  id: string;
  entityId: string;
  tipo: CadastroAuxiliarTipo;
  nome: string;
  ativo: boolean;
  ordem: number;
  lat?: number | null;
  lng?: number | null;
  macrozonaId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BairroCoord {
  id: string;
  nome: string;
  lat: number | null;
  lng: number | null;
}

export interface MapaPin {
  id: string;
  lat: number;
  lng: number;
  data: string;
  endereco: string | null;
  centroCusto: { id: string; nome: string };
  status: string;
  bairro: string;
  logradouro: string;
  tipoServico: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  importance: number;
}

export const mapaApi = {
  geocode: (entityId: string, q: string) =>
    tenantRequest<{ results: GeocodeResult[] }>(
      entityId,
      `/api/tenant/v1/mapa/geocode?q=${encodeURIComponent(q)}`,
    ),
  reverse: (entityId: string, lat: number, lng: number) =>
    tenantRequest<{ label: string; logradouro: string | null; bairro: string | null }>(
      entityId,
      `/api/tenant/v1/mapa/reverse?lat=${lat}&lng=${lng}`,
    ),
  bairroMaisProximo: (entityId: string, lat: number, lng: number) =>
    tenantRequest<{ bairro: string | null; distancia: number | null }>(
      entityId,
      `/api/tenant/v1/mapa/bairro-mais-proximo?lat=${lat}&lng=${lng}`,
    ),
  salvarCoords: (entityId: string, registroId: string, lat: number, lng: number, endereco?: string) =>
    tenantRequest<{ id: string; lat: number; lng: number }>(
      entityId,
      `/api/tenant/v1/mapa/registros/${registroId}/coords`,
      { method: 'PATCH', body: JSON.stringify({ lat, lng, enderecoGeocodificado: endereco }) },
    ),
  pins: (entityId: string, year?: number, month?: number, centroCustoId?: string) => {
    const params = new URLSearchParams();
    if (year)          params.set('year',  String(year));
    if (month)         params.set('month', String(month));
    if (centroCustoId) params.set('centroCustoId', centroCustoId);
    return tenantRequest<{ pins: MapaPin[]; year: number; month: number }>(
      entityId,
      `/api/tenant/v1/mapa/pins?${params}`,
    );
  },
  uploadMidia: (entityId: string, registroId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return tenantUpload<{ id: string; tipo: string; nomeArquivo: string; mimeType: string; tamanhoBytes: number; createdAt: string }>(entityId, `/api/tenant/v1/mapa/registros/${registroId}/midias`, form);
  },
  listMidias: (entityId: string, registroId: string) =>
    tenantRequest<{ midias: { id: string; tipo: string; nomeArquivo: string; mimeType: string; tamanhoBytes: number; createdAt: string }[] }>(
      entityId,
      `/api/tenant/v1/mapa/registros/${registroId}/midias`,
    ),
  deleteMidia: (entityId: string, midiaId: string) =>
    tenantRequest<void>(entityId, `/api/tenant/v1/mapa/midias/${midiaId}`, { method: 'DELETE' }),
  midiaUrl: (_entityId: string, midiaId: string) =>
    `/api/tenant/v1/mapa/midias/${midiaId}`,
  fetchMidiaBlob: async (entityId: string, midiaId: string): Promise<string> => {
    const token = getTenantToken(entityId);
    const headers = new Headers({ 'X-Tenant-Id': entityId });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`/api/tenant/v1/mapa/midias/${midiaId}`, { headers });
    if (!res.ok) throw new Error('Falha ao carregar mídia');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};

export interface LiderRef {
  id: string;
  name: string;
  email: string;
}

export interface Operador {
  id: string;
  entityId: string;
  equipeId: string;
  nome: string;
  cargo: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EquipeDetail {
  id?: string;
  cadastroId: string;
  liderUserId?: string | null;
  lider?: LiderRef | null;
  operadores: Operador[];
}

export const equipeApi = {
  getLideres: (entityId: string) =>
    tenantRequest<{ items: LiderRef[] }>(entityId, '/api/tenant/v1/equipes/lideres'),

  getDetail: (entityId: string, cadastroId: string) =>
    tenantRequest<EquipeDetail>(entityId, `/api/tenant/v1/equipes/${cadastroId}`),

  setLider: (entityId: string, cadastroId: string, liderUserId: string | null) =>
    tenantRequest<EquipeDetail>(entityId, `/api/tenant/v1/equipes/${cadastroId}/lider`, {
      method: 'PATCH',
      body: JSON.stringify({ liderUserId }),
    }),

  addOperador: (entityId: string, cadastroId: string, body: { nome: string; cargo: string }) =>
    tenantRequest<Operador>(entityId, `/api/tenant/v1/equipes/${cadastroId}/operadores`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateOperador: (entityId: string, operadorId: string, body: { nome?: string; cargo?: string; ativo?: boolean }) =>
    tenantRequest<Operador>(entityId, `/api/tenant/v1/equipes/operadores/${operadorId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteOperador: (entityId: string, operadorId: string) =>
    tenantRequest<void>(entityId, `/api/tenant/v1/equipes/operadores/${operadorId}`, {
      method: 'DELETE',
    }),
};

export const cadastrosAuxiliaresApi = {
  list: (entityId: string, tipo?: CadastroAuxiliarTipo) => {
    const params = tipo ? `?tipo=${tipo}` : '';
    return tenantRequest<{ items: CadastroAuxiliar[] }>(
      entityId,
      `/api/tenant/v1/cadastros-auxiliares${params}`,
    );
  },
  create: (entityId: string, body: { tipo: CadastroAuxiliarTipo; nome: string }) =>
    tenantRequest<CadastroAuxiliar>(entityId, '/api/tenant/v1/cadastros-auxiliares', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (entityId: string, id: string, body: { nome?: string; ativo?: boolean; ordem?: number; macrozonaId?: string | null }) =>
    tenantRequest<CadastroAuxiliar>(entityId, `/api/tenant/v1/cadastros-auxiliares/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (entityId: string, id: string) =>
    tenantRequest<void>(entityId, `/api/tenant/v1/cadastros-auxiliares/${id}`, {
      method: 'DELETE',
    }),
  listBairrosCoords: (entityId: string) =>
    tenantRequest<{ items: BairroCoord[] }>(
      entityId,
      '/api/tenant/v1/cadastros-auxiliares/bairros-coords',
    ),
  saveBairroCoords: (entityId: string, id: string, lat: number, lng: number) =>
    tenantRequest<CadastroAuxiliar>(entityId, `/api/tenant/v1/cadastros-auxiliares/${id}/coords`, {
      method: 'PATCH',
      body: JSON.stringify({ lat, lng }),
    }),
};

export interface EnderecoDescoberto {
  id: string;
  entityId: string;
  bairro: string;
  logradouro: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export const enderecosDescobertoApi = {
  list: (entityId: string, bairro?: string) => {
    const params = bairro ? `?bairro=${encodeURIComponent(bairro)}` : '';
    return tenantRequest<{ items: EnderecoDescoberto[]; total: number }>(
      entityId,
      `/api/tenant/v1/enderecos-descobertos${params}`,
    );
  },
  create: (entityId: string, body: { bairro: string; logradouro: string; lat: number; lng: number }) =>
    tenantRequest<EnderecoDescoberto>(entityId, '/api/tenant/v1/enderecos-descobertos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  delete: (entityId: string, id: string) =>
    tenantRequest<void>(entityId, `/api/tenant/v1/enderecos-descobertos/${id}`, {
      method: 'DELETE',
    }),
};

export const entityBootstrapApi = {
  adminStatus: (entityId: string) =>
    apiRequest<{ hasAdmin: boolean }>(
      `/api/platform/v1/entities/${entityId}/admin-status`,
    ),
  bootstrapAdmin: (
    entityId: string,
    body: { name: string; email: string; password: string },
  ) =>
    apiRequest<{ id: string; name: string; email: string; role: string }>(
      `/api/platform/v1/entities/${entityId}/bootstrap-admin`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
};
