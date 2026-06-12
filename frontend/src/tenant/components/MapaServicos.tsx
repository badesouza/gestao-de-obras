import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { mapaApi, type MapaPin } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { SERVICOS_CONFIG } from '../pages/servico-config';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const NOME_PARA_SLUG: Record<string, string> = {
  'Rocagem': 'rocagem', 'Coleta de Entulhos': 'coleta-entulhos',
  'Construcao Civil': 'construcao-civil', 'Encascalhamento': 'encascalhamento',
  'Iluminacao Publica': 'iluminacao', 'Oficina Frota': 'oficina',
  'Pintura': 'pintura', 'Poda de Arvores': 'poda-arvores',
  'Pracas e Jardins': 'pracas-jardins', 'Serralheria': 'serralheria',
  'Tapa-Buracos': 'tapa-buracos', 'Varricao': 'varricao',
};

function getCorServico(nomeCC: string): string {
  const slug = NOME_PARA_SLUG[nomeCC];
  return slug ? (SERVICOS_CONFIG[slug]?.cor ?? '#5b8db8') : '#5b8db8';
}

function getIconeServico(nomeCC: string): string {
  const slug = NOME_PARA_SLUG[nomeCC];
  const path = slug ? (SERVICOS_CONFIG[slug]?.iconPath ?? '') : '';
  return path.split('M').filter(Boolean).map(p => `<path d="M${p}"/>`).join('');
}

function getStatusCor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('conclu') || s.includes('executado')) return '#22c55e';
  if (s.includes('andamento') || s.includes('parcial')) return '#f97316';
  if (s.includes('cancel')) return '#ef4444';
  return '#5b8db8';
}

function getStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('conclu') || s.includes('executado')) return 'Concluída';
  if (s.includes('andamento') || s.includes('parcial')) return 'Em andamento';
  if (s.includes('cancel')) return 'Cancelada';
  return 'Aberta';
}

function criarIconePin(cor: string, statusCor: string, icone: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:36px;height:36px;border-radius:50% 50% 50% 0;
        background:${cor};border:2.5px solid #fff;
        box-shadow:0 4px 12px rgba(0,0,0,0.35);
        transform:rotate(-45deg);position:relative;
        display:flex;align-items:center;justify-content:center;">
        <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${icone}
          </svg>
        </div>
        <div style="position:absolute;bottom:-3px;right:-3px;
          width:11px;height:11px;border-radius:50%;
          background:${statusCor};border:2px solid #fff;
          transform:rotate(45deg);"></div>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
}

