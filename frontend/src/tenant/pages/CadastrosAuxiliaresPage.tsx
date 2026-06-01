import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  cadastrosAuxiliaresApi,
  enderecosDescobertoApi,
  type CadastroAuxiliar,
  type CadastroAuxiliarTipo,
  type EnderecoDescoberto,
} from '../../lib/api-client';
import { useTenant } from '../TenantContext';

/* fix ícones Leaflet */
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ICON_BAIRROS = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const ICON_EQUIPES = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
const ICON_FROTA   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
const ICON_EQUIP   = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07M8.46 8.46a5 5 0 000 7.07"/></svg>;
const ICON_ENDERECOS = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;

const ABAS_CADASTRO: { tipo: CadastroAuxiliarTipo; label: string; icon: React.ReactNode; dica: string }[] = [
  { tipo: 'BAIRRO',      label: 'Bairros',      icon: ICON_BAIRROS, dica: 'Bairros e localidades do município usados nos registros de serviços.' },
  { tipo: 'EQUIPE',      label: 'Equipes',       icon: ICON_EQUIPES, dica: 'Equipes de trabalho disponíveis para os serviços urbanos.' },
  { tipo: 'VEICULO',     label: 'Frota',         icon: ICON_FROTA,   dica: 'Veículos da frota municipal usados nos serviços.' },
  { tipo: 'EQUIPAMENTO', label: 'Equipamentos',  icon: ICON_EQUIP,   dica: 'Equipamentos e maquinários disponíveis para os serviços.' },
];

type AbaAtiva = CadastroAuxiliarTipo | 'ENDERECOS';

