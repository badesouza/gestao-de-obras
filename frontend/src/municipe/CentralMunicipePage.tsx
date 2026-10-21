import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import {
  ApiError, centralPublicaApi,
  type AcompanhamentoSolicitacao, type BairroCoord, type CentralPublica,
} from '../lib/api-client';
import { CameraCarimbo, type LocalFoto } from '../tenant/components/camera/CameraCarimbo';
import { bairroMaisProximoLocal } from '../tenant/components/camera/carimbo';
import { CATEGORIAS_CIDADAO, categoriaPorSlug, corDaCategoria, iconeDaCategoria } from '../tenant/components/obras/categorias';
import { CENTRO_IDS } from '../tenant/pages/servico-config';
import './municipe.css';

/* ── Central do Munícipe (página pública, sem login) ──────────────
   O cidadão chega pelo link ou QR Code e registra um pedido em 4 passos. */

type Tela = 'pedido' | 'sucesso' | 'acompanhar';
interface Foto { id: string; file: File; url: string }
interface Local { lat: number; lng: number; precisao: number | null }
interface PedidoGuardado { protocolo: string; telefone: string; categoriaNome: string; criadoEm: string }

const ETAPAS = ['O problema', 'Foto', 'Endereço', 'Seus dados'];
const soDigitos = (s: string) => s.replace(/\D/g, '');
const mascaraTelefone = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const mascaraCpf = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
};
function cpfValido(cpf: string) {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const chaveGuardados = (id: string) => `gdo:meus-pedidos:${id}`;
function lerGuardados(id: string): PedidoGuardado[] {
  try { return JSON.parse(localStorage.getItem(chaveGuardados(id)) ?? '[]') as PedidoGuardado[]; } catch { return []; }
}
function guardarPedido(id: string, p: PedidoGuardado) {
  try { localStorage.setItem(chaveGuardados(id), JSON.stringify([p, ...lerGuardados(id)].slice(0, 20))); } catch { /* sem storage */ }
}

function Icone({ d, tamanho = 26 }: { d: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* mapa pequeno para confirmar o ponto: o pino pode ser arrastado */
function MapaLocal({ local, centro, onMover }: { local: Local | null; centro: [number, number]; onMover: (lat: number, lng: number) => void }) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pino = useRef<L.Marker | null>(null);
  const mover = useRef(onMover);
  useEffect(() => { mover.current = onMover; });

  useEffect(() => {
    if (!div.current || mapa.current) return;
    const m = L.map(div.current, { zoomControl: false, attributionControl: false }).setView(local ? [local.lat, local.lng] : centro, local ? 17 : 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => mover.current(e.latlng.lat, e.latlng.lng));
    mapa.current = m;
    setTimeout(() => m.invalidateSize(), 120);
    return () => { m.remove(); mapa.current = null; pino.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = mapa.current;
    if (!m || !local) return;
    const icone = L.divIcon({ className: '', html: '<div class="mc-pino"><span></span></div>', iconSize: [34, 44], iconAnchor: [17, 42] });
    if (!pino.current) {
      pino.current = L.marker([local.lat, local.lng], { draggable: true, icon: icone }).addTo(m);
      pino.current.on('dragend', () => { const p = pino.current!.getLatLng(); mover.current(p.lat, p.lng); });
    } else {
      pino.current.setLatLng([local.lat, local.lng]);
    }
    m.setView([local.lat, local.lng], Math.max(m.getZoom(), 16), { animate: true });
  }, [local]);

  return <div ref={div} className="mc-mapa" role="img" aria-label="Mapa com o local do problema. Toque para ajustar o ponto." />;
}

/* ── página ── */
export function CentralMunicipePage() {
  const { id: entityId = '' } = useParams<{ id: string }>();
  const [cfg, setCfg] = useState<CentralPublica | null>(null);
  const [erroCarga, setErroCarga] = useState('');
  const [tela, setTela] = useState<Tela>('pedido');
  const [etapa, setEtapa] = useState(1);

  const [categoria, setCategoria] = useState('');
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [local, setLocal] = useState<Local | null>(null);
  const [descricao, setDescricao] = useState('');
  const [bairro, setBairro] = useState('');
  const [bairroTocado, setBairroTocado] = useState(false);
  const [logradouro, setLogradouro] = useState('');
  const [referencia, setReferencia] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [aceite, setAceite] = useState(false);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [protocolo, setProtocolo] = useState('');
  const topoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    centralPublicaApi.config(entityId).then(setCfg).catch(() => setErroCarga('Não foi possível abrir a Central. Confira o link ou tente de novo.'));
  }, [entityId]);

  const bairrosCoords: BairroCoord[] = useMemo(() => (cfg?.bairros ?? []).map(b => ({ id: b.nome, ...b })), [cfg]);
  const centroMapa: [number, number] = useMemo(() => {
    const comCoord = bairrosCoords.filter(b => b.lat != null && b.lng != null);
    if (!comCoord.length) return [-12.5253, -40.3083];
    return [comCoord.reduce((s, b) => s + b.lat!, 0) / comCoord.length, comCoord.reduce((s, b) => s + b.lng!, 0) / comCoord.length];
  }, [bairrosCoords]);

  const cat = categoriaPorSlug(categoria);
  /* ficha do serviço salva: some se o munícipe não pode pedir; a dica vem do "como aparece para o munícipe" */
  const categoriasVisiveis = CATEGORIAS_CIDADAO.flatMap(c => {
    const f = c.servicoSlug ? cfg?.servicos?.find(s => s.id === CENTRO_IDS[c.servicoSlug!]) : undefined;
    if (f && !f.pode) return [];
    return [{ c, dica: f?.nome ?? c.dica }];
  });
  const cor = categoria ? corDaCategoria(categoria) : '#0B1313';
  const municipio = cfg?.entidade.municipio ? `Prefeitura de ${cfg.entidade.municipio}` : cfg?.entidade.nome ?? 'Prefeitura';

  const definirLocal = (l: Local) => {
    setLocal(l);
    if (!bairroTocado) {
      const perto = bairroMaisProximoLocal(l.lat, l.lng, bairrosCoords);
      if (perto) setBairro(perto);
    }
  };

  const fotosDaCamera = (files: File[], loc: LocalFoto | null) => {
    setCameraAberta(false);
    setFotos(prev => [...prev, ...files.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))].slice(0, 4));
    if (loc) definirLocal({ lat: loc.lat, lng: loc.lng, precisao: loc.precisao });
  };
  const removerFoto = (id: string) => setFotos(prev => {
    const f = prev.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.url);
    return prev.filter(x => x.id !== id);
  });

  const problemas: Record<number, string> = {
    1: categoria ? '' : 'Escolha o tipo de problema',
    2: fotos.length === 0 ? 'Tire pelo menos uma foto do problema' : descricao.trim().length < 5 ? 'Conte em poucas palavras o que está acontecendo' : '',
    3: !bairro ? 'Escolha o bairro' : logradouro.trim().length < 3 ? 'Informe a rua e o número (ou um ponto próximo)' : '',
    4: nome.trim().length < 3 ? 'Informe seu nome' : ![10, 11].includes(soDigitos(telefone).length) ? 'Informe o telefone com DDD' : cpf && !cpfValido(cpf) ? 'CPF inválido (ou deixe em branco)' : !aceite ? 'Marque a autorização para podermos atender o pedido' : '',
  };

  const irPara = (n: number) => { setErro(''); setEtapa(n); topoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const avancar = () => { const p = problemas[etapa]; if (p) { setErro(p); return; } if (etapa < 4) irPara(etapa + 1); else void enviar(); };

  const enviar = async () => {
    if (!cat) return;
    setEnviando(true);
    setErro('');
    try {
      const r = await centralPublicaApi.enviar(entityId, {
        categoria: cat.slug, categoriaNome: cat.nome, descricao: descricao.trim(),
        bairro, logradouro: logradouro.trim(), referencia: referencia.trim() || null,
        lat: local?.lat ?? null, lng: local?.lng ?? null, precisaoM: local?.precisao ?? null,
        nome: nome.trim(), telefone, cpf: cpf || null, email: email.trim() || null, aceite: true,
      }, fotos.map(f => f.file));
      guardarPedido(entityId, { protocolo: r.protocolo, telefone: soDigitos(telefone), categoriaNome: cat.nome, criadoEm: r.criadoEm });
      setProtocolo(r.protocolo);
      setTela('sucesso');
      topoRef.current?.scrollIntoView({ block: 'start' });
    } catch (e) {
      setErro(e instanceof ApiError ? e.body.message ?? 'Não foi possível enviar.' : !navigator.onLine ? 'Sem internet. Conecte-se e toque em Enviar de novo — nada foi perdido.' : 'Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const recomecar = () => {
    fotos.forEach(f => URL.revokeObjectURL(f.url));
    setFotos([]); setCategoria(''); setDescricao(''); setLocal(null); setBairro(''); setBairroTocado(false);
    setLogradouro(''); setReferencia(''); setAceite(false); setProtocolo(''); setErro('');
    setEtapa(1); setTela('pedido');
  };

  if (erroCarga) return <div className="mc-raiz"><div className="mc-falha">{erroCarga}</div></div>;

  return (
    <div className="mc-raiz" style={{ '--mc-cor': cor } as React.CSSProperties}>
      <header className="mc-topo" ref={topoRef}>
        <div className="mc-topo-linha">
          {cfg?.entidade.brasaoUrl ? <img src={cfg.entidade.brasaoUrl} alt="" className="mc-brasao" /> : <span className="mc-brasao mc-brasao-vazio" />}
          <div className="mc-topo-texto">
            <span className="mc-topo-pre">{cfg ? municipio : 'Carregando…'}</span>
            <strong>Central do Munícipe</strong>
          </div>
          {tela !== 'acompanhar'
            ? <button type="button" className="mc-link-topo" onClick={() => setTela('acompanhar')}>Acompanhar</button>
            : <button type="button" className="mc-link-topo" onClick={() => setTela(protocolo ? 'sucesso' : 'pedido')}>Novo pedido</button>}
        </div>
        {tela === 'pedido' && (
          <>
            <h1 className="mc-titulo">Viu um problema na rua? <span>Avise a Prefeitura.</span></h1>
            <ol className="mc-passos" aria-label="Passos">
              {ETAPAS.map((t, i) => (
                <li key={t} className={i + 1 < etapa ? 'is-feito' : i + 1 === etapa ? 'is-atual' : ''} aria-current={i + 1 === etapa ? 'step' : undefined}>
                  <span className="mc-passo-barra" />
                  <span className="mc-passo-nome">{i + 1}. {t}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </header>

      <main className="mc-corpo">
        {tela === 'pedido' && (
          <section key={etapa} className="mc-etapa">
            {etapa === 1 && (
              <>
                <h2 className="mc-h2">O que está acontecendo?</h2>
                <div className="mc-categorias" role="radiogroup" aria-label="Tipo de problema">
                  {categoriasVisiveis.map(({ c, dica }, i) => (
                    <button key={c.slug} type="button" role="radio" aria-checked={categoria === c.slug}
                      className={`mc-categoria${categoria === c.slug ? ' is-escolhida' : ''}`}
                      style={{ '--cat-cor': corDaCategoria(c.slug), '--i': i } as React.CSSProperties}
                      onClick={() => { setCategoria(c.slug); setErro(''); }}>
                      <span className="mc-categoria-icone"><Icone d={iconeDaCategoria(c.slug)} /></span>
                      <strong>{c.nome}</strong>
                      <small>{dica}</small>
                    </button>
                  ))}
                </div>
              </>
            )}

            {etapa === 2 && (
              <>
                <h2 className="mc-h2">Mostre o problema</h2>
                <p className="mc-texto">A foto sai com data, hora e a localização do GPS. Assim a equipe encontra o lugar certinho.</p>
                {fotos.length === 0 ? (
                  <button type="button" className="mc-camera" onClick={() => setCameraAberta(true)}>
                    <span className="mc-camera-icone">
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </span>
                    <strong>Tirar foto do problema</strong>
                    <small>Fique perto do local · permita câmera e localização</small>
                  </button>
                ) : (
                  <div className="mc-fotos">
                    {fotos.map(f => (
                      <div key={f.id} className="mc-foto">
                        <img src={f.url} alt="Foto do problema" />
                        <button type="button" onClick={() => removerFoto(f.id)} aria-label="Remover foto">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    ))}
                    {fotos.length < 4 && (
                      <button type="button" className="mc-foto mc-foto-mais" onClick={() => setCameraAberta(true)}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Outra foto
                      </button>
                    )}
                  </div>
                )}
                {local && (
                  <p className="mc-gps"><i />Local capturado pelo GPS{local.precisao != null && <> · precisão de {Math.round(local.precisao)} m</>}</p>
                )}
                <label className="mc-campo">
                  <span>Conte em poucas palavras</span>
                  <textarea rows={3} maxLength={2000} value={descricao} onChange={e => setDescricao(e.target.value)}
                    placeholder={cat ? `Ex.: ${cat.dica.toLowerCase()} há uma semana, perto da escola` : 'O que está acontecendo?'} />
                </label>
              </>
            )}

            {etapa === 3 && (
              <>
                <h2 className="mc-h2">Onde fica?</h2>
                <p className="mc-texto">{local ? 'Confira o ponto no mapa. Se precisar, arraste o pino ou toque no lugar certo.' : 'Toque no mapa para marcar o lugar do problema.'}</p>
                <MapaLocal local={local} centro={centroMapa} onMover={(lat, lng) => definirLocal({ lat, lng, precisao: null })} />
                <label className="mc-campo">
                  <span>Bairro</span>
                  <select value={bairro} onChange={e => { setBairro(e.target.value); setBairroTocado(true); }}>
                    <option value="">Escolha o bairro…</option>
                    {(cfg?.bairros ?? []).map(b => <option key={b.nome} value={b.nome}>{b.nome}</option>)}
                  </select>
                </label>
                <label className="mc-campo">
                  <span>Rua e número</span>
                  <input value={logradouro} onChange={e => setLogradouro(e.target.value)} maxLength={300} placeholder="Ex.: Rua Rui Barbosa, 245" autoComplete="street-address" />
                </label>
                <label className="mc-campo">
                  <span>Ponto de referência <em>opcional</em></span>
                  <input value={referencia} onChange={e => setReferencia(e.target.value)} maxLength={300} placeholder="Ex.: em frente à escola" />
                </label>
              </>
            )}

            {etapa === 4 && (
              <>
                <h2 className="mc-h2">Seus dados</h2>
                <p className="mc-texto">Para a Prefeitura poder te dar retorno sobre o pedido.</p>
                <label className="mc-campo">
                  <span>Nome</span>
                  <input value={nome} onChange={e => setNome(e.target.value)} maxLength={160} autoComplete="name" placeholder="Seu nome completo" />
                </label>
                <label className="mc-campo">
                  <span>Telefone (WhatsApp)</span>
                  <input value={telefone} onChange={e => setTelefone(mascaraTelefone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(75) 99999-0000" />
                </label>
                <div className="mc-duas">
                  <label className="mc-campo">
                    <span>CPF <em>opcional</em></span>
                    <input value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
                  </label>
                  <label className="mc-campo">
                    <span>E-mail <em>opcional</em></span>
                    <input value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="voce@email.com" />
                  </label>
                </div>
                <label className="mc-aceite">
                  <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} />
                  <span>Autorizo a Prefeitura a usar estes dados <b>apenas para atender e responder este pedido</b>.</span>
                </label>
                <div className="mc-resumo">
                  <span className="mc-resumo-icone"><Icone d={iconeDaCategoria(categoria)} tamanho={22} /></span>
                  <div>
                    <strong>{cat?.nome}</strong>
                    <span>{[logradouro, bairro].filter(Boolean).join(' · ')}</span>
                    <span>{fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'}{local ? ' · com GPS' : ''}</span>
                  </div>
                </div>
              </>
            )}

            {erro && <div className="mc-erro" role="alert">{erro}</div>}
          </section>
        )}

        {tela === 'sucesso' && <Sucesso protocolo={protocolo} onNovo={recomecar} onAcompanhar={() => setTela('acompanhar')} />}
        {tela === 'acompanhar' && <Acompanhar entityId={entityId} />}
      </main>

      {tela === 'pedido' && (
        <footer className="mc-acoes">
          {etapa > 1 && <button type="button" className="mc-btn-voltar" onClick={() => irPara(etapa - 1)}>Voltar</button>}
          <button type="button" className="mc-btn" onClick={avancar} disabled={enviando}>
            {enviando ? 'Enviando…' : etapa < 4 ? 'Continuar' : 'Enviar pedido'}
            {!enviando && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="9 18 15 12 9 6"/></svg>}
          </button>
        </footer>
      )}

      {cameraAberta && cfg && (
        <CameraCarimbo
          entityId={entityId}
          assinatura={{ nome: 'Pedido do cidadão', entidade: cfg.entidade.nome, usuarioId: 'municipe', brasaoUrl: cfg.entidade.brasaoUrl }}
          servico={cat?.nome ?? 'Pedido do cidadão'}
          cor={cor}
          bairro={bairro}
          logradouro={logradouro}
          bairrosCoords={bairrosCoords}
          onConcluir={fotosDaCamera}
          onFechar={() => setCameraAberta(false)}
        />
      )}
    </div>
  );
}

function Sucesso({ protocolo, onNovo, onAcompanhar }: { protocolo: string; onNovo: () => void; onAcompanhar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => { void navigator.clipboard?.writeText(protocolo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); };
  return (
    <section className="mc-sucesso">
      <div className="mc-check" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" pathLength={1} /></svg>
      </div>
      <h2 className="mc-h2">Pedido recebido!</h2>
      <p className="mc-texto">A equipe da Prefeitura vai analisar e encaminhar para o serviço responsável.</p>
      <div className="mc-protocolo">
        <span>Seu protocolo</span>
        <strong>{protocolo}</strong>
        <button type="button" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar número'}</button>
      </div>
      <p className="mc-nota">Guardamos este pedido neste celular. Para acompanhar de outro aparelho, use o protocolo e o seu telefone.</p>
      <button type="button" className="mc-btn" onClick={onAcompanhar}>Acompanhar pedido</button>
      <button type="button" className="mc-btn-voltar mc-btn-largo" onClick={onNovo}>Fazer outro pedido</button>
    </section>
  );
}

function Acompanhar({ entityId }: { entityId: string }) {
  const guardados = useMemo(() => lerGuardados(entityId), [entityId]);
  const [protocolo, setProtocolo] = useState(guardados[0]?.protocolo ?? '');
  const [telefone, setTelefone] = useState(guardados[0] ? mascaraTelefone(guardados[0].telefone) : '');
  const [res, setRes] = useState<AcompanhamentoSolicitacao | null>(null);
  const [erro, setErro] = useState('');
  const [buscando, setBuscando] = useState(false);

  const buscar = async (p = protocolo, t = telefone) => {
    setErro(''); setRes(null); setBuscando(true);
    try { setRes(await centralPublicaApi.acompanhar(entityId, p.trim(), soDigitos(t))); }
    catch (e) { setErro(e instanceof ApiError ? e.body.message ?? 'Não encontrado' : 'Não foi possível consultar agora.'); }
    finally { setBuscando(false); }
  };

  const concluido = !!res?.servicoStatus && /conclu|finaliz|executad/i.test(res.servicoStatus);
  const emExecucao = !!res?.servicoStatus && /andamento|execu/i.test(res.servicoStatus);
  const etapas = res ? [
    { titulo: 'Pedido recebido', info: dataHora(res.criadoEm), estado: 'feito' },
    res.status === 'RECUSADA'
      ? { titulo: 'Não será atendido', info: res.motivoRecusa ?? '', estado: 'recusado' }
      : res.status === 'CONVERTIDA'
        ? { titulo: 'Encaminhado para a equipe', info: `Virou ordem de serviço${res.analisadoEm ? ` · ${dataHora(res.analisadoEm)}` : ''}`, estado: 'feito' }
        : { titulo: 'Em análise', info: 'A equipe está avaliando o pedido', estado: 'atual' },
    ...(res.status === 'RECUSADA' ? [] : [{
      titulo: concluido ? 'Serviço concluído' : emExecucao ? 'Equipe trabalhando no local' : 'Aguardando execução',
      info: concluido && res.servicoAtualizadoEm ? dataHora(res.servicoAtualizadoEm) : res.status === 'CONVERTIDA' ? 'Você pode voltar aqui para ver a conclusão' : '',
      estado: concluido ? 'feito' : res.status === 'CONVERTIDA' ? 'atual' : 'futuro',
    }]),
  ] : [];

  return (
    <section className="mc-etapa">
      <h2 className="mc-h2">Acompanhar pedido</h2>
      {guardados.length > 0 && (
        <div className="mc-guardados">
          <span>Pedidos feitos neste celular</span>
          {guardados.slice(0, 5).map(g => (
            <button key={g.protocolo} type="button" onClick={() => { setProtocolo(g.protocolo); setTelefone(mascaraTelefone(g.telefone)); void buscar(g.protocolo, g.telefone); }}>
              <strong>{g.protocolo}</strong><small>{g.categoriaNome} · {new Date(g.criadoEm).toLocaleDateString('pt-BR')}</small>
            </button>
          ))}
        </div>
      )}
      <div className="mc-duas">
        <label className="mc-campo"><span>Protocolo</span><input value={protocolo} onChange={e => setProtocolo(e.target.value)} placeholder="2026-00001" /></label>
        <label className="mc-campo"><span>Telefone usado</span><input value={telefone} onChange={e => setTelefone(mascaraTelefone(e.target.value))} inputMode="tel" placeholder="(75) 99999-0000" /></label>
      </div>
      <button type="button" className="mc-btn" onClick={() => void buscar()} disabled={buscando || !protocolo || soDigitos(telefone).length < 10}>
        {buscando ? 'Consultando…' : 'Consultar'}
      </button>
      {erro && <div className="mc-erro" role="alert">{erro}</div>}
      {res && (
        <div className="mc-linha-tempo">
          <div className="mc-lt-cab"><strong>{res.categoriaNome}</strong><span>{res.logradouro} · {res.bairro}</span></div>
          <ol>
            {etapas.map(e => (
              <li key={e.titulo} className={`is-${e.estado}`}>
                <i />
                <div><strong>{e.titulo}</strong>{e.info && <span>{e.info}</span>}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
