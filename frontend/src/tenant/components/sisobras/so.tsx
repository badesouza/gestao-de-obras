import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { cadastrosBaseApi } from '../../../lib/api-client';
import type { ChavePasso, ResumoCadastros, SituacaoPasso } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import '../../styles/sisobras.css';

/* ═══════════════════════ Ícones (traço, 24×24) ═══════════════════════ */

const ICONES = {
  orgao: <><path d="M3 22h18" /><path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7" /><path d="M12 2 20 7H4z" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  user: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
  userPlus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  truck: <><path d="M1 4h14v12H1z" /><path d="M15 8h4l4 4v4h-8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
  pie: <><path d="M21.2 15.9A10 10 0 1 1 8 2.8" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  hardhat: <><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" /><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" /><path d="M4 15v-3a6 6 0 0 1 6-6" /><path d="M14 6a6 6 0 0 1 6 6v3" /></>,
  key: <><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></>,
  fluxo: <><rect x="3" y="3" width="8" height="8" rx="2" /><path d="M7 11v4a2 2 0 0 0 2 2h4" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
  clipboard: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h4" /></>,
  shieldCheck: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  idcard: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M15 8h2M15 12h2M7 16h10" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  map: <><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  layers: <><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
  alerta: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  voltar: <path d="M19 12H5M11 18l-6-6 6-6" />,
  editar: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  pasta: <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />,
  chevDir: <path d="m9 18 6-6-6-6" />,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  chat: <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />,
  copiar: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  carrinho: <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.6L21 8H5.1" /></>,
  osCheck: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
} as const;

export type NomeIcone = keyof typeof ICONES;

