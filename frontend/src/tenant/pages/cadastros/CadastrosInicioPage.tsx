import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../TenantContext';
import {
  Ajuda, Cabecalho, Carregando, Ic, PASSOS, Pagina, Placar, ReguaPassos, Selinho, Selo, rotaTenant, useResumoCadastros,
} from '../../components/sisobras/so';

const SELO_SITUACAO = {
  ok: { tom: 'mint' as const, texto: 'Pronto', vivo: false },
  warn: { tom: 'amber' as const, texto: 'Falta ajustar', vivo: true },
  opt: { tom: undefined, texto: 'Opcional', vivo: false },
};

/** Tela 1 · Início dos Cadastros — monte a base do sistema em 6 passos */
export function CadastrosInicioPage() {
  const { entityId } = useTenant();
  const { resumo } = useResumoCadastros();

  if (!resumo) return <Pagina><Carregando /></Pagina>;

  const faltam = resumo.passos.filter(p => p.situacao === 'warn');

  return (
    <Pagina>
      <Cabecalho
        rotulo="Cadastros"
        selo={<Selo />}
        eyebrow="Gestão de Obras · Cadastros"
        titulo="Monte a base do sistema"
        sub="Seis passos, nesta ordem. Tudo o que é cadastrado aqui aparece depois nas ordens de serviço, nas compras e no painel."
        direita={<Placar n={resumo.prontos} de={`de ${resumo.total}`} rotulo="passos prontos" />}
      >
        <ReguaPassos resumo={resumo} />
        {faltam.length > 0 && (
          <div className="so-foot">
            <div className="so-falta">
              <Ic n="alerta" />
              <span>
                Falta ajustar:{' '}
                {faltam.map((p, i) => {
                  const passo = PASSOS[p.n - 1];
                  return (
                    <Fragment key={p.n}>
                      {i > 0 && (i === faltam.length - 1 ? ' e ' : ', ')}
                      <a href={`#passo-${p.n}`}>{passo.curto}</a>{p.aviso ? ` (${p.aviso})` : ''}
                    </Fragment>
                  );
                })}
              </span>
            </div>
          </div>
        )}
      </Cabecalho>

      <section className="so-grid" aria-label="Passos">
        {PASSOS.map(passo => {
          const r = resumo.passos.find(x => x.n === passo.n)!;
          const selo = SELO_SITUACAO[r.situacao];
          const vazio = r.contagem === 'Nada cadastrado';
          return (
            <article key={passo.n} id={`passo-${passo.n}`} className={`so-card so-pc ${r.situacao}`}>
              <header className="so-chead">
                <span className="so-cic"><Ic n={passo.icone} /><span className="so-num mono">{passo.n}</span></span>
                <h2>{passo.nome}</h2>
                <div className="right">
                  <Selinho tom={selo.tom} ponto={r.situacao !== 'opt'} vivo={selo.vivo}>{selo.texto}</Selinho>
                  <Ajuda texto={`Ajuda: ${passo.curto}`} />
                </div>
              </header>
              <div className="so-cbody">
                <p>{passo.texto}</p>
                <div className={`so-kpi${vazio ? ' vazio' : ''}`}>{r.contagem}</div>
                {r.aviso && (
                  <div className={`so-warnline${r.avisoLeve ? ' leve' : ''}`}>
                    <Ic n={r.avisoLeve ? 'info' : 'alerta'} />{r.aviso}
                  </div>
                )}
                <div className="so-cfoot">
                  <Link to={rotaTenant(entityId, passo.rota)} className="so-btn so-ghost">
                    {vazio ? 'Começar' : 'Abrir'}<Ic n="seta" className="arrow" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="so-card so-regras" aria-label="Regras de trabalho">
        <span className="so-cic"><Ic n="shieldCheck" /></span>
        <div className="tx">
          <div className="so-eyebrow">Depois da base</div>
          <b>Regras de trabalho</b>
          <span>Quem aprova as OS e as compras, quem confere a baixa do fiscal e o prazo padrão de atendimento.</span>
        </div>
        <div className="acts">
          <Link to={rotaTenant(entityId, 'cadastros/fluxo')} className="so-btn so-primary">Abrir regras<Ic n="seta" className="arrow" /></Link>
          <Ajuda texto="Ajuda: Regras de trabalho" />
        </div>
      </section>
    </Pagina>
  );
}
