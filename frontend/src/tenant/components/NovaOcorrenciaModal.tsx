import { useEffect, useRef, useState, useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { tenantApi, cadastrosAuxiliaresApi, mapaApi, type CentroCustoDetail, type RegistroDiarioRow, type BairroCoord } from '../../lib/api-client';
import { type ServicoConfig, type CampoConfig } from '../pages/servico-config';
import { CENTRO_IDS } from '../pages/servico-config';


/* ── Multi-select com checkboxes ─────────────────────────────── */
function MultiSelectCheckbox({
  label, obrigatorio, opcoes, value, onChange,
}: {
  label: string;
  obrigatorio?: boolean;
  opcoes: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  const selecionados = value ? value.split(', ').filter(Boolean) : [];

  const toggle = (opcao: string) => {
    const set = new Set(selecionados);
    if (set.has(opcao)) set.delete(opcao); else set.add(opcao);
    onChange(Array.from(set).join(', '));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="sv-modal-field" ref={ref} style={{ position: 'relative' }}>
      <span className="sv-modal-label">
        {label}
        {obrigatorio && <em className="sv-modal-req">*</em>}
      </span>
      <button
        type="button"
        id={id}
        className="sv-multiselect-btn"
        onClick={() => setOpen(o => !o)}
      >
        <span className="sv-multiselect-preview">
          {selecionados.length === 0
            ? 'Selecione…'
            : selecionados.length === 1
              ? selecionados[0]
              : `${selecionados.length} selecionados`}
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {selecionados.length > 0 && (
        <div className="sv-multiselect-tags">
          {selecionados.map(s => (
            <span key={s} className="sv-multiselect-tag">
              {s}
              <button type="button" onClick={() => toggle(s)}>×</button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="sv-multiselect-dropdown">
          {opcoes.map(opcao => (
            <label key={opcao} className="sv-multiselect-item">
              <input
                type="checkbox"
                checked={selecionados.includes(opcao)}
                onChange={() => toggle(opcao)}
              />
              <span>{opcao}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Combobox de bairro com busca ────────────────────────────── */
function BairroCombobox({
  opcoes, bairrosCoords, value, onChange, obrigatorio, inputRef,
}: {
  opcoes: string[];
  bairrosCoords: BairroCoord[];
  value: string;
  onChange: (v: string) => void;
  obrigatorio?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [query, setQuery]   = useState(value);
  const [open,  setOpen]    = useState(false);
  const wrapRef             = useRef<HTMLDivElement>(null);
  const listRef             = useRef<HTMLUListElement>(null);
  const [cursor, setCursor] = useState(-1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    /* só filtra se a query é diferente do value selecionado (usuário está digitando) */
    if (!q || q === value.toLowerCase()) return opcoes;
    return opcoes.filter(o => o.toLowerCase().includes(q));
  }, [query, opcoes, value]);

  /* fecha ao clicar fora */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* sincroniza query quando value muda externamente (ex: sugestão reverso) */
  useEffect(() => { setQuery(value); }, [value]);

  const select = (opt: string) => {
    setQuery(opt);
    setOpen(false);
    setCursor(-1);
    onChange(opt);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { setCursor(c => Math.min(c + 1, filtered.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setCursor(c => Math.max(c - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter' && cursor >= 0) { select(filtered[cursor]); e.preventDefault(); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="sv-modal-field" ref={wrapRef} style={{ position: 'relative' }}>
      <span className="sv-modal-label">
        Bairro / Localidade
        {obrigatorio && <em className="sv-modal-req">*</em>}
      </span>
      <div className="sv-combobox-wrap">
        <input
          ref={inputRef}
          className="sv-combobox-input"
          type="text"
          placeholder="Digite ou selecione…"
          value={query}
          autoComplete="off"
          onFocus={() => { /* não abre automaticamente — só abre ao digitar ou clicar na seta */ }}
          onClick={() => setOpen(o => !o)}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); }}
          onKeyDown={handleKey}
        />
        {query && (
          <button type="button" className="sv-combobox-clear" onClick={e => { e.stopPropagation(); setQuery(''); onChange(''); setCursor(-1); setOpen(true); }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
        <svg className="sv-combobox-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && filtered.length > 0 && (
        <ul className="sv-combobox-list" ref={listRef}>
          {filtered.map((opt, i) => {
            const temCoord = bairrosCoords.some(b => b.nome.toLowerCase() === opt.toLowerCase() && b.lat != null);
            return (
              <li
                key={opt}
                className={`sv-combobox-item${i === cursor ? ' is-cursor' : ''}${opt === value ? ' is-selected' : ''}`}
                onMouseDown={() => select(opt)}
              >
                <span>{opt}</span>
                {temCoord && (
                  <span className="sv-combobox-coord-badge" title="Coordenada cadastrada">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {open && filtered.length === 0 && query && (
        <div className="sv-combobox-empty">Nenhum bairro encontrado</div>
      )}
    </div>
  );
}

/* ── Mini modal para cadastrar coordenada do bairro ──────────── */
/* fix ícones Leaflet */
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  config: ServicoConfig;
  centro: CentroCustoDetail;
  propMap: Record<string, string>;
  editRow: RegistroDiarioRow | null;
  entityId: string;
  municipalityName?: string | null;
  uf?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NovaOcorrenciaModal({ config, centro, propMap, editRow, entityId, municipalityName, uf, onClose, onSaved }: Props) {
  const centroId = CENTRO_IDS[config.slug];
  const isEdit = !!editRow;

  const [data, setData] = useState(editRow?.data ?? hoje());
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    config.campos.forEach(c => {
      const pid = propMap[c.nome];
      if (!pid) return;
      const cell = editRow?.values[pid];
      if (c.tipo === 'boolean') {
        init[c.nome] = cell?.boolean ?? false;
      } else if (c.tipo === 'numero') {
        init[c.nome] = cell?.decimal ?? '';
      } else {
        init[c.nome] = cell?.text ?? '';
      }
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement | null>(null);

  /* listas dinâmicas */
  const [bairros,      setBairros]      = useState<string[]>([]);
  const [bairrosCoords, setBairrosCoords] = useState<BairroCoord[]>([]);
  const [equipes,      setEquipes]      = useState<string[]>([]);
  const [veiculos,     setVeiculos]     = useState<string[]>([]);
  const [equipamentos, setEquipamentos] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      cadastrosAuxiliaresApi.list(entityId, 'BAIRRO'),
      cadastrosAuxiliaresApi.listBairrosCoords(entityId),
      cadastrosAuxiliaresApi.list(entityId, 'EQUIPE'),
      cadastrosAuxiliaresApi.list(entityId, 'VEICULO'),
      cadastrosAuxiliaresApi.list(entityId, 'EQUIPAMENTO'),
    ]).then(([b, bc, e, v, eq]) => {
      setBairros(b.items.filter(i => i.ativo).map(i => i.nome));
      setBairrosCoords(bc.items);
      setEquipes(e.items.filter(i => i.ativo).map(i => i.nome));
      setVeiculos(v.items.filter(i => i.ativo).map(i => i.nome));
      setEquipamentos(eq.items.filter(i => i.ativo).map(i => i.nome));
    }).catch(() => {});
  }, [entityId]);

  /* mantém ref sincronizada para leitura dentro de closures do Leaflet */
  useEffect(() => { valuesRef.current = values; }, [values]);

  /* mini-mapa */
  const miniMapDiv  = useRef<HTMLDivElement>(null);
  const miniMapRef  = useRef<L.Map | null>(null);
  const miniMarker  = useRef<L.Marker | null>(null);
  const entityIdRef = useRef(entityId);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');
  const [geoLabel,  setGeoLabel]  = useState('');
  const skipGeoRef    = useRef(false);
  const skipReversoRef = useRef(false);
  const valuesRef = useRef<Record<string, string | boolean>>({});
  const [bairroSugerido, setBairroSugerido] = useState<{ bairro: string; logradouro: string } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    editRow?.lat != null && editRow?.lng != null
      ? { lat: editRow.lat as number, lng: editRow.lng as number }
      : null,
  );

  useEffect(() => {
    if (!miniMapDiv.current || miniMapRef.current) return;
    const map = L.map(miniMapDiv.current, {
      center: [-12.5253, -40.3083],
      zoom: 13,
      zoomControl: false,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const colocarPin = (lat: number, lng: number) => {
      setCoords({ lat, lng });
      if (miniMarker.current) {
        miniMarker.current.setLatLng([lat, lng]);
      } else {
        miniMarker.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        miniMarker.current.on('dragend', () => {
          const pos = miniMarker.current!.getLatLng();
          aplicarReverso(pos.lat, pos.lng);
        });
      }
    };

    const aplicarReverso = (lat: number, lng: number) => {
      if (skipReversoRef.current) { skipReversoRef.current = false; return; }
      setCoords({ lat, lng });
      setGeoStatus('loading');

      const bairroAtual = String(valuesRef.current['Bairro / Localidade'] ?? '').trim();

      /* busca logradouro no OSM e bairro mais próximo nos nossos dados em paralelo */
      Promise.all([
        mapaApi.reverse(entityIdRef.current, lat, lng),
        mapaApi.bairroMaisProximo(entityIdRef.current, lat, lng),
      ]).then(([res, proximo]) => {
        setGeoLabel(res.label);
        setGeoStatus('found');
        skipGeoRef.current = true;

        const logradouro = (res.logradouro ?? '').trim();

        if (bairroAtual) {
          /* bairro já selecionado — só atualiza logradouro */
          if (logradouro) setValues(prev => ({ ...prev, 'Logradouro / Referência': logradouro }));
          return;
        }

        /* sem bairro — tenta reconhecer pelo nosso banco primeiro */
        const bairroReconhecido = proximo.bairro;

        setValues(prev => ({
          ...prev,
          ...(bairroReconhecido ? { 'Bairro / Localidade': bairroReconhecido } : {}),
          ...(logradouro ? { 'Logradouro / Referência': logradouro } : {}),
        }));

        if (bairroReconhecido) {
          skipGeoRef.current = true; /* evita debounce de geocode após preencher */
        }
      }).catch(() => { setGeoStatus('idle'); });
    };

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      skipReversoRef.current = false;
      colocarPin(lat, lng);
      aplicarReverso(lat, lng);
    });
    miniMapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); miniMapRef.current = null; miniMarker.current = null; };
  }, []);

  /* posicionar pin quando coords mudam — sem disparar reverso quando veio do bairro */
  useEffect(() => {
    if (!coords || !miniMapRef.current) return;
    const { lat, lng } = coords;
    if (miniMarker.current) {
      miniMarker.current.setLatLng([lat, lng]);
    } else {
      miniMarker.current = L.marker([lat, lng], { draggable: true }).addTo(miniMapRef.current);
      miniMarker.current.on('dragend', () => {
        skipReversoRef.current = false;
        const pos = miniMarker.current!.getLatLng();
        /* dragend sempre faz reverso — usuário moveu manualmente */
        void mapaApi.reverse(entityIdRef.current, pos.lat, pos.lng).then(res => {
          setCoords({ lat: pos.lat, lng: pos.lng });
          setGeoLabel(res.label);
          setGeoStatus('found');
          skipGeoRef.current = true;
          if (res.logradouro) setValues(prev => ({ ...prev, 'Logradouro / Referência': res.logradouro! }));
        }).catch(() => {});
      });
    }
    miniMapRef.current.setView([lat, lng], 16);
  }, [coords]);

  /* ao mudar bairro: tenta usar coord cadastrada primeiro */
  const handleBairroChange = useCallback((nomeBairro: string) => {
    setValues(prev => ({ ...prev, 'Bairro / Localidade': nomeBairro }));
    if (!nomeBairro) return;

    const cadastrado = bairrosCoords.find(
      b => b.nome.toLowerCase() === nomeBairro.toLowerCase() && b.lat != null && b.lng != null,
    );

    if (cadastrado) {
      /* coord cadastrada — centraliza direto, sem geocode nem reverso */
      skipReversoRef.current = true;
      skipGeoRef.current = true;
      setCoords({ lat: cadastrado.lat!, lng: cadastrado.lng! });
      setGeoLabel(`Bairro ${cadastrado.nome}`);
      setGeoStatus('found');
    }
    /* sem coord cadastrada: o debounce de geocodificação vai cuidar */
  }, [bairrosCoords]);

  const geocodificar = useCallback(async () => {
    const bairro     = String(values['Bairro / Localidade'] ?? '').trim();
    const logradouro = String(values['Logradouro / Referência'] ?? '').trim();
    if (!bairro) return;
    const cidade = [municipalityName, uf].filter(Boolean).join(', ') || 'Brasil';
    const q = `${logradouro ? logradouro + ', ' : ''}${bairro}, ${cidade}, Brasil`;
    setGeoStatus('loading');
    try {
      const res = await mapaApi.geocode(entityId, q);
      if (res.results.length > 0) {
        const r = res.results[0];
        setCoords({ lat: r.lat, lng: r.lng });
        setGeoLabel(r.label);
        setGeoStatus('found');
      } else {
        setGeoStatus('error');
        setGeoLabel('Endereço não encontrado');
      }
    } catch {
      setGeoStatus('error');
      setGeoLabel('Erro ao geocodificar');
    }
  }, [entityId, values]);

  useEffect(() => {
    const bairro = String(values['Bairro / Localidade'] ?? '').trim();
    if (!bairro) return;
    if (skipGeoRef.current) { skipGeoRef.current = false; return; }
    const t = setTimeout(() => { void geocodificar(); }, 800);
    return () => clearTimeout(t);
  }, [values['Bairro / Localidade'], values['Logradouro / Referência']]);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const set = (nome: string, val: string | boolean) =>
    setValues(prev => ({ ...prev, [nome]: val }));

  const buildCellValues = (): Record<string, { text?: string; decimal?: string; boolean?: boolean }> => {
    const out: Record<string, { text?: string; decimal?: string; boolean?: boolean }> = {};
    config.campos.forEach(c => {
      const pid = propMap[c.nome];
      if (!pid) return;
      const val = values[c.nome];
      if (c.tipo === 'boolean') {
        out[pid] = { boolean: val as boolean };
      } else if (c.tipo === 'numero') {
        const n = String(val).trim();
        if (n) out[pid] = { decimal: n };
      } else {
        const t = String(val).trim();
        if (t) out[pid] = { text: t };
      }
    });
    return out;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    for (const c of config.campos) {
      if (!c.obrigatorio) continue;
      const val = values[c.nome];
      if (c.tipo === 'boolean') continue;
      if (!val || String(val).trim() === '') {
        setError(`Campo obrigatório: ${c.label}`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { data, values: buildCellValues() };
      let registroId: string;
      if (isEdit) {
        await tenantApi.centrosCusto.updateRegistro(entityId, centroId, editRow.id, payload);
        registroId = editRow.id;
      } else {
        const novo = await tenantApi.centrosCusto.createRegistro(entityId, centroId, payload);
        registroId = novo.id;
      }
      if (coords) {
        await mapaApi.salvarCoords(entityId, registroId, coords.lat, coords.lng, geoLabel || undefined);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const renderCampo = (campo: CampoConfig, idx: number) => {
    const pid = propMap[campo.nome];
    if (!pid && campo.tipo !== 'boolean') return null;
    const val = values[campo.nome];

    if (campo.tipo === 'boolean') {
      return (
        <label key={campo.nome} className="sv-modal-field sv-modal-field-bool">
          <input type="checkbox" checked={val as boolean} onChange={e => set(campo.nome, e.target.checked)} />
          <span>{campo.label}</span>
        </label>
      );
    }

    if (campo.tipo === 'select') {
      const dinamicas: Record<string, string[]> = {
        'Bairro / Localidade':   bairros.length     ? bairros     : (campo.opcoes ?? []),
        'Equipe / Turma':        equipes.length      ? equipes     : (campo.opcoes ?? []),
        'Veículo':               veiculos.length     ? veiculos    : (campo.opcoes ?? []),
        'Equipamento Utilizado': equipamentos.length ? equipamentos : (campo.opcoes ?? []),
      };
      const opcoes = dinamicas[campo.nome] ?? campo.opcoes ?? [];

      if (campo.nome === 'Equipamento Utilizado') {
        return (
          <MultiSelectCheckbox
            key={campo.nome}
            label={campo.label}
            obrigatorio={campo.obrigatorio}
            opcoes={opcoes}
            value={val as string}
            onChange={v => set(campo.nome, v)}
          />
        );
      }

      /* Combobox de bairro com busca */
      if (campo.nome === 'Bairro / Localidade') {
        return (
          <BairroCombobox
            key={campo.nome}
            opcoes={opcoes}
            bairrosCoords={bairrosCoords}
            value={val as string}
            onChange={handleBairroChange}
            obrigatorio={campo.obrigatorio}
            inputRef={idx === 0 ? (el => { firstRef.current = el; }) : undefined}
          />
        );
      }

      return (
        <label key={campo.nome} className="sv-modal-field">
          <span className="sv-modal-label">
            {campo.label}
            {campo.obrigatorio && <em className="sv-modal-req">*</em>}
          </span>
          <select
            value={val as string}
            onChange={e => set(campo.nome, e.target.value)}
            ref={idx === 0 ? (el => { firstRef.current = el as HTMLInputElement | null; }) : undefined}
          >
            <option value="">Selecione…</option>
            {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    }

    if (campo.tipo === 'numero') {
      return (
        <label key={campo.nome} className="sv-modal-field">
          <span className="sv-modal-label">
            {campo.label}
            {campo.obrigatorio && <em className="sv-modal-req">*</em>}
          </span>
          <input
            type="number" min="0" step="0.01"
            value={val as string}
            onChange={e => set(campo.nome, e.target.value)}
            placeholder={campo.placeholder ?? '0.00'}
            ref={idx === 0 ? (el => { firstRef.current = el; }) : undefined}
          />
        </label>
      );
    }

    return (
      <label key={campo.nome} className="sv-modal-field">
        <span className="sv-modal-label">
          {campo.label}
          {campo.obrigatorio && <em className="sv-modal-req">*</em>}
        </span>
        {campo.nome === 'Observações' || campo.nome === 'Defeito / Problema' || campo.nome === 'Peças Utilizadas' ? (
          <textarea value={val as string} onChange={e => set(campo.nome, e.target.value)} placeholder={campo.placeholder} rows={3} />
        ) : (
          <input
            type="text" value={val as string}
            onChange={e => set(campo.nome, e.target.value)}
            placeholder={campo.placeholder}
            ref={idx === 0 ? (el => { firstRef.current = el; }) : undefined}
          />
        )}
      </label>
    );
  };

  const camposNormais = config.campos.filter(c => c.tipo !== 'boolean');
  const camposBool    = config.campos.filter(c => c.tipo === 'boolean');

  return createPortal(
    <>
      <div className="sv-modal-backdrop" onClick={onClose}>
        <div className="sv-modal" onClick={e => e.stopPropagation()}>

          <div className="sv-modal-bar" style={{ background: config.cor }} />

          <div className="sv-modal-head">
            <div className="sv-modal-head-left">
              <div className="sv-modal-eyebrow" style={{ color: config.cor }}>
                <span style={{
                  display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
                  background: `color-mix(in srgb, ${config.cor} 12%, transparent)`, borderRadius: 6,
                }}>
                  {config.icon}
                </span>
                {config.nome}
              </div>
              <h3 className="sv-modal-title">{isEdit ? 'Editar ocorrência' : 'Nova ocorrência'}</h3>
              <p className="sv-modal-subtitle">
                {isEdit ? 'Altere os campos e salve.' : 'Preencha os dados do serviço executado.'}
              </p>
            </div>
            <button type="button" className="sv-modal-close" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <form className="sv-modal-form" onSubmit={handleSubmit}>
            <div className="sv-modal-body">

              <label className="sv-modal-field">
                <span className="sv-modal-label">Data <em className="sv-modal-req">*</em></span>
                <input type="date" value={data} onChange={e => setData(e.target.value)} required />
              </label>

              {camposNormais
                .filter(c => c.nome === 'Bairro / Localidade' || c.nome === 'Logradouro / Referência')
                .map((c, i) => renderCampo(c, i))}

              {config.campos.some(c => c.nome === 'Bairro / Localidade') && (
                <div className="sv-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="sv-modal-label">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    Localização no mapa
                    <span style={{ fontWeight: 400, marginLeft: 4, textTransform: 'none', letterSpacing: 0 }}>
                      — clique para ajustar o pin
                    </span>
                  </span>
                  <div className="sv-mini-mapa">
                    <div ref={miniMapDiv} style={{ height: 260, width: '100%' }} />
                    {geoStatus === 'idle' && !coords && (
                      <div className="sv-mini-mapa-overlay">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>Selecione o bairro para localizar no mapa</span>
                      </div>
                    )}
                    {geoStatus === 'loading' && (
                      <div className="sv-mini-mapa-overlay">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sv-spin">
                          <path d="M21 12a9 9 0 11-6.219-8.56"/>
                        </svg>
                        <span>Localizando…</span>
                      </div>
                    )}
                  </div>
                  <div className={`sv-mini-mapa-status${geoStatus === 'found' ? ' is-found' : geoStatus === 'error' ? ' is-error' : ''}`}>
                    {geoStatus === 'found' && (
                      <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> {geoLabel}</>
                    )}
                    {geoStatus === 'error' && (
                      <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> {geoLabel}</>
                    )}
                    {geoStatus === 'idle' && coords && (
                      <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}</>
                    )}
                    {geoStatus === 'idle' && !coords && 'Aguardando bairro…'}
                  </div>

                  {/* Aviso de bairro diferente */}
                  {bairroSugerido && (
                    <div className="sv-bairro-alerta">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <span>
                        O ponto parece estar em <strong>{bairroSugerido.bairro}</strong>.
                        Deseja corrigir o bairro?
                      </span>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="sv-bairro-alerta-btn-sim"
                          onClick={() => {
                            set('Bairro / Localidade', bairroSugerido.bairro);
                            setBairroSugerido(null);
                          }}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          className="sv-bairro-alerta-btn-nao"
                          onClick={() => setBairroSugerido(null)}
                        >
                          Não
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {camposNormais
                .filter(c => c.nome !== 'Bairro / Localidade' && c.nome !== 'Logradouro / Referência')
                .map((c, i) => renderCampo(c, i + 10))}

              {camposBool.length > 0 && (
                <div className="sv-modal-bools">
                  {camposBool.map(c => renderCampo(c, 99))}
                </div>
              )}

              {error && (
                <div className="tn-alert" style={{ marginTop: 4 }}>
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
              <button type="submit" className="tn-btn-blue" disabled={saving} style={{ height: 40, fontSize: 13 }}>
                {saving ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sv-spin">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    Salvando…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {isEdit ? 'Salvar alterações' : 'Registrar ocorrência'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

    </>,
    document.body,
  );
}
