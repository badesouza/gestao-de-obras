import { useId, type CSSProperties } from 'react';
import './marca.css';

/* Símbolo do SisObras ("Bloco S"): quatro blocos assentados em duas fiadas formando o S.
   Geometria gerada uma vez (vista de frente com profundidade); a mesma dos ícones em /public. */
const CUBOS = [
  { frente: '2,39.08 13.88,39.08 13.88,27.2 2,27.2', topo: '2,27.2 13.88,27.2 19.89,21.98 8.01,21.98', lado: '13.88,39.08 13.88,27.2 19.89,21.98 19.89,33.86', brilho: '2,27.2 13.88,27.2 13.88,39.08', solta: [-1.8, 1.4] },
  { frente: '15.06,39.08 26.94,39.08 26.94,27.2 15.06,27.2', topo: '15.06,27.2 26.94,27.2 32.94,21.98 21.06,21.98', lado: '26.94,39.08 26.94,27.2 32.94,21.98 32.94,33.86', brilho: '15.06,27.2 26.94,27.2 26.94,39.08', solta: [0, 1.8] },
  { frente: '15.06,26.02 26.94,26.02 26.94,14.14 15.06,14.14', topo: '15.06,14.14 26.94,14.14 32.94,8.92 21.06,8.92', lado: '26.94,26.02 26.94,14.14 32.94,8.92 32.94,20.8', brilho: '15.06,14.14 26.94,14.14 26.94,26.02', solta: [0, -1.8] },
  { frente: '28.11,26.02 39.99,26.02 39.99,14.14 28.11,14.14', topo: '28.11,14.14 39.99,14.14 46,8.92 34.12,8.92', lado: '39.99,26.02 39.99,14.14 46,8.92 46,20.8', brilho: '28.11,14.14 39.99,14.14 39.99,26.02', solta: [1.8, -1.4] },
] as const;

type Props = {
  tamanho?: number;
  className?: string;
  /** "montar": os blocos caem e se encaixam ao aparecer · "carregando": sobem e descem em sequência */
  animacao?: 'montar' | 'carregando';
  titulo?: string;
};

export function SimboloSisObras({ tamanho = 40, className = '', animacao, titulo }: Props) {
  const id = 'sbs' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      className={`sbs${animacao ? ' ' + animacao : ''}${className ? ' ' + className : ''}`}
      width={tamanho} height={tamanho} viewBox="0 0 48 48"
      role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#D4D1FF" /><stop offset="1" stopColor="#A59FFF" /></linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7A71FF" /><stop offset="1" stopColor="#4F5BF0" /></linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1FC3DC" /><stop offset="1" stopColor="#0E8DB0" /></linearGradient>
      </defs>
      {CUBOS.map((c, k) => (
        <g key={k} className="sbs-cubo" style={{ "--k": k, "--dx": `${c.solta[0]}px`, "--dy": `${c.solta[1]}px` } as CSSProperties}>
          <polygon points={c.lado} fill={`url(#${id}l)`} />
          <polygon points={c.topo} fill={`url(#${id}t)`} />
          <polygon points={c.frente} fill={`url(#${id}f)`} />
          <polyline points={c.brilho} fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth=".6" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}

/** Assinatura: símbolo + "SisObras" + linha de apoio */
export function AssinaturaSisObras({ tamanho = 40, apoio = 'Gestão de Obras e Serviços', escuro = true, animacao }: { tamanho?: number; apoio?: string; escuro?: boolean; animacao?: 'montar' }) {
  return (
    <span className={`sbs-assin${escuro ? ' escuro' : ''}`}>
      <SimboloSisObras tamanho={tamanho} animacao={animacao} />
      <span className="sbs-wm"><b>Sis<i>Obras</i></b>{apoio && <small>{apoio}</small>}</span>
    </span>
  );
}

/** Abertura depois da senha: os blocos se encaixam e a barra enche (cerca de 1,3 s) */
export function AberturaSisObras({ nome, destino = 'Abrindo o sistema' }: { nome?: string; destino?: string }) {
  const primeiro = nome?.trim().split(/\s+/)[0];
  return (
    <div className="sbs-abertura" role="status" aria-live="polite">
      <div>
        <SimboloSisObras tamanho={104} animacao="montar" />
        <b>{primeiro ? `Bem-vindo, ${primeiro}` : 'Bem-vindo'}</b>
        <small>{destino}</small>
        <span className="barra"><i /></span>
      </div>
    </div>
  );
}
