import { INSTRUCOES } from '../pages/servico-instrucoes';
import { Aviso, Ic, Janela, type NomeIcone } from './sisobras/so';

interface Props {
  slug: string | null;
  nomeServico: string;
  corServico: string;
  onClose: () => void;
}

/* ícone de cada seção pelo assunto (as instruções vêm das planilhas da Secretaria) */
function iconeDaSecao(titulo: string): NomeIcone {
  if (/campo|registro|preench/i.test(titulo)) return 'clipboard';
  if (/foto|imagem|evid/i.test(titulo)) return 'image';
  if (/status|etapa|fluxo/i.test(titulo)) return 'fluxo';
  if (/equipe|fiscal|respons/i.test(titulo)) return 'users';
  if (/local|bairro|rota|mapa/i.test(titulo)) return 'pin';
  if (/meta|indicador|produ/i.test(titulo)) return 'sliders';
  return 'doc';
}

/** Manual de uso do serviço, em janela no padrão SisObras */
export function ServicoInstrucoesDrawer({ slug, nomeServico, corServico, onClose }: Props) {
  if (!slug) return null;
  const instrucoes = INSTRUCOES[slug] ?? null;
  return (
    <Janela icone="info" eyebrow={<span style={{ color: corServico }}>Manual de uso</span>} titulo={instrucoes?.nome ?? nomeServico}
      sub={instrucoes?.resumo} largura={680} onFechar={onClose} rotulo={`Instruções — ${nomeServico}`}
      rodape={<button type="button" className="so-btn so-primary" onClick={onClose}>Entendi</button>}>
      {!instrucoes ? (
        <Aviso tom="plain">As instruções para este serviço ainda não foram cadastradas.</Aviso>
      ) : (
        <>
          {instrucoes.secoes.map((secao, si) => (
            <section key={si} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="so-fs-t" style={{ gap: 8 }}><Ic n={iconeDaSecao(secao.titulo)} style={{ width: 15, height: 15, color: 'var(--brand)' }} />{secao.titulo}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {secao.itens.map((item, ii) => {
                  const i = item.indexOf(':');
                  const rotulo = i > -1 ? item.slice(0, i) : null;
                  const corpo = i > -1 ? item.slice(i + 1).trim() : item;
                  return (
                    <li key={ii} style={{ display: 'flex', gap: 9, fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 2, marginTop: 7, flex: 'none', background: corServico }} />
                      <span>{rotulo && <b style={{ color: 'var(--ink)' }}>{rotulo}: </b>}{corpo}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {instrucoes.dicas.length > 0 && (
            <div className="so-note amber" style={{ alignItems: 'flex-start' }}>
              <Ic n="info" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <b>Dicas importantes</b>
                {instrucoes.dicas.map((d, di) => <span key={di}>{d}</span>)}
              </div>
            </div>
          )}
          <p className="so-help" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ic n="shield" style={{ width: 13, height: 13 }} />Instruções tiradas das planilhas operacionais da Secretaria de Obras de Itaberaba.</p>
        </>
      )}
    </Janela>
  );
}
