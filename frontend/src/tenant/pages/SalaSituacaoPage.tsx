import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tenantApi, mapaApi, type PainelData, type PainelFeedItem, type Situacao } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { MapaServicos } from '../components/MapaServicos';
import { SERVICOS_CONFIG, CENTRO_IDS, type ServicoConfig } from './servico-config';
import { useOnline } from '../../lib/offline/pwa';
import '../styles/obras-ui.css';

/* ── Sala de Situação ─────────────────────────────────────────────
   A primeira tela do secretário: o que está acontecendo na cidade agora. */

const SLUG_POR_CENTRO: Record<string, string> = Object.fromEntries(
  Object.entries(CENTRO_IDS).map(([slug, id]) => [id, slug]),
);
const servicoDe = (centroId: string): ServicoConfig | undefined => {
  const slug = SLUG_POR_CENTRO[centroId];
  return slug ? SERVICOS_CONFIG[slug] : undefined;
};

const SITUACAO: Record<Situacao, { rotulo: string; classe: string }> = {
  aberta:    { rotulo: 'Aberta',       classe: 'is-aberta' },
  execucao:  { rotulo: 'Em execução',  classe: 'is-execucao' },
  concluida: { rotulo: 'Concluída',    classe: 'is-concluida' },
  cancelada: { rotulo: 'Cancelada',    classe: 'is-cancelada' },
};

const reduzMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/* número que sobe do zero até o valor, com desaceleração */
function useContador(alvo: number, duracao = 1100) {
  const [v, setV] = useState(0);
  const semAnimacao = reduzMovimento();
  useEffect(() => {
    if (semAnimacao) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duracao);
      setV(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao, semAnimacao]);
  return semAnimacao ? alvo : v;
}

/* foto autenticada: baixa como blob e libera ao desmontar */
function useFotoUrl(entityId: string, fotoId: string | null) {
  const [foto, setFoto] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!fotoId) return;
    let viva = true, atual: string | null = null;
    mapaApi.fetchMidiaBlob(entityId, fotoId)
      .then(u => { if (viva) { atual = u; setFoto({ id: fotoId, url: u }); } else URL.revokeObjectURL(u); })
      .catch(() => {});
    return () => { viva = false; if (atual) URL.revokeObjectURL(atual); };
  }, [entityId, fotoId]);
  return foto && foto.id === fotoId ? foto.url : null;
}

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
function haQuanto(iso: string | null, agora = Date.now()) {
  if (!iso) return 'sem registro';
  const m = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const nomeCurto = (n: string) => n.trim().split(/\s+/).slice(0, 2).join(' ');

/* ── peças ──────────────────────────────────────────────────────── */

function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  const W = 96, H = 30, max = Math.max(1, ...valores);
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * W},${H - 3 - (v / max) * (H - 6)}`).join(' ');
  return (
    <svg className="ob-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline className="ob-spark-linha" points={pts} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
      <circle className="ob-spark-ponto" cx={W} cy={H - 3 - (valores[valores.length - 1] / max) * (H - 6)} r="3" fill={cor} />
    </svg>
  );
}

function Medidor({ valor, meta, cor }: { valor: number | null; meta: number; cor: string }) {
  const pct = valor == null ? 0 : Math.min(100, (valor / (meta * 2)) * 100);
  return (
    <div className="ob-medidor" aria-hidden="true">
      <div className="ob-medidor-trilho">
        <div className="ob-medidor-barra" style={{ width: `${pct}%`, background: cor }} />
        <div className="ob-medidor-meta" style={{ left: '50%' }} title={`meta: ${meta} dias`} />
      </div>
    </div>
  );
}

function Anel({ pct, cor }: { pct: number | null; cor: string }) {
  const r = 14, c = 2 * Math.PI * r, p = pct == null ? 0 : pct / 100;
  return (
    <svg className="ob-anel" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(238,243,239,0.1)" strokeWidth="4" />
      <circle className="ob-anel-arco" cx="18" cy="18" r={r} fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 18 18)" />
    </svg>
  );
}

function Kpi({ i, rotulo, valor, decimais = 0, unidade, nota, tom, cor, grafico }: {
  i: number; rotulo: string; valor: number | null; decimais?: number; unidade?: string;
  nota: string; tom: 'ok' | 'alerta' | 'ruim' | 'neutro'; cor: string; grafico: React.ReactNode;
}) {
  const n = useContador(valor ?? 0);
  const texto = valor == null ? '—' : decimais ? n.toFixed(decimais).replace('.', ',') : Math.round(n).toString();
  return (
    <div className="ob-kpi ob-reveal" style={{ '--i': i, '--kpi-cor': cor } as React.CSSProperties}>
      <span className="ob-kpi-rotulo">{rotulo}</span>
      <div className="ob-kpi-linha">
        <span className="ob-kpi-valor">{texto}</span>
        {unidade && valor != null && <span className="ob-kpi-unidade">{unidade}</span>}
      </div>
      <div className="ob-kpi-rodape">
        <span className={`ob-kpi-nota tom-${tom}`}>{nota}</span>
        {grafico}
      </div>
    </div>
  );
}

function Badge({ situacao }: { situacao: Situacao }) {
  const s = SITUACAO[situacao];
  return <span className={`ob-badge ${s.classe}`}><i />{s.rotulo}</span>;
}

function Thumb({ entityId, item }: { entityId: string; item: PainelFeedItem }) {
  const url = useFotoUrl(entityId, item.fotoId);
  const cfg = servicoDe(item.servico.id);
  return (
    <div className="ob-thumb" style={{ '--serv-cor': cfg?.cor ?? '#60a5fa' } as React.CSSProperties}>
      {url ? <img src={url} alt="" /> : item.fotoId ? <span className="ob-skeleton" /> : (
        <span className="ob-thumb-vazio">{cfg?.icon}<small>sem foto</small></span>
      )}
      {url && (
        <span className="ob-thumb-hora"><b>{hora(item.criadoEm)}</b><i /></span>
      )}
    </div>
  );
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
    const slug = SLUG_POR_CENTRO[centroId];
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
                {dados.fiscais.nomes.slice(0, 3).map(n => <span key={n}>{n.split(' ').map(p => p[0]).slice(0, 2).join('')}</span>)}
              </span>
              <span><b>{dados.fiscais.total}</b> {dados.fiscais.total === 1 ? 'fiscal registrou' : 'fiscais registraram'} hoje</span>
            </div>
          )}
          <MenuNova entityId={entityId} />
        </div>
      </header>

      {/* KPIs */}
      <section className="ob-kpis" aria-label="Indicadores">
        {!k ? [1, 2, 3, 4].map(n => <div key={n} className="ob-kpi"><span className="ob-skeleton" style={{ height: 96 }} /></div>) : (
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
                const cfg = servicoDe(f.servico.id);
                return (
                  <Link key={f.id} to={linkServico(f.servico.id, f.id)} className="ob-feed-item ob-reveal" style={{ '--i': 7 + i } as React.CSSProperties}>
                    <Thumb entityId={entityId} item={f} />
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
                const cfg = servicoDe(s.id);
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
