import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { osApi, type LinhaOS } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { CENTRO_IDS } from './servico-config';
import { ServicoInstrucoesDrawer } from '../components/ServicoInstrucoesDrawer';
import { BarraAcoes, Cabecalho, Cartao, Ic, Pagina, Placar, Selo, Sep, rotaTenant } from '../components/sisobras/so';
import { IconeServico, MarcaServico } from './os/os-ui';

interface Servico {
  slug: string; nome: string; descricao: string; cor: string; categoria: string; foco: string; metricas: string[];
}

const SERVICOS: Servico[] = [
  { slug: 'rocagem', nome: 'Roçagem', descricao: 'Controle de roçagem de vias, terrenos e áreas públicas.', cor: '#22c55e', categoria: 'Manutenção verde', foco: 'Áreas públicas', metricas: ['Área roçada (m²)', 'Extensão (m)', 'Equipe', 'Equipamento'] },
  { slug: 'coleta-entulhos', nome: 'Coleta de Entulhos', descricao: 'Registro de coleta e descarte de resíduos e entulhos urbanos.', cor: '#f97316', categoria: 'Limpeza urbana', foco: 'Resíduos', metricas: ['Volume (m³)', 'Veículo', 'Horas trabalhadas', 'Tipo de resíduo'] },
  { slug: 'construcao-civil', nome: 'Construção Civil', descricao: 'Acompanhamento de obras e serviços de construção civil.', cor: '#3b82f6', categoria: 'Obras', foco: 'Execução', metricas: ['Área executada (m²)', 'Extensão (m)', 'Número da OS', 'Status'] },
  { slug: 'encascalhamento', nome: 'Encascalhamento', descricao: 'Registro de encascalhamento de vias e acessos rurais.', cor: '#a78bfa', categoria: 'Infraestrutura viária', foco: 'Acessos rurais', metricas: ['Volume (m³)', 'Extensão (m)', 'Equipamento', 'Equipe'] },
  { slug: 'iluminacao', nome: 'Iluminação Pública', descricao: 'Manutenção e instalação de luminárias na rede pública.', cor: '#5b8db8', categoria: 'Rede pública', foco: 'Luminárias', metricas: ['Tipo de luminária', 'Equipe', 'Origem da demanda', 'Status'] },
  { slug: 'oficina', nome: 'Oficina / Frota', descricao: 'Manutenção de veículos e equipamentos da secretaria.', cor: '#64748b', categoria: 'Frota', foco: 'Equipamentos', metricas: ['Placa / Patrimônio', 'Defeito', 'Peças utilizadas', 'Mecânico'] },
  { slug: 'pintura', nome: 'Pintura', descricao: 'Serviços de pintura de vias, meio-fio e espaços públicos.', cor: '#ec4899', categoria: 'Conservação', foco: 'Sinalização', metricas: ['Área pintada (m²)', 'Tipo de tinta', 'Equipe', 'Status'] },
  { slug: 'poda-arvores', nome: 'Poda de Árvores', descricao: 'Poda e manejo da arborização urbana e das vias públicas.', cor: '#16a34a', categoria: 'Arborização', foco: 'Manejo urbano', metricas: ['Espécie', 'Porte', 'Resíduo recolhido', 'Equipe'] },
  { slug: 'pracas-jardins', nome: 'Praças e Jardins', descricao: 'Manutenção e conservação de praças e jardins públicos.', cor: '#0ea5e9', categoria: 'Espaços públicos', foco: 'Praças', metricas: ['Nome da praça', 'Situação do espaço', 'Equipe', 'Tipo de serviço'] },
  { slug: 'serralheria', nome: 'Serralheria', descricao: 'Fabricação e manutenção de estruturas metálicas públicas.', cor: '#94a3b8', categoria: 'Manutenção técnica', foco: 'Estruturas', metricas: ['Material utilizado', 'Equipe', 'Local de destino', 'Tipo de serviço'] },
  { slug: 'tapa-buracos', nome: 'Tapa-Buracos', descricao: 'Registro de operações de tapa-buracos em vias públicas.', cor: '#dc2626', categoria: 'Pavimentação', foco: 'Vias públicas', metricas: ['Localização', 'Responsável técnico', 'Meta mensal', 'Status'] },
  { slug: 'varricao', nome: 'Varrição', descricao: 'Controle de varrição de ruas por rotas, distrito e turno.', cor: '#06b6d4', categoria: 'Limpeza urbana', foco: 'Rotas', metricas: ['Rota / Distrito', 'Prevista × executada', 'Turno', 'Fiscal'] },
];

interface Numeros { abertas: number; atrasadas: number; conferir: number; feitasMes: number }
const ZERO: Numeros = { abertas: 0, atrasadas: 0, conferir: 0, feitasMes: 0 };

