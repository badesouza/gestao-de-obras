import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, contratosApi, tenantApi, type TipoLicitacao } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { TIPOS } from '../components/obras/licitacao-tipos';
import { CamposProcesso } from '../components/obras/CamposProcesso';
import '../styles/compras-ui.css';
import '../styles/orcamento.css';
import '../styles/licitacao.css';

/* ── Nova licitação: dados do processo; os contratos vêm em seguida ── */
export function LicitacaoCreatePage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const [identificacao, setIdentificacao] = useState('');
  const [objeto, setObjeto] = useState('');
  const [pa, setPa] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [tipo, setTipo] = useState<TipoLicitacao | ''>('');
  const [homologacao, setHomologacao] = useState('');
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { contratosApi.modalidades(entityId).then(r => setModalidades(r.modalidades)).catch(() => {}); }, [entityId]);

  const salvar = async () => {
    if (!identificacao.trim()) return setErro('Informe o número da licitação.');
    if (objeto.trim().length < 3) return setErro('Descreva o objeto da licitação.');
    setSalvando(true); setErro('');
    try {
      const l = await tenantApi.licitacoes.create(entityId, {
        identificacao: identificacao.trim(), objeto: objeto.trim(),
        numeroProcesso: pa.trim() || null, modalidade: modalidade || null, tipo: tipo || null, dataHomologacao: homologacao || null,
      });
      navigate(`/t/${entityId}/licitacoes/${l.id}?novoContrato=1`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.body.message : 'Não foi possível salvar');
      setSalvando(false);
    }
  };

  const cor = tipo ? TIPOS[tipo].cor : '#2563EB';
  return (
    <div className="ob-page ob-claro lc-pagina" style={{ '--serv-cor': cor } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/></svg>
          </span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv"><Link to={`/t/${entityId}/licitacoes`} className="or-voltar">← Licitações</Link></span>
            <h1 className="ob-h1">Nova licitação</h1>
            <p className="ob-sub">Primeiro os dados do processo. Em seguida você lança os contratos, com o fornecedor, a vigência, os lotes e os itens.</p>
          </div>
        </div>
      </header>

      <section className="ob-card or-secao ob-reveal lc-nova" style={{ '--i': 1 } as React.CSSProperties}>
        <CamposProcesso {...{ identificacao, setIdentificacao, objeto, setObjeto, pa, setPa, modalidade, setModalidade, tipo, setTipo, homologacao, setHomologacao, modalidades }} />
        {erro && <div className="ob-erro">{erro}</div>}
        <div className="lc-nova-acoes">
          <Link to={`/t/${entityId}/licitacoes`} className="ob-btn-ghost ob-btn-alto">Cancelar</Link>
          <button type="button" className="ob-btn" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar e lançar o contrato →'}</button>
        </div>
      </section>
    </div>
  );
}
