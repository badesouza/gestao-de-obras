import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { clearPlatformToken, platformApi } from '../../lib/api-client';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  .pf-shell {
    display: flex;
    min-height: 100svh;
    background: #f0f1f3;
    font-family: 'Rajdhani', system-ui, sans-serif;
  }

  /* ── Sidebar ── */
  .pf-sidebar {
    width: 220px;
    flex-shrink: 0;
    background-color: #0a1818;
    background-image:
      linear-gradient(rgba(42,74,74,0.35) 1px, transparent 1px),
      linear-gradient(90deg, rgba(42,74,74,0.35) 1px, transparent 1px),
      linear-gradient(rgba(42,74,74,0.12) 1px, transparent 1px),
      linear-gradient(90deg, rgba(42,74,74,0.12) 1px, transparent 1px);
    background-size: 40px 40px, 40px 40px, 10px 10px, 10px 10px;
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100svh;
    border-right: 1px solid rgba(255,255,255,0.05);
  }

  .pf-sidebar-top {
    padding: 24px 20px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .pf-sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .pf-sidebar-icon {
    width: 32px; height: 32px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .pf-sidebar-name {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    letter-spacing: 0.04em;
    line-height: 1.2;
  }

  .pf-sidebar-area {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(56,189,248,0.55);
    margin-top: 2px;
  }

  .pf-nav {
    flex: 1;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pf-nav-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
    padding: 8px 8px 4px;
  }

  .pf-nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.45);
    text-decoration: none;
    transition: all 0.15s;
    position: relative;
  }

  .pf-nav-link:hover {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.85);
  }

  .pf-nav-link.active {
    background: #5b8db8;
    color: #060d0d;
    font-weight: 700;
  }

  .pf-nav-link.active svg {
    opacity: 1;
  }

  .pf-nav-link.active::before { display: none; }

  .pf-nav-link svg {
    width: 15px; height: 15px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .pf-nav-link.active svg { opacity: 1; }

  .pf-sidebar-bottom {
    padding: 16px 12px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .pf-logout-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 12px;
    border-radius: 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-family: 'Rajdhani', system-ui, sans-serif;
    font-weight: 500;
    color: rgba(255,255,255,0.3);
    transition: all 0.15s;
    text-align: left;
  }

  .pf-logout-btn:hover {
    background: rgba(239,68,68,0.1);
    color: rgba(252,165,165,0.9);
  }

  .pf-logout-btn svg {
    width: 15px; height: 15px;
    opacity: 0.7;
  }

  /* ── Main ── */
  .pf-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #f0f1f3;
  }

  /* ── Topbar ── */
  .pf-topbar {
    background: rgba(240,235,224,0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(0,0,0,0.07);
    padding: 0 24px 0 22px;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
    animation: pf-topbar-in 0.35s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes pf-topbar-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Breadcrumb */
  .pf-breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(0,0,0,0.35);
    letter-spacing: 0.08em;
    text-transform: lowercase;
    flex-shrink: 0;
  }
  .pf-breadcrumb-sep {
    opacity: 0.3;
    font-size: 12px;
  }
  .pf-breadcrumb-page {
    font-family: 'Rajdhani', system-ui, sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #0a1a1a;
    letter-spacing: -0.01em;
    text-transform: none;
  }

  /* Busca central */
  .pf-topbar-search-wrap {
    flex: 1;
    max-width: 320px;
    position: relative;
    display: flex;
    align-items: center;
  }
  .pf-topbar-search-icon {
    position: absolute;
    left: 12px;
    color: rgba(0,0,0,0.3);
    pointer-events: none;
  }
  .pf-topbar-search {
    width: 100%;
    height: 36px;
    padding: 0 44px 0 34px;
    background: rgba(255,255,255,0.65);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 20px;
    font-size: 13px;
    font-family: 'Rajdhani', system-ui, sans-serif;
    font-weight: 500;
    color: #0a1a1a;
    outline: none;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.22,1,0.36,1);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8);
  }
  .pf-topbar-search::placeholder { color: rgba(0,0,0,0.3); }
  .pf-topbar-search:hover {
    background: rgba(255,255,255,0.95);
    border-color: rgba(56,189,248,0.3);
    box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  }
  .pf-topbar-search:focus {
    background: #fff;
    border-color: rgba(56,189,248,0.5);
    box-shadow: 0 0 0 3px rgba(56,189,248,0.1), 0 2px 8px rgba(0,0,0,0.06);
  }
  .pf-topbar-kbd {
    position: absolute;
    right: 10px;
    background: rgba(0,0,0,0.05);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 5px;
    padding: 1px 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: rgba(0,0,0,0.3);
    letter-spacing: 0.04em;
    pointer-events: none;
  }

  /* Direita */
  .pf-topbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  /* Data pill */
  .pf-topbar-date {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    height: 32px;
    background: rgba(255,255,255,0.6);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(0,0,0,0.4);
    letter-spacing: 0.05em;
    white-space: nowrap;
    transition: all 0.2s;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
  }
  .pf-topbar-date:hover {
    background: rgba(255,255,255,0.95);
    border-color: rgba(56,189,248,0.25);
    color: #0a1a1a;
  }

  /* Divisor */
  .pf-topbar-divider {
    width: 1px;
    height: 22px;
    background: rgba(0,0,0,0.08);
    margin: 0 2px;
  }

  /* Badge admin */
  .pf-topbar-badge {
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(255,255,255,0.7);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 20px;
    padding: 4px 12px 4px 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: rgba(0,0,0,0.55);
    cursor: default;
    transition: all 0.2s cubic-bezier(0.22,1,0.36,1);
    box-shadow: 0 1px 3px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8);
  }
  .pf-topbar-badge:hover {
    background: #fff;
    border-color: rgba(56,189,248,0.3);
    box-shadow: 0 4px 14px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }

  .pf-topbar-avatar {
    width: 26px; height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a3a3a 0%, #0a1818 100%);
    border: 1.5px solid rgba(56,189,248,0.35);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Rajdhani', system-ui, sans-serif;
    font-size: 10px; font-weight: 700;
    color: #38bdf8;
    flex-shrink: 0;
    box-shadow: 0 0 8px rgba(56,189,248,0.2);
    transition: box-shadow 0.2s;
  }
  .pf-topbar-badge:hover .pf-topbar-avatar {
    box-shadow: 0 0 14px rgba(56,189,248,0.45);
  }

  .pf-topbar-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 0 rgba(34,197,94,0.5);
    animation: pf-dot-pulse 2.4s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pf-dot-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
    50%       { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
  }

  /* Sair */
  .pf-logout-topbar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px; height: 34px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 9px;
    color: rgba(0,0,0,0.35);
    cursor: pointer;
    transition: all 0.18s cubic-bezier(0.22,1,0.36,1);
  }
  .pf-logout-topbar:hover {
    background: rgba(239,68,68,0.07);
    border-color: rgba(239,68,68,0.2);
    color: #b91c1c;
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(239,68,68,0.12);
  }
  .pf-logout-topbar:active { transform: translateY(0); }

  .pf-content {
    flex: 1;
    padding: 32px;
  }

  @media (max-width: 768px) {
    .pf-sidebar { display: none; }
    .pf-content { padding: 20px 16px; }
    .pf-topbar { padding: 0 16px; }
    .pf-topbar-search-wrap { display: none; }
    .pf-topbar-date { display: none; }
  }