function nomeMes(m: number, y: number) {
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

const LEGENDA = [
  { cor: '#22c55e', label: 'Concluída' },
  { cor: '#f97316', label: 'Em andamento' },
  { cor: '#5b8db8', label: 'Aberta' },
  { cor: '#ef4444', label: 'Cancelada' },
];

type FiltroStatus = '' | 'Concluída' | 'Em andamento' | 'Aberta' | 'Cancelada';
type TileMode = 'street' | 'satellite';

interface Props { height?: number; showFilters?: boolean; fullscreenMode?: boolean; }

export function MapaServicos({ height = 420, showFilters = true, fullscreenMode = false }: Props) {
  const { entityId } = useTenant();
  const containerRef     = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<L.Map | null>(null);
  const layerRef         = useRef<L.LayerGroup | null>(null);
  const streetRef        = useRef<L.TileLayer | null>(null);
  const satelliteRef     = useRef<L.TileLayer | null>(null);
  const resizeFrameRef   = useRef<number | null>(null);
  const resizeTimerRef   = useRef<number | null>(null);
  const resizeLockRef    = useRef(false); // bloqueia ResizeObserver durante troca de fullscreen
  const [mapReady, setMapReady] = useState(false);

  const hoje = new Date();
  const [year,  setYear]  = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth() + 1);
  const [pins,  setPins]  = useState<MapaPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [tileMode, setTileMode] = useState<TileMode>('satellite');

  const [filtroCC,     setFiltroCC]     = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('');
  const [filtroBairro, setFiltroBairro] = useState('');
  const [filtroDia,    setFiltroDia]    = useState('');

  const scheduleMapResize = useCallback((delay = 0) => {
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    if (resizeTimerRef.current !== null) {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = null;
    }

    const run = () => {
      resizeFrameRef.current = requestAnimationFrame(() => {
        mapRef.current?.invalidateSize({ pan: false, animate: false });
        resizeFrameRef.current = null;
      });
    };

    if (delay > 0) {
      resizeTimerRef.current = window.setTimeout(() => {
        resizeTimerRef.current = null;
        run();
      }, delay);
      return;
    }

    run();
  }, []);

  const centros = useMemo(() => {
    const m = new Map<string, string>();
    pins.forEach(p => m.set(p.centroCusto.id, p.centroCusto.nome));
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [pins]);

  const bairros = useMemo(() => {
    const set = new Set<string>();
    pins.forEach(p => { if (p.bairro) set.add(p.bairro); });
    return Array.from(set).sort();
  }, [pins]);

  const pinsFiltrados = useMemo(() => pins.filter(p => {
    if (filtroStatus && getStatusLabel(p.status) !== filtroStatus) return false;
    if (filtroBairro && p.bairro !== filtroBairro) return false;
    if (filtroDia && p.data !== filtroDia) return false;
    return true;
  }), [pins, filtroStatus, filtroBairro, filtroDia]);

  /* ── inicializar mapa ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const el = containerRef.current;
    const map = L.map(el, { center: [-12.5253, -40.3083], zoom: 13, zoomControl: true, zoomAnimation: false });

    const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 19,
    });
    const satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: '© Google', subdomains: ['mt0','mt1','mt2','mt3'], maxZoom: 21,
      updateWhenZooming: false, keepBuffer: 4,
    });

    satellite.addTo(map);
    streetRef.current    = street;
    satelliteRef.current = satellite;
    layerRef.current     = L.layerGroup().addTo(map);
    mapRef.current       = map;

    const ro = new ResizeObserver(() => {
      if (!resizeLockRef.current) scheduleMapResize(40);
    });
    ro.observe(el);
    setTimeout(() => { map.invalidateSize({ pan: false, animate: false }); setMapReady(true); }, 200);

    return () => {
      ro.disconnect();
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      setMapReady(false);
    };
  }, [scheduleMapResize]);

  /* trocar tile ao mudar modo */
  useEffect(() => {
    if (!mapRef.current || !streetRef.current || !satelliteRef.current) return;
    if (tileMode === 'satellite') {
      mapRef.current.removeLayer(streetRef.current);
      satelliteRef.current.addTo(mapRef.current);
    } else {
      mapRef.current.removeLayer(satelliteRef.current);
      streetRef.current.addTo(mapRef.current);
    }
  }, [tileMode]);

  const loadPins = useCallback(async () => {
    if (!mapReady) return;
    setLoading(true);
    try {
      const res = await mapaApi.pins(entityId, year, month, filtroCC || undefined);
      setPins(res.pins);
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, [entityId, year, month, filtroCC, mapReady]);

  useEffect(() => { void loadPins(); }, [loadPins]);

  useEffect(() => {
    if (!mapReady || !layerRef.current || !mapRef.current) return;
    layerRef.current.clearLayers();
    const bounds: L.LatLng[] = [];

    pinsFiltrados.forEach(pin => {
      const cor       = getCorServico(pin.centroCusto.nome);
      const statusCor = getStatusCor(pin.status);
      const icone     = criarIconePin(cor, statusCor, getIconeServico(pin.centroCusto.nome));
      const ll        = L.latLng(pin.lat, pin.lng);
      bounds.push(ll);
      const dataFmt = new Date(pin.data + 'T12:00:00').toLocaleDateString('pt-BR');
      const marker  = L.marker(ll, { icon: icone });

      const slug = NOME_PARA_SLUG[pin.centroCusto.nome];
      const href = slug ? `/t/${entityId}/servicos/${slug}` : null;

      marker.bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:220px;max-width:260px;line-height:1.4">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">
            <div style="width:8px;height:8px;border-radius:50%;background:${statusCor};flex-shrink:0;box-shadow:0 0 0 3px ${statusCor}22"></div>
            <strong style="font-size:13px;color:#0a0a0a;letter-spacing:-0.01em;flex:1">${pin.centroCusto.nome}</strong>
            ${href ? `
            <a href="${href}" title="Ver ordem de serviço" style="
              display:inline-flex;align-items:center;justify-content:center;
              width:26px;height:26px;border-radius:7px;flex-shrink:0;
              background:#f0f4fa;border:1px solid rgba(91,141,184,0.25);
              color:#5b8db8;text-decoration:none;
              transition:background 0.15s;
            " onmouseover="this.style.background='#dce8f5'" onmouseout="this.style.background='#f0f4fa'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>` : ''}
          </div>
          ${[pin.logradouro, pin.bairro].filter(Boolean).length > 0 ? `
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" style="flex-shrink:0;margin-top:2px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style="font-size:12px;color:#555">${[pin.logradouro, pin.bairro].filter(Boolean).join(', ')}</span>
          </div>` : ''}
          ${pin.tipoServico ? `<div style="font-size:11px;color:#888;margin-bottom:8px;padding:3px 8px;background:#f8f8f8;border-radius:4px;display:inline-block">${pin.tipoServico}</div>` : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
            <span style="padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:700;background:${statusCor}18;color:${statusCor};border:1px solid ${statusCor}40">
              ${getStatusLabel(pin.status)}
            </span>
            <span style="font-size:10px;color:#bbb">${dataFmt}</span>
          </div>
        </div>`, { maxWidth: 280, className: 'sv-mapa-popup' });

      layerRef.current?.addLayer(marker);
    });

    if (bounds.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 16 });
    } else if (pins.length === 0) {
      mapRef.current.setView([-12.5253, -40.3083], 13);
    }
  }, [pinsFiltrados, mapReady]);

  const mudarMes = (delta: number) => {
    let nm = month + delta; let ny = year;
    if (nm < 1)  { nm = 12; ny--; }
    if (nm > 12) { nm = 1;  ny++; }
    setMonth(nm); setYear(ny); setFiltroDia('');
  };

  const concluidas  = pinsFiltrados.filter(p => getStatusLabel(p.status) === 'Concluída').length;
  const emAndamento = pinsFiltrados.filter(p => getStatusLabel(p.status) === 'Em andamento').length;
  const abertas     = pinsFiltrados.filter(p => getStatusLabel(p.status) === 'Aberta').length;
  const total       = pinsFiltrados.length;

  const temFiltro = filtroCC || filtroStatus || filtroBairro || filtroDia;

  return (
    <div className={`sv-mapa-layout${fullscreenMode ? ' is-fullscreen' : ''}`}>

      {/* ── Coluna principal: controles + mapa ── */}
      <div className="sv-mapa-main">

        {showFilters && (
          <div className="sv-mapa-controls">

            {/* Navegação mês */}
            <div className="sv-month-nav">
              <button type="button" className="sv-month-btn" onClick={() => mudarMes(-1)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="sv-month-label" style={{ textTransform: 'capitalize', fontSize: 12 }}>
                {nomeMes(month, year)}
              </span>
              <button type="button" className="sv-month-btn" onClick={() => mudarMes(1)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Separador */}
            <div className="sv-mapa-sep" />

            {/* Pills de tile */}
            <div className="sv-mapa-pills">
              <button type="button" className={`sv-mapa-pill${tileMode === 'street' ? ' is-active' : ''}`} onClick={() => setTileMode('street')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Mapa
              </button>
              <button type="button" className={`sv-mapa-pill${tileMode === 'satellite' ? ' is-active' : ''}`} onClick={() => setTileMode('satellite')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                Satélite
              </button>
            </div>

            <div className="sv-mapa-sep" />

            {/* Dropdown de status */}
            <select className="sv-mapa-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as FiltroStatus)}>
              <option value="">Todos os status</option>
              <option value="Aberta">Aberta</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Concluída">Concluída</option>
              <option value="Cancelada">Cancelada</option>
            </select>

            {/* Filtros select */}
            {centros.length > 1 && (
              <select className="sv-mapa-select" value={filtroCC} onChange={e => setFiltroCC(e.target.value)}>
                <option value="">Todos os serviços</option>
                {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {bairros.length > 0 && (
              <select className="sv-mapa-select" value={filtroBairro} onChange={e => setFiltroBairro(e.target.value)}>
                <option value="">Todos os bairros</option>
                {bairros.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            {pins.length > 0 && (
              <input type="date" className="sv-mapa-select" style={{ paddingRight: 8 }}
                value={filtroDia}
                min={`${year}-${String(month).padStart(2,'0')}-01`}
                max={`${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`}
                onChange={e => setFiltroDia(e.target.value)}
              />
            )}

            {temFiltro && (
              <button type="button" className="sv-mapa-clear" onClick={() => { setFiltroCC(''); setFiltroStatus(''); setFiltroBairro(''); setFiltroDia(''); }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Limpar
              </button>
            )}

            {loading && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--tn-muted)" strokeWidth="2" className="sv-spin" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            )}
          </div>
        )}

        {/* Mapa */}
        <div className="sv-mapa-container" style={{ position: 'relative', flex: fullscreenMode ? 1 : undefined, display: fullscreenMode ? 'flex' : undefined, flexDirection: fullscreenMode ? 'column' : undefined }}>
          <div ref={containerRef} className="sv-mapa-leaflet" style={{ minHeight: fullscreenMode ? 0 : height, flex: fullscreenMode ? 1 : undefined, width: '100%' }} />

          {/* Botão abrir em nova aba / fechar */}
          {fullscreenMode ? (
            <button
              type="button"
              className="sv-mapa-fs-btn"
              onClick={() => window.close()}
              title="Fechar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="sv-mapa-fs-btn"
              onClick={() => window.open(`/t/${entityId}/mapa`, '_blank')}
              title="Abrir mapa em tela cheia"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M21 8V5a2 2 0 00-2-2h-3"/>
                <path d="M3 16v3a2 2 0 002 2h3"/><path d="M16 21h3a2 2 0 002-2v-3"/>
              </svg>
            </button>
          )}

          {mapReady && !loading && pinsFiltrados.length === 0 && (
            <div className="sv-mapa-empty">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span>{pins.length > 0 ? 'Nenhuma ocorrência para os filtros selecionados' : `Nenhuma ocorrência com localização em ${nomeMes(month, year)}`}</span>
              {pins.length === 0 && <small>As coordenadas são salvas ao registrar uma ocorrência com localização.</small>}
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar direita ── */}
      <div className="sv-mapa-sidebar">

        {/* Stats */}
        <div className="sv-mapa-sb-stat-card">
          <div className="sv-mapa-sb-stat-ring">
            <span className="sv-mapa-sb-value">{total}</span>
          </div>
          <div className="sv-mapa-sb-label" style={{ textAlign: 'center', marginBottom: 0 }}>ocorrências no mapa</div>
        </div>

        <div className="sv-mapa-sb-divider" />

        {/* Legenda com contadores */}
        <div className="sv-mapa-sb-block" title={`${LEGENDA.length} status monitorados`}>
          <div className="sv-mapa-sb-label">Legenda</div>
          <div className="sv-mapa-sb-legenda">
            {[
              { cor: '#22c55e', label: 'Concluída',    count: concluidas },
              { cor: '#f97316', label: 'Em andamento', count: emAndamento },
              { cor: '#5b8db8', label: 'Aberta',       count: abertas },
            ].map(l => {
              const pct = total > 0 ? Math.round((l.count / total) * 100) : 0;
              return (
                <div key={l.label} className="sv-mapa-sb-leg-item" style={{ '--dot-color': l.cor } as React.CSSProperties}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span className="sv-mapa-sb-dot" style={{ background: l.cor }} />
                      <span className="sv-mapa-sb-leg-label">{l.label}</span>
                    </div>
                    <span className="sv-mapa-sb-leg-count">{l.count}</span>
                  </div>
                  <div className="sv-mapa-sb-leg-bar-track">
                    <div className="sv-mapa-sb-leg-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sv-mapa-sb-divider" />

        {/* Bairros com mais ocorrências */}
        {bairros.length > 0 && (
          <div className="sv-mapa-sb-block">
            <div className="sv-mapa-sb-label">Por bairro</div>
            <div className="sv-mapa-sb-bairros">
              {(() => {
                const ranked = bairros
                  .map(b => ({ b, count: pinsFiltrados.filter(p => p.bairro === b).length }))
                  .filter(x => x.count > 0)
                  .sort((a, z) => z.count - a.count);
                const max = ranked[0]?.count ?? 1;
                function heatPill(count: number): { bg: string; text: string } {
                  const t = max === 1 ? 0 : (count - 1) / (max - 1); // 0=frio, 1=quente
                  if (t >= 0.85) return { bg: '#dc2626', text: '#fff' };
                  if (t >= 0.65) return { bg: '#f97316', text: '#fff' };
                  if (t >= 0.45) return { bg: '#eab308', text: '#78350f' };
                  if (t >= 0.25) return { bg: '#22c55e', text: '#fff' };
                  return { bg: '#3b82f6', text: '#fff' };
                }
                return ranked.map(({ b, count }, i) => {
                  const pill = heatPill(count);
                  return (
                    <div
                      key={b}
                      className={`sv-mapa-sb-bairro${filtroBairro === b ? ' is-active' : ''}`}
                      style={{ animationDelay: `${i * 55}ms` }}
                      onClick={() => setFiltroBairro(filtroBairro === b ? '' : b)}
                    >
                      <span>{b}</span>
                      <span className="sv-mapa-sb-rank-pill" style={{ background: pill.bg, color: pill.text }}>
                        {count}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
