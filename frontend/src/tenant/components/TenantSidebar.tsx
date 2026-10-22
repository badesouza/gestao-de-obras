import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTenant } from '../TenantContext';
import { getInitials } from '../utils/format';
import { centralApi } from '../../lib/api-client';
import { SimboloSisObras } from '../../components/marca/SimboloSisObras';
import '../styles/menu-obras.css';

/** Quantos pedidos de munícipes aguardam análise (atualiza a cada 2 min) */
function usePedidosNovos(entityId: string | undefined, ativo: boolean) {
  const [novas, setNovas] = useState(0);
  useEffect(() => {
    if (!entityId || !ativo) return;
    const buscar = () => { if (navigator.onLine) centralApi.resumo(entityId).then(r => setNovas(r.novas)).catch(() => {}); };
    buscar();
    const t = setInterval(buscar, 120000);
    window.addEventListener('focus', buscar);
    return () => { clearInterval(t); window.removeEventListener('focus', buscar); };
  }, [entityId, ativo]);
  return novas;
}

/* ═══ Ícones próprios do SisObras ═══
   Traço na cor do texto; a parte "de obra" (classe a) vem em ciano e se redesenha
   no hover, como uma linha de CAD sendo traçada. */
function Ico({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/* módulos */
const IcoPainel = () => (
  <Ico>
    <rect x="3" y="4" width="18" height="12.5" rx="2.2" />
    <path d="M8.5 20.5h7M12 16.5v4" />
    <circle className="a" pathLength={1} cx="12" cy="10.2" r="3.4" />
    <path className="a radar" pathLength={1} d="M12 10.2l2.9-1.9" />
  </Ico>
);
const IcoCapacete = () => (
  <Ico>
    <path d="M5 16a7 7 0 0114 0" />
    <path d="M3 16h18v1.8a1.2 1.2 0 01-1.2 1.2H4.2A1.2 1.2 0 013 17.8z" />
    <path className="a" pathLength={1} d="M10.3 9.4V7.6a1.7 1.7 0 013.4 0v1.8" />
    <path className="a" pathLength={1} d="M8.6 16v-3.2M15.4 16v-3.2" />
  </Ico>
);
const IcoCarrinho = () => (
  <Ico>
    <path d="M2.5 4h2.3l2.2 10.3a1.6 1.6 0 001.6 1.3h8.5a1.6 1.6 0 001.5-1.2L20.8 8H5.7" />
    <circle cx="9.3" cy="19.6" r="1.3" />
    <circle cx="16.9" cy="19.6" r="1.3" />
    <rect className="a" pathLength={1} x="10" y="9.6" width="6" height="3.6" rx=".7" />
  </Ico>
);
const IcoContrato = () => (
  <Ico>
    <path d="M13.5 3H7a2 2 0 00-2 2v14a2 2 0 002 2h5" />
    <path d="M13.5 3L19 8.5V12M13.5 3v5.5H19" />
    <path d="M8.5 12.5h5M8.5 16h2.5" />
    <circle className="a" pathLength={1} cx="17" cy="16.6" r="2.9" />
    <path className="a" pathLength={1} d="M15.6 19.2L15.1 22l1.9-1 1.9 1-.5-2.8" />
  </Ico>
);
const IcoPrancheta = () => (
  <Ico>
    <rect x="4.5" y="4.5" width="15" height="17" rx="2.2" />
    <path className="a" pathLength={1} d="M9 4.5V3.6c0-.3.3-.6.6-.6h4.8c.3 0 .6.3.6.6v.9a1 1 0 01-1 1h-4a1 1 0 01-1-1z" />
    <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h3" />
    <path className="a" pathLength={1} d="M14 17.4l1.3 1.3 2.4-2.6" />
  </Ico>
);

/* telas */
const IcoSala = () => (
  <Ico>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <path className="a radar" pathLength={1} d="M12 12l6-6" />
  </Ico>
);
const IcoMegafone = () => (
  <Ico>
    <path d="M3.5 10.5l15-6.5v16l-15-6.5z" />
    <path className="a" pathLength={1} d="M7.5 15v3.5a2 2 0 002 2h.6a1.6 1.6 0 001.6-1.6v-2.6" />
    <path className="a" pathLength={1} d="M21 10v4" />
  </Ico>
);
const IcoCone = () => (
  <Ico>
    <path d="M10.3 3.5h3.4l4.6 15.5H5.7z" />
    <path d="M3.5 19h17" />
    <path className="a" pathLength={1} d="M8.7 10.5h6.6M7.4 15h9.2" />
  </Ico>
);
const IcoOsLista = () => (
  <Ico>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    <path className="a" pathLength={1} d="M7 8h5M7 16h8" />
  </Ico>
);
const IcoCelular = () => (
  <Ico>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path className="a" pathLength={1} d="M9.5 7.5h5M9.5 11h5M9.5 14.5h3" />
    <path d="M11 18.5h2" />
  </Ico>
);
const IcoCalculadora = () => (
  <Ico>
    <rect x="5" y="3" width="14" height="18" rx="2.2" />
    <rect className="a" pathLength={1} x="8" y="6" width="8" height="3.6" rx=".7" />
    <path d="M8.6 13.5h.01M12 13.5h.01M15.4 13.5h.01M8.6 17h.01M12 17h.01M15.4 17h.01" strokeWidth="2.4" />
  </Ico>
);
const IcoPedido = () => (
  <Ico>
    <path d="M20.5 12v7a2 2 0 01-2 2h-13a2 2 0 01-2-2V6a2 2 0 012-2h10" />
    <path className="a" pathLength={1} d="M8.5 11.5l3 3L21 5" />
  </Ico>
);
const IcoCaminhao = () => (
  <Ico>
    <path d="M2.5 5.5h11v10.5h-11z" />
    <path d="M13.5 9h4.3l3.7 3.7V16h-8" />
    <circle className="a" pathLength={1} cx="6.5" cy="18" r="1.8" />
    <circle className="a" pathLength={1} cx="17" cy="18" r="1.8" />
  </Ico>
);
const IcoSaldo = () => (
  <Ico>
    <path d="M4 3.5V20h16.5" />
    <path className="a" pathLength={1} d="M8.5 16v-4M12.5 16V8M16.5 16v-6" />
  </Ico>
);
const IcoMartelo = () => (
  <Ico>
    <path d="M13.6 3.4l6.9 6.9-2.7 2.7-6.9-6.9z" />
    <path d="M12.3 9.9L4.2 18" />
    <path className="a" pathLength={1} d="M3 21h9" />
  </Ico>
);
const IcoBlocos = () => (
  <Ico>
    <path d="M12 3l9 4.6-9 4.6-9-4.6z" />
    <path className="a" pathLength={1} d="M3 12.2l9 4.6 9-4.6" />
    <path d="M3 16.8l9 4.6 9-4.6" />
  </Ico>
);
const IcoFluxo = () => (
  <Ico>
    <circle cx="6" cy="6" r="2.6" />
    <rect x="14" y="14.5" width="6.5" height="6.5" rx="1.4" />
    <path className="a" pathLength={1} d="M8.6 6h5.4a3.3 3.3 0 013.3 3.3v5.2" />
    <path className="a" pathLength={1} d="M15.2 12.3l2.1 2.2 2.1-2.2" />
  </Ico>
);

const Chevron = () => (
  <svg className="mo-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* ═══ Módulos do menu ═══ */
interface Tela {
  to: string;
  label: string;
  permission: string;
  /** caixa da tela Acessos que também precisa estar marcada */
  acesso?: string;
  icon: React.ReactNode;
}
interface Modulo { chave: string; nome: string; icon: React.ReactNode; telas: Tela[] }

const MODULOS: Modulo[] = [
  { chave: 'painel', nome: 'Painel', icon: <IcoPainel />, telas: [
    { to: 'dashboard', label: 'Sala de Situação', permission: 'dashboard.view', acesso: 'painel.sala', icon: <IcoSala /> },
  ] },
  { chave: 'os', nome: 'Ordens de Serviço', icon: <IcoCapacete />, telas: [
    { to: 'os',               label: 'Ordens de Serviço',       permission: 'centros_custo.view', acesso: 'os.lista', icon: <IcoOsLista /> },
    { to: 'minhas-os',        label: 'Minhas OS (celular)',     permission: 'centros_custo.view', acesso: 'os.minhas', icon: <IcoCelular /> },
    { to: 'central-municipe', label: 'Central de Solicitações', permission: 'centros_custo.view', icon: <IcoMegafone /> },
    { to: 'servicos',         label: 'Serviços Urbanos',        permission: 'centros_custo.view', icon: <IcoCone /> },
  ] },
  { chave: 'compras', nome: 'Compras', icon: <IcoCarrinho />, telas: [
    { to: 'orcamentos', label: 'Orçamentos',           permission: 'centros_custo.view', icon: <IcoCalculadora /> },
    { to: 'pedidos',    label: 'Pedidos de compra',    permission: 'centros_custo.view', icon: <IcoPedido /> },
    { to: 'compras',    label: 'Central de compras',   permission: 'centros_custo.view', icon: <IcoCaminhao /> },
    { to: 'saldos',     label: 'Saldos dos contratos', permission: 'centros_custo.view', icon: <IcoSaldo /> },
  ] },
  { chave: 'contratos', nome: 'Contratos', icon: <IcoContrato />, telas: [
    { to: 'licitacoes', label: 'Licitações', permission: 'licitacoes.view', icon: <IcoMartelo /> },
  ] },
  { chave: 'cadastros', nome: 'Cadastros', icon: <IcoPrancheta />, telas: [
    { to: 'cadastros',         label: 'Início dos cadastros', permission: 'centros_custo.view', icon: <IcoBlocos /> },
    { to: 'cadastros/fluxo',   label: 'Fluxo e aprovações',   permission: 'users.manage',       icon: <IcoFluxo /> },
  ] },
];

interface TenantSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function TenantSidebar({ mobile = false, onNavigate }: TenantSidebarProps) {
  const { id: entityId } = useParams<{ id: string }>();
  const { session } = useTenant();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);

  const largo = mobile || hovered || pinned;

  const podeVer = (t: Tela) => session.permissions.includes(t.permission)
    && (!t.acesso || session.adminGeral || !!session.acessos?.includes(t.acesso));
  const modulos = MODULOS
    .map(m => ({ ...m, telas: m.telas.filter(podeVer) }))
    .filter(m => m.telas.length > 0);
  const todasTelas = modulos.flatMap(m => m.telas);

  /* a tela com o caminho mais longo que casa fica ativa (Cadastros não acende em Cadastros › Usuários) */
  const casa = (path: string) => {
    const base = `/t/${entityId}/${path}`;
    return location.pathname === base || location.pathname.startsWith(`${base}/`);
  };
  const isActive = (path: string) =>
    casa(path) && !todasTelas.some(t => t.to !== path && t.to.startsWith(`${path}/`) && casa(t.to));
  const moduloAtual = modulos.find(m => m.telas.some(t => isActive(t.to)))?.chave ?? null;

  /* acordeão: um módulo aberto por vez; ao navegar, abre o da tela atual */
  const [aberto, setAberto] = useState<string | null>(moduloAtual);
  useEffect(() => { setAberto(moduloAtual); }, [moduloAtual]);
  const abertoMulti = modulos.some(m => m.chave === aberto && m.telas.length > 1);

  const novas = usePedidosNovos(entityId, session.permissions.includes('centros_custo.view'));
  const badgeTela = (to: string) => (to === 'central-municipe' ? novas : 0);
  const Badge = ({ n, titulo }: { n: number; titulo?: string }) => n > 0
    ? <span className="mo-badge" title={titulo}>{n > 99 ? '99+' : n}</span>
    : null;

  /* desafixar ao clicar fora */
  useEffect(() => {
    if (mobile) return;
    const handler = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobile]);

  /* desafixar ao navegar */
  useEffect(() => {
    if (!mobile) setPinned(false);
  }, [location.pathname, mobile]);

  /* destaque que desliza até o item sob o mouse */
  const moverDestaque = (e: React.MouseEvent) => {
    const nav = navRef.current, hl = hlRef.current;
    const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-mo-hit]');
    if (!nav || !hl || !alvo) return;
    const r = alvo.getBoundingClientRect(), n = nav.getBoundingClientRect();
    hl.style.width = `${r.width}px`;
    hl.style.height = `${r.height}px`;
    hl.style.transform = `translate(${r.left - n.left}px, ${r.top - n.top + nav.scrollTop}px)`;
    nav.classList.add('hovering');
  };

  const nomeCurto = session.entity.name.split(' ')[0];

  return (
    <div
      ref={sidebarRef}
      className={`mo${mobile ? ' mo-mobile' : ''}${largo ? ' is-wide' : ''}`}
      onMouseEnter={mobile ? undefined : () => setHovered(true)}
      onMouseLeave={mobile ? undefined : () => setHovered(false)}
      onClick={mobile ? undefined : () => setPinned(true)}
    >
      {/* Marca */}
      <div className="mo-head">
        <div className="mo-logo" aria-hidden="true">
          <SimboloSisObras tamanho={30} />
        </div>
        <div className="mo-brand mo-some">
          <b>{nomeCurto}</b>
          <small>SisObras · Gestão de Obras</small>
        </div>
        {largo && !mobile && (
          <button
            type="button"
            className="mo-pin"
            onClick={(e) => { e.stopPropagation(); setPinned(false); setHovered(false); }}
            title="Recolher o menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
        )}
      </div>

      {/* Módulos */}
      <nav
        ref={navRef}
        className={`mo-nav${abertoMulti ? ' has-open' : ''}`}
        onMouseOver={moverDestaque}
        onMouseLeave={() => navRef.current?.classList.remove('hovering')}
      >
        <div ref={hlRef} className="mo-hl" aria-hidden="true" />
        <div className="mo-eyebrow mo-some">Módulos</div>

        {modulos.map((m) => {
          const atual = m.chave === moduloAtual;
          const totalBadge = m.telas.reduce((s, t) => s + badgeTela(t.to), 0);

          /* módulo de uma tela só: é um link direto */
          if (m.telas.length === 1) {
            const t = m.telas[0];
            return (
              <div key={m.chave} className={`mo-mod solo${atual ? ' current' : ''}`}>
                <Link
                  to={`/t/${entityId}/${t.to}`}
                  onClick={() => { setAberto(m.chave); onNavigate?.(); }}
                  className="mo-row"
                  data-mo-hit
                  title={!largo ? t.label : undefined}
                  aria-current={atual ? 'page' : undefined}
                >
                  <span className="mo-tile">{m.icon}{!largo && totalBadge > 0 && <i className="mo-dot" />}</span>
                  <span className="mo-lbl mo-some">{t.label}</span>
                  {largo && <Badge n={totalBadge} />}
                </Link>
              </div>
            );
          }

          const open = largo && aberto === m.chave;
          return (
            <div key={m.chave} className={`mo-mod${open ? ' open' : ''}${atual ? ' current' : ''}`}>
              <button
                type="button"
                className="mo-row"
                data-mo-hit
                aria-expanded={open}
                title={!largo ? m.nome : undefined}
                onClick={() => setAberto(a => (a === m.chave && largo ? null : m.chave))}
              >
                <span className="mo-tile">{m.icon}{!largo && totalBadge > 0 && <i className="mo-dot" />}</span>
                <span className="mo-lbl mo-some">{m.nome}</span>
                {largo && (totalBadge > 0 && !open
                  ? <Badge n={totalBadge} />
                  : <span className="mo-count">{m.telas.length}</span>)}
                {largo && <Chevron />}
              </button>
              <div className="mo-kids" inert={!open || undefined}>
                <div>
                  <ul>
                    {m.telas.map((t) => {
                      const ativo = isActive(t.to);
                      const n = badgeTela(t.to);
                      return (
                        <li key={t.to}>
                          <Link
                            to={`/t/${entityId}/${t.to}`}
                            onClick={onNavigate}
                            className={`mo-kid${ativo ? ' active' : ''}`}
                            data-mo-hit
                            aria-current={ativo ? 'page' : undefined}
                          >
                            {t.icon}
                            <span className="mo-klbl">{t.label}</span>
                            <Badge n={n} titulo={`${n} ${n === 1 ? 'pedido aguardando' : 'pedidos aguardando'}`} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Quem está usando */}
      <div className="mo-foot">
        <div className="mo-user">
          <div className="mo-av">{getInitials(session.name)}</div>
          <div className="mo-some" style={{ minWidth: 0 }}>
            <b>{session.name}</b>
            <small>{session.role.name}</small>
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
