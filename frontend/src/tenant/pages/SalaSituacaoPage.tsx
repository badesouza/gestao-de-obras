import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tenantApi, type PainelData } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { MapaServicos } from '../components/MapaServicos';
import { SERVICOS_CONFIG } from './servico-config';
import { useOnline } from '../../lib/offline/pwa';
import { Anel, Badge, FotoThumb, Kpi, KpiCarregando, Medidor, Sparkline } from '../components/obras/ui';
import { haQuanto, iniciais, nomeCurto, servicoDoCentro, slugDoCentro } from '../components/obras/util';

/* ── Sala de Situação ─────────────────────────────────────────────
   A primeira tela do secretário: o que está acontecendo na cidade agora. */

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function saudacao(d: Date) {
  const h = d.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
function dataLonga(d: Date) {
  const dia = DIAS[d.getDay()];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1).replace('-feira', '')}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function MenuNova({ entityId }: { entityId: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!aberto) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [aberto]);
  return (
    <div className="ob-menu-wrap" ref={ref}>
      <button type="button" className="ob-btn" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nova ocorrência
      </button>
      {aberto && (
        <div className="ob-menu">
          <span className="ob-menu-titulo">Qual serviço?</span>
          {Object.values(SERVICOS_CONFIG).map((s, i) => (
            <button key={s.slug} type="button" className="ob-menu-item ob-reveal" style={{ '--i': i, '--serv-cor': s.cor } as React.CSSProperties}
              onClick={() => navigate(`/t/${entityId}/servicos/${s.slug}?nova=1`)}>
              <span className="ob-menu-icone">{s.icon}</span>
              {s.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── página ─────────────────────────────────────────────────────── */

export function SalaSituacaoPage() {
  const { entityId, session } = useTenant();
  const online = useOnline();
  const [dados, setDados] = useState<PainelData | null>(null);
  const [erro, setErro] = useState('');
  const [agora, setAgora] = useState(() => new Date());

  const carregar = () => tenantApi.painel(entityId).then(d => { setDados(d); setErro(''); }).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));

  useEffect(() => { void carregar(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [entityId]);
  useEffect(() => {
    const t = setInterval(() => { setAgora(new Date()); if (navigator.onLine) void carregar(); }, 60000);
    return () => clearInterval(t);
  }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const primeiroNome = session.name.split(' ')[0];

  if (erro && !dados) {
    return <div className="ob-page"><div className="ob-erro">{erro}</div></div>;
  }

  const k = dados?.kpis;
  const deltaSemana = k ? k.concluidasSemana - k.concluidasSemanaAnterior : 0;
  const base = `/t/${entityId}`;
  const linkServico = (centroId: string, os?: string) => {
    const slug = slugDoCentro(centroId);
    return slug ? `${base}/servicos/${slug}${os ? `?os=${os}` : ''}` : `${base}/servicos`;
  };

  return (
    <div className="ob-page">

      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-head-texto">
          <span className="ob-eyebrow"><i className="ob-live" />Sala de Situação · {online ? 'ao vivo' : 'sem internet · últimos dados guardados'}</span>
          <h1 className="ob-h1">{dataLonga(agora)}</h1>
          <p className="ob-sub">
            {saudacao(agora)}, {primeiroNome}.{' '}
            {k ? (
              k.abertas === 0
                ? 'Nenhuma ocorrência aberta na cidade.'
                : <>Há <b>{k.abertas} {k.abertas === 1 ? 'ocorrência aberta' : 'ocorrências abertas'}</b>{k.atrasadas > 0 && <> — <b className="tom-ruim">{k.atrasadas} {k.atrasadas === 1 ? 'passou' : 'passaram'} de 7 dias</b></>}. Hoje chegaram <b>{k.registradasHoje}</b> {k.registradasHoje === 1 ? 'registro' : 'registros'} do campo.</>
            ) : 'Carregando o que está acontecendo nas ruas…'}
          </p>
        </div>
        <div className="ob-head-acoes">
          {dados && (
            <div className="ob-pill" title={dados.fiscais.nomes.join(', ')}>
              <span className="ob-avatares">
                {dados.fiscais.nomes.slice(0, 3).map(n => <span key={n}>{iniciais(n)}</span>)}
              </span>
              <span><b>{dados.fiscais.total}</b> {dados.fiscais.total === 1 ? 'fiscal registrou' : 'fiscais registraram'} hoje</span>
            </div>
          )}
          <MenuNova entityId={entityId} />
        </div>
      </header>

      {/* KPIs */}
      <section className="ob-kpis" aria-label="Indicadores">
        {!k ? [1, 2, 3, 4].map(n => <KpiCarregando key={n} />) : (
          <>
            <Kpi i={1} rotulo="Abertas agora" valor={k.abertas} cor="var(--ob-blue)"
              nota={k.atrasadas > 0 ? `${k.atrasadas} ${k.atrasadas === 1 ? 'passou' : 'passaram'} de 7 dias` : 'nenhuma atrasada'}
              tom={k.atrasadas > 0 ? 'ruim' : 'ok'}
              grafico={<Sparkline valores={dados!.serie.map(s => s.registradas)} cor="var(--ob-blue)" />} />
            <Kpi i={2} rotulo="Concluídas na semana" valor={k.concluidasSemana} cor="var(--ob-green)"
              nota={deltaSemana > 0 ? `+${deltaSemana} sobre a semana passada` : deltaSemana < 0 ? `${deltaSemana} sobre a semana passada` : 'igual à semana passada'}
              tom={deltaSemana > 0 ? 'ok' : deltaSemana < 0 ? 'ruim' : 'neutro'}
              grafico={<Sparkline valores={dados!.serie.map(s => s.concluidas)} cor="var(--ob-green)" />} />
            <Kpi i={3} rotulo="Tempo até concluir" valor={k.tempoMedioDias} decimais={1} unidade="dias" cor={k.tempoMedioDias != null && k.tempoMedioDias > k.metaDias ? 'var(--ob-rose)' : 'var(--ob-ink)'}
              nota={k.tempoMedioDias == null ? 'sem conclusões nos últimos 30 dias' : `meta da secretaria: ${k.metaDias} dias`}
              tom={k.tempoMedioDias == null ? 'neutro' : k.tempoMedioDias > k.metaDias ? 'ruim' : 'ok'}
              grafico={<Medidor valor={k.tempoMedioDias} meta={k.metaDias} cor={k.tempoMedioDias != null && k.tempoMedioDias > k.metaDias ? 'var(--ob-rose)' : 'var(--ob-green)'} />} />
            <Kpi i={4} rotulo="Com foto e GPS" valor={k.comFotoPct} unidade="%" cor="var(--ob-amber)"
              nota={k.comFotoPct == null ? 'nenhum registro no mês' : k.semFoto > 0 ? `${k.semFoto} ${k.semFoto === 1 ? 'registro' : 'registros'} sem foto` : 'todos os registros com foto'}
              tom={k.comFotoPct == null ? 'neutro' : k.semFoto > 0 ? 'alerta' : 'ok'}
              grafico={<Anel pct={k.comFotoPct} cor="var(--ob-amber)" />} />
          </>
        )}
      </section>

      {/* Mapa + feed */}
      <div className="ob-grid-mapa">
        <section className="ob-card ob-reveal" style={{ '--i': 5 } as React.CSSProperties} aria-label="Mapa da cidade">
          <div className="ob-card-head">
            <div>
              <h2 className="ob-card-titulo">Mapa da cidade</h2>
              <span className="ob-card-sub">Cada ponto é uma ocorrência · clique para ver a foto e a OS</span>
            </div>
            <Link to={`${base}/mapa`} target="_blank" className="ob-btn-ghost">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>
              Tela cheia
            </Link>
          </div>
          <div className="ob-mapa">
            <MapaServicos height={520} showFilters />
          </div>
        </section>

        <section className="ob-card ob-reveal" style={{ '--i': 6 } as React.CSSProperties} aria-label="Chegando do campo">
          <div className="ob-card-head">
            <div>
              <h2 className="ob-card-titulo">Chegando do campo</h2>
              <span className="ob-card-sub">Últimos registros dos fiscais</span>
            </div>
            <span className="ob-tag tom-ok"><i className="ob-live" />ao vivo</span>
          </div>
          <div className="ob-feed">
            {!dados ? [1, 2, 3, 4].map(n => <div key={n} className="ob-feed-item"><span className="ob-skeleton" style={{ width: 76, height: 76, borderRadius: 10 }} /><span className="ob-skeleton" style={{ flex: 1, height: 56 }} /></div>)
              : dados.feed.length === 0 ? <p className="ob-vazio">Nenhum registro ainda. O primeiro que um fiscal fizer aparece aqui.</p>
              : dados.feed.map((f, i) => {
                const cfg = servicoDoCentro(f.servico.id);
                return (
                  <Link key={f.id} to={linkServico(f.servico.id, f.id)} className="ob-feed-item ob-reveal" style={{ '--i': 7 + i } as React.CSSProperties}>
                    <FotoThumb entityId={entityId} fotoId={f.fotoId} quando={f.criadoEm} cor={cfg?.cor ?? '#60a5fa'} icone={cfg?.icon} contagem={f.fotos} />
                    <div className="ob-feed-texto">
                      <span className="ob-feed-servico" style={{ color: cfg?.cor }}>{f.servico.nome}</span>
                      <span className="ob-feed-local">{[f.bairro, f.logradouro].filter(Boolean).join(' · ') || 'Sem local informado'}</span>
                      <span className="ob-feed-meta">{nomeCurto(f.fiscal)} · {haQuanto(f.criadoEm, agora.getTime())}</span>
                      <span className="ob-feed-tags">
                        <Badge situacao={f.situacao} />
                        {f.lat != null && <span className="ob-tag tom-ok">GPS</span>}
                        {f.fotos === 0 && <span className="ob-tag tom-alerta">sem foto</span>}
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      </div>

      {/* Atenção + por serviço + equipes */}
      <div className="ob-grid-3">
        <section className="ob-card ob-reveal" style={{ '--i': 8 } as React.CSSProperties} aria-label="Precisa de atenção">
          <div className="ob-card-head"><h2 className="ob-card-titulo">Precisa de atenção</h2></div>
          <div className="ob-alertas">
            {!dados ? <span className="ob-skeleton" style={{ height: 180 }} /> : (
              <>
                {dados.pedidosMunicipeNovos > 0 && (
                  <Link to={`${base}/central-municipe`} className="ob-alerta tom-alerta ob-alerta-link">
                    <span className="ob-alerta-num">{dados.pedidosMunicipeNovos}</span>
                    <div className="ob-alerta-texto">
                      <strong>Pedidos de moradores aguardando</strong>
                      <span>Chegaram pela Central do Munícipe, com foto e GPS. Toque para analisar.</span>
                    </div>
                  </Link>
                )}
                <div className={`ob-alerta ${dados.alertas.atrasadas.total ? 'tom-ruim' : 'is-ok'}`}>
                  <span className="ob-alerta-num">{dados.alertas.atrasadas.total}</span>
                  <div className="ob-alerta-texto">
                    <strong>Abertas há mais de 7 dias</strong>
                    {dados.alertas.atrasadas.total === 0 ? <span>Nenhuma. Tudo dentro do prazo.</span> : dados.alertas.atrasadas.itens.map(a => (
                      <Link key={a.id} to={linkServico(a.servicoId, a.id)}>{a.servico} · {a.bairro || 'sem bairro'} · <b>{a.dias} dias</b></Link>
                    ))}
                  </div>
                </div>
                <div className={`ob-alerta ${dados.alertas.gpsLonge.total ? 'tom-alerta' : 'is-ok'}`}>
                  <span className="ob-alerta-num">{dados.alertas.gpsLonge.total}</span>
                  <div className="ob-alerta-texto">
                    <strong>GPS longe do bairro informado</strong>
                    {dados.alertas.gpsLonge.total === 0 ? <span>Todas as fotos batem com o bairro.</span> : dados.alertas.gpsLonge.itens.map(a => (
                      <span key={a.id}>{a.servico} · {a.bairro} · <b>{(a.distanciaM / 1000).toFixed(1).replace('.', ',')} km</b> de distância</span>
                    ))}
                  </div>
                </div>
                <div className={`ob-alerta ${dados.alertas.semFoto.total ? 'tom-alerta' : 'is-ok'}`}>
                  <span className="ob-alerta-num">{dados.alertas.semFoto.total}</span>
                  <div className="ob-alerta-texto">
                    <strong>Registros sem foto no mês</strong>
                    {dados.alertas.semFoto.total === 0 ? <span>Todos têm prova fotográfica.</span> : dados.alertas.semFoto.itens.map(a => (
                      <Link key={a.id} to={linkServico(a.servicoId, a.id)}>{a.servico} · {a.bairro || 'sem bairro'} · {haQuanto(a.criadoEm, agora.getTime())}</Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="ob-card ob-reveal" style={{ '--i': 9 } as React.CSSProperties} aria-label="Por serviço">
          <div className="ob-card-head">
            <h2 className="ob-card-titulo">Por serviço</h2>
            <span className="ob-card-sub">{MESES[agora.getMonth()]} · {k?.totalMes ?? 0} {k?.totalMes === 1 ? 'ocorrência' : 'ocorrências'}</span>
          </div>
          <div className="ob-servicos">
            {!dados ? <span className="ob-skeleton" style={{ height: 180 }} /> : dados.porServico.length === 0 ? <p className="ob-vazio">Nenhuma ocorrência registrada neste mês.</p>
              : dados.porServico.map((s, i) => {
                const cfg = servicoDoCentro(s.id);
                return (
                  <Link key={s.id} to={linkServico(s.id)} className="ob-servico ob-reveal" style={{ '--i': 10 + i } as React.CSSProperties}>
                    <div className="ob-servico-linha">
                      <span className="ob-servico-nome"><i style={{ background: cfg?.cor ?? 'var(--ob-blue)' }} />{s.nome}</span>
                      <span className="ob-servico-num"><b>{s.concluidas}</b> de {s.total} concluídas</span>
                    </div>
                    <div className="ob-barra">
                      <span style={{ width: `${(s.concluidas / s.total) * 100}%`, background: 'var(--ob-green)' }} />
                      <span style={{ width: `${(s.execucao / s.total) * 100}%`, background: 'var(--ob-amber)' }} />
                      <span style={{ width: `${(s.abertas / s.total) * 100}%`, background: 'var(--ob-blue)' }} />
                    </div>
                  </Link>
                );
              })}
            {dados && dados.porServico.length > 0 && (
              <div className="ob-legenda">
                <span><i style={{ background: 'var(--ob-green)' }} />concluída</span>
                <span><i style={{ background: 'var(--ob-amber)' }} />em execução</span>
                <span><i style={{ background: 'var(--ob-blue)' }} />aberta</span>
              </div>
            )}
          </div>
        </section>

        <section className="ob-card ob-reveal" style={{ '--i': 10 } as React.CSSProperties} aria-label="Equipes hoje">
          <div className="ob-card-head"><h2 className="ob-card-titulo">Equipes hoje</h2></div>
          <div className="ob-equipes">
            {!dados ? <span className="ob-skeleton" style={{ height: 180 }} /> : dados.equipes.length === 0 ? <p className="ob-vazio">Cadastre as equipes em Cadastros para acompanhá-las aqui.</p>
              : dados.equipes.map((e, i) => {
                const ultimoMs = e.ultimo ? agora.getTime() - new Date(e.ultimo).getTime() : null;
                const tom = ultimoMs == null ? 'neutro' : ultimoMs < 3600_000 ? 'ok' : e.hoje > 0 ? 'neutro' : 'alerta';
                return (
                  <div key={e.nome} className="ob-equipe ob-reveal" style={{ '--i': 11 + i } as React.CSSProperties}>
                    <span className="ob-equipe-letra">{e.nome.replace(/^equipe\s*/i, '').slice(0, 2).toUpperCase() || 'EQ'}</span>
                    <span className="ob-equipe-texto">
                      <strong>{e.nome}</strong>
                      <span className={`tom-${tom}`}>{e.ultimo ? `Último registro ${haQuanto(e.ultimo, agora.getTime())}` : 'Sem registros'}</span>
                    </span>
                    <span className="ob-equipe-num"><b>{e.hoje}</b><small>hoje</small></span>
                  </div>
                );
              })}
          </div>
        </section>
      </div>
    </div>
  );
}
