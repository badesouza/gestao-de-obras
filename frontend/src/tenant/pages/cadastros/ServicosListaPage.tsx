import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { servicosFichaApi } from '../../../lib/api-client';
import type { ServicoResumo, TipoServico } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import { AcoesLinha, Aviso, BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Pagina, Sep, msgErro, rotaTenant, useConfirmarExclusao, useResumoCadastros } from '../../components/sisobras/so';
import { ServicoJanela } from './ServicoJanela';
import { padroesDoServico } from './servico-padroes';

type Filtro = 'todos' | 'MANUTENCAO' | 'CONSTRUCAO' | 'sem-centro' | 'inativos';

/** Passo 7 — Serviços: a lista; cadastrar e editar abrem a janela em passos */
export function ServicosListaPage() {
  const { entityId } = useTenant();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const [servicos, setServicos] = useState<ServicoResumo[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [params, setParams] = useSearchParams();
  /* janela do serviço: id = editar; null = novo. ?abrir=<id> vem dos endereços antigos */
  const [janela, setJanela] = useState<{ id: string | null } | null>(() => (params.get('abrir') ? { id: params.get('abrir') } : null));
  const { confirmar, janelaExclusao } = useConfirmarExclusao();

  const carregar = useCallback(async () => {
    try { setServicos((await servicosFichaApi.listar(entityId)).servicos); }
    catch (e) { showToast(msgErro(e, 'Não foi possível abrir os serviços'), 'error'); setServicos([]); }
  }, [entityId, showToast]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!servicos) return <Pagina><Carregando /></Pagina>;

  // ficha nunca salva: mostra os padrões de hoje
  const vistos = servicos.map(s => {
    const p = padroesDoServico(s.id);
    return {
      ...s,
      cor: s.cor ?? p.cor,
      tipoServico: s.tipoServico ?? p.tipoServico,
      subtipos: s.fichaSalva ? s.subtipos : p.subtipos.length,
      municipePode: s.fichaSalva ? s.municipePode !== false : p.municipePode,
    };
  });
  const ativos = vistos.filter(s => s.ativo);
  const semCentro = ativos.filter(s => !s.centro).length;
  const visiveis = vistos.filter(s =>
    filtro === 'todos' ? s.ativo
      : filtro === 'inativos' ? !s.ativo
        : filtro === 'sem-centro' ? s.ativo && !s.centro
          : s.ativo && s.tipoServico === filtro);
  const qtdTipo = (t: TipoServico) => ativos.filter(s => s.tipoServico === t).length;

  function fecharJanela() {
    setJanela(null);
    if (params.get('abrir')) setParams({}, { replace: true });
  }

  function excluir(sv: { id: string; nome: string }) {
    confirmar({
      oque: 'serviço', nome: sv.nome,
      texto: 'Se o serviço já tiver OS, ele não é apagado (as OS iriam junto): fica inativo, some das listas novas e o histórico continua.',
      acao: async () => {
        try {
          const r = await servicosFichaApi.excluir(entityId, sv.id);
          showToast(r.desativado ? 'Tem OS: ficou inativo e o histórico continua' : 'Serviço excluído', r.desativado ? 'warning' : 'success');
          await carregar(); recarregar();
        } catch (e) { showToast(msgErro(e), 'error'); }
      },
    });
  }

  return (
    <Pagina>
      <CabecalhoPasso passo={7} resumo={resumo} sub="O que a secretaria faz. Tudo o que compõe um serviço fica aqui: centro de custo, campos comuns, equipamentos que pode usar e as ações com suas atividades." />

      <Aviso className="so-rise">Cada serviço tem <strong>ações</strong> e cada ação tem suas <strong>atividades</strong> — ex.: na Poda, a ação "Porte da árvore" tem Pequeno, Médio e Grande. Clique em <strong>Novo serviço</strong> ou no lápis para abrir a janela em 5 passos.</Aviso>

      <Cartao className="so-rise d1" icone="list" titulo="Lista de serviços"
        meta={<><span className="mono">{ativos.length}</span> serviços{semCentro > 0 && <> · <span style={{ color: 'var(--amber)', fontWeight: 800 }}>{semCentro} sem centro de custo</span></>}</>}
        ajuda="Ajuda: Serviços">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div className="so-chips" style={{ marginRight: 'auto' }}>
            <button type="button" className={`so-chip${filtro === 'todos' ? ' on' : ''}`} onClick={() => setFiltro('todos')}>Todos <span className="n">{ativos.length}</span></button>
            <button type="button" className={`so-chip${filtro === 'MANUTENCAO' ? ' on' : ''}`} onClick={() => setFiltro('MANUTENCAO')}>Manutenção <span className="n">{qtdTipo('MANUTENCAO')}</span></button>
            <button type="button" className={`so-chip${filtro === 'CONSTRUCAO' ? ' on' : ''}`} onClick={() => setFiltro('CONSTRUCAO')}>Construção <span className="n">{qtdTipo('CONSTRUCAO')}</span></button>
            {semCentro > 0 && <button type="button" className={`so-chip alert${filtro === 'sem-centro' ? ' on' : ''}`} onClick={() => setFiltro('sem-centro')}>Sem centro de custo <span className="n">{semCentro}</span></button>}
            {vistos.length > ativos.length && <button type="button" className={`so-chip${filtro === 'inativos' ? ' on' : ''}`} onClick={() => setFiltro('inativos')}>Inativos <span className="n">{vistos.length - ativos.length}</span></button>}
          </div>
          <button type="button" className="so-btn so-primary" onClick={() => setJanela({ id: null })}><Ic n="plus" />Novo serviço</button>
        </div>
        <div className="so-tw">
          <table className="so-table">
            <thead><tr><th scope="col">Serviço</th><th scope="col">Centro de custo</th><th scope="col" className="c">Ações</th><th scope="col" className="c">Quem atende</th><th scope="col" className="c">Munícipe pede?</th><th scope="col"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ações</span></th></tr></thead>
            <tbody>
              {visiveis.map(s => (
                <tr key={s.id}>
                  <td data-l="Serviço"><div className="nm"><span className="so-dotc" style={{ background: s.cor }} /><span><span className="strong">{s.nome}</span><span className="sub">{s.tipoServico === 'CONSTRUCAO' ? 'Construção' : 'Manutenção'} · {s.subtipos} tipos de serviço{!s.fichaSalva && ' · ainda não conferido'}</span></span></div></td>
                  <td data-l="Centro de custo">{s.centro ? <span style={{ fontWeight: 600 }}><span className="mono" style={{ fontSize: 11, color: 'var(--brand-ink)', fontWeight: 700 }}>{s.centro.codigo}</span> {s.centro.nome}</span> : <span className="so-badge amber"><span className="dot live" />Sem centro de custo</span>}</td>
                  <td data-l="Ações" className="c mono">{s.campos + 1}</td>
                  <td data-l="Quem atende" className="c mono">{s.pessoas}</td>
                  <td data-l="Munícipe pede?" className="c"><span className={`so-badge ${s.municipePode ? 'mint' : ''}`}>{s.municipePode ? 'Sim' : 'Não'}</span></td>
                  <td data-l="" className="acoes"><AcoesLinha nome={s.nome} onEditar={() => setJanela({ id: s.id })} onExcluir={s.ativo ? () => excluir(s) : undefined} /></td>
                </tr>
              ))}
              {!visiveis.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>Nenhum serviço aqui.</td></tr>}
            </tbody>
          </table>
        </div>
      </Cartao>

      {janela && (
        <ServicoJanela key={janela.id ?? 'novo'} servicoId={janela.id} showToast={showToast} onFechar={fecharJanela}
          onSalvo={() => { fecharJanela(); carregar(); recarregar(); }} />
      )}

      <BarraAcoes esquerda={<><b>{ativos.length}</b> serviços{semCentro > 0 && <><Sep /><span style={{ color: 'var(--amber)', fontWeight: 800 }}>{semCentro} sem centro de custo</span></>}<Sep />passo 7 de 7</>}>
        <Link to={rotaTenant(entityId, 'cadastros/centros-de-custo')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Centros de custo</Link>
        <Link to={rotaTenant(entityId, 'cadastros/fluxo')} className="so-btn so-primary">Concluir: Fluxo e aprovações<Ic n="seta" className="arrow" /></Link>
      </BarraAcoes>
      {janelaExclusao}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
