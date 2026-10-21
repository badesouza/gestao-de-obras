import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import QRCode from 'qrcode';
import { ApiError, centralApi, type SolicitacaoMunicipeItem, type StatusSolicitacao } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { SERVICOS_CONFIG, CENTRO_IDS } from './servico-config';
import { FotoThumb, Kpi, KpiCarregando } from '../components/obras/ui';
import { haQuanto, nomeCurto, slugDoCentro, useFotoUrl } from '../components/obras/util';
import { centroDaCategoria, corDaCategoria, iconeDaCategoria } from '../components/obras/categorias';
import '../styles/central.css';

/* ── Central do Munícipe (lado da prefeitura) ─────────────────────
   Pedidos que chegam pelo link / QR Code → vira ordem de serviço ou é recusado. */

type Filtro = StatusSolicitacao | 'TODAS';
const STATUS: Record<StatusSolicitacao, { rotulo: string; classe: string }> = {
  NOVA:       { rotulo: 'Aguardando análise', classe: 'is-execucao' },
  CONVERTIDA: { rotulo: 'Virou OS',           classe: 'is-concluida' },
  RECUSADA:   { rotulo: 'Recusado',           classe: 'is-cancelada' },
};
const MOTIVOS_RAPIDOS = ['Fora da área atendida pela Prefeitura', 'Pedido repetido — já existe uma OS para este local', 'Não é responsabilidade da Secretaria de Obras', 'Foto não mostra o problema'];

const foneBonito = (d: string) => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
const cpfMascarado = (c: string) => c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : c;
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Icone({ d, tamanho = 18 }: { d: string; tamanho?: number }) {
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function MapaPonto({ lat, lng, cor }: { lat: number; lng: number; cor: string }) {
  const div = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!div.current) return;
    const m = L.map(div.current, { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false }).setView([lat, lng], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    L.circleMarker([lat, lng], { radius: 10, color: '#fff', weight: 3, fillColor: cor, fillOpacity: 1 }).addTo(m);
    setTimeout(() => m.invalidateSize(), 150);
    return () => { m.remove(); };
  }, [lat, lng, cor]);
  return <div ref={div} className="cm-mapa" role="img" aria-label="Local do pedido no mapa" />;
}

function FotoGrande({ entityId, fotoId, onAbrir }: { entityId: string; fotoId: string; onAbrir: (url: string) => void }) {
  const url = useFotoUrl(entityId, fotoId, 'central');
  return url
    ? <button type="button" className="cm-foto" onClick={() => onAbrir(url)} aria-label="Ver foto inteira"><img src={url} alt="Foto enviada pelo munícipe" /></button>
    : <span className="cm-foto"><span className="ob-skeleton" style={{ height: '100%' }} /></span>;
}

