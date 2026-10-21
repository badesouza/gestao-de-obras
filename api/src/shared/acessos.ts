/**
 * Acessos por caixa (Módulo 1 · tela "Acessos do usuário").
 * Cada pessoa tem a sua lista de caixas marcadas; o perfil virou só um MODELO
 * que pré-marca as caixas. "Administrador geral" libera tudo.
 * Os passos do fluxo (aprovar OS, conferir baixa, revisar/aprovar pedido…)
 * também são caixas: vincular alguém a um passo em "Fluxo e aprovações"
 * é marcar a mesma caixa.
 */

export interface ItemAcesso { chave: string; nome: string; etapa?: string }
export interface GrupoAcesso { nome: string; fluxo?: boolean; itens: ItemAcesso[] }
export interface MenuAcesso { chave: string; nome: string; grupos: GrupoAcesso[] }

export const CATALOGO_ACESSOS: MenuAcesso[] = [
  { chave: 'painel', nome: 'Painel', grupos: [
    { nome: 'Telas', itens: [
      { chave: 'painel.sala', nome: 'Sala de Situação' },
      { chave: 'painel.mapa', nome: 'Mapa das ocorrências' },
      { chave: 'painel.relatorios', nome: 'Relatórios' },
    ] },
  ] },
  { chave: 'os', nome: 'Ordens de Serviço', grupos: [
    { nome: 'Telas', itens: [
      { chave: 'os.lista', nome: 'Lista de OS' },
      { chave: 'os.minhas', nome: 'Minhas OS (celular)' },
      { chave: 'os.central', nome: 'Central do Munícipe' },
    ] },
    { nome: 'Passos', fluxo: true, itens: [
      { chave: 'os.abrir', nome: 'Abrir OS / ocorrência', etapa: 'Registrada' },
      { chave: 'os.triar', nome: 'Triar pedido do munícipe', etapa: 'vira OS ou recusa' },
      { chave: 'os.aprovar', nome: 'Aprovar abertura de OS', etapa: 'sai de Aguardando aprovação' },
      { chave: 'os.baixa', nome: 'Dar baixa com foto', etapa: 'Executada' },
      { chave: 'os.conferir', nome: 'Conferir a baixa', etapa: 'Finalizada' },
      { chave: 'os.reabrir', nome: 'Reabrir OS', etapa: 'volta para Registrada' },
      { chave: 'os.cancelar', nome: 'Cancelar OS', etapa: 'Cancelada' },
    ] },
  ] },
  { chave: 'compras', nome: 'Compras', grupos: [
    { nome: 'Telas', itens: [
      { chave: 'compras.orcamentos', nome: 'Orçamentos' },
      { chave: 'compras.pedidos', nome: 'Pedidos' },
      { chave: 'compras.saldos', nome: 'Saldos dos contratos' },
    ] },
    { nome: 'Passos', fluxo: true, itens: [
      { chave: 'compras.orcar', nome: 'Fazer orçamento', etapa: 'Orçamento' },
      { chave: 'compras.lancar', nome: 'Lançar pedido', etapa: 'Rascunho' },
      { chave: 'compras.revisar', nome: 'Revisar pedido', etapa: 'Em revisão' },
      { chave: 'compras.aprovar', nome: 'Aprovar pedido', etapa: 'Aprovado' },
      { chave: 'compras.enviar', nome: 'Enviar ao fornecedor', etapa: 'Enviado' },
      { chave: 'compras.receber', nome: 'Registrar recebimento', etapa: 'Recebido' },
    ] },
  ] },
  { chave: 'contratos', nome: 'Contratos', grupos: [
    { nome: 'Telas e ações', itens: [
      { chave: 'contratos.ver', nome: 'Ver licitações e contratos' },
      { chave: 'contratos.cadastrar', nome: 'Cadastrar licitação e contrato' },
      { chave: 'contratos.aditivo', nome: 'Lançar aditivo' },
      { chave: 'contratos.importar', nome: 'Importar itens da planilha' },
    ] },
  ] },
  { chave: 'cadastros', nome: 'Cadastros', grupos: [
    { nome: 'Passos do cadastro', itens: [
      { chave: 'cad.orgao', nome: 'Órgão' },
      { chave: 'cad.lugares', nome: 'Lugares' },
      { chave: 'cad.pessoas', nome: 'Pessoas' },
      { chave: 'cad.veiculos', nome: 'Veículos e equipamentos' },
      { chave: 'cad.centros', nome: 'Centros de custo' },
      { chave: 'cad.servicos', nome: 'Serviços' },
      { chave: 'cad.regras', nome: 'Regras de trabalho' },
    ] },
  ] },
];

export const TODAS_CHAVES: string[] = CATALOGO_ACESSOS.flatMap(m => m.grupos.flatMap(g => g.itens.map(i => i.chave)));
const VALIDAS = new Set(TODAS_CHAVES);