/** Serviços Urbanos — catálogo dos serviços com os números ao vivo de cada um */
export function ServicosPage() {
  const { entityId, session } = useTenant();
  const nav = useNavigate();
  const [busca, setBusca] = useState('');
  const [view, setView] = useState<'card' | 'lista'>('card');
  const [ajuda, setAjuda] = useState<Servico | null>(null);
  const [linhas, setLinhas] = useState<LinhaOS[] | null>(null);

  useEffect(() => { osApi.painel(entityId).then(d => setLinhas(d.linhas)).catch(() => setLinhas([])); }, [entityId]);

  const permitidos = session.servicosPermitidos;
  const meus = useMemo(() => permitidos ? SERVICOS.filter(s => permitidos.includes(CENTRO_IDS[s.slug])) : SERVICOS, [permitidos]);
  const numeros = useMemo(() => {
    const m: Record<string, Numeros> = {};
    const mes = new Date().toISOString().slice(0, 7);
    for (const l of linhas ?? []) {
      const n = m[l.servico.id] ?? (m[l.servico.id] = { ...ZERO });
      if (l.etapa === 'AGUARDANDO_APROVACAO' || l.etapa === 'REGISTRADA' || l.etapa === 'EXECUTADA') n.abertas++;
      if (l.atrasada) n.atrasadas++;
      if (l.etapa === 'EXECUTADA') n.conferir++;
      if (l.executadoEm?.startsWith(mes)) n.feitasMes++;
    }
    return m;
  }, [linhas]);
  const num = (s: Servico) => numeros[CENTRO_IDS[s.slug]] ?? ZERO;
  const termo = busca.trim().toLowerCase();
  const filtrados = meus.filter(s => !termo || [s.nome, s.descricao, s.categoria, s.foco, ...s.metricas].some(c => c.toLowerCase().includes(termo)));
  const tot = meus.reduce((a, s) => { const n = num(s); return { abertas: a.abertas + n.abertas, atrasadas: a.atrasadas + n.atrasadas, conferir: a.conferir + n.conferir, feitasMes: a.feitasMes + n.feitasMes }; }, { ...ZERO });
  const categorias = new Set(meus.map(s => s.categoria)).size;
  const abrir = (s: Servico) => nav(rotaTenant(entityId, `servicos/${s.slug}`));

  return (
    <Pagina>
      <Cabecalho rotulo="Serviços Urbanos" selo={<Selo icone="wrench" />}
        eyebrow={<>Gestão de Obras · <Link to={rotaTenant(entityId, 'os')}>Ordens de Serviço</Link></>}
        titulo="Serviços Urbanos" extras={<span className="os-pill mint"><i />{meus.length} {meus.length === 1 ? 'serviço' : 'serviços'}</span>}
        sub="Cada serviço tem sua tela com as ocorrências do mês, análises, planejamento e solicitações de material."
        direita={<Placar n={linhas ? tot.abertas : '—'} de="OS" rotulo="abertas agora" />} />

      <section className="os-kpis" aria-label="Resumo">
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#635BFF,#8B85FF)', '--ks': 'rgba(99,91,255,.8)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg></span>Serviços</div>
          <div className="v"><span className="os-num">{meus.length}</span><span className="os-delta neutro">{categorias} frentes</span></div>
          <small>que você atende</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#10C6D4,#635BFF)', '--ks': 'rgba(16,198,212,.8)', '--kg': 'rgba(16,198,212,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg></span>Abertas agora</div>
          <div className="v"><span className="os-num" key={tot.abertas}>{linhas ? tot.abertas : '—'}</span></div>
          <small>somando todos os serviços</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#E5534B,#F59088)', '--ks': 'rgba(229,83,75,.8)', '--kg': 'rgba(229,83,75,.14)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>Atrasadas</div>
          <div className="v"><span className="os-num" key={tot.atrasadas} style={{ color: tot.atrasadas ? 'var(--coral)' : undefined }}>{linhas ? tot.atrasadas : '—'}</span></div>
          <small>passaram do prazo do serviço</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#19B88A,#10C6D4)', '--ks': 'rgba(25,184,138,.8)', '--kg': 'rgba(25,184,138,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span>Feitas no mês</div>
          <div className="v"><span className="os-num" key={tot.feitasMes}>{linhas ? tot.feitasMes : '—'}</span>{tot.conferir > 0 && <span className="os-pill cyan" style={{ height: 20, fontSize: 10.5 }}><i />{tot.conferir} a conferir</span>}</div>
          <small>baixas dadas em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}</small>
        </article>
      </section>

      <Cartao icone="wrench" titulo="Serviços" meta={`${filtrados.length} de ${meus.length}`} ajuda="Ajuda: Serviços Urbanos"
        direita={<>
          <div className="so-seg" role="radiogroup" aria-label="Como mostrar">
            <label className={view === 'card' ? 'on' : ''}><input type="radio" name="view" checked={view === 'card'} onChange={() => setView('card')} /><Ic n="layers" style={{ width: 14, height: 14 }} />Cartões</label>
            <label className={view === 'lista' ? 'on' : ''}><input type="radio" name="view" checked={view === 'lista'} onChange={() => setView('lista')} /><Ic n="list" style={{ width: 14, height: 14 }} />Lista</label>
          </div>
          <label className="so-field" style={{ width: 230 }}><span className="so-sr">Buscar serviço</span>
            <span className="so-ctrl"><Ic n="search" /><input type="search" placeholder="Buscar serviço…" value={busca} onChange={e => setBusca(e.target.value)} /></span>
          </label>
        </>}>
        {filtrados.length === 0 ? <p className="so-help" style={{ textAlign: 'center', padding: 18 }}>Nenhum serviço com esse nome.</p> : view === 'card' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {filtrados.map((s, i) => {
              const n = num(s);
              return (
                <article key={s.slug} className="os-sc" style={{ '--c': s.cor, animation: `so-rise .55s var(--ease) ${i * 40}ms both`, cursor: 'pointer' } as React.CSSProperties}
                  onClick={() => abrir(s)}>
                  <span className="top">
                    <span className="m"><IconeServico nome={s.nome} /></span>
                    <span style={{ minWidth: 0, flex: 1 }}><small style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: s.cor }}>{s.categoria}</small><b>{s.nome}</b></span>
                    <span onClick={e => e.stopPropagation()}><button type="button" className="so-qh" aria-label={`Como usar ${s.nome}`} title="Como usar" onClick={() => setAjuda(s)}>?</button></span>
                  </span>
                  <small style={{ lineHeight: 1.45 }}>{s.descricao}</small>
                  <span className="so-tags">{s.metricas.map(m => <span key={m} className="so-tag">{m}</span>)}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span className={`os-pill ${n.abertas ? 'brand' : 'ghost'}`} style={{ height: 22, fontSize: 10.5 }}><i />{n.abertas} {n.abertas === 1 ? 'aberta' : 'abertas'}</span>
                    {n.atrasadas > 0 && <span className="os-pill coral" style={{ height: 22, fontSize: 10.5 }}><i />{n.atrasadas} {n.atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>}
                    {n.conferir > 0 && <span className="os-pill cyan" style={{ height: 22, fontSize: 10.5 }}><i />{n.conferir} a conferir</span>}
                  </span>
                  <span className="ft"><span>{s.foco}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: s.cor }}>Abrir<Ic n="seta" style={{ width: 13, height: 13 }} /></span></span>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="so-tw">
            <table className="so-table os-rows">
              <thead><tr><th scope="col">Serviço</th><th scope="col">O que o fiscal registra</th><th scope="col">Abertas</th><th scope="col">Atrasadas</th><th scope="col">A conferir</th><th scope="col"><span className="so-sr">Ações</span></th></tr></thead>
              <tbody>
                {filtrados.map(s => {
                  const n = num(s);
                  return (
                    <tr key={s.slug} onClick={() => abrir(s)} style={{ cursor: 'pointer' }}>
                      <td data-l="Serviço"><MarcaServico nome={s.nome} cor={s.cor} sub={s.categoria} /></td>
                      <td data-l="O que registra"><span className="so-tags">{s.metricas.slice(0, 3).map(m => <span key={m} className="so-tag">{m}</span>)}{s.metricas.length > 3 && <span className="so-tag">+{s.metricas.length - 3}</span>}</span></td>
                      <td data-l="Abertas" className="mono">{n.abertas}</td>
                      <td data-l="Atrasadas" className="mono" style={{ color: n.atrasadas ? 'var(--coral)' : undefined }}>{n.atrasadas}</td>
                      <td data-l="A conferir" className="mono">{n.conferir}</td>
                      <td data-l="" className="r" onClick={e => e.stopPropagation()}>
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button type="button" className="so-qh" aria-label={`Como usar ${s.nome}`} onClick={() => setAjuda(s)}>?</button>
                          <Link to={rotaTenant(entityId, `servicos/${s.slug}`)} className="so-btn so-ghost sm">Abrir<Ic n="seta" style={{ width: 13, height: 13 }} /></Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <BarraAcoes esquerda={<><b>{meus.length} serviços</b><Sep />{linhas ? `${tot.abertas} OS abertas` : 'carregando…'}<Sep />{tot.atrasadas} atrasadas</>}>
        <Link to={rotaTenant(entityId, 'os')} className="so-btn so-ghost"><Ic n="list" />Todas as OS</Link>
        <Link to={rotaTenant(entityId, 'os?nova=1')} className="so-btn so-primary os-shine">Nova OS<Ic n="seta" className="arrow" /></Link>
      </BarraAcoes>

      <ServicoInstrucoesDrawer slug={ajuda?.slug ?? null} nomeServico={ajuda?.nome ?? ''} corServico={ajuda?.cor ?? '#635BFF'} onClose={() => setAjuda(null)} />
    </Pagina>
  );
}