/* ── Mini mapa para cadastro manual de endereço ────────────────── */
function MapaCadastroEndereco({
  entityId,
  onSalvar,
  onCancelar,
}: {
  entityId: string;
  onSalvar: (item: EnderecoDescoberto) => void;
  onCancelar: () => void;
}) {
  const mapDiv   = useRef<HTMLDivElement>(null);
  const mapRef   = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [bairro, setBairro] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [busca, setBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;
    const map = L.map(mapDiv.current, { center: [-12.5253, -40.3083], zoom: 13 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);

    const colocar = (lat: number, lng: number) => {
      setCoords({ lat, lng });
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const p = markerRef.current!.getLatLng();
          setCoords({ lat: p.lat, lng: p.lng });
        });
      }
    };

    map.on('click', (e: L.LeafletMouseEvent) => colocar(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  const handleBuscar = async () => {
    if (!busca.trim()) return;
    setBuscando(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({ q: busca + ', Brasil', format: 'json', limit: '1', countrycodes: 'br' }),
        { headers: { 'User-Agent': 'GestaoObras/1.0' } },
      );
      const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setCoords({ lat, lng });
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 16);
          if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
          else {
            markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
            markerRef.current.on('dragend', () => {
              const p = markerRef.current!.getLatLng();
              setCoords({ lat: p.lat, lng: p.lng });
            });
          }
        }
      }
    } catch { /* ignore */ } finally { setBuscando(false); }
  };

  const handleSalvar = async () => {
    if (!bairro.trim() || !logradouro.trim() || !coords) {
      setError('Preencha bairro, logradouro e marque o ponto no mapa.');
      return;
    }
    setSalvando(true);
    setError('');
    try {
      const item = await enderecosDescobertoApi.create(entityId, {
        bairro: bairro.trim(),
        logradouro: logradouro.trim(),
        lat: coords.lat,
        lng: coords.lng,
      });
      onSalvar(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="end-cadastro-form">
      <div className="end-cadastro-fields">
        <div className="sv-modal-field">
          <span className="sv-modal-label">Bairro / Localidade <em className="sv-modal-req">*</em></span>
          <input type="text" className="sv-coord-search-input" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Costa e Silva" />
        </div>
        <div className="sv-modal-field">
          <span className="sv-modal-label">Logradouro / Rua <em className="sv-modal-req">*</em></span>
          <input type="text" className="sv-coord-search-input" value={logradouro} onChange={e => setLogradouro(e.target.value)} placeholder="Ex: Rua das Flores" />
        </div>
      </div>
      <div className="sv-coord-modal-search" style={{ padding: '8px 0' }}>
        <input
          type="text"
          className="sv-coord-search-input"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleBuscar()}
          placeholder="Buscar endereço no mapa…"
        />
        <button type="button" className="sv-coord-search-btn" onClick={() => void handleBuscar()} disabled={buscando}>
          {buscando
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sv-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          }
          Buscar
        </button>
      </div>
      <p className="sv-coord-hint" style={{ padding: 0, marginBottom: 8 }}>Clique no mapa ou arraste o pin para posicionar o endereço</p>
      <div ref={mapDiv} style={{ height: 280, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--tn-hairline)' }} />
      {coords && <p className="sv-coord-label">Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}</p>}
      {error && <div className="tn-alert" style={{ marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" className="tn-btn-secondary" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="tn-btn-blue" style={{ height: 38, fontSize: 13 }} onClick={() => void handleSalvar()} disabled={salvando || !coords || !bairro.trim() || !logradouro.trim()}>
          {salvando ? 'Salvando…' : 'Salvar endereço'}
        </button>
      </div>
    </div>
  );
}

/* ── Aba de endereços descobertos ───────────────────────────────── */
function AbaEnderecos({ entityId }: { entityId: string }) {
  const [items, setItems] = useState<EnderecoDescoberto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [mostraCadastro, setMostraCadastro] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<EnderecoDescoberto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await enderecosDescobertoApi.list(entityId);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (item: EnderecoDescoberto) => {
    setDeleting(true);
    try {
      await enderecosDescobertoApi.delete(entityId, item.id);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

  const filtrados = items.filter(i =>
    !filtro ||
    i.bairro.toLowerCase().includes(filtro.toLowerCase()) ||
    i.logradouro.toLowerCase().includes(filtro.toLowerCase()),
  );

  /* agrupa por bairro */
  const porBairro = filtrados.reduce<Record<string, EnderecoDescoberto[]>>((acc, i) => {
    (acc[i.bairro] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="tn-panel">
      <div className="tn-panel-head">
        <div className="tn-panel-head-left">
          <span>Mapeamento automático</span>
          <h3>Endereços descobertos</h3>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tn-chip dot-blue"><i />{items.length} endereço{items.length !== 1 ? 's' : ''}</span>
          <button
            type="button"
            className="tn-btn-blue"
            style={{ height: 36, fontSize: 13 }}
            onClick={() => setMostraCadastro(v => !v)}
          >
            {mostraCadastro ? 'Fechar' : '+ Cadastrar manualmente'}
          </button>
        </div>
      </div>

      <div className="cad-dica">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        Endereços descobertos automaticamente a partir das ocorrências registradas. Cada bairro + rua é gravado uma única vez.
      </div>

      {/* Formulário de cadastro manual */}
      {mostraCadastro && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--tn-hairline)' }}>
          <MapaCadastroEndereco
            entityId={entityId}
            onSalvar={(item) => { setItems(prev => [item, ...prev]); setMostraCadastro(false); }}
            onCancelar={() => setMostraCadastro(false)}
          />
        </div>
      )}

      {/* Busca */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--tn-hairline)' }}>
        <div className="sv-search-wrap" style={{ maxWidth: '100%' }}>
          <svg className="sv-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="sv-search"
            type="search"
            placeholder="Filtrar por bairro ou logradouro…"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            style={{ maxWidth: '100%' }}
          />
        </div>
      </div>

      {error && <div className="tn-alert" style={{ margin: '0 16px 12px' }}>{error}</div>}

      {loading ? (
        <div className="tn-skeleton">{[1,2,3].map(n => <div key={n} className="tn-skeleton-row" />)}</div>
      ) : items.length === 0 ? (
        <div className="tn-empty" style={{ padding: '40px 24px' }}>
          <div className="tn-empty-icon">🗺️</div>
          <strong>Nenhum endereço descoberto ainda</strong>
          <span>Os endereços aparecem automaticamente conforme as ocorrências são registradas com localização.</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="tn-empty" style={{ padding: '32px 24px' }}>
          <div className="tn-empty-icon">🔍</div>
          <strong>Nenhum resultado para "{filtro}"</strong>
        </div>
      ) : (
        <div className="end-lista">
          {Object.entries(porBairro).map(([bairro, ruas]) => (
            <div key={bairro} className="end-bairro-grupo">
              <div className="end-bairro-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <strong>{bairro}</strong>
                <span className="end-bairro-count">{ruas.length} rua{ruas.length !== 1 ? 's' : ''}</span>
              </div>
              {ruas.map(item => (
                <div key={item.id} className="end-rua-item">
                  <div className="end-rua-info">
                    <span className="end-rua-nome">{item.logradouro}</span>
                    <span className="end-rua-coords">
                      {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                    </span>
                  </div>
                  <div className="end-rua-data">
                    {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  <button
                    type="button"
                    className="tn-icon-btn sv-btn-excluir"
                    title="Excluir"
                    onClick={() => setConfirmDelete(item)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="sv-modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="sv-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="sv-confirm-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3>Excluir endereço?</h3>
            <p><strong>{confirmDelete.logradouro}</strong> — {confirmDelete.bairro}</p>
            <div className="sv-confirm-actions">
              <button type="button" className="tn-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button type="button" className="sv-btn-danger" onClick={() => void handleDelete(confirmDelete)} disabled={deleting}>
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Página principal ───────────────────────────────────────────── */
export function CadastrosAuxiliaresPage() {
  const { entityId } = useTenant();
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('BAIRRO');
  const [items, setItems] = useState<CadastroAuxiliar[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<CadastroAuxiliar | null>(null);

  const load = useCallback(async () => {
    if (abaAtiva === 'ENDERECOS') return;
    setLoading(true);
    setError('');
    try {
      const res = await cadastrosAuxiliaresApi.list(entityId, abaAtiva as CadastroAuxiliarTipo);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [entityId, abaAtiva]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!novoNome.trim()) return;
    setAdding(true); setError('');
    try {
      await cadastrosAuxiliaresApi.create(entityId, { tipo: abaAtiva as CadastroAuxiliarTipo, nome: novoNome.trim() });
      setNovoNome('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao adicionar');
    } finally { setAdding(false); }
  };

  const handleToggleAtivo = async (item: CadastroAuxiliar) => {
    setSaving(true);
    try {
      await cadastrosAuxiliaresApi.update(entityId, item.id, { ativo: !item.ativo });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally { setSaving(false); }
  };

  const handleEdit = async (id: string) => {
    if (!editNome.trim()) return;
    setSaving(true); setError('');
    try {
      await cadastrosAuxiliaresApi.update(entityId, id, { nome: editNome.trim() });
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (item: CadastroAuxiliar) => {
    setSaving(true);
    try {
      await cadastrosAuxiliaresApi.delete(entityId, item.id);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally { setSaving(false); }
  };

  const abaInfo = ABAS_CADASTRO.find(a => a.tipo === abaAtiva);
  const sort = (arr: CadastroAuxiliar[]) => [...arr].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ativos   = sort(items.filter(i => i.ativo));
  const inativos = sort(items.filter(i => !i.ativo));

  return (
    <div className="tn-page">

      <div className="tn-hero-light">
        <div className="tn-hero-light-glow" />
        <div className="tn-hero-light-inner">
          <div className="tn-hero-light-left">
            <div className="tn-hero-light-kicker">
              <span className="tn-hero-light-dot" />
              Configurações
            </div>
            <h2 className="tn-hero-light-title">Cadastros <span>Auxiliares</span></h2>
            <p className="tn-hero-light-desc">
              Bairros, equipes, frota, equipamentos e endereços mapeados do município.
            </p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="cad-abas">
        {ABAS_CADASTRO.map(aba => (
          <button
            key={aba.tipo}
            type="button"
            className={`cad-aba${abaAtiva === aba.tipo ? ' is-active' : ''}`}
            onClick={() => { setAbaAtiva(aba.tipo); setNovoNome(''); setEditId(null); setError(''); }}
          >
            <span className="cad-aba-icon">{aba.icon}</span>
            {aba.label}
          </button>
        ))}
        <button
          type="button"
          className={`cad-aba${abaAtiva === 'ENDERECOS' ? ' is-active' : ''}`}
          onClick={() => { setAbaAtiva('ENDERECOS'); setError(''); }}
        >
          <span className="cad-aba-icon">{ICON_ENDERECOS}</span>
          Endereços
        </button>
      </div>

      {/* Aba de endereços */}
      {abaAtiva === 'ENDERECOS' && <AbaEnderecos entityId={entityId} />}

      {/* Abas normais */}
      {abaAtiva !== 'ENDERECOS' && abaInfo && (
        <div className="tn-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left">
              <span>Cadastro</span>
              <h3>{abaInfo.label}</h3>
            </div>
            <span className="tn-chip dot-blue">
              <i />{ativos.length} ativo{ativos.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="cad-dica">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {abaInfo.dica}
          </div>

          <div className="cad-add-form">
            <input
              type="text"
              className="cad-add-input"
              placeholder={`Novo(a) ${abaInfo.label.slice(0,-1).toLowerCase()}…`}
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); }}
              maxLength={150}
            />
            <button
              type="button"
              className="tn-btn-blue"
              style={{ height: 40, fontSize: 13, whiteSpace: 'nowrap' }}
              onClick={handleAdd}
              disabled={adding || !novoNome.trim()}
            >
              {adding ? 'Adicionando…' : '+ Adicionar'}
            </button>
          </div>

          {error && <div className="tn-alert" style={{ margin: '0 16px 12px' }}>{error}</div>}

          {loading ? (
            <div className="tn-skeleton">{[1,2,3].map(n => <div key={n} className="tn-skeleton-row" />)}</div>
          ) : items.length === 0 ? (
            <div className="tn-empty" style={{ padding: '32px 24px' }}>
              <div className="tn-empty-icon">{abaInfo.icon}</div>
              <strong>Nenhum(a) {abaInfo.label.slice(0,-1).toLowerCase()} cadastrado(a)</strong>
              <span>Use o campo acima para adicionar o primeiro.</span>
            </div>
          ) : (
            <div className="cad-list">
              {ativos.map((item, idx) => (
                <div key={item.id} className="cad-item" style={{ '--item-delay': `${idx * 0.03}s` } as React.CSSProperties}>
                  <div className="cad-item-dot cad-dot-green" />
                  {editId === item.id ? (
                    <input
                      type="text" className="cad-edit-input" value={editNome}
                      onChange={e => setEditNome(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void handleEdit(item.id); if (e.key === 'Escape') setEditId(null); }}
                      autoFocus maxLength={150}
                    />
                  ) : (
                    <span className="cad-item-nome">{item.nome}</span>
                  )}
                  <div className="cad-item-actions">
                    {editId === item.id ? (
                      <>
                        <button type="button" className="tn-icon-btn cad-btn-save" onClick={() => void handleEdit(item.id)} disabled={saving} title="Salvar">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button type="button" className="tn-icon-btn" onClick={() => setEditId(null)} title="Cancelar">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="tn-icon-btn" title="Editar" onClick={() => { setEditId(item.id); setEditNome(item.nome); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button type="button" className="tn-icon-btn cad-btn-inativar" title="Inativar" onClick={() => void handleToggleAtivo(item)} disabled={saving}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        </button>
                        <button type="button" className="tn-icon-btn sv-btn-excluir" title="Excluir" onClick={() => setConfirmDelete(item)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {inativos.length > 0 && (
                <>
                  <div className="cad-section-label">Inativos</div>
                  {inativos.map((item, idx) => (
                    <div key={item.id} className="cad-item cad-item-inativo" style={{ '--item-delay': `${idx * 0.03}s` } as React.CSSProperties}>
                      <div className="cad-item-dot cad-dot-gray" />
                      <span className="cad-item-nome">{item.nome}</span>
                      <div className="cad-item-actions">
                        <button type="button" className="tn-icon-btn cad-btn-reativar" title="Reativar" onClick={() => void handleToggleAtivo(item)} disabled={saving}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                        </button>
                        <button type="button" className="tn-icon-btn sv-btn-excluir" title="Excluir" onClick={() => setConfirmDelete(item)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="sv-modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="sv-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="sv-confirm-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3>Excluir "{confirmDelete.nome}"?</h3>
            <p>Esta ação não pode ser desfeita. Registros já lançados não serão afetados.</p>
            <div className="sv-confirm-actions">
              <button type="button" className="tn-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button type="button" className="sv-btn-danger" onClick={() => void handleDelete(confirmDelete)} disabled={saving}>
                {saving ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
