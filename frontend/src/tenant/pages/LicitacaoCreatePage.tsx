import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, tenantApi } from '../../lib/api-client';
import { useTenant } from '../TenantContext';

export function LicitacaoCreatePage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const [identificacao, setIdentificacao] = useState('');
  const [objeto, setObjeto] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const licitacao = await tenantApi.licitacoes.create(entityId, { identificacao, objeto });
      navigate(`/t/${entityId}/licitacoes/${licitacao.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tn-page">

      {/* Breadcrumb */}
      <Link to={`/t/${entityId}/licitacoes`} className="tn-back-link">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Licitações
      </Link>

      {/* Hero */}
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

      {/* Formulário */}
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
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Identificação <span style={{ color: '#dc2626' }}>*</span>
            </span>
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
                style={{
                  width: '100%', paddingLeft: 38, paddingRight: 14, height: 42,
                  fontSize: 13, fontWeight: 600, color: '#0f172a',
                  border: `1.5px solid ${identificacao ? '#2563eb60' : '#e2e8f0'}`,
                  borderRadius: 12, outline: 'none',
                  background: identificacao ? '#eff6ff08' : '#fafafa',
                  transition: 'border-color 0.15s, background 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
                onBlur={e => { e.target.style.borderColor = identificacao ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Número ou código do processo licitatório</span>
          </label>

          {/* Objeto */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Objeto / descrição <span style={{ color: '#dc2626' }}>*</span>
            </span>
            <textarea
              value={objeto}
              onChange={e => setObjeto(e.target.value)}
              placeholder="Descreva o objeto do contrato ou processo licitatório…"
              required
              minLength={3}
              rows={4}
              style={{
                width: '100%', padding: '12px 14px',
                fontSize: 13, fontWeight: 500, color: '#0f172a',
                border: `1.5px solid ${objeto ? '#2563eb60' : '#e2e8f0'}`,
                borderRadius: 12, outline: 'none', resize: 'vertical',
                background: objeto ? '#eff6ff08' : '#fafafa',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6,
              }}
              onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px #2563eb15'; }}
              onBlur={e => { e.target.style.borderColor = objeto ? '#2563eb60' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
            />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Resumo do objeto contratado (mínimo 3 caracteres)</span>
          </label>

          {error && (
            <div className="tn-alert">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <Link to={`/t/${entityId}/licitacoes`} style={{ textDecoration: 'none' }}>
              <button type="button" className="tn-btn-secondary">
                Cancelar
              </button>
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="tn-btn-blue"
              style={{ height: 40, fontSize: 13, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
