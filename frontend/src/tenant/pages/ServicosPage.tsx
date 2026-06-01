import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BrickWall,
  Brush,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Grid3X3,
  Hammer,
  House,
  Lamp,
  Layers3,
  Leaf,
  List,
  MapPin,
  Paintbrush,
  Search,
  Shovel,
  Sparkles,
  Sprout,
  Tags,
  Trash2,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { ServicoInstrucoesDrawer } from '../components/ServicoInstrucoesDrawer';

interface Servico {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  Icon: LucideIcon;
  cor: string;
  categoria: string;
  foco: string;
  metricas: string[];
  status: 'ativo' | 'inativo';
}

const SERVICOS: Servico[] = [
  {
    id: 'rocagem',
    slug: 'rocagem',
    nome: 'Rocagem',
    descricao: 'Controle de rocagem de vias, terrenos e areas publicas.',
    Icon: Sprout,
    cor: '#22c55e',
    categoria: 'Manutencao verde',
    foco: 'Areas publicas',
    metricas: ['Area rocada (m2)', 'Extensao (m)', 'Equipe', 'Equipamento'],
    status: 'ativo',
  },
  {
    id: 'coleta-entulhos',
    slug: 'coleta-entulhos',
    nome: 'Coleta de Entulhos',
    descricao: 'Registro de coleta e descarte de residuos e entulhos urbanos.',
    Icon: Trash2,
    cor: '#f97316',
    categoria: 'Limpeza urbana',
    foco: 'Residuos',
    metricas: ['Volume (m3)', 'Veiculo', 'Horas trabalhadas', 'Tipo de residuo'],
    status: 'ativo',
  },
  {
    id: 'construcao-civil',
    slug: 'construcao-civil',
    nome: 'Construcao Civil',
    descricao: 'Acompanhamento de obras e servicos de construcao civil.',
    Icon: BrickWall,
    cor: '#3b82f6',
    categoria: 'Obras',
    foco: 'Execucao',
    metricas: ['Area executada (m2)', 'Extensao (m)', 'Numero OS', 'Status'],
    status: 'ativo',
  },
  {
    id: 'encascalhamento',
    slug: 'encascalhamento',
    nome: 'Encascalhamento',
    descricao: 'Registro de encascalhamento de vias e acessos rurais.',
    Icon: Truck,
    cor: '#a78bfa',
    categoria: 'Infraestrutura viaria',
    foco: 'Acessos rurais',
    metricas: ['Volume (m3)', 'Extensao (m)', 'Equipamento', 'Equipe'],
    status: 'ativo',
  },
  {
    id: 'iluminacao',
    slug: 'iluminacao',
    nome: 'Iluminacao Publica',
    descricao: 'Manutencao e instalacao de luminarias na rede publica.',
    Icon: Lamp,
    cor: '#5b8db8',
    categoria: 'Rede publica',
    foco: 'Luminarias',
    metricas: ['Tipo de luminaria', 'Equipe', 'Origem da demanda', 'Status'],
    status: 'ativo',
  },
  {
    id: 'oficina',
    slug: 'oficina',
    nome: 'Oficina / Frota',
    descricao: 'Manutencao de veiculos e equipamentos da secretaria.',
    Icon: Wrench,
    cor: '#64748b',
    categoria: 'Frota',
    foco: 'Equipamentos',
    metricas: ['Placa / Patrimonio', 'Defeito', 'Pecas utilizadas', 'Mecanico'],
    status: 'ativo',
  },
  {
    id: 'pintura',
    slug: 'pintura',
    nome: 'Pintura',
    descricao: 'Servicos de pintura de vias, meio-fio e espacos publicos.',
    Icon: Paintbrush,
    cor: '#ec4899',
    categoria: 'Conservacao',
    foco: 'Sinalizacao',
    metricas: ['Area pintada (m2)', 'Tipo de tinta', 'Equipe', 'Status'],
    status: 'ativo',
  },
  {
    id: 'poda-arvores',
    slug: 'poda-arvores',
    nome: 'Poda de Arvores',
    descricao: 'Poda e manejo de arborizacao urbana e vias publicas.',
    Icon: Leaf,
    cor: '#16a34a',
    categoria: 'Arborizacao',
    foco: 'Manejo urbano',
    metricas: ['Especie', 'Porte', 'Residuo recolhido', 'Equipe'],
    status: 'ativo',
  },
  {
    id: 'pracas-jardins',
    slug: 'pracas-jardins',
    nome: 'Pracas e Jardins',
    descricao: 'Manutencao e conservacao de pracas e jardins publicos.',
    Icon: House,
    cor: '#0ea5e9',
    categoria: 'Espacos publicos',
    foco: 'Pracas',
    metricas: ['Nome da praca', 'Situacao do espaco', 'Equipe', 'Tipo de servico'],
    status: 'ativo',
  },
  {
    id: 'serralheria',
    slug: 'serralheria',
    nome: 'Serralheria',
    descricao: 'Fabricacao e manutencao de estruturas metalicas publicas.',
    Icon: Hammer,
    cor: '#94a3b8',
    categoria: 'Manutencao tecnica',
    foco: 'Estruturas',
    metricas: ['Material utilizado', 'Equipe', 'Local de destino', 'Tipo de servico'],
    status: 'ativo',
  },
  {
    id: 'tapa-buracos',
    slug: 'tapa-buracos',
    nome: 'Tapa-Buracos',
    descricao: 'Registro de operacoes de tapa-buracos em vias publicas.',
    Icon: Shovel,
    cor: '#dc2626',
    categoria: 'Pavimentacao',
    foco: 'Vias publicas',
    metricas: ['Localizacao', 'Responsavel tecnico', 'Meta mensal', 'Status'],
    status: 'ativo',
  },
  {
    id: 'varricao',
    slug: 'varricao',
    nome: 'Varricao',
    descricao: 'Controle de varricao de ruas por rotas, distrito e turno.',
    Icon: Brush,
    cor: '#06b6d4',
    categoria: 'Limpeza urbana',
    foco: 'Rotas',
    metricas: ['Rota / Distrito', 'Prevista vs executada', 'Turno', 'Fiscal'],
    status: 'ativo',
  },
];

