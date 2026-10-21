import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type BairroCoord } from '../../../lib/api-client';
import {
  bairroMaisProximoLocal, capturarDoVideo, carimbarArquivo, carregarBrasao,
  desenharCarimbo, gerarCodigo, prepararFontes, type DadosCarimbo,
} from './carimbo';
import '../../styles/camera.css';

export interface LocalFoto { lat: number; lng: number; precisao: number }

/** Quem assina a foto: o fiscal logado, ou o cidadão na Central do Munícipe */
export interface AssinaturaFoto { nome: string; entidade: string; usuarioId: string; brasaoUrl?: string | null }

interface Props {
  entityId: string;
  assinatura: AssinaturaFoto;
  servico: string;
  cor: string;
  bairro: string;
  logradouro: string;
  bairrosCoords: BairroCoord[];
  onConcluir: (fotos: File[], local: LocalFoto | null) => void;
  onFechar: () => void;
}

interface Foto { id: string; file: File; url: string }

const CHAVE_COPIA = 'gdo:cam-copia-celular';

/** Baixa a foto para o aparelho — no Android ela aparece na Galeria / Google Fotos (pasta Download) */
function salvarNoCelular(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/** Câmera de campo: foto com carimbo de hora, GPS, local e fiscal — funciona sem internet */
export function CameraCarimbo({ entityId, assinatura, servico, cor, bairro, logradouro, bairrosCoords, onConcluir, onFechar }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const visorRef   = useRef<HTMLDivElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const [camErro,    setCamErro]    = useState<'' | 'negada' | 'indisponivel'>('');
  const [camPronta,  setCamPronta]  = useState(false);
  const [gps,        setGps]        = useState<LocalFoto | null>(null);
  const [gpsErro,    setGpsErro]    = useState(() => navigator.geolocation ? '' : 'Este aparelho não tem GPS disponível');
  const [buscandoS,  setBuscandoS]  = useState(0);
  const [agora,      setAgora]      = useState(() => new Date());
  const [online,     setOnline]     = useState(navigator.onLine);
  const [brasao,     setBrasao]     = useState<HTMLImageElement | null>(null);
  const [fotos,      setFotos]      = useState<Foto[]>([]);
  const [capturando, setCapturando] = useState(false);
  const [flash,      setFlash]      = useState(false);
  const [aviso,      setAviso]      = useState('');
  const [vendo,      setVendo]      = useState<Foto | null>(null);
  const [sair,       setSair]       = useState(false);
  const [dica,       setDica]       = useState('');
  const [rect,       setRect]       = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [copia,      setCopia]      = useState(() => {
    try { return localStorage.getItem(CHAVE_COPIA) !== '0'; } catch { return true; }
  });

  const entidade = assinatura.entidade;
  const fiscal   = assinatura.nome;

  /* bairro: o do formulário, ou o mais próximo dos cadastrados (offline) */
  const bairroFoto = bairro || (gps ? bairroMaisProximoLocal(gps.lat, gps.lng, bairrosCoords) ?? '' : '');

  /* ── câmera ── */
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setCamErro('indisponivel'); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelado) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setCamErro((e as DOMException).name === 'NotAllowedError' ? 'negada' : 'indisponivel');
      }
    })();
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  /* ── GPS contínuo (usa satélite, não precisa de internet) ── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => { setGps({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }); setGpsErro(''); },
      e => { if (e.code === e.PERMISSION_DENIED) setGpsErro('Localização bloqueada. Libere nas permissões do navegador.'); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /* relógio + contador de busca de satélites */
  useEffect(() => {
    const t = setInterval(() => {
      setAgora(new Date());
      setBuscandoS(s => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    void prepararFontes();
    void carregarBrasao(entityId, assinatura.brasaoUrl).then(setBrasao);
  }, [entityId, assinatura.brasaoUrl]);

  /* trava a rolagem da página por baixo */
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, []);

  /* ── posição exata da imagem dentro do visor (object-fit: contain) ── */
  const medir = useCallback(() => {
    const v = videoRef.current, box = visorRef.current;
    if (!v || !box || !v.videoWidth) return;
    const bw = box.clientWidth, bh = box.clientHeight;
    const esc = Math.min(bw / v.videoWidth, bh / v.videoHeight);
    const w = v.videoWidth * esc, h = v.videoHeight * esc;
    setRect({ x: (bw - w) / 2, y: (bh - h) / 2, w, h });
  }, []);

  useEffect(() => {
    const box = visorRef.current;
    if (!box) return;
    const ro = new ResizeObserver(medir);
    ro.observe(box);
    return () => ro.disconnect();
  }, [medir]);

  const montarDados = useCallback(async (quando: Date, local: LocalFoto | null, codigo?: string): Promise<DadosCarimbo> => ({
    quando,
    lat: local?.lat ?? null,
    lng: local?.lng ?? null,
    precisao: local?.precisao ?? null,
    bairro: bairroFoto,
    logradouro,
    servico,
    cor,
    fiscal,
    entidade,
    brasao,
    codigo: codigo ?? await gerarCodigo([local?.lat ?? null, local?.lng ?? null, quando.toISOString(), assinatura.usuarioId, entityId]),
  }), [bairroFoto, logradouro, servico, cor, fiscal, entidade, brasao, assinatura.usuarioId, entityId]);

  /* prévia ao vivo: o mesmo desenho que vai para a foto */
  useEffect(() => {
    const c = overlayRef.current;
    if (!c || !rect) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(rect.w * dpr);
    c.height = Math.round(rect.h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    void montarDados(agora, gps, '••••-••••').then(d => desenharCarimbo(ctx, c.width, c.height, d));
  }, [rect, agora, gps, montarDados]);

  /* ── disparo ── */
  const adicionar = (file: File) => {
    setFotos(prev => [...prev, { id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }]);
    if (copia) salvarNoCelular(file);
  };

  const alternarCopia = () => {
    const nova = !copia;
    setCopia(nova);
    try { localStorage.setItem(CHAVE_COPIA, nova ? '1' : '0'); } catch { /* sem storage */ }
    setDica(nova ? 'Cópia no celular ligada: as fotos vão para a Galeria (pasta Download)' : 'Cópia no celular desligada: as fotos ficam só no sistema');
  };

  const disparar = async () => {
    const v = videoRef.current;
    if (capturando || !v?.videoWidth) return;
    setCapturando(true);
    setFlash(true);
    navigator.vibrate?.(35);
    try {
      adicionar(await capturarDoVideo(v, await montarDados(new Date(), gps)));
    } catch {
      setAviso('Não foi possível salvar a foto. Tente de novo.');
    } finally {
      setCapturando(false);
      setTimeout(() => setFlash(false), 160);
    }
  };

  const carimbarDoCelular = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      try { adicionar(await carimbarArquivo(f, await montarDados(new Date(), gps))); }
      catch { setAviso(`Não foi possível carimbar "${f.name}".`); }
    }
  };

  const excluir = (id: string) => {
    setFotos(prev => {
      const alvo = prev.find(f => f.id === id);
      if (alvo) URL.revokeObjectURL(alvo.url);
      return prev.filter(f => f.id !== id);
    });
    setVendo(null);
  };

  const concluir = () => {
    /* as URLs de prévia são do componente; o formulário cria as dele */
    fotos.forEach(f => URL.revokeObjectURL(f.url));
    onConcluir(fotos.map(f => f.file), gps);
  };

  const fechar = () => {
    if (fotos.length && !sair) { setSair(true); return; }
    fotos.forEach(f => URL.revokeObjectURL(f.url));
    onFechar();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (vendo) setVendo(null);
      else if (sair) setSair(false);
      else fechar();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  });

  useEffect(() => {
    if (!dica) return;
    const t = setTimeout(() => setDica(''), 3200);
    return () => clearTimeout(t);
  }, [dica]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  /* ── estado do GPS para a pílula ── */
  const nivel = gps ? (gps.precisao <= 15 ? 3 : gps.precisao <= 40 ? 2 : 1) : 0;
  const textoGps = gpsErro
    ? 'GPS indisponível'
    : gps
      ? `±${Math.round(gps.precisao)} m · ${nivel === 3 ? 'ótimo' : nivel === 2 ? 'bom' : 'fraco, aguarde'}`
      : `Buscando satélites · ${buscandoS}s`;

  return createPortal(
    <div className="cam-root" style={{ '--cam-cor': cor } as React.CSSProperties}>

      {/* topo */}
      <header className="cam-top">
        <button type="button" className="cam-icon-btn" onClick={fechar} aria-label="Fechar câmera">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div className="cam-titulo">
          <span className="cam-titulo-eyebrow">Câmera de campo</span>
          <span className="cam-titulo-nome">{servico}</span>
        </div>
        <button
          type="button"
          className={`cam-icon-btn cam-copia${copia ? ' is-on' : ''}`}
          onClick={alternarCopia}
          aria-pressed={copia}
          aria-label={copia ? 'Cópia no celular ligada' : 'Cópia no celular desligada'}
          title="Guardar cópia na galeria do celular"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="5" y="2" width="14" height="20" rx="2.5"/>
            <polyline points="9 11 12 14 15 11"/><line x1="12" y1="6" x2="12" y2="14"/>
          </svg>
          {copia && <span className="cam-copia-ok" aria-hidden />}
        </button>
        <div className={`cam-gps cam-gps-n${nivel}${gpsErro ? ' is-erro' : ''}`} title={gpsErro || undefined}>
          <span className="cam-gps-barras" aria-hidden>
            <i /><i /><i />
          </span>
          <span>{textoGps}</span>
        </div>
      </header>

      {!online && (
        <div className="cam-offline">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
          </svg>
          Sem internet · GPS e câmera funcionando normalmente
        </div>
      )}

      {/* visor */}
      <div className="cam-visor" ref={visorRef}>
        <video
          ref={videoRef}
          className="cam-video"
          playsInline
          muted
          onLoadedMetadata={() => { setCamPronta(true); medir(); }}
        />
        {rect && camPronta && (
          <div className="cam-quadro" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
            <canvas ref={overlayRef} className="cam-overlay" />
            <span className="cam-canto cam-canto-tl" /><span className="cam-canto cam-canto-tr" />
            <span className="cam-canto cam-canto-bl" /><span className="cam-canto cam-canto-br" />
            <span className="cam-mira" aria-hidden />
          </div>
        )}

        {!camPronta && !camErro && (
          <div className="cam-estado">
            <span className="cam-spinner" />
            <span>Abrindo a câmera…</span>
          </div>
        )}

        {camErro && (
          <div className="cam-estado cam-estado-erro">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <strong>{camErro === 'negada' ? 'A câmera foi bloqueada' : 'Câmera indisponível aqui'}</strong>
            <span>
              {camErro === 'negada'
                ? 'Toque no cadeado da barra de endereço e permita a câmera. Ou use a câmera do celular abaixo — a foto recebe o carimbo do mesmo jeito.'
                : 'Use a câmera do celular — a foto recebe o carimbo do mesmo jeito.'}
            </span>
            <button type="button" className="cam-btn-claro" onClick={() => arquivoRef.current?.click()}>
              Usar câmera do celular
            </button>
            <input
              ref={arquivoRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={e => { void carimbarDoCelular(e.target.files); e.target.value = ''; }}
            />
          </div>
        )}

        {flash && <div className="cam-flash" />}
        {aviso && <div className="cam-aviso">{aviso}</div>}
        {dica && !aviso && <div className="cam-dica">{dica}</div>}
      </div>

      {/* controles */}
      <footer className="cam-controles">
        <div className="cam-rolo">
          {fotos.slice(-3).map((f, i, arr) => (
            <button
              key={f.id}
              type="button"
              className="cam-rolo-thumb"
              style={{ '--i': arr.length - 1 - i } as React.CSSProperties}
              onClick={() => setVendo(f)}
              aria-label="Ver foto"
            >
              <img src={f.url} alt="" />
            </button>
          ))}
          {fotos.length > 0 && <span className="cam-rolo-qtd">{fotos.length}</span>}
        </div>

        <button
          type="button"
          className={`cam-disparo${capturando ? ' is-ativo' : ''}`}
          onClick={() => void disparar()}
          disabled={!camPronta || capturando}
          aria-label="Tirar foto"
        >
          <span />
        </button>

        <button
          type="button"
          className="cam-concluir"
          onClick={concluir}
          disabled={fotos.length === 0}
        >
          Usar {fotos.length > 0 ? fotos.length : ''} {fotos.length === 1 ? 'foto' : 'fotos'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </footer>

      {/* foto em tela cheia */}
      {vendo && (
        <div className="cam-ver" onClick={() => setVendo(null)}>
          <img src={vendo.url} alt="Foto carimbada" onClick={e => e.stopPropagation()} />
          <div className="cam-ver-acoes" onClick={e => e.stopPropagation()}>
            <button type="button" className="cam-btn-perigo" onClick={() => excluir(vendo.id)}>Excluir foto</button>
            <button type="button" className="cam-btn-claro" onClick={() => setVendo(null)}>Voltar</button>
          </div>
        </div>
      )}

      {/* confirmação de saída com fotos */}
      {sair && (
        <div className="cam-sheet-fundo" onClick={() => setSair(false)}>
          <div className="cam-sheet" onClick={e => e.stopPropagation()}>
            <strong>Sair sem usar {fotos.length === 1 ? 'a foto' : `as ${fotos.length} fotos`}?</strong>
            <span>{fotos.length === 1 ? 'Ela será descartada.' : 'Elas serão descartadas.'}</span>
            <button type="button" className="cam-btn-solido" onClick={concluir}>
              Usar {fotos.length === 1 ? 'a foto' : `as ${fotos.length} fotos`}
            </button>
            <button type="button" className="cam-btn-perigo" onClick={fechar}>Descartar e sair</button>
            <button type="button" className="cam-btn-texto" onClick={() => setSair(false)}>Continuar fotografando</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