/* ── QR Code + cartaz ── */
function PainelQr({ link, municipio, brasao, onFechar }: { link: string; municipio: string; brasao: string | null; onFechar: () => void }) {
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [cartaz, setCartaz] = useState(false);
  useEffect(() => {
    void QRCode.toDataURL(link, { width: 900, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B1313', light: '#FFFFFF' } }).then(setQr);
  }, [link]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onFechar]);
  const copiar = () => { void navigator.clipboard?.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); };

  return createPortal(
    <div className="cm-fundo" onClick={onFechar}>
      <div className={`cm-qr-modal ob-claro${cartaz ? ' is-cartaz' : ''}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="QR Code da Central do Munícipe">
        {!cartaz ? (
          <>
            <div className="cm-qr-cab">
              <div>
                <span className="ob-eyebrow" style={{ color: '#B45309' }}>Divulgação</span>
                <h2>Link e QR Code</h2>
                <p>Quem apontar a câmera do celular cai direto na página de pedidos. Coloque em cartazes, ônibus, redes sociais e no site da Prefeitura.</p>
              </div>
              <button type="button" className="ob-icone-btn" onClick={onFechar} aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="cm-qr-corpo">
              {qr ? <img src={qr} alt="QR Code da Central do Munícipe" className="cm-qr-img" /> : <span className="ob-skeleton cm-qr-img" />}
              <div className="cm-qr-acoes">
                <label className="cm-qr-link"><span className="ob-sr">Link</span><input readOnly value={link} onFocus={e => e.target.select()} /></label>
                <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={copiar}>{copiado ? 'Link copiado ✓' : 'Copiar link'}</button>
                <a className="ob-btn-ghost ob-btn-alto" href={qr || undefined} download="qrcode-central-do-municipe.png">Baixar QR Code</a>
                <button type="button" className="ob-btn" onClick={() => setCartaz(true)}>Ver cartaz para imprimir</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="cm-cartaz-barra">
              <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setCartaz(false)}>Voltar</button>
              <button type="button" className="ob-btn" onClick={() => window.print()}>Imprimir</button>
            </div>
            <div className="cm-cartaz" id="cm-cartaz">
              <div className="cm-cartaz-topo">
                {brasao && <img src={brasao} alt="" />}
                <span>{municipio}</span>
              </div>
              <h1>Viu um problema na rua?<em>Avise a Prefeitura pelo celular.</em></h1>
              <div className="cm-cartaz-meio">
                {qr && <img src={qr} alt="QR Code" />}
                <ol>
                  <li><b>1</b>Aponte a câmera do celular para o código</li>
                  <li><b>2</b>Escolha o problema e tire uma foto</li>
                  <li><b>3</b>Receba o número do protocolo e acompanhe</li>
                </ol>
              </div>
              <div className="cm-cartaz-icones">
                {['tapa-buracos', 'rocagem', 'iluminacao', 'coleta-entulhos', 'poda-arvores'].map(s => (
                  <span key={s} style={{ background: corDaCategoria(s) }}><Icone d={iconeDaCategoria(s)} tamanho={28} /></span>
                ))}
              </div>
              <p className="cm-cartaz-link">{link.replace(/^https?:\/\//, '')}</p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── detalhe do pedido ── */
function Detalhe({ entityId, item, onFechar, onAtualizado }: {
  entityId: string; item: SolicitacaoMunicipeItem; onFechar: () => void; onAtualizado: () => void;
}) {
  const sugerido = centroDaCategoria(item.categoria) ?? '';
  const [centroId, setCentroId] = useState(sugerido);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [convertido, setConvertido] = useState<{ registroId: string; centroId: string } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const cor = corDaCategoria(item.categoria);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (zoom) setZoom(null); else onFechar(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onFechar, zoom]);

  const converter = async () => {
    if (!centroId) { setErro('Escolha o serviço responsável'); return; }
    setOcupado(true); setErro('');
    try {
      const r = await centralApi.converter(entityId, item.id, centroId);
      setConvertido({ registroId: r.registroId, centroId });
      onAtualizado();
    } catch (e) { setErro(e instanceof ApiError ? e.body.message : 'Não foi possível gerar a OS'); }
    finally { setOcupado(false); }
  };
  const recusar = async () => {
    if (motivo.trim().length < 5) { setErro('Explique o motivo para o munícipe'); return; }
    setOcupado(true); setErro('');
    try { await centralApi.recusar(entityId, item.id, motivo.trim()); onAtualizado(); onFechar(); }
    catch (e) { setErro(e instanceof ApiError ? e.body.message : 'Não foi possível recusar'); }
    finally { setOcupado(false); }
  };

  const linkOS = (registroId: string, centro: string) => {
    const slug = slugDoCentro(centro);
    return slug ? `/t/${entityId}/servicos/${slug}?os=${registroId}` : `/t/${entityId}/servicos`;
  };
  const tel = item.telefone;

  return createPortal(
    <div className="cm-fundo" onClick={onFechar}>
      <aside className="cm-gaveta ob-claro" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Pedido ${item.protocolo}`} style={{ '--serv-cor': cor } as React.CSSProperties}>
        <header className="cm-gaveta-cab">
          <span className="cm-gaveta-icone"><Icone d={iconeDaCategoria(item.categoria)} tamanho={22} /></span>
          <div>
            <span className="cm-protocolo">Protocolo {item.protocolo}</span>
            <h2>{item.categoriaNome}</h2>
          </div>
          <button type="button" className="ob-icone-btn" onClick={onFechar} aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </header>

        <div className="cm-gaveta-corpo">
          <div className={`cm-fotos cm-fotos-${Math.min(item.fotos.length, 3)}`}>
            {item.fotos.map(f => <FotoGrande key={f} entityId={entityId} fotoId={f} onAbrir={setZoom} />)}
          </div>

          <section className="cm-bloco">
            <h3>O que o munícipe disse</h3>
            <p className="cm-descricao">“{item.descricao}”</p>
            <span className="cm-quando">Enviado em {dataHora(item.createdAt)} · {haQuanto(item.createdAt)}</span>
          </section>

          <section className="cm-bloco">
            <h3>Onde</h3>
            <strong className="cm-endereco">{item.logradouro}</strong>
            <span className="cm-sub">{item.bairro}{item.referencia ? ` · ${item.referencia}` : ''}</span>
            {item.lat != null && item.lng != null && (
              <>
                <MapaPonto lat={item.lat} lng={item.lng} cor={cor} />
                <span className="cm-sub">
                  GPS da foto{item.precisaoM != null ? ` · precisão de ${Math.round(item.precisaoM)} m` : ''} ·{' '}
                  <a href={`https://www.google.com/maps?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer">abrir no Google Maps</a>
                </span>
              </>
            )}
          </section>

          <section className="cm-bloco">
            <h3>Quem pediu</h3>
            <div className="cm-pessoa">
              <span className="cm-avatar">{item.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div>
                <strong>{item.nome}</strong>
                <span>{foneBonito(tel)}{item.cpf ? ` · CPF ${cpfMascarado(item.cpf)}` : ''}{item.email ? ` · ${item.email}` : ''}</span>
              </div>
            </div>
            <div className="cm-contato">
              <a className="ob-btn-ghost" href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z"/></svg>
                WhatsApp
              </a>
              <a className="ob-btn-ghost" href={`tel:+55${tel}`}>Ligar</a>
            </div>
          </section>

          {item.status !== 'NOVA' && !convertido && (
            <section className={`cm-resultado ${item.status === 'CONVERTIDA' ? 'is-ok' : 'is-recusado'}`}>
              <strong>{item.status === 'CONVERTIDA' ? 'Virou ordem de serviço' : 'Pedido recusado'}</strong>
              <span>{item.analisadoPor ? `por ${item.analisadoPor}` : ''}{item.analisadoEm ? ` em ${dataHora(item.analisadoEm)}` : ''}</span>
              {item.motivoRecusa && <span>Motivo: {item.motivoRecusa}</span>}
              {item.registroDiarioId && item.centroCustoId && <Link to={linkOS(item.registroDiarioId, item.centroCustoId)} className="ob-btn">Abrir a ordem de serviço</Link>}
            </section>
          )}

          {convertido && (
            <section className="cm-resultado is-ok cm-sucesso">
              <span className="cm-sucesso-check"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></span>
              <strong>Ordem de serviço criada!</strong>
              <span>Com as fotos, o GPS e os dados do pedido. O munícipe já vê "Encaminhado para a equipe" no acompanhamento.</span>
              <Link to={linkOS(convertido.registroId, convertido.centroId)} className="ob-btn">Abrir a ordem de serviço</Link>
            </section>
          )}
        </div>

        {item.status === 'NOVA' && !convertido && (
          <footer className="cm-gaveta-acoes">
            {erro && <div className="ob-erro">{erro}</div>}
            {!recusando ? (
              <>
                <label className="cm-servico">
                  <span>Encaminhar para</span>
                  <select value={centroId} onChange={e => setCentroId(e.target.value)}>
                    <option value="">Escolha o serviço…</option>
                    {Object.values(SERVICOS_CONFIG).map(s => <option key={s.slug} value={CENTRO_IDS[s.slug]}>{s.nome}</option>)}
                  </select>
                </label>
                <div className="cm-botoes">
                  <button type="button" className="ob-btn-ghost ob-btn-alto cm-btn-recusar" onClick={() => { setRecusando(true); setErro(''); }}>Recusar</button>
                  <button type="button" className="ob-btn cm-btn-gerar" onClick={() => void converter()} disabled={ocupado}>
                    {ocupado ? 'Gerando…' : 'Gerar ordem de serviço'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="cm-servico-rotulo">Por que não será atendido? O munícipe vai ver esta resposta.</span>
                <div className="cm-motivos">
                  {MOTIVOS_RAPIDOS.map(m => <button key={m} type="button" className={`ob-chip${motivo === m ? ' is-ativo' : ''}`} onClick={() => setMotivo(m)}>{m}</button>)}
                </div>
                <textarea className="cm-motivo" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Escreva o motivo…" maxLength={1000} />
                <div className="cm-botoes">
                  <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setRecusando(false)}>Voltar</button>
                  <button type="button" className="ob-btn cm-btn-confirmar-recusa" onClick={() => void recusar()} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Confirmar recusa'}</button>
                </div>
              </>
            )}
          </footer>
        )}

        {zoom && (
          <div className="cm-zoom" onClick={() => setZoom(null)}>
            <img src={zoom} alt="Foto enviada pelo munícipe" />
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

/* ── página ── */
export function CentralMunicipeAdminPage() {
  const { entityId, session } = useTenant();
  const [dados, setDados] = useState<Awaited<ReturnType<typeof centralApi.listar>> | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('NOVA');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<SolicitacaoMunicipeItem | null>(null);
  const [qrAberto, setQrAberto] = useState(false);

  const carregar = () => centralApi.listar(entityId).then(d => { setDados(d); setErro(''); }).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
  useEffect(() => { void carregar(); }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (navigator.onLine) void carregar(); }, 60000);
    return () => clearInterval(t);
  }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = `${window.location.origin}/s/${entityId}`;
  const municipio = session.entity.municipalityName ? `Prefeitura de ${session.entity.municipalityName}` : session.entity.name;
  const [brasao, setBrasao] = useState<string | null>(null);
  useEffect(() => { fetch(`/api/public/v1/tenants/${entityId}`).then(r => r.json()).then(t => setBrasao(t.coatOfArmsUrl ?? null)).catch(() => {}); }, [entityId]);

  const itens = useMemo(() => dados?.itens ?? [], [dados]);
  const termo = busca.trim().toLowerCase();
  const visiveis = itens.filter(i => (filtro === 'TODAS' || i.status === filtro) &&
    (!termo || [i.protocolo, i.nome, i.bairro, i.logradouro, i.categoriaNome, i.descricao, i.telefone].some(t => t.toLowerCase().includes(termo))));

  const analisados = itens.filter(i => i.analisadoEm);
  const tempoMedioH = analisados.length
    ? analisados.reduce((s, i) => s + (new Date(i.analisadoEm!).getTime() - new Date(i.createdAt).getTime()), 0) / analisados.length / 3600_000
    : null;
  const r = dados?.resumo;
  const FILTROS: { id: Filtro; rotulo: string; qtd: number; cor: string }[] = [
    { id: 'NOVA', rotulo: 'Aguardando', qtd: r?.novas ?? 0, cor: 'var(--ob-amber)' },
    { id: 'CONVERTIDA', rotulo: 'Viraram OS', qtd: r?.convertidas ?? 0, cor: 'var(--ob-green)' },
    { id: 'RECUSADA', rotulo: 'Recusados', qtd: r?.recusadas ?? 0, cor: 'var(--ob-faint)' },
    { id: 'TODAS', rotulo: 'Todos', qtd: itens.length, cor: 'var(--ob-blue)' },
  ];

  return (
    <div className="ob-page ob-claro" style={{ '--serv-cor': '#F59E0B' } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone"><Icone d="M3 11l18-8v18L3 13zM7 12.5V19a2 2 0 002 2h1a2 2 0 002-2v-4.5" tamanho={30} /></span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">Atendimento ao cidadão</span>
            <h1 className="ob-h1">Central do Munícipe</h1>
            <p className="ob-sub">Pedidos feitos pelo celular, com foto e GPS. Transforme em ordem de serviço com um clique.</p>
          </div>
        </div>
        <div className="ob-head-acoes">
          <a href={link} target="_blank" rel="noreferrer" className="ob-btn-ghost ob-btn-alto">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Página do cidadão
          </a>
          <button type="button" className="ob-btn" onClick={() => setQrAberto(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4"/></svg>
            QR Code e cartaz
          </button>
        </div>
      </header>

      <section className="ob-kpis" aria-label="Resumo">
        {!r ? [1, 2, 3, 4].map(n => <KpiCarregando key={n} />) : (
          <>
            <Kpi i={1} rotulo="Aguardando análise" valor={r.novas} cor="var(--ob-amber)" nota={r.novas ? 'responda o quanto antes' : 'nenhum pedido parado'} tom={r.novas ? 'alerta' : 'ok'} grafico={null} />
            <Kpi i={2} rotulo="Viraram ordem de serviço" valor={r.convertidas} cor="var(--ob-green)" nota="encaminhados às equipes" tom="neutro" grafico={null} />
            <Kpi i={3} rotulo="Recusados" valor={r.recusadas} cor="var(--ob-faint)" nota="com motivo para o cidadão" tom="neutro" grafico={null} />
            <Kpi i={4} rotulo="Tempo até responder" valor={tempoMedioH == null ? null : tempoMedioH < 24 ? Math.round(tempoMedioH * 10) / 10 : Math.round(tempoMedioH / 24 * 10) / 10}
              decimais={1} unidade={tempoMedioH != null && tempoMedioH < 24 ? 'horas' : 'dias'} cor="var(--ob-blue)"
              nota={tempoMedioH == null ? 'nenhum pedido analisado ainda' : 'média entre envio e resposta'} tom="neutro" grafico={null} />
          </>
        )}
      </section>

      <section className="ob-card ob-reveal" style={{ '--i': 5 } as React.CSSProperties} aria-label="Pedidos">
        <div className="ob-filtros">
          <div className="ob-chips" role="group" aria-label="Filtrar pedidos">
            {FILTROS.map(f => (
              <button key={f.id} type="button" className={`ob-chip${filtro === f.id ? ' is-ativo' : ''}`} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}>
                <i style={{ background: f.cor }} />{f.rotulo}<span>{f.qtd}</span>
              </button>
            ))}
          </div>
          <label className="ob-busca">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
            <span className="ob-sr">Buscar</span>
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Protocolo, nome, bairro, rua…" />
          </label>
        </div>

        {erro && <div className="ob-erro" style={{ margin: '0 16px 12px' }}>{erro}</div>}
        {!dados && !erro && <div className="ob-lista">{[1, 2, 3].map(n => <div key={n} className="ob-oc"><span className="ob-skeleton" style={{ height: 88 }} /></div>)}</div>}

        {dados && itens.length === 0 && (
          <div className="ob-vazio-grande">
            <span className="ob-serv-icone ob-serv-icone-grande"><Icone d="M3 11l18-8v18L3 13zM7 12.5V19a2 2 0 002 2h1a2 2 0 002-2v-4.5" tamanho={34} /></span>
            <strong>Nenhum pedido ainda</strong>
            <span>Divulgue o link e o QR Code. Os pedidos dos moradores aparecem aqui na hora, com foto e localização.</span>
            <button type="button" className="ob-btn" onClick={() => setQrAberto(true)}>Gerar QR Code</button>
          </div>
        )}
        {dados && itens.length > 0 && visiveis.length === 0 && <p className="ob-vazio" style={{ padding: '8px 20px 24px' }}>{filtro === 'NOVA' && !termo ? 'Nenhum pedido aguardando. Tudo respondido!' : 'Nenhum pedido com esse filtro.'}</p>}

        {visiveis.length > 0 && (
          <div className="ob-lista">
            {visiveis.map((i, idx) => {
              const cor = corDaCategoria(i.categoria);
              const st = STATUS[i.status];
              return (
                <article key={i.id} className={`ob-oc ob-reveal${i.status === 'NOVA' ? ' cm-nova' : ''}`} style={{ '--i': Math.min(idx, 12), '--serv-cor': cor } as React.CSSProperties}>
                  <button type="button" className="ob-oc-abrir" onClick={() => setAberto(i)} aria-label={`Abrir pedido ${i.protocolo}`}>
                    <FotoThumb entityId={entityId} fotoId={i.fotos[0]} quando={i.createdAt} cor={cor} tamanho={88} contagem={i.fotos.length} origem="central"
                      icone={<Icone d={iconeDaCategoria(i.categoria)} tamanho={24} />} />
                    <span className="ob-oc-info">
                      <span className="ob-oc-topo">
                        <span className="ob-oc-os">{i.protocolo}</span>
                        <span className="cm-cat" style={{ color: cor, background: `color-mix(in srgb, ${cor} 12%, #fff)` }}><Icone d={iconeDaCategoria(i.categoria)} tamanho={13} />{i.categoriaNome}</span>
                        <span className={`ob-badge ${st.classe}`}><i />{st.rotulo}</span>
                      </span>
                      <strong className="ob-oc-local">{i.bairro} · {i.logradouro}</strong>
                      <span className="ob-oc-detalhe">“{i.descricao}”</span>
                      <span className="ob-oc-meta">{nomeCurto(i.nome)} · {haQuanto(i.createdAt)}{i.lat != null && <span className="ob-tag tom-ok">GPS</span>}</span>
                    </span>
                  </button>
                  <div className="ob-oc-acoes cm-acoes-lista">
                    <button type="button" className={i.status === 'NOVA' ? 'ob-btn cm-btn-analisar' : 'ob-btn-ghost ob-btn-alto'} onClick={() => setAberto(i)}>
                      {i.status === 'NOVA' ? 'Analisar' : 'Ver'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {aberto && <Detalhe entityId={entityId} item={aberto} onFechar={() => setAberto(null)} onAtualizado={() => void carregar()} />}
      {qrAberto && <PainelQr link={link} municipio={municipio} brasao={brasao} onFechar={() => setQrAberto(false)} />}
    </div>
  );
}