const categorias = Array.from(new Set(SERVICOS.map((servico) => servico.categoria)));

export function ServicosPage() {
  const { id: entityId } = useParams<{ id: string }>();
  const [busca, setBusca] = useState('');
  const [view, setView] = useState<'card' | 'lista'>('card');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ajudaSlug, setAjudaSlug] = useState<string | null>(null);
  const [ajudaNome, setAjudaNome] = useState('');
  const [ajudaCor, setAjudaCor] = useState('');

  const abrirAjuda = useCallback((e: MouseEvent, slug: string, nome: string, cor: string) => {
    e.preventDefault();
    e.stopPropagation();
    setAjudaSlug(slug);
    setAjudaNome(nome);
    setAjudaCor(cor);
  }, []);

  const filtered = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return SERVICOS;

    return SERVICOS.filter((servico) =>
      [servico.nome, servico.descricao, servico.categoria, servico.foco, ...servico.metricas]
        .some((campo) => campo.toLowerCase().includes(termo)),
    );
  }, [busca]);

  const ativos = SERVICOS.filter((servico) => servico.status === 'ativo').length;
  const totalCampos = SERVICOS.reduce((total, servico) => total + servico.metricas.length, 0);

  return (
    <div className="tn-page sv-services-page">
      <section className="sv-ops-hero">
        <div className="sv-ops-hero-grid" />
        <div className="sv-ops-hero-copy">
          <span className="sv-hero-kicker">
            <Sparkles size={14} />
            Operacao urbana integrada
          </span>
          <h2>Servicos Urbanos</h2>
          <p>Registro diario, indicadores e execucao por modulo para a Secretaria de Obras.</p>
          <div className="sv-hero-badges">
            <span><BadgeCheck size={14} /> {ativos} modulos ativos</span>
            <span><MapPin size={14} /> Itaberaba</span>
            <span><Activity size={14} /> Registro diario</span>
          </div>
        </div>
        <div className="sv-hero-console" aria-hidden="true">
          <div className="sv-console-top">
            <span />
            <span />
            <span />
          </div>
          <div className="sv-console-map">
            {SERVICOS.slice(0, 8).map((servico, index) => (
              <i
                key={servico.id}
                style={{
                  '--sv-cor': servico.cor,
                  '--pin-x': `${14 + ((index * 23) % 72)}%`,
                  '--pin-y': `${22 + ((index * 17) % 58)}%`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="sv-kpi-strip">
        <div className="sv-kpi-card tone-blue">
          <ClipboardList size={20} />
          <span>Total de servicos</span>
          <strong>{SERVICOS.length}</strong>
          <small>Modulos cadastrados</small>
        </div>
        <div className="sv-kpi-card tone-green">
          <CheckCircle2 size={20} />
          <span>Servicos ativos</span>
          <strong>{ativos}</strong>
          <small>Disponiveis para operacao</small>
        </div>
        <div className="sv-kpi-card tone-cyan">
          <Tags size={20} />
          <span>Campos chave</span>
          <strong>{totalCampos}</strong>
          <small>Metricas acompanhadas</small>
        </div>
        <div className="sv-kpi-card tone-amber">
          <Layers3 size={20} />
          <span>Categorias</span>
          <strong>{categorias.length}</strong>
          <small>Frentes de trabalho</small>
        </div>
      </div>

      <section className="tn-panel sv-services-panel">
        <div className="tn-panel-head sv-services-head">
          <div className="tn-panel-head-left">
            <span>Catalogo operacional</span>
            <h3>Servicos cadastrados</h3>
          </div>
          <div className="sv-panel-actions">
            <div className="sv-view-toggle" aria-label="Alternar visualizacao">
              <button
                type="button"
                className={`sv-view-btn${view === 'card' ? ' is-active' : ''}`}
                onClick={() => setView('card')}
                title="Visualizacao em cards"
              >
                <Grid3X3 size={14} />
                Cards
              </button>
              <button
                type="button"
                className={`sv-view-btn${view === 'lista' ? ' is-active' : ''}`}
                onClick={() => setView('lista')}
                title="Visualizacao em lista"
              >
                <List size={14} />
                Lista
              </button>
            </div>

            <label className="sv-search-wrap">
              <Search className="sv-search-icon" size={14} />
              <input
                className="sv-search"
                type="search"
                placeholder="Buscar servico..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>
          </div>
        </div>

        {view === 'card' && (
          <div className="sv-grid sv-services-grid">
            {filtered.map((servico, idx) => (
              <Link
                key={servico.id}
                to={`/t/${entityId}/servicos/${servico.slug}`}
                className="sv-card sv-service-card"
                style={{ '--sv-delay': `${idx * 0.035}s`, '--sv-cor': servico.cor } as React.CSSProperties}
              >
                <button
                  type="button"
                  className="sv-help-btn"
                  style={{ '--sv-cor': servico.cor } as React.CSSProperties}
                  onClick={(e) => abrirAjuda(e, servico.slug, servico.nome, servico.cor)}
                  title="Ver instrucoes de uso"
                >
                  <CircleHelp size={14} />
                </button>

                <div className="sv-card-bar" />
                <div className="sv-card-inner">
                  <div className="sv-card-head">
                    <div className="sv-card-icon">
                      <servico.Icon size={25} strokeWidth={1.9} />
                    </div>
                    <div className="sv-status-stack">
                      <span className="sv-status-pill"><i />Ativo</span>
                      <span className="sv-count-pill">{servico.metricas.length} campos</span>
                    </div>
                  </div>

                  <div className="sv-card-body">
                    <span className="sv-category">{servico.categoria}</span>
                    <strong className="sv-card-nome">{servico.nome}</strong>
                    <p className="sv-card-desc">{servico.descricao}</p>
                  </div>

                  <div className="sv-card-metricas">
                    {servico.metricas.map((metrica) => (
                      <span key={metrica} className="sv-metrica">{metrica}</span>
                    ))}
                  </div>

                  <div className="sv-card-footer">
                    <span className="sv-focus-label">{servico.foco}</span>
                    <span className="sv-card-cta">
                      Abrir registro
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {filtered.length === 0 && (
              <div className="sv-empty">
                <Search size={32} />
                <strong>Nenhum servico encontrado</strong>
                <span>Tente outro termo de busca.</span>
              </div>
            )}
          </div>
        )}

        {view === 'lista' && (
          <div className="tn-accordion-list sv-services-list">
            {filtered.map((servico, idx) => {
              const isOpen = expandedId === servico.id;
              return (
                <div
                  key={servico.id}
                  className={`tn-acc-item sv-list-item${isOpen ? ' is-open' : ''}`}
                  style={{ '--item-delay': `${idx * 0.03}s`, '--sv-cor': servico.cor } as React.CSSProperties}
                >
                  <div className="tn-acc-head sv-acc-head" onClick={() => setExpandedId(isOpen ? null : servico.id)}>
                    <div className="sv-acc-icon">
                      <servico.Icon size={21} strokeWidth={1.9} />
                    </div>

                    <div className="tn-acc-main">
                      <strong>{servico.nome}</strong>
                      <span>{servico.descricao}</span>
                    </div>

                    <div className="tn-acc-col sv-acc-metricas-col">
                      <span className="tn-acc-col-label">Campos registrados</span>
                      <div className="sv-acc-metricas-inline">
                        {servico.metricas.slice(0, 3).map((metrica) => (
                          <span key={metrica} className="sv-metrica">{metrica}</span>
                        ))}
                        {servico.metricas.length > 3 && (
                          <span className="sv-metrica">+{servico.metricas.length - 3}</span>
                        )}
                      </div>
                    </div>

                    <div className="tn-acc-col">
                      <span className="tn-acc-col-label">Status</span>
                      <span className="tn-acc-col-val">
                        <span className="sv-status-pill"><i />Ativo</span>
                      </span>
                    </div>

                    <div className="tn-acc-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="sv-help-btn-list"
                        style={{ '--sv-cor': servico.cor } as React.CSSProperties}
                        onClick={(e) => abrirAjuda(e, servico.slug, servico.nome, servico.cor)}
                        title="Ver instrucoes de uso"
                      >
                        <CircleHelp size={14} />
                      </button>
                      <Link
                        to={`/t/${entityId}/servicos/${servico.slug}`}
                        className="tn-icon-btn"
                        title="Abrir registro"
                      >
                        <ArrowRight size={15} />
                      </Link>
                    </div>

                    <div className="tn-acc-chevron">
                      <ChevronDown size={15} />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="tn-acc-body">
                      <div className="tn-acc-body-grid">
                        {servico.metricas.map((metrica) => (
                          <div key={metrica} className="tn-acc-body-field">
                            <span>Campo registrado</span>
                            <strong>{metrica}</strong>
                          </div>
                        ))}
                        <div className="tn-acc-body-field">
                          <span>Tipo</span>
                          <strong>Registro diario</strong>
                        </div>
                      </div>
                      <div className="tn-acc-body-actions">
                        <Link to={`/t/${entityId}/servicos/${servico.slug}`} className="tn-btn-secondary">
                          <ArrowRight size={13} />
                          Abrir registro diario
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="sv-empty">
                <AlertTriangle size={32} />
                <strong>Nenhum servico encontrado</strong>
                <span>Tente outro termo de busca.</span>
              </div>
            )}
          </div>
        )}
      </section>

      <ServicoInstrucoesDrawer
        slug={ajudaSlug}
        nomeServico={ajudaNome}
        corServico={ajudaCor}
        onClose={() => setAjudaSlug(null)}
      />
    </div>
  );
}
