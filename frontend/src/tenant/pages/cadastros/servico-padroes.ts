import { SERVICOS_CONFIG, SLUG_POR_CENTRO_ID } from '../servico-config';
import { CATEGORIAS_CIDADAO } from '../../components/obras/categorias';
import type { CampoServico, MomentoCampo, TipoServico } from '../../../lib/api-client';

/**
 * Enquanto a ficha de um serviço nunca foi salva, a tela parte do que hoje
 * está configurado no código das telas de operação (cor, tipos, campos e se o
 * munícipe pode pedir). Ao salvar, a ficha passa a valer pelo banco.
 */

/** Campos que vêm em toda OS: não entram na lista "só deste serviço" */
const COMUNS = new Set([
  'Bairro / Localidade', 'Logradouro / Referência', 'LOGRADOURO', 'Origem da Demanda', 'Tipo de Serviço', 'Equipe / Turma',
  'Status', 'Observações', 'Fiscal', 'Veículo', 'Veículo / Equipamento', 'Equipamento Utilizado', 'Foto Registrada?',
  'Nº da OS', 'ORDEM DE SERVICO', 'DATA INI', 'DATA FIM',
]);
const NA_ABERTURA = /defeito|ocorr|situa|porte|esp[eé]cie|pra[cç]a|rota|distrito|refer|motivo|descarte/i;

export const CAMPOS_FIXOS = [
  'Bairro e endereço (com GPS)', 'Origem do pedido', 'Subtipo do serviço', 'Equipe e quem trabalhou',
  'Veículo ou equipamento usado', 'Fotos do antes e do depois, com carimbo', 'Etapa da OS', 'Observações',
];

export const CORES = [
  ['Azul aço', '#5b8db8'], ['Vermelho', '#dc2626'], ['Laranja', '#f97316'], ['Verde', '#16a34a'], ['Verde claro', '#22c55e'],
  ['Ciano', '#06b6d4'], ['Céu', '#0ea5e9'], ['Azul', '#3b82f6'], ['Lilás', '#a78bfa'], ['Rosa', '#ec4899'], ['Cinza', '#64748b'], ['Prata', '#94a3b8'],
] as const;

export function padroesDoServico(servicoId: string) {
  const slug = SLUG_POR_CENTRO_ID[servicoId];
  const cfg = slug ? SERVICOS_CONFIG[slug] : undefined;
  const cat = slug ? CATEGORIAS_CIDADAO.find(c => c.servicoSlug === slug) : undefined;
  const subtipos = cfg?.campos.find(c => c.nome === 'Tipo de Serviço')?.opcoes?.filter(o => o !== 'Outro') ?? [];
  const campos: CampoServico[] = (cfg?.campos ?? []).filter(c => !COMUNS.has(c.nome)).map(c => ({
    nome: c.label || c.nome,
    detalhe: c.placeholder && !/^0[.,]0/.test(c.placeholder) ? c.placeholder : null,
    tipo: c.tipo === 'select' ? 'LISTA' : c.tipo === 'numero' ? 'NUMERO' : c.tipo === 'boolean' ? 'SIM_NAO' : 'TEXTO',
    opcoes: c.tipo === 'select' ? c.opcoes ?? [] : [],
    momento: (NA_ABERTURA.test(c.nome) ? 'ABERTURA' : 'BAIXA') as MomentoCampo,
    obrigatorio: !!c.obrigatorio,
  }));
  const tipo: TipoServico = slug === 'construcao-civil' || slug === 'serralheria' ? 'CONSTRUCAO' : 'MANUTENCAO';
  return {
    slug: slug ?? null,
    cor: cfg?.cor ?? '#5b8db8',
    subtipos,
    campos,
    tipoServico: tipo,
    municipePode: !!cat,
    nomeMunicipe: cat ? `${cat.nome} (${cat.dica.toLowerCase()})` : null,
  };
}