export function Ic({ n, className, style }: { n: NomeIcone; className?: string; style?: React.CSSProperties }) {
  return <svg className={`i${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" style={style}>{ICONES[n]}</svg>;
}

/* ═══════════════════════ Página, mira e selo ═══════════════════════ */

/** Área de conteúdo no padrão SisObras (o menu do sistema fica como está) */
export function Pagina({ children, semMira }: { children: ReactNode; semMira?: boolean }) {
  return (
    <div className="so so-main">
      <div className="so-rolagem">
        <div className="so-wrap">
          {!semMira && <Mira />}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Mira de projeto: cursor de prancha que percorre a página e marca pontos */
export function Mira() {
  return (
    <div className="so-cad" aria-hidden="true">
      <span className="h" /><span className="v" /><span className="ping" /><span className="box" /><span className="tag" />
    </div>
  );
}

/** Selo da página: prancha quadriculada com cantoneiras e o bloco do ícone flutuando */
export function Selo({ icone, tom, pequeno, rotulo }: { icone?: NomeIcone; tom?: 'mint' | 'amber'; pequeno?: boolean; rotulo?: string }) {
  return (
    <div className={`so-selo${pequeno ? ' sm' : ''}`} {...(rotulo ? { role: 'img', 'aria-label': rotulo } : { 'aria-hidden': true })}>
      <span className="cm tl" /><span className="cm tr" /><span className="cm br" /><span className="cm bl" />
      {icone ? (
        <>
          <span className="so-gsh" />
          <span className={`so-sic${tom ? ` ${tom}` : ''}`}><Ic n={icone} /></span>
        </>
      ) : <PlacasIso />}
    </div>
  );
}

/** As 3 placas isométricas da Tela 1 (a base do sistema) */
function PlacasIso() {
  return (
    <svg className="so-iso" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="soIsoV" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9993FF" /><stop offset="1" stopColor="#635BFF" /></linearGradient>
        <linearGradient id="soIsoC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6AE6F0" /><stop offset="1" stopColor="#10C6D4" /></linearGradient>
        <linearGradient id="soIsoM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5BE0B6" /><stop offset="1" stopColor="#19B88A" /></linearGradient>
      </defs>
      <ellipse className="sh" cx="32" cy="58" rx="17" ry="3.5" />
      <g className="pl p3"><g className="in">
        <path d="M12 40 32 50 32 55 12 45Z" fill="#129E77" /><path d="M32 50 52 40 52 45 32 55Z" fill="#0E8463" />
        <path className="tp" d="M32 30 52 40 32 50 12 40Z" fill="url(#soIsoM)" />
      </g></g>
      <g className="pl p2"><g className="in">
        <path d="M12 31 32 41 32 46 12 36Z" fill="#0FA5B0" /><path d="M32 41 52 31 52 36 32 46Z" fill="#0B8C96" />
        <path className="tp" d="M32 21 52 31 32 41 12 31Z" fill="url(#soIsoC)" />
      </g></g>
      <g className="pl p1"><g className="in">
        <path d="M12 22 32 32 32 37 12 27Z" fill="#4B43E0" /><path d="M32 32 52 22 52 27 32 37Z" fill="#3D35C9" />
        <path className="tp" d="M32 12 52 22 32 32 12 22Z" fill="url(#soIsoV)" />
      </g></g>
    </svg>
  );
}

/* ═══════════════════════ Cabeçalho, placar, ajuda ═══════════════════════ */

export function Ajuda({ texto }: { texto: string }) {
  return <button type="button" className="so-qh" data-tip={texto} aria-label={texto}>?</button>;
}

export function ComoPreencher({ onClick }: { onClick?: () => void }) {
  return <button type="button" className="so-qpill" onClick={onClick}><span className="q">?</span>Como preencher</button>;
}

export function Placar({ n, de, rotulo }: { n: ReactNode; de: ReactNode; rotulo: string }) {
  return <div className="so-score"><div className="n"><b>{n}</b><span>{de}</span></div><small>{rotulo}</small></div>;
}

export function Cabecalho({ selo, eyebrow, titulo, antesTitulo, extras, sub, direita, children, rotulo }: {
  selo: ReactNode; eyebrow: ReactNode; titulo: ReactNode; antesTitulo?: ReactNode; extras?: ReactNode;
  sub?: ReactNode; direita?: ReactNode; children?: ReactNode; rotulo: string;
}) {
  const temRodape = !!children;
  return (
    <section className={`so-card so-head${temRodape ? '' : ' solo'}`} aria-label={rotulo}>
      <div className="so-plan" aria-hidden="true" />
      <div className="so-head-top">
        <div className="so-head-l">
          {selo}
          <div style={{ minWidth: 0 }}>
            <div className="so-eyebrow">{eyebrow}</div>
            <div className="so-title-row">
              {antesTitulo}
              <h1>{titulo}</h1>
              {extras}
              <ComoPreencher />
            </div>
            {sub && <p className="so-sub">{sub}</p>}
          </div>
        </div>
        {direita}
      </div>
      {children}
    </section>
  );
}

/* ═══════════════════════ Régua dos 6 passos ═══════════════════════ */

export interface Passo {
  n: number; chave: ChavePasso; nome: string; curto: string; icone: NomeIcone; rota: string; texto: string; botao?: string;
}

/** Os 6 passos do cadastro. As rotas dos passos 3 a 6 apontam para as telas atuais até as novas entrarem. */
export const PASSOS: Passo[] = [
  { n: 1, chave: 'orgao', nome: 'Órgão', curto: 'Órgão', icone: 'orgao', rota: 'cadastros/orgao', texto: 'Quem usa o sistema. O nome e o brasão aparecem no carimbo das fotos e nos PDFs.' },
  { n: 2, chave: 'lugares', nome: 'Lugares', curto: 'Lugares', icone: 'pin', rota: 'cadastros/lugares', texto: 'Macrozonas e bairros onde o trabalho acontece.' },
  { n: 3, chave: 'pessoas', nome: 'Pessoas', curto: 'Pessoas', icone: 'users', rota: 'cadastros/pessoas', texto: 'Quem entra no sistema e as equipes que vão a campo.' },
  { n: 4, chave: 'veiculos', nome: 'Veículos e equipamentos', curto: 'Veículos', icone: 'truck', rota: 'cadastros/veiculos', texto: 'Opcional. Só se quiser saber qual veículo ou máquina foi usado em cada OS.' },
  { n: 5, chave: 'centros', nome: 'Centros de custo', curto: 'Centros de custo', icone: 'pie', rota: 'cadastros/centros-de-custo', texto: 'Para onde vai o gasto. Ex.: Iluminação Pública, Limpeza Urbana.' },
  { n: 6, chave: 'servicos', nome: 'Serviços', curto: 'Serviços', icone: 'wrench', rota: 'cadastros/servicos', texto: 'O que a secretaria faz. Cada serviço tem seu centro de custo, quem atende e o que o fiscal preenche.' },
];

export const TEXTO_SITUACAO: Record<SituacaoPasso, string> = { ok: 'Pronto', warn: 'Ajustar', opt: 'Opcional' };

/** Resumo dos passos (Início dos Cadastros e régua). `recarregar` depois de salvar algo. */
export function useResumoCadastros() {
  const { entityId } = useTenant();
  const [resumo, setResumo] = useState<ResumoCadastros | null>(null);
  const recarregar = useCallback(() => {
    cadastrosBaseApi.resumo(entityId).then(setResumo).catch(() => setResumo(null));
  }, [entityId]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { resumo, recarregar };
}

export function rotaTenant(entityId: string, rota: string) {
  return `/t/${entityId}/${rota}`;
}

/** Régua de passos: os próprios passos formam a barra de progresso */
export function ReguaPassos({ resumo, atual }: { resumo: ResumoCadastros | null; atual?: number }) {
  const { entityId } = useTenant();
  return (
    <ol className="so-regua" aria-label="Passos do cadastro">
      {PASSOS.map(p => {
        const sit = resumo?.passos.find(x => x.n === p.n)?.situacao ?? 'opt';
        const cur = p.n === atual;
        return (
          <li key={p.n} className={`so-sg ${sit}${cur ? ' cur' : ''}`}>
            <Link to={cur ? '#' : rotaTenant(entityId, p.rota)} aria-current={cur ? 'step' : undefined}>
              <span className="sg-ic"><Ic n={p.icone} /></span>
              <span className="sg-tx"><b>{p.curto}</b><small><span>{String(p.n).padStart(2, '0')}</span>{cur ? 'Você está aqui' : TEXTO_SITUACAO[sit]}</small></span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Cabeçalho padrão de uma tela de passo: selo, título, placar "N de 6" e a régua */
export function CabecalhoPasso({ passo, titulo, sub, extras, resumo, rotuloPlacar = 'passo do cadastro' }: {
  passo: number; titulo?: string; sub: ReactNode; extras?: ReactNode; resumo: ResumoCadastros | null; rotuloPlacar?: string;
}) {
  const { entityId } = useTenant();
  const p = PASSOS[passo - 1];
  return (
    <Cabecalho
      rotulo={p.nome}
      selo={<Selo icone={p.icone} />}
      eyebrow={<>Gestão de Obras · <Link to={rotaTenant(entityId, 'cadastros')}>Cadastros</Link></>}
      titulo={titulo ?? p.nome}
      extras={extras}
      sub={sub}
      direita={<Placar n={passo} de="de 6" rotulo={rotuloPlacar} />}
    >
      <ReguaPassos resumo={resumo} atual={passo} />
    </Cabecalho>
  );
}

/* ═══════════════════════ Cartões, selos, botões ═══════════════════════ */

export function Cartao({ icone, tomIcone, titulo, meta, direita, ajuda, className, children, corpoClassName, corpoStyle, id, rotulo }: {
  icone: NomeIcone | ReactNode; tomIcone?: 'mint' | 'amber' | 'cyan'; titulo: ReactNode; meta?: ReactNode; direita?: ReactNode;
  ajuda?: string; className?: string; children?: ReactNode; corpoClassName?: string; corpoStyle?: React.CSSProperties; id?: string; rotulo?: string;
}) {
  return (
    <section id={id} className={`so-card${className ? ` ${className}` : ''}`} aria-label={rotulo ?? (typeof titulo === 'string' ? titulo : undefined)}>
      <header className="so-chead">
        <span className={`so-cic${tomIcone ? ` ${tomIcone}` : ''}`}>{typeof icone === 'string' ? <Ic n={icone as NomeIcone} /> : icone}</span>
        <h2>{titulo}</h2>
        {meta && <span className="meta">{meta}</span>}
        {(direita || ajuda) && <div className="right">{direita}{ajuda && <Ajuda texto={ajuda} />}</div>}
      </header>
      {children !== undefined && <div className={`so-cbody${corpoClassName ? ` ${corpoClassName}` : ''}`} style={corpoStyle}>{children}</div>}
    </section>
  );
}

export function Selinho({ tom, children, ponto, vivo }: { tom?: 'mint' | 'amber' | 'brand' | 'cyan' | 'coral' | 'ink' | 'ex'; children: ReactNode; ponto?: boolean; vivo?: boolean }) {
  return <span className={`so-badge${tom ? ` ${tom}` : ''}`}>{ponto && <span className={`dot${vivo ? ' live' : ''}`} />}{children}</span>;
}

export function BarraAcoes({ esquerda, children }: { esquerda: ReactNode; children: ReactNode }) {
  return (
    <div className="so-actionbar">
      <div className="ab-l">{esquerda}</div>
      <div className="acts">{children}</div>
    </div>
  );
}

export function Sep() { return <span className="sep" />; }

export function Aviso({ tom, icone, children, className }: { tom?: 'amber' | 'mint' | 'plain'; icone?: NomeIcone; children: ReactNode; className?: string }) {
  const ic: NomeIcone = icone ?? (tom === 'amber' ? 'alerta' : 'info');
  return <div className={`so-note${tom ? ` ${tom}` : ''}${className ? ` ${className}` : ''}`}><Ic n={ic} /><span>{children}</span></div>;
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return <div className="so-carregando">{texto}</div>;
}

/** Mensagem curta de erro vinda da API */
export function msgErro(e: unknown, padrao = 'Não foi possível salvar') {
  const m = (e as { body?: { message?: string } })?.body?.message;
  return m || padrao;
}

/* ═══════════════════════ Janela (modal) ═══════════════════════ */

/** Janela no padrão SisObras: abre pelo botão, com selo, título, corpo e rodapé de ações.
    Fecha no X, no Esc ou no Cancelar (clicar fora não fecha, para não perder o que foi digitado). */
export function Janela({ icone, tom, eyebrow, titulo, sub, ajuda, largura = 560, onFechar, rodape, children, rotulo }: {
  icone: NomeIcone; tom?: 'mint' | 'amber'; eyebrow?: ReactNode; titulo: ReactNode; sub?: ReactNode; ajuda?: string;
  largura?: number; onFechar: () => void; rodape?: ReactNode; children: ReactNode; rotulo?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar.current(); };
    window.addEventListener('keydown', esc);
    const foco = ref.current?.querySelector<HTMLElement>('.so-dlg-b input:not([type=checkbox]):not([type=radio]):not([disabled]), .so-dlg-b select, .so-dlg-b textarea');
    setTimeout(() => foco?.focus(), 40);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  return createPortal(
    <div className="so so-scrim fixo" role="presentation">
      <section ref={ref} className="so-dialog so-janela" role="dialog" aria-modal="true" aria-label={rotulo ?? (typeof titulo === 'string' ? titulo : undefined)} style={{ width: largura }}>
        <div className="so-dlg-h">
          <Selo icone={icone} tom={tom} pequeno />
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && <div className="so-eyebrow">{eyebrow}</div>}
            <h2 style={{ marginTop: eyebrow ? 3 : 0 }}>{titulo}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-start' }}>
            {ajuda && <Ajuda texto={ajuda} />}
            <button type="button" className="so-x" aria-label="Fechar" onClick={onFechar}><Ic n="x" /></button>
          </div>
        </div>
        <div className="so-dlg-b">{children}</div>
        {rodape && <div className="so-dlg-f">{rodape}</div>}
      </section>
    </div>,
    document.body,
  );
}
