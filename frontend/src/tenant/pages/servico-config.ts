import { createElement } from 'react';

export interface CampoConfig {
  nome: string;       // nome da propriedade no banco
  label: string;      // label no formulário
  tipo: 'texto' | 'numero' | 'boolean' | 'select';
  opcoes?: string[];  // para tipo select
  placeholder?: string;
  obrigatorio?: boolean;
}

export interface ServicoConfig {
  slug: string;
  nome: string;
  descricao: string;
  cor: string;
  icon: React.ReactNode;
  iconPath: string; // SVG path string para uso no Leaflet e nos cards
  camposPrincipais: string[]; // nomes a mostrar na lista (até 4)
  campos: CampoConfig[];
}

/* ── ícones SVG inline ─────────────────────────────────────────── */
const svg = (path: string) =>
  createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6' },
    createElement('path', { d: path })
  );

/* ── listas compartilhadas extraídas das planilhas ───────────── */
const BAIRROS = [
  'Açude Novo','Barro Vermelho','Batalhão','Brisas da Chapada',
  'Campo do Governo','Centro','Coelba','Costa e Silva','Derba',
  'Escurinha','Estrela do Sol','Gran Bahia','Jardim das Palmeiras',
  'Luar de Itaberaba','Malvinas','Morada dos Sonhos','Nova Itaberaba',
  'Nova Opção','Primavera','Recanto das Palmeiras','RM','São João',
  'Sem Teto','Universitário','Urbis',
];

const ORIGENS = ['Ouvidoria','Vistoria Própria','Munícipe','Vereador','Secretaria','Outros'];
const STATUS_PADRAO = ['Em Andamento','Concluído','Pendente','Cancelado'];
const EQUIPES = ['Equipe A','Equipe B','Equipe C','Equipe D','Outra'];

const ROTAS_VARRICAO = [
  'São João / Nova Itaberaba',
  'R. L. Fernandes Serra / Av. Rui Barbosa',
  'Rua da Palmeira e Rodoviária',
  'Irmã Dulce / Res. Itaberaba-RM',
  'Barro Vermelho – Lado A',
  'Barro Vermelho – Lado B',
  'Vida Nova Itaberaba – Predinhos',
  'Pç. Rosário / Liberdade / Formiga / Beira Rio',
  'Pç. J.J. Seabra / Av. Rio Branco',
  'Oriente',
  'Jardim Europa',
  'Bairro do Independente',
  'Campo do Governo / Pç. J. A. Mascarenhas',
  'Costa e Silva / CIPE Chapada',
  'Praça do Coqueiro',
  'Centro Financeiro',
  'Caititu',
  'Batalhão / CONCIC / Conj. Univ. / Bela Vista',
  'Av. Medeiros Neto e Imediações',
  'Av. Luís Viana Filho / Pç. João Leão',
  'Brigadeiro Eduardo Gomes / CETEP',
  'Açude Novo / Brisas / Estrela do Sol',
  'Morada dos Sonhos',
  'Paroquial',
  'Rua da Linha',
  'Lot. Bahia 01',
  'Gran Bahia',
  'Rua de Ipirá',
  'Sem Teto',
  'Urbis',
  'Hermes Bastos',
  'Escurinha',
  'Lot. Bahia 02',
  'Av. Getúlio Vargas',
  'Derba',
  'Pé do Monte',
  'Primavera',
  'Jardim das Palmeiras',
  'Orla Parques das Águas',
];

