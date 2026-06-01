import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { INSTRUCOES } from '../pages/servico-instrucoes';

interface Props {
  slug: string | null;
  nomeServico: string;
  corServico: string;
  onClose: () => void;
}

export function ServicoInstrucoesDrawer({ slug, nomeServico, corServico, onClose }: Props) {
  const instrucoes = slug ? INSTRUCOES[slug] ?? null : null;
  const isOpen = !!slug;

  /* fechar com ESC */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  /* travar scroll do body quando aberto */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`sv-drawer-backdrop${isOpen ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`sv-drawer${isOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Instruções — ${nomeServico}`}
        style={{ '--sv-cor': corServico } as React.CSSProperties}
      >
        {/* Cabeçalho */}
        <div className="sv-drawer-head">
          <div className="sv-drawer-head-bar" />
          <div className="sv-drawer-head-inner">
            <div className="sv-drawer-head-left">
              <div className="sv-drawer-eyebrow">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Manual de uso
              </div>
              <h3 className="sv-drawer-title">{instrucoes?.nome ?? nomeServico}</h3>
              {instrucoes?.resumo && (
                <p className="sv-drawer-resumo">{instrucoes.resumo}</p>
              )}
            </div>
            <button
              type="button"
              className="sv-drawer-close"
              onClick={onClose}
              aria-label="Fechar instruções"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="sv-drawer-body">
          {!instrucoes ? (
            <div className="sv-drawer-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <strong>Instruções não disponíveis</strong>
              <span>As instruções para este serviço ainda não foram cadastradas.</span>
            </div>
          ) : (
            <>
              {/* Seções */}
              {instrucoes.secoes.map((secao, si) => (
                <div key={si} className="sv-drawer-section">
                  <div className="sv-drawer-section-title">
                    <span className="sv-drawer-section-icon">{secao.icon}</span>
                    {secao.titulo}
                  </div>
                  <ul className="sv-drawer-list">
                    {secao.itens.map((item, ii) => {
                      /* destaca o rótulo antes dos dois pontos */
                      const colonIdx = item.indexOf(':');
                      const label = colonIdx > -1 ? item.slice(0, colonIdx) : null;
                      const body  = colonIdx > -1 ? item.slice(colonIdx + 1).trim() : item;
                      return (
                        <li key={ii} className="sv-drawer-list-item">
                          <span className="sv-drawer-bullet" />
                          <span>
                            {label && <strong className="sv-drawer-field-label">{label}:</strong>}
                            {' '}{body}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {/* Dicas */}
              {instrucoes.dicas.length > 0 && (
                <div className="sv-drawer-section sv-drawer-dicas">
                  <div className="sv-drawer-section-title">
                    <span className="sv-drawer-section-icon">💡</span>
                    Dicas importantes
                  </div>
                  <ul className="sv-drawer-list">
                    {instrucoes.dicas.map((dica, di) => (
                      <li key={di} className="sv-drawer-list-item sv-drawer-dica-item">
                        <span className="sv-drawer-bullet sv-drawer-bullet-dica" />
                        <span>{dica}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rodapé */}
              <div className="sv-drawer-footer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Instruções extraídas das planilhas operacionais da Secretaria de Obras de Itaberaba.
              </div>
            </>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}
