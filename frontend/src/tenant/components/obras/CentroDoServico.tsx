import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, centrosDeCustoApi, type CentroDeCusto } from '../../../lib/api-client';
import { Dialogo } from './ui';

/* ── Centro de custo do serviço: o serviço escolhe onde lança as despesas ── */
export function CentroDoServico({ entityId, servicoId, slug, nomeServico, podeGerir }: {
  entityId: string; servicoId: string; slug: string; nomeServico: string; podeGerir: boolean;
}) {
  const [centros, setCentros] = useState<CentroDeCusto[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState('');
  const [aplicar, setAplicar] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(() => centrosDeCustoApi.listar(entityId).then(r => setCentros(r.itens)).catch(() => setCentros([])), [entityId]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 5000); return () => clearTimeout(t); }, [aviso]);

  if (!centros) return null;
  const atual = centros.find(c => c.servicos.some(s => s.id === servicoId));
  const ativos = centros.filter(c => c.ativo);

  const salvar = async () => {
    setSalvando(true); setErro('');
    try {
      const r = await centrosDeCustoApi.definirCentroDoServico(entityId, servicoId, { centroDeCustoId: escolha || null, slug, aplicarAntigos: aplicar });
      const n = r.ocorrencias + r.solicitacoes + r.pedidos + r.orcamentos;
      setAberto(false);
      setAviso(n ? `Centro de custo salvo. ${r.ocorrencias} ocorrências e ${r.solicitacoes + r.pedidos + r.orcamentos} itens de compra/orçamento acertados.` : 'Centro de custo salvo.');
      await carregar();
    } catch (e) { setErro(e instanceof ApiError ? e.body.message : 'Não foi possível salvar'); }
    finally { setSalvando(false); }
  };

  return (
    <>
      <div className={`sc-servico${atual ? '' : ' is-sem'}`}>
        <span className="sc-servico-rotulo">Centro de custo</span>
        {atual ? <><code>{atual.codigo}</code><span>{atual.nome}</span></> : <span>não definido — as despesas ficam sem apropriação</span>}
        {podeGerir && <button type="button" onClick={() => { setEscolha(atual?.id ?? ''); setErro(''); setAberto(true); }}>{atual ? 'trocar' : 'definir'}</button>}
        {aviso && <em role="status">{aviso}</em>}
      </div>
      {aberto && (
        <Dialogo titulo={`Centro de custo de ${nomeServico}`} subtitulo="Toda ocorrência e toda compra deste serviço nasce com este centro (dá para trocar em cada lançamento)."
          onFechar={() => setAberto(false)}
          acoes={<><button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setAberto(false)}>Cancelar</button>
            <button type="button" className="ob-acao is-aprovar" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button></>}>
          {ativos.length === 0 ? (
            <p className="sc-nota">Ainda não há centros de custo. <Link to={`/t/${entityId}/centros-de-custo`}>Cadastre em Centros de custo</Link>.</p>
          ) : (
            <div className="cc-form">
              <label className="cc-campo cc-largo"><span>Centro de custo</span>
                <select value={escolha} onChange={e => setEscolha(e.target.value)} autoFocus>
                  <option value="">Sem centro de custo</option>
                  {ativos.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
                </select>
              </label>
              <label className="sc-check cc-largo">
                <input type="checkbox" checked={aplicar} onChange={e => setAplicar(e.target.checked)} />
                <span>Acertar também o que já foi lançado deste serviço sem centro</span>
              </label>
            </div>
          )}
          {erro && <div className="ob-erro">{erro}</div>}
        </Dialogo>
      )}
    </>
  );
}
