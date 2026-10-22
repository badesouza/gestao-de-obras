import { ROTAS_VARRICAO, SERVICOS_CONFIG, SLUG_POR_CENTRO_ID } from '../servico-config';
import { CATEGORIAS_CIDADAO } from '../../components/obras/categorias';
import type { CampoServico, CamposComuns, ItemFrotaSimples, MomentoCampo, TipoServico } from '../../../lib/api-client';

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

/** Campos de equipamento/veículo que hoje estão escritos dentro de cada serviço */
const CAMPOS_EQUIP = ['Equipamento Utilizado', 'Veículo', 'Veículo / Equipamento'];

export const CORES = [
  ['Azul aço', '#5b8db8'], ['Vermelho', '#dc2626'], ['Laranja', '#f97316'], ['Verde', '#16a34a'], ['Verde claro', '#22c55e'],
  ['Ciano', '#06b6d4'], ['Céu', '#0ea5e9'], ['Azul', '#3b82f6'], ['Lilás', '#a78bfa'], ['Rosa', '#ec4899'], ['Cinza', '#64748b'], ['Prata', '#94a3b8'],
] as const;

export function padroesDoServico(servicoId: string) {
  const slug = SLUG_POR_CENTRO_ID[servicoId];
  const cfg = slug ? SERVICOS_CONFIG[slug] : undefined;
  const cat = slug ? CATEGORIAS_CIDADAO.find(c => c.servicoSlug === slug) : undefined;
  const subtipos = cfg?.campos.find(c => c.nome === 'Tipo de Serviço')?.opcoes?.filter(o => o !== 'Outro') ?? [];
  const proprios = (cfg?.campos ?? []).filter(c => !COMUNS.has(c.nome));
  /* números soltos (área, extensão, volume, horas) viram uma ação só: "Medição", uma atividade por medida */
  const numeros = proprios.filter(c => c.tipo === 'numero');
  const medicao: CampoServico[] = numeros.length ? [{
    nome: 'Medição', detalhe: null, tipo: 'NUMERO' as const, opcoes: numeros.map(c => (c.label || c.nome).replace(/\s+Tapa/, '')),
    momento: 'BAIXA', obrigatorio: numeros.some(c => c.obrigatorio),
  }] : [];
  const campos: CampoServico[] = [...medicao, ...proprios.filter(c => c.tipo !== 'numero').map((c): CampoServico => ({
    nome: c.label || c.nome,
    detalhe: c.placeholder && !/^0[.,]0/.test(c.placeholder) ? c.placeholder : null,
    tipo: c.tipo === 'select' ? 'LISTA' : c.tipo === 'numero' ? 'NUMERO' : c.tipo === 'boolean' ? 'SIM_NAO' : 'TEXTO',
    opcoes: c.tipo === 'select' ? c.opcoes ?? [] : [],
    momento: (NA_ABERTURA.test(c.nome) ? 'ABERTURA' : 'BAIXA') as MomentoCampo,
    obrigatorio: !!c.obrigatorio,
  }))];
  const tipo: TipoServico = slug === 'construcao-civil' || slug === 'serralheria' ? 'CONSTRUCAO' : 'MANUTENCAO';
  const tem = (nome: string) => !!cfg?.campos.some(c => c.nome === nome);
  const nomesEquip = (cfg?.campos ?? []).filter(c => CAMPOS_EQUIP.includes(c.nome)).flatMap(c => c.opcoes ?? []).filter(o => o !== 'Outro');
  const local: CamposComuns['local'] = slug === 'varricao' ? { tipo: 'ROTA', lista: [...ROTAS_VARRICAO] }
    : slug === 'pracas-jardins' ? { tipo: 'LOCAL', lista: [] }
      : slug === 'oficina' ? { tipo: 'VEICULO', lista: [] }
        : { tipo: 'ENDERECO', lista: [] };
  return {
    slug: slug ?? null,
    cor: cfg?.cor ?? '#5b8db8',
    subtipos,
    campos,
    tipoServico: tipo,
    municipePode: !!cat,
    nomeMunicipe: cat ? `${cat.nome} (${cat.dica.toLowerCase()})` : null,
    /** campos comuns como estão hoje (equipamentos: casados pelo nome com o cadastro) */
    camposComuns: (frota: ItemFrotaSimples[]): CamposComuns => ({
      local,
      origem: { usa: !cfg || tem('Origem da Demanda'), obrigatorio: false },
      equipe: { usa: !cfg || tem('Equipe / Turma'), obrigatorio: false },
      veiculo: { usa: nomesEquip.length > 0, obrigatorio: false },
      fotos: { usa: true, obrigatorio: false },
      observacoes: { usa: !cfg || tem('Observações'), obrigatorio: false },
      equipamentos: frota.filter(f => nomesEquip.some(n => n.toLowerCase() === f.nome.toLowerCase() || n.toLowerCase() === (f.subtipo ?? '').toLowerCase())).map(f => f.id),
    }),
  };
}

/** Campos comuns de um serviço novo: tudo ligado, acontece num endereço */
export function camposComunsNovos(): CamposComuns {
  return {
    local: { tipo: 'ENDERECO', lista: [] },
    origem: { usa: true, obrigatorio: false }, equipe: { usa: true, obrigatorio: false }, veiculo: { usa: false, obrigatorio: false },
    fotos: { usa: true, obrigatorio: false }, observacoes: { usa: true, obrigatorio: false }, equipamentos: [],
  };
}