export function limparChaves(chaves: string[]): string[] {
  return Array.from(new Set(chaves.filter(c => VALIDAS.has(c))));
}

/** Modelos de acesso (o antigo "perfil"): só pré-marcam as caixas */
export const MODELOS: Record<string, { nome: string; descricao: string; admin: boolean; chaves: string[] }> = {
  ADMIN: { nome: 'Administrador', descricao: 'Tudo marcado.', admin: true, chaves: TODAS_CHAVES },
  COORDENADOR: {
    nome: 'Coordenador', descricao: 'Aprova OS, confere baixa, aprova pedido.', admin: false,
    chaves: ['painel.sala', 'painel.mapa', 'painel.relatorios', 'os.lista', 'os.minhas', 'os.central', 'os.abrir', 'os.triar', 'os.aprovar', 'os.conferir', 'os.reabrir', 'os.cancelar',
      'compras.orcamentos', 'compras.pedidos', 'compras.saldos', 'compras.aprovar', 'contratos.ver'],
  },
  FISCAL: {
    nome: 'Fiscal', descricao: 'Abre OS, dá baixa com foto, faz orçamento.', admin: false,
    chaves: ['painel.sala', 'painel.mapa', 'os.lista', 'os.minhas', 'os.abrir', 'os.baixa', 'compras.orcamentos', 'compras.pedidos', 'compras.saldos', 'compras.orcar', 'compras.lancar', 'contratos.ver'],
  },
  COMPRAS: {
    nome: 'Compras e almoxarifado', descricao: 'Revisa e envia pedido, registra recebimento.', admin: false,
    chaves: ['painel.sala', 'compras.orcamentos', 'compras.pedidos', 'compras.saldos', 'compras.revisar', 'compras.enviar', 'compras.receber', 'contratos.ver'],
  },
  CONSULTA: {
    nome: 'Consulta', descricao: 'Só vê o painel e os relatórios.', admin: false,
    chaves: ['painel.sala', 'painel.mapa', 'painel.relatorios'],
  },
};

export const ORDEM_MODELOS = ['ADMIN', 'COORDENADOR', 'FISCAL', 'COMPRAS', 'CONSULTA'] as const;

/** Que caixas liberam cada permissão antiga (as rotas antigas continuam valendo) */
const PERMISSAO_POR_CAIXA: Record<string, string[]> = {
  'dashboard.view': ['painel.sala', 'painel.mapa', 'painel.relatorios'],
  'centros_custo.view': TODAS_CHAVES.filter(c => c.startsWith('os.') || c.startsWith('compras.') || c.startsWith('cad.') || c === 'painel.mapa'),
  'centros_custo.registros.edit': ['os.abrir', 'os.baixa'],
  'centros_custo.manage': ['cad.orgao', 'cad.lugares', 'cad.veiculos', 'cad.centros', 'cad.servicos'],
  'centros_custo.propriedades.manage': ['cad.servicos'],
  'licitacoes.view': ['contratos.ver', 'compras.orcamentos', 'compras.pedidos', 'compras.saldos', 'compras.orcar', 'compras.lancar'],
  'licitacoes.manage': ['contratos.cadastrar', 'contratos.aditivo'],
  'licitacoes.items.import': ['contratos.importar'],
  'licitacoes.items.deactivate': ['contratos.cadastrar'],
  'users.view': ['cad.pessoas'],
  'users.manage': ['cad.pessoas'],
};

export const TODAS_PERMISSOES = Object.keys(PERMISSAO_POR_CAIXA);

export function permissoesDasCaixas(chaves: string[], admin: boolean): string[] {
  if (admin) return TODAS_PERMISSOES;
  const tem = new Set(chaves);
  return TODAS_PERMISSOES.filter(p => PERMISSAO_POR_CAIXA[p].some(c => tem.has(c)));
}

export interface QuemAge { admin: boolean; acessos: string[] }
export function pode(u: QuemAge, chave: string) {
  return u.admin || u.acessos.includes(chave);
}

/** Poderes no fluxo da OS e das compras (antes vinham do perfil na tela Regras) */
export function poderesFluxo(u: QuemAge) {
  return {
    podeAprovar: pode(u, 'os.aprovar'),
    podeConferir: pode(u, 'os.conferir'),
    podeReabrir: pode(u, 'os.reabrir'),
    podeCancelar: pode(u, 'os.cancelar'),
    podeTriar: pode(u, 'os.triar'),
    podeRevisarCompra: pode(u, 'compras.revisar'),
    podeAprovarCompra: pode(u, 'compras.aprovar'),
    podeEnviarCompra: pode(u, 'compras.enviar'),
    podeReceberCompra: pode(u, 'compras.receber'),
    podeLancarCompra: pode(u, 'compras.lancar') || pode(u, 'compras.orcar'),
  };
}
