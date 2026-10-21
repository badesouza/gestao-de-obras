import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, centrosDeCustoApi, type CentroDeCusto, type VinculoServico } from '../../../lib/api-client';
import { CENTRO_IDS, SERVICOS_CONFIG } from '../../pages/servico-config';
import { Dialogo } from './ui';

/* ── Serviços urbanos × centro de custo: ajuste de tudo numa tela só ──
   Cada serviço aponta o seu centro padrão. Ao salvar, o que já foi
   lançado sem centro (ocorrências, solicitações, pedidos, orçamentos)
   pode receber o centro do seu serviço.                              */

const SLUG_POR_ID = Object.fromEntries(Object.entries(CENTRO_IDS).map(([slug, id]) => [id, slug]));
const msg = (e: unknown) => e instanceof ApiError ? e.body.message : 'Não foi possível concluir';

export function ServicosCentrosPainel({ entityId, centros, podeGerir, onMudou }: {
  entityId: string; centros: CentroDeCusto[]; podeGerir: boolean; onMudou: (aviso: string) => void;
}) {
  const [vinculos, setVinculos] = useState<VinculoServico[] | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [aplicarAntigos, setAplicarAntigos] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [estrutura, setEstrutura] = useState<{ codigo: string; nome: string } | null>(null);

  const carregar = useCallback(() => centrosDeCustoApi.vinculos(entityId, CENTRO_IDS)
    .then(v => { setVinculos(v); setEscolhas(Object.fromEntries(v.map(x => [x.servicoId, x.centroDeCustoId ?? '']))); })
    .catch(e => setErro(msg(e))), [entityId]);
  useEffect(() => { void carregar(); }, [carregar, centros.length]);

  const ativos = useMemo(() => centros.filter(c => c.ativo), [centros]);
  const lista = (vinculos ?? []).filter(v => v.ativo);
  const semCentro = lista.filter(v => !escolhas[v.servicoId]);
  const mudou = lista.some(v => (escolhas[v.servicoId] || null) !== v.centroDeCustoId);
  const pendentesAntigos = lista.reduce((t, v) => t + (escolhas[v.servicoId] ? v.ocorrenciasSemCentro + v.comprasSemCentro : 0), 0);
  const ocorrSem = lista.reduce((t, v) => t + v.ocorrenciasSemCentro, 0);
  const comprasSem = lista.reduce((t, v) => t + v.comprasSemCentro, 0);

  const salvar = async () => {
    setSalvando(true); setErro('');
    try {
      const r = await centrosDeCustoApi.salvarVinculos(entityId, lista.map(v => ({
        servicoId: v.servicoId, slug: v.slug ?? SLUG_POR_ID[v.servicoId] ?? '', centroDeCustoId: escolhas[v.servicoId] || null,
      })), aplicarAntigos);
      const acertados = r.ocorrencias + r.solicitacoes + r.pedidos + r.orcamentos;
      onMudou(acertados ? `Vínculos salvos. Acertados: ${r.ocorrencias} ocorrências, ${r.solicitacoes + r.pedidos} itens de compra, ${r.orcamentos} itens de orçamento.` : 'Vínculos dos serviços salvos.');
      await carregar();
    } catch (e) { setErro(msg(e)); }
    finally { setSalvando(false); }
  };

  const montar = async () => {
    if (!estrutura) return;
    setSalvando(true); setErro('');
    try {
      const r = await centrosDeCustoApi.estruturaSugerida(entityId, { codigoSecretaria: estrutura.codigo, nomeSecretaria: estrutura.nome });
      setEstrutura(null);
      onMudou(`Estrutura montada: ${r.criados.length} setores criados e ligados aos serviços. Confira e salve para acertar o que já foi lançado.`);
      await carregar();
    } catch (e) { setErro(msg(e)); }
    finally { setSalvando(false); }
  };

  const raizSugerida = () => {
    const sec = ativos.find(c => c.tipo === 'SECRETARIA');
    return sec ? { codigo: sec.codigo, nome: sec.nome } : { codigo: '02.01', nome: 'Secretaria de Obras e Serviços Públicos' };
  };

  return (
    <section className="ob-card ob-reveal sc-painel" style={{ '--i': 4 } as React.CSSProperties} aria-label="Serviços e centros de custo">
      <div className="sc-cab">
        <div>
          <h2 className="sc-titulo">Centro de custo de cada serviço</h2>
          <p className="sc-sub">Cada serviço escolhe o centro de custo onde lança as despesas. Ajuste tudo aqui e salve de uma vez — ou dentro de cada serviço.</p>
        </div>
        {podeGerir && semCentro.length > 0 && (
          <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setEstrutura(raizSugerida())}>Montar estrutura sugerida</button>
        )}
      </div>

      {!vinculos && !erro && <div className="sc-grade">{[1, 2, 3, 4, 5, 6].map(n => <span key={n} className="ob-skeleton" style={{ height: 64, borderRadius: 14 }} />)}</div>}
      {vinculos && (
        <div className="sc-grade">
          {lista.map((v, i) => {
            const cfg = SERVICOS_CONFIG[v.slug ?? SLUG_POR_ID[v.servicoId] ?? ''];
            const escolhido = escolhas[v.servicoId] ?? '';
            const pendentes = v.ocorrenciasSemCentro + v.comprasSemCentro;
            return (
              <div key={v.servicoId} className={`sc-linha ob-reveal${escolhido ? '' : ' is-sem'}`} style={{ '--i': Math.min(i, 12), '--serv-cor': cfg?.cor ?? '#78716C' } as React.CSSProperties}>
                <span className="sc-icone">{cfg?.icon}</span>
                <span className="sc-nome">
                  <b>{cfg?.nome ?? v.nome}</b>
                  {pendentes > 0 && <small>{[v.ocorrenciasSemCentro && `${v.ocorrenciasSemCentro} ocorrências`, v.comprasSemCentro && `${v.comprasSemCentro} compras`].filter(Boolean).join(' · ')} sem centro</small>}
                  {!pendentes && escolhido && <small className="is-ok">tudo apropriado</small>}
                </span>
                <select value={escolhido} disabled={!podeGerir} aria-label={`Centro de custo de ${cfg?.nome ?? v.nome}`}
                  onChange={e => setEscolhas(x => ({ ...x, [v.servicoId]: e.target.value }))}>
                  <option value="">Sem centro de custo</option>
                  {ativos.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {erro && <div className="ob-erro">{erro}</div>}
      {podeGerir && vinculos && (
        <div className="sc-rodape">
          <label className="sc-check">
            <input type="checkbox" checked={aplicarAntigos} onChange={e => setAplicarAntigos(e.target.checked)} />
            <span>Acertar também o que já foi lançado sem centro{ocorrSem + comprasSem ? ` (${ocorrSem} ocorrências, ${comprasSem} itens de compra)` : ''}</span>
          </label>
          <button type="button" className="ob-acao is-aprovar" disabled={salvando || (!mudou && !(aplicarAntigos && pendentesAntigos))} onClick={() => void salvar()}>
            {salvando ? 'Salvando…' : 'Salvar tudo'}
          </button>
        </div>
      )}

      {estrutura && (
        <Dialogo titulo="Montar estrutura sugerida" subtitulo="Cria a secretaria (se ainda não existir) e um setor para cada serviço sem centro, já ligados. Depois dá para trocar códigos e nomes."
          onFechar={() => setEstrutura(null)}
          acoes={<><button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setEstrutura(null)}>Cancelar</button>
            <button type="button" className="ob-acao is-aprovar" disabled={salvando || !estrutura.codigo.trim() || estrutura.nome.trim().length < 2} onClick={() => void montar()}>{salvando ? 'Criando…' : `Criar ${semCentro.length} setores`}</button></>}>
          <div className="cc-form">
            <label className="cc-campo cc-curto"><span>Código</span><input value={estrutura.codigo} onChange={e => setEstrutura({ ...estrutura, codigo: e.target.value })} maxLength={20} /></label>
            <label className="cc-campo"><span>Secretaria</span><input value={estrutura.nome} onChange={e => setEstrutura({ ...estrutura, nome: e.target.value })} maxLength={200} /></label>
          </div>
          <ul className="sc-previa">
            {semCentro.map((v, i) => {
              const cfg = SERVICOS_CONFIG[v.slug ?? SLUG_POR_ID[v.servicoId] ?? ''];
              return <li key={v.servicoId}><code>{estrutura.codigo.trim()}.{String(i + 1).padStart(2, '0')}</code>{cfg?.nome ?? v.nome}</li>;
            })}
          </ul>
          <p className="sc-nota">Se algum código já existir, o próximo número livre é usado.</p>
        </Dialogo>
      )}
    </section>
  );
}
