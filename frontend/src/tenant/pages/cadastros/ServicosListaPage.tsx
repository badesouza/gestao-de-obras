import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { servicosFichaApi } from '../../../lib/api-client';
import type { ServicoResumo, TipoServico } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import { Aviso, BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Pagina, Sep, msgErro, rotaTenant, useResumoCadastros } from '../../components/sisobras/so';
import { padroesDoServico } from './servico-padroes';

type Filtro = 'todos' | 'MANUTENCAO' | 'CONSTRUCAO' | 'sem-centro' | 'inativos';

/** Tela 9 · Passo 6 — Serviços (lista) */
export function ServicosListaPage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const [servicos, setServicos] = useState<ServicoResumo[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [novo, setNovo] = useState<{ nome: string; tipo: TipoServico } | null>(null);

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

  async function criar() {
    if (!novo || novo.nome.trim().length < 2) { showToast('Informe o nome do serviço', 'warning'); return; }
    try {
      const r = await servicosFichaApi.criar(entityId, novo.nome, novo.tipo);
      recarregar();
      navigate(rotaTenant(entityId, `cadastros/servicos/${r.id}`));
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  return (
    <Pagina>
      <CabecalhoPasso passo={6} resumo={resumo} sub="O que a secretaria faz. Cada serviço tem uma ficha: centro de custo, contratos, quem atende e o que o fiscal preenche." />

      <Aviso className="so-rise">Hoje todo serviço repete os mesmos campos (bairro, endereço, origem, equipe, status). Agora eles vêm <strong>sozinhos em toda OS</strong>, e cada ficha guarda só o que é <strong>daquele serviço</strong> — por exemplo, "tipo de luminária" na Iluminação.</Aviso>

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
          <button type="button" className="so-btn so-primary" onClick={() => setNovo({ nome: '', tipo: 'MANUTENCAO' })}><Ic n="plus" />Novo serviço</button>
        </div>
        {novo && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: 10, borderRadius: 12, border: '1px dashed var(--line-2)', background: 'var(--surface-2)' }}>
            <span className="so-ctrl" style={{ flex: '1 1 240px' }}><input autoFocus placeholder="Nome do serviço (ex.: Drenagem)" value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') criar(); if (e.key === 'Escape') setNovo(null); }} /></span>
            <div className="so-seg">
              <label className={novo.tipo === 'MANUTENCAO' ? 'on' : ''}><input type="radio" name="tipoNovo" checked={novo.tipo === 'MANUTENCAO'} onChange={() => setNovo({ ...novo, tipo: 'MANUTENCAO' })} /> Manutenção</label>
              <label className={novo.tipo === 'CONSTRUCAO' ? 'on' : ''}><input type="radio" name="tipoNovo" checked={novo.tipo === 'CONSTRUCAO'} onChange={() => setNovo({ ...novo, tipo: 'CONSTRUCAO' })} /> Construção</label>
            </div>
            <button type="button" className="so-btn so-primary" onClick={criar}><Ic n="check" />Criar e abrir a ficha</button>
            <button type="button" className="so-btn so-ghost" onClick={() => setNovo(null)}>Cancelar</button>
          </div>
        )}
        <div className="so-tw">
          <table className="so-table">
            <thead><tr><th scope="col">Serviço</th><th scope="col">Centro de custo</th><th scope="col" className="c">Contratos</th><th scope="col" className="c">Quem atende</th><th scope="col" className="c">Munícipe pede?</th><th scope="col"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ações</span></th></tr></thead>
            <tbody>
              {visiveis.map(s => (
                <tr key={s.id}>
                  <td data-l="Serviço"><div className="nm"><span className="so-dotc" style={{ background: s.cor }} /><span><span className="strong">{s.nome}</span><span className="sub">{s.tipoServico === 'CONSTRUCAO' ? 'Construção' : 'Manutenção'} · {s.subtipos} subtipos{!s.fichaSalva && ' · ficha ainda não salva'}</span></span></div></td>
                  <td data-l="Centro de custo">{s.centro ? <span style={{ fontWeight: 600 }}><span className="mono" style={{ fontSize: 11, color: 'var(--brand-ink)', fontWeight: 700 }}>{s.centro.codigo}</span> {s.centro.nome}</span> : <span className="so-badge amber"><span className="dot live" />Sem centro de custo</span>}</td>
                  <td data-l="Contratos" className="c mono">{s.contratos}</td>
                  <td data-l="Quem atende" className="c mono">{s.pessoas}</td>
                  <td data-l="Munícipe pede?" className="c"><span className={`so-badge ${s.municipePode ? 'mint' : ''}`}>{s.municipePode ? 'Sim' : 'Não'}</span></td>
                  <td data-l="" className="r"><Link to={rotaTenant(entityId, `cadastros/servicos/${s.id}`)} className="so-btn so-ghost sm">Abrir ficha<Ic n="seta" className="arrow" /></Link></td>
                </tr>
              ))}
              {!visiveis.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>Nenhum serviço aqui.</td></tr>}
            </tbody>
          </table>
        </div>
      </Cartao>

      <BarraAcoes esquerda={<><b>{ativos.length}</b> serviços{semCentro > 0 && <><Sep /><span style={{ color: 'var(--amber)', fontWeight: 800 }}>{semCentro} sem centro de custo</span></>}<Sep />passo 6 de 6</>}>
        <Link to={rotaTenant(entityId, 'cadastros/centros-de-custo')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Centros de custo</Link>
        <Link to={rotaTenant(entityId, 'configuracoes')} className="so-btn so-primary">Concluir: Fluxo e aprovações<Ic n="seta" className="arrow" /></Link>
      </BarraAcoes>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