/* ── configuração dos 12 serviços ─────────────────────────────── */
export const SERVICOS_CONFIG: Record<string, ServicoConfig> = {

  'rocagem': {
    slug: 'rocagem', nome: 'Roçagem', cor: '#22c55e',
    descricao: 'Registro de roçagem de vias, terrenos e áreas públicas.',
    iconPath: 'M12 22V12M12 12C12 12 7 10 4 6c4 0 8 2 8 6zM12 12c0 0-5 10-5 10M12 12c0 0 5 10 5 10M7 3c2 1 4 4 5 9M17 3c-2 1-4 4-5 9',
    icon: svg('M12 2a10 10 0 100 20A10 10 0 0012 2zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01'),
    camposPrincipais: ['Bairro / Localidade', 'Tipo de Serviço', 'Área Roçada (m²)', 'Status'],
    campos: [
      { nome: 'Bairro / Localidade',    label: 'Bairro / Localidade',   tipo: 'select',  obrigatorio: true,  opcoes: BAIRROS },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Rua das Flores, próx. escola…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ORIGENS },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Roçagem Manual','Roçagem Mecanizada','Capina','Controle Químico','Limpeza de Margem','Outro'] },
      { nome: 'Área Roçada (m²)',       label: 'Área Roçada (m²)',      tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Extensão (m)',           label: 'Extensão (m)',          tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Equipamento Utilizado',  label: 'Equipamento',           tipo: 'select',  opcoes: ['Roçadeira Costal','Roçadeira Tratorizada','Motosserra','Trator','Outro'] },
      { nome: 'Horas Trabalhadas',      label: 'Horas Trabalhadas',     tipo: 'numero',  placeholder: '0.0' },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: EQUIPES },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: STATUS_PADRAO },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações adicionais…' },
    ],
  },

  'coleta-entulhos': {
    slug: 'coleta-entulhos', nome: 'Coleta de Entulhos', cor: '#f97316',
    descricao: 'Registro de coleta e descarte de resíduos e entulhos urbanos.',
    iconPath: 'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 16a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM18.5 16a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
    icon: svg('M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2'),
    camposPrincipais: ['Bairro / Localidade', 'Tipo de Resíduo', 'Volume Coletado (m³)', 'Status'],
    campos: [
      { nome: 'Bairro / Localidade',    label: 'Bairro / Localidade',   tipo: 'select',  obrigatorio: true,  opcoes: BAIRROS },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Rua das Flores…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ['Ouvidoria','Vistoria Própria','Munícipe','Vereador','Outros'] },
      { nome: 'Tipo de Resíduo',        label: 'Tipo de Resíduo',       tipo: 'select',  opcoes: ['Entulho de obra','Resíduo vegetal/poda','Resíduo volumoso/móvel','Misto','Outro'] },
      { nome: 'Volume Coletado (m³)',   label: 'Volume Coletado (m³)',  tipo: 'numero',  obrigatorio: true,  placeholder: '0.00' },
      { nome: 'Situação do Local',      label: 'Situação do Local',     tipo: 'select',  opcoes: ['Calçada','Via pública','Terreno baldio','Área pública'] },
      { nome: 'Horas Trabalhadas',      label: 'Horas Trabalhadas',     tipo: 'numero',  placeholder: '0.0' },
      { nome: 'Veículo',                label: 'Veículo',               tipo: 'select',  opcoes: ['Caminhão 01','Caminhão 02','Caminhão 03','Trator/Pá','Retroescavadeira','Outro'] },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: EQUIPES },
      { nome: 'Descarte Irregular?',    label: 'Descarte Irregular?',   tipo: 'boolean' },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: STATUS_PADRAO },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'construcao-civil': {
    slug: 'construcao-civil', nome: 'Construção Civil', cor: '#3b82f6',
    descricao: 'Acompanhamento de obras e serviços de construção civil.',
    iconPath: 'M2 20h20M6 20V10l6-6 6 6v10M9 20v-5h6v5',
    icon: svg('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10'),
    camposPrincipais: ['Nº da OS', 'Bairro / Localidade', 'Área Executada (m²)', 'Status'],
    campos: [
      { nome: 'Nº da OS',               label: 'Nº da OS',              tipo: 'texto',   obrigatorio: true,  placeholder: 'Ex: OS-2026-001' },
      { nome: 'Bairro / Localidade',    label: 'Bairro / Localidade',   tipo: 'select',  obrigatorio: true,  opcoes: BAIRROS },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Rua A…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ORIGENS },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Pavimentação','Recapeamento','Calçada/Passeio','Drenagem','Muro de Arrimo','Outros'] },
      { nome: 'Área Executada (m²)',    label: 'Área Executada (m²)',   tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Extensão Linear (m)',    label: 'Extensão Linear (m)',   tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: EQUIPES },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: ['Em Andamento','Concluído','Pendente','Cancelado'] },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'encascalhamento': {
    slug: 'encascalhamento', nome: 'Encascalhamento', cor: '#a78bfa',
    descricao: 'Registro de encascalhamento de vias e acessos rurais.',
    iconPath: 'M8 3L4 9h16l-4-6H8zM4 9c0 6 4 10 8 13 4-3 8-7 8-13',
    icon: svg('M1 3h15v13H1zM16 8h4l3 3v5h-7V8z'),
    camposPrincipais: ['Bairro / Localidade', 'Tipo de Serviço', 'Volume Coletado (m³)', 'Status'],
    campos: [
      { nome: 'Bairro / Localidade',    label: 'Bairro / Localidade',   tipo: 'select',  obrigatorio: true,  opcoes: BAIRROS },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Estrada vicinal…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ORIGENS },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Encascalhamento','Reforço','Nivelamento','Patrolamento'] },
      { nome: 'Volume Coletado (m³)',   label: 'Volume (m³)',           tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Extensão (m)',           label: 'Extensão (m)',          tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Equipamento Utilizado',  label: 'Equipamento',           tipo: 'select',  opcoes: ['Patrol','Retroescavadeira','Caminhão Basculante','Trator','Outro'] },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: EQUIPES },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: ['Em Andamento','Concluído','Pendente','Cancelado'] },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'iluminacao': {
    slug: 'iluminacao', nome: 'Iluminação Pública', cor: '#5b8db8',
    descricao: 'Manutenção e instalação de luminárias na rede pública.',
    iconPath: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 006 8c0 1.3.5 2.6 1.5 3.5.7.8 1.3 1.5 1.5 2.5M9 18h6M10 22h4',
    icon: svg('M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.5-1.3 4.7-3.3 6H8.3A7 7 0 0112 2z'),
    camposPrincipais: ['Bairro / Localidade', 'Tipo de Serviço', 'Tipo de Luminária', 'Status'],
    campos: [
      { nome: 'Bairro / Localidade',    label: 'Bairro / Localidade',   tipo: 'select',  obrigatorio: true,  opcoes: BAIRROS },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Rua A, poste nº…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ORIGENS },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Troca de Lâmpada','Reparo de Poste','Instalação Nova','Reparo de Fiação','Outros'] },
      { nome: 'Tipo de Luminária',      label: 'Tipo de Luminária',     tipo: 'select',  opcoes: ['LED','Vapor de Sódio','Vapor de Mercúrio','Mista','Outros'] },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: EQUIPES },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: ['Em Andamento','Concluído','Pendente','Cancelado'] },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'oficina': {
    slug: 'oficina', nome: 'Oficina / Frota', cor: '#64748b',
    descricao: 'Manutenção de veículos e equipamentos da secretaria.',
    iconPath: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
    icon: svg('M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z'),
    camposPrincipais: ['Veículo / Equipamento', 'Placa / Patrimônio', 'Defeito / Problema', 'Status'],
    campos: [
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  obrigatorio: true, opcoes: ['Preventiva','Corretiva','Troca de Peças','Funilaria','Elétrica','Mecânica'] },
      { nome: 'Veículo / Equipamento',  label: 'Veículo / Equipamento', tipo: 'texto',   obrigatorio: true,  placeholder: 'Ex: Caminhão Basculante…' },
      { nome: 'Placa / Patrimônio',     label: 'Placa / Patrimônio',    tipo: 'texto',   obrigatorio: true,  placeholder: 'Ex: ABC-1234 ou Patrimônio 001' },
      { nome: 'Mecânico Responsável',   label: 'Mecânico Responsável',  tipo: 'texto',   placeholder: 'Nome do mecânico…' },
      { nome: 'Defeito / Problema',     label: 'Defeito / Problema',    tipo: 'texto',   placeholder: 'Descreva o defeito com clareza…' },
      { nome: 'Peças Utilizadas',       label: 'Peças Utilizadas',      tipo: 'texto',   placeholder: 'Ex: Filtro de óleo, pastilha de freio…' },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: ['Em Andamento','Concluído','Aguardando Peça','Cancelado'] },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'pintura': {
    slug: 'pintura', nome: 'Pintura', cor: '#ec4899',
    descricao: 'Serviços de pintura de vias, meio-fio e espaços públicos.',
    iconPath: 'M19 3H5v10l9.29 9.29c.94.94 2.48.94 3.42 0l2.29-2.29c.94-.94.94-2.48 0-3.42L19 13V3zM6.9 3.29L14 10.4',
    icon: svg('M2 13.5V20a2 2 0 002 2h16a2 2 0 002-2v-6.5M2 13.5L12 2l10 11.5'),
    camposPrincipais: ['Bairro / Localidade', 'Tipo de Serviço', 'Área Pintada (m²)', 'Status'],
    campos: [
      { nome: 'Bairro / Localidade',    label: 'Bairro / Localidade',   tipo: 'select',  obrigatorio: true,  opcoes: BAIRROS },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Rua A…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ORIGENS },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Meio-fio','Muro/Parede','Faixa de Pedestre','Sinalização Viária','Prédio Público'] },
      { nome: 'Tipo de Tinta',          label: 'Tipo de Tinta',         tipo: 'select',  opcoes: ['Tinta Acrílica','Tinta a óleo','Tinta Epóxi','Tinta de Demarcação','Outros'] },
      { nome: 'Área Pintada (m²)',      label: 'Área Pintada (m²)',     tipo: 'numero',  obrigatorio: true,  placeholder: '0.00' },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: EQUIPES },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: STATUS_PADRAO },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'poda-arvores': {
    slug: 'poda-arvores', nome: 'Poda de Árvores', cor: '#16a34a',
    descricao: 'Poda e manejo de arborização urbana e vias públicas.',
    iconPath: 'M17 8C8 10 5.9 16.17 3.82 22h3.09c.33-1.15.66-2.34.98-3.5H14V22h2V8zM12 2a5 5 0 014.93 4.14C18.16 5.45 20 6.6 20 8c0 2.21-2 4-4 4h-1',
    icon: svg('M17 8C8 10 5.9 16.17 3.82 22h3.09c.33-1.15.66-2.34.98-3.5H14V22h2V8z'),
    camposPrincipais: ['Bairro / Localidade', 'Espécie da Árvore', 'Porte da Árvore', 'Status'],
    campos: [
      { nome: 'Bairro / Localidade',    label: 'Bairro / Localidade',   tipo: 'texto',   obrigatorio: true,  placeholder: 'Ex: Centro…' },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Rua A…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ['Ouvidoria','Vistoria Própria','Munícipe','Vereador','Secretaria','Outros'] },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Poda','Supressão','Roçagem','Limpeza de Canteiro','Remoção de Toco','Outro'] },
      { nome: 'Espécie da Árvore',      label: 'Espécie da Árvore',     tipo: 'texto',   placeholder: 'Ex: Mangueira, Ficus, Oiti…' },
      { nome: 'Porte da Árvore',        label: 'Porte da Árvore',       tipo: 'select',  opcoes: ['Pequeno (até 5m)','Médio (5–10m)','Grande (acima de 10m)'] },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: ['Equipe A','Equipe B','Equipe C'] },
      { nome: 'Resíduo Recolhido?',     label: 'Resíduo Recolhido?',    tipo: 'select',  opcoes: ['Sim','Não','Parcial'] },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: ['Em Andamento','Concluído','Pendente','Cancelado'] },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'pracas-jardins': {
    slug: 'pracas-jardins', nome: 'Praças e Jardins', cor: '#0ea5e9',
    descricao: 'Manutenção e conservação de praças e jardins públicos.',
    iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
    icon: svg('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
    camposPrincipais: ['Praça / Jardim / Local', 'Tipo de Serviço', 'Situação do Espaço', 'Status'],
    campos: [
      { nome: 'Praça / Jardim / Local', label: 'Praça / Jardim / Local',tipo: 'texto',   obrigatorio: true,  placeholder: 'Ex: Praça da Liberdade…' },
      { nome: 'Bairro / Localidade',    label: 'Bairro',                tipo: 'texto',   placeholder: 'Ex: Centro…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ['Ouvidoria','Vistoria Própria','Munícipe','Outros'] },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Capina','Jardinagem','Plantio','Irrigação','Limpeza Geral','Reforma de Canteiro'] },
      { nome: 'Situação do Espaço',     label: 'Situação do Espaço',    tipo: 'select',  opcoes: ['Boa','Regular','Precária'] },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: EQUIPES },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: STATUS_PADRAO },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'serralheria': {
    slug: 'serralheria', nome: 'Serralheria', cor: '#94a3b8',
    descricao: 'Fabricação e manutenção de estruturas metálicas públicas.',
    iconPath: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76zM2 22l4-4',
    icon: svg('M2 3h20v14H2zM8 21h8M12 17v4'),
    camposPrincipais: ['Bairro / Localidade', 'Tipo de Serviço', 'Material Utilizado', 'Status'],
    campos: [
      { nome: 'Bairro / Localidade',    label: 'Bairro / Local de Destino',tipo: 'texto', obrigatorio: true, placeholder: 'Ex: Centro…' },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Rua A…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ['Ouvidoria','Vistoria Própria','Munícipe','Outros'] },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Fabricação de Grade','Reparo de Portão','Corrimão','Estrutura','Solda','Outros'] },
      { nome: 'Material Utilizado',     label: 'Material Utilizado',    tipo: 'select',  opcoes: ['Ferro','Aço','Inox','Alumínio','Outros'] },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: ['Equipe A','Equipe B'] },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: ['Em Andamento','Concluído','Pendente','Cancelado'] },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'tapa-buracos': {
    slug: 'tapa-buracos', nome: 'Tapa-Buracos', cor: '#dc2626',
    descricao: 'Registro de operações de tapa-buracos em vias públicas.',
    iconPath: 'M2 22h20M6.87 2h10.26L20 7H4L6.87 2zM4 7v9a2 2 0 002 2h12a2 2 0 002-2V7M12 12v3M9.5 12H15',
    icon: svg('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z'),
    camposPrincipais: ['Bairro / Localidade', 'Tipo de Serviço', 'Área Executada Tapa (m²)', 'Status'],
    campos: [
      { nome: 'Bairro / Localidade',    label: 'Bairro / Localidade',   tipo: 'select',  obrigatorio: true,  opcoes: BAIRROS },
      { nome: 'Logradouro / Referência',label: 'Logradouro / Referência',tipo: 'texto',  placeholder: 'Ex: Rua A…' },
      { nome: 'Origem da Demanda',      label: 'Origem da Demanda',     tipo: 'select',  opcoes: ORIGENS },
      { nome: 'Tipo de Serviço',        label: 'Tipo de Serviço',       tipo: 'select',  opcoes: ['Tapa-Buraco','Remendo','Fresagem','Recapeamento Emergencial'] },
      { nome: 'Área Executada Tapa (m²)',label:'Área Executada (m²)',   tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Horas Trabalhadas Tapa', label: 'Horas Trabalhadas',     tipo: 'numero',  placeholder: '0.0' },
      { nome: 'Responsável Técnico',    label: 'Responsável Técnico',   tipo: 'texto',   placeholder: 'Nome do responsável…' },
      { nome: 'Equipe / Turma',         label: 'Equipe / Turma',        tipo: 'select',  opcoes: EQUIPES },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: STATUS_PADRAO },
      { nome: 'Observações',            label: 'Observações',           tipo: 'texto',   placeholder: 'Observações…' },
    ],
  },

  'varricao': {
    slug: 'varricao', nome: 'Varrição', cor: '#06b6d4',
    descricao: 'Controle de varrição de ruas por rotas, distrito e turno.',
    iconPath: 'M3 22l7-7M15 3L3 15l4 4L19 7l-4-4zM3 22l4-4M18 2l4 4-5.5 5.5',
    icon: svg('M3 3l18 18M3 21L21 3'),
    camposPrincipais: ['Rota / Local', 'Distrito', 'Extensão Executada (m)', 'Status'],
    campos: [
      { nome: 'Rota / Local',           label: 'Rota / Local',          tipo: 'select',  obrigatorio: true, opcoes: ROTAS_VARRICAO },
      { nome: 'Distrito',               label: 'Distrito',              tipo: 'select',  opcoes: ['Distrito 01','Distrito 02','Distrito 03','Distrito 04'] },
      { nome: 'Fiscal',                 label: 'Fiscal',                tipo: 'select',  opcoes: ['Lucas Neves','José Carvalho','Lucas Sena','Jucelino Salomão'] },
      { nome: 'Turno',                  label: 'Turno',                 tipo: 'select',  opcoes: ['Manhã','Tarde','Diário'] },
      { nome: 'Extensão Prevista (m)',  label: 'Extensão Prevista (m)', tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Extensão Executada (m)', label: 'Extensão Executada (m)',tipo: 'numero',  placeholder: '0.00' },
      { nome: 'Motivo Não Execução',    label: 'Motivo Não Execução',   tipo: 'select',  opcoes: ['—','Chuva','Falta de Agente','Feriado','Equipamento','Outro'] },
      { nome: 'Ocorrência',             label: 'Ocorrência',            tipo: 'texto',   placeholder: 'Descreva a ocorrência…' },
      { nome: 'Status',                 label: 'Status',                tipo: 'select',  obrigatorio: true, opcoes: ['Executado','Parcial','Não Executado'] },
    ],
  },

};

/* mapa slug → ID do centro de custo */
export const CENTRO_IDS: Record<string, string> = {
  'rocagem':          'ef72cabd-0ab6-42a9-8978-6d44de1d940c',
  'coleta-entulhos':  '539ff02b-e0e5-4525-8c18-1a4f647bfc29',
  'construcao-civil': 'a6bd332d-202f-41b6-a3a0-bd059aeb4761',
  'encascalhamento':  'e40d07b6-b38b-44f6-b713-b6e4da71b242',
  'iluminacao':       'e16eadbe-d466-4d3a-a24b-e5db2d613449',
  'oficina':          '2d9a7e4c-0fed-43e1-b837-cb3dbc06f2ec',
  'pintura':          'c86a6892-0f8e-4e01-86ef-bba0e939d34b',
  'poda-arvores':     '58847725-14e3-4e90-8826-4b0b046a5626',
  'pracas-jardins':   '23a199e4-1252-4dc0-a512-5abdce61c9a5',
  'serralheria':      'e13e1202-9bed-4c95-9dbd-9e284946acd5',
  'tapa-buracos':     '6cd588b8-a313-4f16-9dcd-04c488f713bc',
  'varricao':         '0e9678e5-8394-4b31-8514-2d6b36d9ea1c',
};
