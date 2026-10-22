import type { ReactNode } from 'react';
import { Ic, Pagina, Selo, type NomeIcone } from '../../tenant/components/sisobras/so';
import '../styles/aviso-so.css';

/** Tela de aviso no padrão SisObras (acesso negado, página não encontrada).
 *  `cheia`: fora da casca do sistema, ocupa a janela inteira. */
export function TelaAviso({ icone, tom, codigo, titulo, texto, ponto, cheia, children }: {
  icone: NomeIcone; tom: 'coral' | 'amber'; codigo: string; titulo: string; texto: ReactNode;
  ponto?: string; cheia?: boolean; children: ReactNode;
}) {
  const conteudo = (
    <div className="pa-centro">
      <section className={`so-card pa-card ${tom}`} aria-label={titulo}>
        <div className="so-plan" aria-hidden="true" />
        <Selo icone={icone} tom={tom} />
        <span className="pa-codigo"><span className="dot" />{codigo}</span>
        <h1>{titulo}</h1>
        <p>{texto}</p>
        {ponto && (
          <div className="pa-ponto" title={ponto}>
            <Ic n="pin" /><span>{ponto}</span>
          </div>
        )}
        <div className="pa-acoes">{children}</div>
        <div className="pa-fita" aria-hidden="true" />
      </section>
    </div>
  );

  if (!cheia) return <Pagina>{conteudo}</Pagina>;
  return <div className="pa-cheia"><Pagina>{conteudo}</Pagina></div>;
}
