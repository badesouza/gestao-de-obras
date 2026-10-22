import { tenantRequest, type Etapa, type SolicitacaoMunicipeItem } from './api-client';

/* ── Central de Solicitações: munícipe + escritório + campo ── */

export type OrigemSolicitacao = 'MUNICIPE' | 'ESCRITORIO' | 'CAMPO';
export type SituacaoSolicitacao = 'AGUARDANDO' | 'OS' | 'RECUSADO';

/** OS aberta no escritório ou em campo, esperando (ou já com) o crivo do responsável */
export interface SolicitacaoInterna {
  id: string; numeroOS: string | null; origem: 'ESCRITORIO' | 'CAMPO'; etapa: Etapa; situacao: SituacaoSolicitacao;
  centroCustoId: string; servicoNome: string; tipoServico: string | null;
  bairro: string | null; logradouro: string | null; descricao: string | null;
  lat: number | null; lng: number | null; fotos: string[];
  autor: string; autorPapel: string; autorPerfil: string;
  data: string; createdAt: string;
  analisadoEm: string | null; analisadoPor: string | null; motivoRecusa: string | null;
  executadoEm: string | null; finalizadoEm: string | null;
}

/** Pedido do munícipe com a OS que ele virou (quando virou) */
export type SolicitacaoMunicipe = SolicitacaoMunicipeItem & { osNumero: string | null; osEtapa: Etapa | null };

export interface DadosCentral {
  municipe: SolicitacaoMunicipe[];
  internas: SolicitacaoInterna[];
  poderes: { podeTriar: boolean; podeAprovar: boolean };
}

export const centralSolicitacoesApi = {
  listar: (entityId: string) => tenantRequest<DadosCentral>(entityId, '/api/tenant/v1/central-solicitacoes'),
  aprovar: (entityId: string, registroId: string) =>
    tenantRequest<{ etapa: Etapa }>(entityId, `/api/tenant/v1/registros/${registroId}/etapa`, {
      method: 'POST', body: JSON.stringify({ acao: 'aprovar' }),
    }),
  recusar: (entityId: string, registroId: string, motivo: string) =>
    tenantRequest<{ etapa: Etapa }>(entityId, `/api/tenant/v1/registros/${registroId}/etapa`, {
      method: 'POST', body: JSON.stringify({ acao: 'recusar', observacao: motivo }),
    }),
};
