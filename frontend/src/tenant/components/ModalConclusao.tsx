import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { useTenant } from '../TenantContext';
import { mapaApi } from '../../lib/api-client';

type MidiaLocal = { id: string; url: string; tipo: string; nome: string; tamanho: number; uploading?: boolean; error?: string };

interface Props {
  registroId: string;
  centroCustoNome: string;
  cor: string;
  data: string;
  bairro?: string;
  logradouro?: string;
  lat?: number | null;
  lng?: number | null;
  onClose: () => void;
  onConfirm: (dados: DadosConclusao) => Promise<void>;
}

export interface DadosConclusao {
  statusFinal: string;
  qualidade: string;
  observacoesFiscal: string;
  dataVistoria: string;
  nomeFiscal: string;
  lat?: number;
  lng?: number;
  enderecoConfirmado?: string;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ModalConclusao({ registroId, centroCustoNome, cor, data, bairro, logradouro, lat, lng, onClose, onConfirm }: Props) {
  const { session, entityId } = useTenant();

  const [statusFinal,       setStatusFinal]       = useState('Concluído');
  const [qualidade,         setQualidade]         = useState('');
  const [observacoesFiscal, setObservacoesFiscal] = useState('');
  const [dataVistoria,      setDataVistoria]      = useState(hoje());
  const [nomeFiscal,        setNomeFiscal]        = useState(session.name);
  const [saving,            setSaving]            = useState(false);
  const [error,             setError]             = useState('');
  const [midias,            setMidias]            = useState<MidiaLocal[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* mapa de confirmação */
  const mapDiv    = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [coordsConfirmadas, setCoordsConfirmadas] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null
  );
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'found'>('idle');
  const [geoLabel,  setGeoLabel]  = useState('');
  const entityIdRef = useRef(entityId);

  const firstRef = useRef<HTMLSelectElement>(null);
  const bodyRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { bodyRef.current?.scrollTo({ top: 0 }); }, 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  /* inicializar mini-mapa */
  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;

    const centro: [number, number] = lat != null && lng != null
      ? [lat, lng]
      : [-12.5253, -40.3083];

    const map = L.map(mapDiv.current, {
      center: centro,
      zoom: lat != null ? 16 : 13,
      zoomControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    /* pin inicial do registro original */
    if (lat != null && lng != null) {
      const pinOriginal = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#94a3b8;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);opacity:0.6;" title="Localização original do registro"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([lat, lng], { icon: pinOriginal }).addTo(map);
    }

    const pinFiscal = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#16a34a;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.35);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;">
        <div style="transform:rotate(45deg);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30],
    });

    const colocarPin = (clat: number, clng: number) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([clat, clng]);
      } else {
        markerRef.current = L.marker([clat, clng], { icon: pinFiscal, draggable: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current!.getLatLng();
          fazerReverso(pos.lat, pos.lng);
        });
      }
    };

    const fazerReverso = (clat: number, clng: number) => {
      setCoordsConfirmadas({ lat: clat, lng: clng });
      setGeoStatus('loading');
      mapaApi.reverse(entityIdRef.current, clat, clng).then(res => {
        setGeoLabel(res.label);
        setGeoStatus('found');
      }).catch(() => setGeoStatus('idle'));
    };

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clat, lng: clng } = e.latlng;
      colocarPin(clat, clng);
      fazerReverso(clat, clng);
    });

    /* se já tem coords, coloca o pin do fiscal */
    if (lat != null && lng != null) {
      colocarPin(lat, lng);
    }

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/');
      const maxMB   = isVideo ? 50 : 10;
      if (file.size > maxMB * 1024 * 1024) {
        setError(`"${file.name}" excede ${maxMB}MB.`);
        continue;
      }
      const tempId = crypto.randomUUID();
      const url    = URL.createObjectURL(file);
      setMidias(prev => [...prev, { id: tempId, url, tipo: isVideo ? 'video' : 'foto', nome: file.name, tamanho: file.size, uploading: true }]);
      try {
        const saved = await mapaApi.uploadMidia(entityId, registroId, file);
        /* mantém o blob URL local para preview — a URL da API exige auth e não funciona em <img> */
        setMidias(prev => prev.map(m => m.id === tempId ? { ...m, id: saved.id, uploading: false } : m));
      } catch {
        setMidias(prev => prev.map(m => m.id === tempId ? { ...m, uploading: false, error: 'Falha no upload' } : m));
      }
    }
  }, [entityId, registroId]);

  /* revogar blob URLs ao desmontar */
  useEffect(() => {
    return () => {
      midias.forEach(m => { if (m.url.startsWith('blob:')) URL.revokeObjectURL(m.url); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveMidia = useCallback(async (midia: MidiaLocal) => {
    if (midia.uploading) return;
    if (midia.url.startsWith('blob:')) URL.revokeObjectURL(midia.url);
    setMidias(prev => prev.filter(m => m.id !== midia.id));
    try { await mapaApi.deleteMidia(entityId, midia.id); } catch { /* silencioso */ }
  }, [entityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qualidade) { setError('Informe a qualidade da execução.'); return; }
    if (!nomeFiscal.trim()) { setError('Informe o nome do fiscal.'); return; }
    setError('');
    setSaving(true);
    try {
      await onConfirm({
        statusFinal, qualidade, observacoesFiscal, dataVistoria, nomeFiscal,
        lat: coordsConfirmadas?.lat,
        lng: coordsConfirmadas?.lng,
        enderecoConfirmado: geoLabel || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar conclusão');
      setSaving(false);
    }
  };

  const formatDataBr = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return createPortal(
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal sv-modal-conclusao" onClick={e => e.stopPropagation()}>

        {/* Barra verde */}
        <div className="sv-modal-bar" style={{ background: '#22c55e' }} />

        {/* Cabeçalho */}
        <div className="sv-modal-head">
          <div className="sv-modal-head-left">
            <div className="sv-modal-eyebrow" style={{ color: '#16a34a' }}>
              <span style={{
                display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
                background: 'rgba(34,197,94,0.12)', borderRadius: 6,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              Vistoria de Conclusão
            </div>
            <h3 className="sv-modal-title">Baixa do serviço</h3>
            <p className="sv-modal-subtitle">
              {centroCustoNome} · {[logradouro, bairro].filter(Boolean).join(', ') || formatDataBr(data)}
            </p>
          </div>
          <button type="button" className="sv-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Formulário */}
        <form className="sv-modal-form" onSubmit={handleSubmit}>
          <div className="sv-modal-body" ref={bodyRef}>

            {/* Info do registro */}
            <div className="sv-conclusao-info" style={{ '--sv-cor': cor } as React.CSSProperties}>
              <div className="sv-conclusao-info-row">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Registro de {formatDataBr(data)}
              </div>
              {(bairro || logradouro) && (
                <div className="sv-conclusao-info-row">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {[logradouro, bairro].filter(Boolean).join(', ')}
                </div>
              )}
            </div>

            {/* Mapa de confirmação — largura total */}
            <div className="sv-modal-field" style={{ gridColumn: '1 / -1' }}>
              <span className="sv-modal-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Confirmação de localização
                <span style={{ fontWeight: 400, marginLeft: 4, textTransform: 'none', letterSpacing: 0 }}>
                  — clique no mapa para confirmar onde o fiscal está
                </span>
              </span>
              <div className="sv-mini-mapa sv-conclusao-mapa">
                <div ref={mapDiv} style={{ height: 220, width: '100%' }} />
                {!coordsConfirmadas && (
                  <div className="sv-mini-mapa-overlay">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>Clique no mapa para confirmar o local da vistoria</span>
                  </div>
                )}
                {geoStatus === 'loading' && (
                  <div className="sv-mini-mapa-overlay">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sv-spin">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    <span>Localizando…</span>
                  </div>
                )}
              </div>
              {/* Status da localização */}
              <div className={`sv-mini-mapa-status${geoStatus === 'found' ? ' is-found' : ''}`}>
                {geoStatus === 'found' && coordsConfirmadas && (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {geoLabel || `${coordsConfirmadas.lat.toFixed(5)}, ${coordsConfirmadas.lng.toFixed(5)}`}
                  </>
                )}
                {geoStatus === 'idle' && coordsConfirmadas && (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {coordsConfirmadas.lat.toFixed(5)}, {coordsConfirmadas.lng.toFixed(5)}
                  </>
                )}
                {!coordsConfirmadas && (
                  <span style={{ color: 'var(--tn-muted)' }}>Localização não confirmada</span>
                )}
              </div>
              {/* Legenda */}
              {lat != null && (
                <div className="sv-conclusao-legenda-mapa">
                  <span><i style={{ background: '#94a3b8' }} /> Local original do registro</span>
                  <span><i style={{ background: '#16a34a' }} /> Local da vistoria (fiscal)</span>
                </div>
              )}
            </div>

            {/* ── Levantamento fotográfico ── */}
            <div className="sv-modal-field sv-midia-section" style={{ gridColumn: '1 / -1' }}>
              <span className="sv-modal-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Levantamento fotográfico / vídeo
                <span style={{ fontWeight: 400, marginLeft: 4, textTransform: 'none', letterSpacing: 0, color: 'var(--tn-muted)' }}>
                  — fotos e vídeos curtos do local (até 10MB/foto · 50MB/vídeo)
                </span>
              </span>

              {/* Drop zone */}
              <div
                className="sv-midia-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('is-drag'); }}
                onDragLeave={e => e.currentTarget.classList.remove('is-drag')}
                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('is-drag'); void handleUpload(e.dataTransfer.files); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Clique ou arraste arquivos aqui</span>
                <small>JPG, PNG, MP4, MOV</small>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  style={{ display: 'none' }}
                  onChange={e => { void handleUpload(e.target.files); e.target.value = ''; }}
                />
              </div>

              {/* Grid de preview */}
              {midias.length > 0 && (
                <div className="sv-midia-grid">
                  {midias.map(m => (
                    <div key={m.id} className={`sv-midia-thumb${m.uploading ? ' is-uploading' : ''}${m.error ? ' is-error' : ''}`}>
                      {m.tipo === 'video' ? (
                        <video src={m.url} className="sv-midia-preview" muted playsInline />
                      ) : (
                        <img src={m.url} alt={m.nome} className="sv-midia-preview" />
                      )}
                      <div className="sv-midia-overlay">
                        {m.uploading && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="sv-spin">
                            <path d="M21 12a9 9 0 11-6.219-8.56"/>
                          </svg>
                        )}
                        {m.error && <span className="sv-midia-err">{m.error}</span>}
                        {!m.uploading && (
                          <button type="button" className="sv-midia-del" onClick={() => void handleRemoveMidia(m)}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        )}
                      </div>
                      {m.tipo === 'video' && (
                        <div className="sv-midia-badge-video">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          Vídeo
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status final */}
            <label className="sv-modal-field">
              <span className="sv-modal-label">Status final <em className="sv-modal-req">*</em></span>
              <select ref={firstRef} value={statusFinal} onChange={e => setStatusFinal(e.target.value)}>
                <option value="Concluído">Concluído</option>
                <option value="Concluído Parcialmente">Concluído Parcialmente</option>
                <option value="Não Executado">Não Executado</option>
              </select>
            </label>

            {/* Qualidade */}
            <label className="sv-modal-field">
              <span className="sv-modal-label">Qualidade da execução <em className="sv-modal-req">*</em></span>
              <select value={qualidade} onChange={e => setQualidade(e.target.value)}>
                <option value="">Selecione…</option>
                <option value="Boa">Boa</option>
                <option value="Regular">Regular</option>
                <option value="Insatisfatória">Insatisfatória</option>
              </select>
            </label>

            {/* Data da vistoria */}
            <label className="sv-modal-field">
              <span className="sv-modal-label">Data da vistoria <em className="sv-modal-req">*</em></span>
              <input type="date" value={dataVistoria} onChange={e => setDataVistoria(e.target.value)} required />
            </label>

            {/* Fiscal responsável */}
            <label className="sv-modal-field">
              <span className="sv-modal-label">Fiscal responsável <em className="sv-modal-req">*</em></span>
              <input
                type="text"
                value={nomeFiscal}
                onChange={e => setNomeFiscal(e.target.value)}
                placeholder="Nome do fiscal…"
              />
            </label>

            {/* Observações — largura total */}
            <label className="sv-modal-field" style={{ gridColumn: '1 / -1' }}>
              <span className="sv-modal-label">Observações do fiscal</span>
              <textarea
                value={observacoesFiscal}
                onChange={e => setObservacoesFiscal(e.target.value)}
                placeholder="Descreva as condições encontradas no local, pendências, observações gerais…"
                rows={3}
              />
            </label>

            {/* Aviso qualidade insatisfatória */}
            {qualidade === 'Insatisfatória' && (
              <div className="sv-conclusao-alerta" style={{ gridColumn: '1 / -1' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Qualidade insatisfatória. Descreva as pendências nas observações acima.
              </div>
            )}

            {error && (
              <div className="tn-alert" style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}
          </div>

          <div className="sv-modal-footer">
            <button type="button" className="tn-btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="sv-btn-conclusao" disabled={saving}>
              {saving ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sv-spin">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  Registrando…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Confirmar baixa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
