import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearPlatformToken, platformApi } from '../../lib/api-client';
import { formatTodayPtBr, getInitials } from '../../tenant/utils/format';
import { SimboloSisObras } from '../../components/marca/SimboloSisObras';
import '../../tenant/styles/menu-obras.css';
import '../styles/plataforma-so.css';

/* ═══ Ícones do menu (mesmo traço do menu da prefeitura; a parte em ciano se redesenha no hover) ═══ */
function Ico({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const IcoPrefeitura = () => (
  <Ico>
    <path d="M3 21h18" />
    <path d="M6 17.5v-6M10 17.5v-6M14 17.5v-6M18 17.5v-6" />
    <path className="a" pathLength={1} d="M12 3l8.5 5h-17z" />
  </Ico>
);

interface Tela { to: string; label: string; titulo: string; icon: React.ReactNode }

const TELAS: Tela[] = [
  { to: '/platform/entities', label: 'Entidades', titulo: 'Entidades', icon: <IcoPrefeitura /> },
];

function PlatformSidebar({ mobile = false, operador, onNavigate }: {
  mobile?: boolean; operador: { name: string; email: string } | null; onNavigate?: () => void;
}) {
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const largo = mobile || hovered;

  return (
    <div
      className={`mo${mobile ? ' mo-mobile' : ''}${largo ? ' is-wide' : ''}`}
      onMouseEnter={mobile ? undefined : () => setHovered(true)}
      onMouseLeave={mobile ? undefined : () => setHovered(false)}
    >
      <div className="mo-head">
        <div className="mo-logo" aria-hidden="true">
          <SimboloSisObras tamanho={30} />
        </div>
        <div className="mo-brand mo-some">
          <b>Plataforma</b>
          <small>SisObras · Gestão de Obras</small>
        </div>
      </div>

      <nav className="mo-nav">
        <div className="mo-eyebrow mo-some">Administração</div>
        {TELAS.map((t) => {
          const atual = location.pathname.startsWith(t.to);
          return (
            <div key={t.to} className={`mo-mod solo${atual ? ' current' : ''}`}>
              <Link
                to={t.to}
                onClick={onNavigate}
                className="mo-row"
                data-mo-hit
                title={!largo ? t.label : undefined}
                aria-current={atual ? 'page' : undefined}
              >
                <span className="mo-tile">{t.icon}</span>
                <span className="mo-lbl mo-some">{t.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="mo-foot">
        <div className="mo-user">
          <div className="mo-av">{operador ? getInitials(operador.name) : '··'}</div>
          <div className="mo-some" style={{ minWidth: 0 }}>
            <b>{operador?.name ?? 'Operador'}</b>
            <small>Operador da plataforma</small>
          </div>
        </div>
        <div className="mo-ver mo-some" title="Versão do sistema neste aparelho">
          <span>E 357.214 · N 8.614.902</span>
          <span>v {__VERSAO_APP__}</span>
        </div>
      </div>
    </div>
  );
}

/** Casca da Área da Plataforma: o mesmo menu escuro e o mesmo topo de dentro da prefeitura */
export function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [operador, setOperador] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => { platformApi.me().then(setOperador).catch(() => setOperador(null)); }, []);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [mobileOpen]);

  const handleLogout = async () => {
    try { await platformApi.logout(); } catch { /* ignore */ }
    clearPlatformToken();
    navigate('/platform/login');
  };

  const titulo = TELAS.find(t => location.pathname.startsWith(t.to))?.titulo ?? 'Plataforma';

  return (
    <div className="tn-shell pf-so">
      <aside className="tn-sidebar">
        <PlatformSidebar operador={operador} />
      </aside>

      <div
        className={`tn-mobile-nav-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
      >
        <div className="tn-mobile-nav-drawer" onClick={(e) => e.stopPropagation()}>
          <PlatformSidebar mobile operador={operador} onNavigate={() => setMobileOpen(false)} />
          <button type="button" className="tn-mobile-nav-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="tn-main">
        <div className="tn-topbar">
          <div className="tn-topbar-left">
            <button type="button" className="tn-topbar-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Menu">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="tn-topbar-breadcrumb">
              <span className="tn-topbar-entity">Plataforma</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.3, flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="tn-topbar-page">{titulo}</span>
            </div>
          </div>

          <div className="tn-topbar-right">
            <div className="tn-topbar-date-pill">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{formatTodayPtBr()}</span>
            </div>

            <div className="tn-topbar-divider" />

            <div className="tn-topbar-user" title={operador?.email}>
              <div className="tn-topbar-user-avatar">{operador ? getInitials(operador.name) : '··'}</div>
              <div className="tn-topbar-user-info">
                <span className="tn-topbar-user-name">{operador?.name.split(' ')[0] ?? 'Operador'}</span>
                <span className="tn-topbar-user-role">Plataforma</span>
              </div>
            </div>

            <button type="button" className="tn-logout-btn" onClick={handleLogout} title="Sair">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="tn-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