`;

export function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try { await platformApi.logout(); } catch { /* ignore */ }
    clearPlatformToken();
    navigate('/platform/login');
  };

  const isActive = (path: string) =>
    location.pathname.startsWith(path) ? 'pf-nav-link active' : 'pf-nav-link';

  return (
    <div className="pf-shell">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Sidebar */}
      <aside className="pf-sidebar">
        <div className="pf-sidebar-top">
          <div className="pf-sidebar-logo">
            <div className="pf-sidebar-icon">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L2 7V18H7V13H13V18H18V7L10 2Z" fill="rgba(56,189,248,0.9)" />
                <rect x="7" y="13" width="6" height="5" fill="rgba(56,189,248,0.3)" />
              </svg>
            </div>
            <div>
              <div className="pf-sidebar-name">Gestão de Obras</div>
            </div>
          </div>
          <div className="pf-sidebar-area">Plataforma admin</div>
        </div>

        <nav className="pf-nav">
          <div className="pf-nav-label">Gestão</div>
          <Link to="/platform/entities" className={isActive('/platform/entities')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Entidades
          </Link>
        </nav>

        <div className="pf-sidebar-bottom">
          <button className="pf-logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="pf-main">
        <div className="pf-topbar">

          {/* Esquerda — breadcrumb */}
          <div className="pf-breadcrumb">
            <span>plataforma</span>
            <span className="pf-breadcrumb-sep">›</span>
            <span className="pf-breadcrumb-page">
              {location.pathname.replace('/platform/', '').split('/')[0]}
            </span>
          </div>

          {/* Centro — busca */}
          <div className="pf-topbar-search-wrap">
            <svg className="pf-topbar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="pf-topbar-search" placeholder="Buscar entidade, CNPJ…" readOnly />
            <kbd className="pf-topbar-kbd">⌘K</kbd>
          </div>

          {/* Direita */}
          <div className="pf-topbar-right">

            {/* Data */}
            <div className="pf-topbar-date">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>

            <div className="pf-topbar-divider" />

            {/* Badge admin com avatar */}
            <div className="pf-topbar-badge">
              <div className="pf-topbar-avatar">A</div>
              <span className="pf-topbar-dot" />
              admin
            </div>

            {/* Sair */}
            <button className="pf-logout-topbar" onClick={handleLogout} title="Sair">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>

          </div>
        </div>
        <main className="pf-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
