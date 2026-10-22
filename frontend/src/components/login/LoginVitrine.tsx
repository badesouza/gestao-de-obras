import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowRight, BadgeCheck, CheckCheck, ClipboardCheck, Eye, EyeOff, HardHat, Inbox, LayoutGrid,
  LockKeyhole, Mail, MapPinned, QrCode, ShieldCheck, Smartphone, TriangleAlert, WifiOff,
} from 'lucide-react';
import { SimboloSisObras } from '../marca/SimboloSisObras';
import './login.css';

/* ─── Entrada do SisObras: vitrine à esquerda + cartão de acesso à direita ───
   Usada pelo login da plataforma e pelo login da entidade. Os textos da
   vitrine descrevem o que o sistema faz (nada de número inventado). */

const ETAPAS = [
  { ic: Inbox, t: 'Pedido', d: 'Munícipe, escritório ou campo' },
  { ic: BadgeCheck, t: 'Aprovação', d: 'Responsável confere e libera' },
  { ic: HardHat, t: 'Execução', d: 'Fiscal registra com foto e GPS' },
  { ic: CheckCheck, t: 'Finalizada', d: 'Coordenador confere a baixa' },
];

/** número que sobe de 0 até o valor quando a tela abre */
function Sobe({ ate, ms = 1400, atraso = 400 }: { ate: number; ms?: number; atraso?: number }) {
  const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [v, setV] = useState(parado ? ate : 0);
  useEffect(() => {
    if (parado) return;
    let raf = 0;
    const t0 = performance.now() + atraso;
    const passo = (agora: number) => {
      const p = Math.min(1, Math.max(0, (agora - t0) / ms));
      setV(Math.round(ate * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    /* aba em segundo plano não roda animação: garante o valor final */
    const fim = window.setTimeout(() => setV(ate), atraso + ms + 150);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(fim); };
  }, [ate, ms, atraso, parado]);
  return <>{v}</>;
}

/** lanterna do cartão segue o mouse */
function luz(e: React.PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--px', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--py', `${e.clientY - r.top}px`);
}

function Marca() {
  return (
    <div className="lg-marca sbs-gatilho">
      <div className="lg-logo" aria-hidden="true">
        <SimboloSisObras tamanho={40} animacao="montar" />
      </div>
      <div>
        <b>SisObras</b>
        <small>Gestão de Obras e Serviços</small>
      </div>
    </div>
  );
}

function Kpis() {
  return (
    <div className="lg-kpis">
      <div className="lg-kpi violeta" style={{ '--i': 0 } as CSSProperties} onPointerMove={luz}>
        <div className="lg-kpi-top">
          <span className="lg-kpi-ic"><ClipboardCheck /></span>
          <span className="lg-kpi-tag">Ordens</span>
        </div>
        <div className="lg-kpi-num"><strong><Sobe ate={4} ms={900} /></strong><span>etapas</span></div>
        <p>Toda OS tem número, prazo e dono em cada passo.</p>
        <div className="lg-kpi-viz">
          <div className="lg-viz-regua"><i /><i /><i /><i /></div>
        </div>
      </div>

      <div className="lg-kpi ciano" style={{ '--i': 1 } as CSSProperties} onPointerMove={luz}>
        <div className="lg-kpi-top">
          <span className="lg-kpi-ic"><QrCode /></span>
          <span className="lg-kpi-tag">Munícipe</span>
        </div>
        <div className="lg-kpi-num"><strong><Sobe ate={24} /></strong><span>horas</span></div>
        <p>Pedido por link ou QR Code, com protocolo.</p>
        <div className="lg-kpi-viz">
          <svg className="lg-viz-linha" viewBox="0 0 120 18" preserveAspectRatio="none" aria-hidden="true">
            <path d="M1 14 L18 11 L32 13 L48 7 L62 9 L78 4 L94 6 L119 2" />
          </svg>
        </div>
      </div>

      <div className="lg-kpi verde" style={{ '--i': 2 } as CSSProperties} onPointerMove={luz}>
        <div className="lg-kpi-top">
          <span className="lg-kpi-ic"><MapPinned /></span>
          <span className="lg-kpi-tag">Campo</span>
        </div>
        <div className="lg-kpi-num"><strong>GPS</strong><span>+ foto</span></div>
        <p>Antes e depois com local, data e hora na imagem.</p>
        <div className="lg-kpi-viz">
          <span className="lg-viz-radar" aria-hidden="true"><i /></span>
          <span className="lg-viz-gps">12°31′S · 40°18′W</span>
        </div>
      </div>

      <div className="lg-kpi ambar" style={{ '--i': 3 } as CSSProperties} onPointerMove={luz}>
        <div className="lg-kpi-top">
          <span className="lg-kpi-ic"><LayoutGrid /></span>
          <span className="lg-kpi-tag">Integrado</span>
        </div>
        <div className="lg-kpi-num"><strong><Sobe ate={5} ms={900} atraso={600} /></strong><span>módulos</span></div>
        <p>Cadastros, contratos, OS, compras e painel.</p>
        <div className="lg-kpi-viz">
          <div className="lg-viz-mods">
            {[0, 1, 2, 3, 4].map(i => <i key={i} style={{ '--i': i } as CSSProperties} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginVitrine({ orgao, children }: { orgao?: string; children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);

  /* lanterna do fundo acompanha o mouse (um quadro por vez) */
  useEffect(() => {
    const el = raiz.current;
    if (!el || window.matchMedia('(pointer: coarse)').matches) return;
    let raf = 0;
    const mover = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${e.clientX}px`);
        el.style.setProperty('--my', `${e.clientY}px`);
      });
    };
    el.addEventListener('pointermove', mover);
    return () => { el.removeEventListener('pointermove', mover); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="lg" ref={raiz}>
      <div className="lg-bg" aria-hidden="true">
        <span className="lg-glow g1" /><span className="lg-glow g2" /><span className="lg-glow g3" />
      </div>

      <section className="lg-vitrine">
        <div className="lg-laser" aria-hidden="true" />
        <div className="lg-cadlayer" aria-hidden="true">
          <div className="lg-cad"><span className="h" /><span className="v" /><span className="ping" /><span className="box" /><span className="tag" /></div>
        </div>

        <Marca />

        <div className="lg-hero">
          <p className="lg-eyebrow"><i />{orgao || 'Obras e serviços urbanos'}</p>
          <h1>Do pedido do munícipe<br />à <em>obra entregue</em>.</h1>
          <p className="lg-hero-desc">
            Ordens de serviço, equipes, contratos e compras da Secretaria num só sistema —
            no escritório e no celular do fiscal, com prova de cada serviço feito.
          </p>
        </div>

        <div className="lg-fluxo">
          <div className="lg-fluxo-top">
            <b>Caminho de uma ordem de serviço</b>
            <span>do pedido à baixa</span>
          </div>
          <div className="lg-trilho">
            <div className="lg-cometa" aria-hidden="true" />
            {ETAPAS.map(({ ic: Ic, t, d }, i) => (
              <div className="lg-etapa" key={t} style={{ '--i': i } as CSSProperties}>
                <span className="no"><Ic /></span>
                <b>{t}</b>
                <small>{d}</small>
              </div>
            ))}
          </div>
        </div>

        <Kpis />

        <div className="lg-selos">
          <span><ShieldCheck />Conexão protegida</span>
          <span><Smartphone />Instala no celular</span>
          <span><WifiOff />Registra sem sinal</span>
        </div>
      </section>

      <main className="lg-lado">
        <div className="lg-cartao-wrap">
          <div className="lg-cartao">{children}</div>
        </div>
      </main>
    </div>
  );
}

/* ─── Peças do cartão ─────────────────────────────────────────────────────── */

function saudacao(d: Date) {
  const h = d.getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function LoginSaudacao() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const data = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="lg-saudacao">
      <b>{saudacao(agora)}</b>
      <time dateTime={agora.toISOString()}>{data} · {hora}</time>
    </div>
  );
}

/** selo em camadas: prancha quadriculada, cantoneiras, laser e o ícone (ou brasão) flutuando */
export function LoginSelo({ children, tom, brasao }: { children?: ReactNode; tom?: 'coral' | 'ambar'; brasao?: string | null }) {
  const [falhou, setFalhou] = useState(false);
  const comBrasao = !!brasao && !falhou;
  return (
    <div className="lg-selo" aria-hidden="true">
      <span className="cm tl" /><span className="cm tr" /><span className="cm br" /><span className="cm bl" />
      <span className="lg-gsh" />
      <span className={`lg-sic${comBrasao ? ' brasao' : tom ? ` ${tom}` : ''}`}>
        {comBrasao ? <img src={brasao!} alt="" onError={() => setFalhou(true)} /> : children}
      </span>
    </div>
  );
}

export function LoginCabecalho({ selo, eyebrow, titulo, sub }: { selo: ReactNode; eyebrow: string; titulo: ReactNode; sub?: string }) {
  return (
    <div className="lg-cab">
      {selo}
      <div className="lg-cab-txt">
        <p className="lg-cab-eyebrow">{eyebrow}</p>
        <h2>{titulo}</h2>
        {sub && <p>{sub}</p>}
      </div>
    </div>
  );
}

type CamposProps = {
  idPrefixo: string;
  email: string; setEmail: (v: string) => void;
  senha: string; setSenha: (v: string) => void;
  placeholderEmail: string;
  erro: string;
  carregando: boolean;
  textoBotao: string;
  onSubmit: (e: React.FormEvent) => void;
};

export function LoginFormulario(p: CamposProps) {
  const [ver, setVer] = useState(false);
  const [caps, setCaps] = useState(false);
  const checaCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  return (
    <form className="lg-form" onSubmit={p.onSubmit}>
      <div className="lg-campo">
        <label htmlFor={`${p.idPrefixo}-email`}>E-mail</label>
        <div className="lg-ctrl">
          <Mail aria-hidden="true" />
          <input
            id={`${p.idPrefixo}-email`}
            type="email"
            value={p.email}
            onChange={(e) => p.setEmail(e.target.value)}
            placeholder={p.placeholderEmail}
            required
            autoComplete="username"
          />
        </div>
      </div>

      <div className="lg-campo">
        <label htmlFor={`${p.idPrefixo}-password`}>Senha</label>
        <div className="lg-ctrl">
          <LockKeyhole aria-hidden="true" />
          <input
            id={`${p.idPrefixo}-password`}
            type={ver ? 'text' : 'password'}
            value={p.senha}
            onChange={(e) => p.setSenha(e.target.value)}
            onKeyUp={checaCaps}
            onKeyDown={checaCaps}
            onBlur={() => setCaps(false)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="lg-olho"
            onClick={() => setVer(v => !v)}
            aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
            title={ver ? 'Esconder senha' : 'Mostrar senha'}
          >
            {ver ? <EyeOff /> : <Eye />}
          </button>
        </div>
        {caps && <span className="lg-caps"><TriangleAlert />Caps Lock ligado</span>}
      </div>

      {p.erro && (
        <div className="lg-erro" role="alert" key={p.erro}>
          <TriangleAlert />
          <span>{p.erro}</span>
        </div>
      )}

      <button type="submit" className="lg-btn" disabled={p.carregando}>
        {p.carregando
          ? <><span className="lg-spin" />Conferindo acesso…</>
          : <>{p.textoBotao}<ArrowRight /></>}
      </button>
    </form>
  );
}

export function LoginRodape() {
  return (
    <div className="lg-rodape">
      <span><ShieldCheck />Conexão protegida</span>
      <code>v {__VERSAO_APP__}</code>
    </div>
  );
}
