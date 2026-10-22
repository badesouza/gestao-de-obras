import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import QRCode from 'qrcode';
import { corDaCategoria, iconeDaCategoria } from '../obras/categorias';
import '../../styles/obras-ui.css';
import '../../styles/central.css';

/* ── Peças da Central de Solicitações: QR Code + cartaz e mapa do ponto ── */

export function Icone({ d, tamanho = 18 }: { d: string; tamanho?: number }) {
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

export function MapaPonto({ lat, lng, cor, className }: { lat: number; lng: number; cor: string; className?: string }) {
  const div = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!div.current) return;
    const m = L.map(div.current, { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false }).setView([lat, lng], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    L.circleMarker([lat, lng], { radius: 10, color: '#fff', weight: 3, fillColor: cor, fillOpacity: 1 }).addTo(m);
    setTimeout(() => m.invalidateSize(), 150);
    return () => { m.remove(); };
  }, [lat, lng, cor]);
  return <div ref={div} className={className ?? 'cm-mapa'} role="img" aria-label="Local do pedido no mapa" />;
}

/* ── QR Code + cartaz ── */
export function PainelQr({ link, municipio, brasao, onFechar }: { link: string; municipio: string; brasao: string | null; onFechar: () => void }) {
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
