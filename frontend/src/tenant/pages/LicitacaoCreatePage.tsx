import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, fornecedorApi, tenantApi, type Fornecedor } from '../../lib/api-client';
import { useTenant } from '../TenantContext';

/* ── Modal de cadastro rápido de fornecedor ──────────────────────── */
function ModalNovoFornecedor({
  entityId,
  onSalvo,
  onFechar,
}: {
  entityId: string;
  onSalvo: (f: Fornecedor) => void;
  onFechar: () => void;
}) {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj]               = useState('');
  const [contato, setContato]         = useState('');
  const [telefone, setTelefone]       = useState('');
  const [email, setEmail]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const handleSalvar = async () => {
    if (!razaoSocial.trim()) { setError('Razão social é obrigatória.'); return; }
    setSaving(true); setError('');
    try {
      const f = await fornecedorApi.create(entityId, {
        razaoSocial: razaoSocial.trim(),
        cnpj:     cnpj.trim()     || undefined,
        contato:  contato.trim()  || undefined,
        telefone: telefone.trim() || undefined,
        email:    email.trim()    || undefined,
      });
      onSalvo(f);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao cadastrar fornecedor');
    } finally { setSaving(false); }
  };

  return (
    <div className="sv-modal-backdrop" onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="forn-modal" onClick={e => e.stopPropagation()}>

        <div className="forn-modal-head">
          <div>
            <span className="eq-detalhe-kicker">Cadastro rápido</span>
            <h3>Novo fornecedor</h3>
          </div>
          <button type="button" className="eq-detalhe-close" onClick={onFechar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="forn-modal-body">
          {error && <div className="tn-alert" style={{ marginBottom: 14 }}>{error}</div>}

          <div className="forn-form-grid">
            <label className="forn-field span-2">
              <span>Razão social <em style={{ color: '#dc2626' }}>*</em></span>
              <input ref={inputRef} type="text" value={razaoSocial}
                onChange={e => setRazaoSocial(e.target.value)}
                placeholder="Nome completo ou empresa…" maxLength={250} />
            </label>

            <label className="forn-field">
              <span>CNPJ</span>
              <input type="text" value={cnpj} onChange={e => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00" maxLength={18} />
            </label>

            <label className="forn-field">
              <span>Contato / responsável</span>
              <input type="text" value={contato} onChange={e => setContato(e.target.value)}
                placeholder="Nome do contato…" maxLength={150} />
            </label>

            <label className="forn-field">
              <span>Telefone</span>
              <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000" maxLength={30} />
            </label>

            <label className="forn-field">
              <span>E-mail</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="contato@empresa.com.br" maxLength={150} />
            </label>
          </div>
        </div>

        <div className="forn-modal-actions">
          <button type="button" className="tn-btn-secondary" onClick={onFechar}>Cancelar</button>
          <button type="button" className="tn-btn-blue"
            style={{ height: 38, fontSize: 13 }}
            disabled={saving || !razaoSocial.trim()}
            onClick={() => void handleSalvar()}>
            {saving ? 'Salvando…' : '+ Cadastrar fornecedor'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Campo de busca + seleção de fornecedor ──────────────────────── */
function CampoFornecedor({
  entityId,
  value,
  onChange,
  onNovoFornecedor,
}: {
  entityId: string;
  value: Fornecedor | null;
  onChange: (f: Fornecedor | null) => void;
  onNovoFornecedor: () => void;
}) {
  const [busca, setBusca]       = useState('');
  const [opcoes, setOpcoes]     = useState<Fornecedor[]>([]);
  const [aberto, setAberto]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const pesquisar = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fornecedorApi.list(entityId, q || undefined);
      setOpcoes(res.items);
    } catch { setOpcoes([]); }
    finally { setLoading(false); }
  }, [entityId]);

  useEffect(() => {
    if (aberto) void pesquisar(busca);
  }, [aberto, busca, pesquisar]);

  /* fechar ao clicar fora */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBusca = (v: string) => {
    setBusca(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void pesquisar(v), 300);
  };

  const selecionar = (f: Fornecedor) => {
    onChange(f);
    setBusca('');
    setAberto(false);
  };

  const limpar = () => { onChange(null); setBusca(''); };

  return (
    <div ref={wrapRef} className="forn-campo-wrap">
      {value ? (
        <div className="forn-selecionado">
          <div className="forn-selecionado-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="forn-selecionado-info">
            <strong>{value.razaoSocial}</strong>
            {value.cnpj && <span>{value.cnpj}</span>}
          </div>
          <button type="button" className="forn-limpar-btn" onClick={limpar} title="Remover">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ) : (
        <div className="forn-input-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
            className="forn-search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="forn-search-input"
            placeholder="Buscar fornecedor…"
            value={busca}
            onChange={e => handleBusca(e.target.value)}
            onFocus={() => setAberto(true)}
          />
        </div>
      )}

      {aberto && !value && (
        <div className="forn-dropdown">
          {loading && (
            <div className="forn-dropdown-loading">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
              Buscando…
            </div>
          )}

          {!loading && opcoes.length === 0 && (
            <div className="forn-dropdown-empty">
              {busca ? `Nenhum resultado para "${busca}"` : 'Nenhum fornecedor cadastrado'}
            </div>
          )}

          {!loading && opcoes.map(f => (
            <button key={f.id} type="button" className="forn-dropdown-item" onClick={() => selecionar(f)}>
              <strong>{f.razaoSocial}</strong>
              {f.cnpj && <span>{f.cnpj}</span>}
            </button>
          ))}

          <button type="button" className="forn-dropdown-novo" onClick={() => { setAberto(false); onNovoFornecedor(); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Cadastrar novo fornecedor
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Página principal ────────────────────────────────────────────── */
export function LicitacaoCreatePage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const [identificacao, setIdentificacao] = useState('');
  const [objeto, setObjeto]               = useState('');
  const [fornecedor, setFornecedor]       = useState<Fornecedor | null>(null);
  const [modalForn, setModalForn]         = useState(false);
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(''); setLoading(true);
    try {
      const licitacao = await tenantApi.licitacoes.create(entityId, {
        identificacao,
        objeto,
        fornecedorId: fornecedor?.id ?? null,
      });
      navigate(`/t/${entityId}/licitacoes/${licitacao.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar');
    } finally { setLoading(false); }
  };

  const inputStyle = (filled: boolean) => ({
    width: '100%', height: 42, paddingLeft: 38, paddingRight: 14,
    fontSize: 13, fontWeight: 600, color: '#0f172a',
    border: `1.5px solid ${filled ? '#2563eb60' : '#e2e8f0'}`,
    borderRadius: 12, outline: 'none',
    background: filled ? '#eff6ff08' : '#fafafa',
    transition: 'border-color 0.15s, background 0.15s',
    boxSizing: 'border-box' as const,
  });

  return (
    <div className="tn-page">

      <Link to={`/t/${entityId}/licitacoes`} className="tn-back-link">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Licitações
      </Link>

      <div className="tn-hero-light" style={{ borderLeftColor: '#2563eb' }}>
        <div className="tn-hero-light-glow" />
        <div className="tn-hero-light-inner">
          <div className="tn-hero-light-left">
            <div className="tn-hero-light-kicker">
              <span className="tn-hero-light-dot" style={{ background: '#2563eb' }} />
              Novo processo
            </div>
            <h2 className="tn-hero-light-title">Nova licitação</h2>
            <p className="tn-hero-light-desc">
              Cadastre o processo licitatório para depois importar os itens do contrato.
            </p>
          </div>
        </div>
      </div>

      <div className="tn-panel" style={{ maxWidth: 640 }}>
        <div className="tn-panel-head">
          <div className="tn-panel-head-left">
            <span>Identificação do processo</span>
            <h3>Dados da licitação</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Identificação */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="forn-field-label">Identificação <span style={{ color: '#dc2626' }}>*</span></span>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <input
                type="text"
                value={identificacao}
                onChange={e => setIdentificacao(e.target.value)}
                placeholder="Ex.: 001/2026"
                required
                style={inputStyle(!!identificacao)}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
                onBlur={e => { e.target.style.borderColor = identificacao ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Número ou código do processo licitatório</span>
          </label>

          {/* Objeto */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="forn-field-label">Objeto / descrição <span style={{ color: '#dc2626' }}>*</span></span>
            <textarea
              value={objeto}
              onChange={e => setObjeto(e.target.value)}
              placeholder="Descreva o objeto do contrato ou processo licitatório…"
              required minLength={3} rows={4}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#0f172a',
                border: `1.5px solid ${objeto ? '#2563eb60' : '#e2e8f0'}`,
                borderRadius: 12, outline: 'none', resize: 'vertical',
                background: objeto ? '#eff6ff08' : '#fafafa',
                transition: 'border-color 0.15s', boxSizing: 'border-box',
                fontFamily: 'inherit', lineHeight: 1.6,
              }}
              onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
              onBlur={e => { e.target.style.borderColor = objeto ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Resumo do objeto contratado (mínimo 3 caracteres)</span>
          </label>

          {/* Fornecedor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="forn-field-label">Fornecedor</span>
            <CampoFornecedor
              entityId={entityId}
              value={fornecedor}
              onChange={setFornecedor}
              onNovoFornecedor={() => setModalForn(true)}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Empresa ou pessoa contratada. Opcional — pode ser adicionado depois.</span>
          </div>

          {error && (
            <div className="tn-alert">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <Link to={`/t/${entityId}/licitacoes`} style={{ textDecoration: 'none' }}>
              <button type="button" className="tn-btn-secondary">Cancelar</button>
            </Link>
            <button type="submit" disabled={loading} className="tn-btn-blue"
              style={{ height: 40, fontSize: 13, opacity: loading ? 0.7 : 1 }}>
              {loading ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  Salvando…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Cadastrar licitação
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {modalForn && (
        <ModalNovoFornecedor
          entityId={entityId}
          onSalvo={f => { setFornecedor(f); setModalForn(false); }}
          onFechar={() => setModalForn(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
