import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { frotaApi } from '../../../lib/api-client';
import type { ItemFrota, ListaFrota, SituacaoFrota, TipoFrota } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import {
  Ajuda, Aviso, BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Pagina, Selinho, Sep, msgErro, rotaTenant, useResumoCadastros,
} from '../../components/sisobras/so';

const SITUACAO: Record<SituacaoFrota, { texto: string; tom: string }> = {
  EM_USO: { texto: 'Em uso', tom: 'mint' },
  NA_OFICINA: { texto: 'Na oficina', tom: 'amber' },
  PARADO: { texto: 'Parado', tom: '' },
};

interface Form { nome: string; subtipo: string; placa: string; patrimonio: string; equipeId: string }
const VAZIO: Form = { nome: '', subtipo: '', placa: '', patrimonio: '', equipeId: '' };

/** Tela 7 · Passo 4 — Veículos e equipamentos (opcional) */
export function VeiculosPage() {
  const { entityId } = useTenant();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const [params, setParams] = useSearchParams();
  const tipo: TipoFrota = params.get('aba') === 'equipamentos' ? 'EQUIPAMENTO' : 'VEICULO';
  const ehVeiculo = tipo === 'VEICULO';
  const [dados, setDados] = useState<ListaFrota | null>(null);
  const [filtro, setFiltro] = useState<'todos' | SituacaoFrota>('todos');
  const [editando, setEditando] = useState<ItemFrota | null>(null);
  const [form, setForm] = useState<Form>(VAZIO);
  const [erroNome, setErroNome] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try { setDados(await frotaApi.listar(entityId, tipo)); }
    catch (e) { showToast(msgErro(e, 'Não foi possível abrir a lista'), 'error'); }
  }, [entityId, tipo, showToast]);
  useEffect(() => { setDados(null); setEditando(null); setForm(VAZIO); setFiltro('todos'); carregar(); }, [carregar]);

  if (!dados) return <Pagina><Carregando /></Pagina>;

  const nomeTipo = ehVeiculo ? 'veículo' : 'equipamento';
  const qtd = (s: SituacaoFrota) => dados.itens.filter(i => i.situacao === s).length;
  const visiveis = dados.itens.filter(i => filtro === 'todos' || i.situacao === filtro);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  function abrir(i: ItemFrota | null) {
    setEditando(i); setErroNome(false);
    setForm(i ? { nome: i.nome, subtipo: i.subtipo ?? '', placa: i.placa ?? '', patrimonio: i.patrimonio ?? '', equipeId: i.equipe?.id ?? '' } : VAZIO);
  }

  async function salvar() {
    if (!form.nome.trim()) { setErroNome(true); showToast('Informe como a equipe chama', 'warning'); return; }
    setSalvando(true);
    const d = { tipo, nome: form.nome, subtipo: form.subtipo || null, placa: ehVeiculo ? form.placa || null : null, patrimonio: form.patrimonio || null, equipeId: ehVeiculo ? form.equipeId || null : null };
    try {
      if (editando) await frotaApi.atualizar(entityId, editando.id, d);
      else await frotaApi.criar(entityId, d);
      showToast(editando ? 'Salvo' : `${ehVeiculo ? 'Veículo' : 'Equipamento'} cadastrado`);
      abrir(null); await carregar(); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  async function remover(i: ItemFrota) {
    if (!window.confirm(`Tirar "${i.nome}" da lista?`)) return;
    try {
      const r = await frotaApi.remover(entityId, i.id);
      showToast(r.desativado ? 'Já foi usado em OS: ficou inativo e o histórico continua' : 'Removido', r.desativado ? 'warning' : 'success');
      abrir(null); await carregar(); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  const aba = (t: 'veiculos' | 'equipamentos') => { setParams(t === 'equipamentos' ? { aba: 'equipamentos' } : {}, { replace: true }); };

  return (
    <Pagina>
      <CabecalhoPasso passo={4} resumo={resumo} rotuloPlacar="passo · opcional"
        extras={<Selinho>opcional</Selinho>}
        sub={'Na baixa da OS, o fiscal escolhe daqui o que foi usado. Hoje essas listas ("Caminhão 01", "Roçadeira costal"…) estão escritas dentro de cada serviço; passam a vir deste cadastro.'} />

      <nav className="so-tabs" role="tablist" aria-label="Tipo de cadastro">
        <button type="button" role="tab" aria-selected={ehVeiculo} className={`so-tab${ehVeiculo ? ' on' : ''}`} onClick={() => aba('veiculos')}><Ic n="truck" />Veículos <span className="n">{dados.contagem.veiculos}</span></button>
        <button type="button" role="tab" aria-selected={!ehVeiculo} className={`so-tab${!ehVeiculo ? ' on' : ''}`} onClick={() => aba('equipamentos')}><Ic n="wrench" />Equipamentos <span className="n">{dados.contagem.equipamentos}</span></button>
      </nav>

      <div className="so-split">
        <Cartao className="grow so-rise" icone={ehVeiculo ? 'truck' : 'wrench'} titulo={ehVeiculo ? 'Veículos' : 'Equipamentos'} meta={<><span className="mono">{dados.itens.length}</span> cadastrados</>} ajuda={`Ajuda: ${ehVeiculo ? 'Veículos' : 'Equipamentos'}`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <div className="so-chips" style={{ marginRight: 'auto' }}>
              <button type="button" className={`so-chip${filtro === 'todos' ? ' on' : ''}`} onClick={() => setFiltro('todos')}>Todos <span className="n">{dados.itens.length}</span></button>
              {(['EM_USO', 'NA_OFICINA', 'PARADO'] as SituacaoFrota[]).map(s => (
                <button key={s} type="button" className={`so-chip${filtro === s ? ' on' : ''}`} onClick={() => setFiltro(s)}>{SITUACAO[s].texto} <span className="n">{qtd(s)}</span></button>
              ))}
            </div>
            <button type="button" className="so-btn so-primary" onClick={() => abrir(null)}><Ic n="plus" />Novo {nomeTipo}</button>
          </div>
          <div className="so-tw">
            <table className="so-table">
              <thead><tr><th scope="col">{ehVeiculo ? 'Veículo' : 'Equipamento'}</th><th scope="col">{ehVeiculo ? 'Placa / patrimônio' : 'Patrimônio'}</th>{ehVeiculo && <th scope="col">Equipe</th>}<th scope="col">Situação</th><th scope="col" className="r">Uso no mês</th></tr></thead>
              <tbody>
                {visiveis.map(i => {
                  const s = SITUACAO[i.situacao];
                  return (
                    <tr key={i.id} className={editando?.id === i.id ? 'sel' : ''}>
                      <td data-l={ehVeiculo ? 'Veículo' : 'Equipamento'}><button type="button" className="so-link-nome" onClick={() => abrir(i)}>{i.nome}</button><span className="sub">{i.subtipo ?? '—'}</span></td>
                      <td data-l="Placa / patrimônio" className="mono">{ehVeiculo ? `${i.placa ?? '—'} · ${i.patrimonio ?? '—'}` : i.patrimonio ?? '—'}</td>
                      {ehVeiculo && <td data-l="Equipe">{i.equipe?.nome ?? 'Uso geral'}</td>}
                      <td data-l="Situação"><span className={`so-badge ${s.tom}`}><span className="dot" />{s.texto}</span></td>
                      <td data-l="Uso no mês" className="r mono">{i.situacao === 'NA_OFICINA' && i.osOficina ? i.osOficina : `${i.usoMes} OS`}</td>
                    </tr>
                  );
                })}
                {!visiveis.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>Nada aqui ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </Cartao>

        <section className="so-panel side" aria-label={editando ? `Editar ${nomeTipo}` : `Novo ${nomeTipo}`} key={`${tipo}-${editando?.id ?? 'novo'}`}>
          <header className="so-chead">
            <span className="so-cic"><Ic n={editando ? 'editar' : 'plus'} /></span>
            <h2>{editando ? `Editar ${nomeTipo}` : `Novo ${nomeTipo}`}</h2>
            <div className="right"><Ajuda texto={`Ajuda: ${editando ? 'Editar' : 'Novo'} ${nomeTipo}`} />{editando && <button type="button" className="so-x" aria-label="Fechar" onClick={() => abrir(null)}><Ic n="x" /></button>}</div>
          </header>
          <div className="so-cbody">
            <label className="so-field"><span className="so-lbl">Tipo</span>
              <span className="so-ctrl"><input list={`tipos-${tipo}`} placeholder="Escolha ou escreva" value={form.subtipo} onChange={e => set('subtipo', e.target.value)} /></span>
              <datalist id={`tipos-${tipo}`}>{dados.tipos.map(t => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="so-field"><span className="so-lbl">Como a equipe chama <span className="req">*</span></span>
              <span className={`so-ctrl${erroNome ? ' invalid' : ''}`}><input type="text" placeholder={ehVeiculo ? 'Caminhão basculante 02' : 'Roçadeira costal 03'} value={form.nome} onChange={e => { set('nome', e.target.value); if (e.target.value.trim()) setErroNome(false); }} /></span>
            </label>
            <div className={ehVeiculo ? 'so-row2' : undefined}>
              {ehVeiculo && (
                <label className="so-field"><span className="so-lbl">Placa</span>
                  <span className="so-ctrl mono"><input type="text" placeholder="ABC1D23" value={form.placa} onChange={e => set('placa', e.target.value.toUpperCase())} /></span>
                </label>
              )}
              <label className="so-field"><span className="so-lbl">Patrimônio</span>
                <span className="so-ctrl mono"><input type="text" placeholder="0000" value={form.patrimonio} onChange={e => set('patrimonio', e.target.value)} /></span>
              </label>
            </div>
            {ehVeiculo && (
              <label className="so-field"><span className="so-lbl">Equipe que usa <span className="opt">opcional</span></span>
                <span className="so-ctrl"><select value={form.equipeId} onChange={e => set('equipeId', e.target.value)}><option value="">Nenhuma (uso geral)</option>{dados.equipes.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
              </label>
            )}
            <Aviso>A situação muda sozinha: fica <strong>Na oficina</strong> quando abrem uma OS de Oficina / Frota para ele e volta a <strong>Em uso</strong> quando ela é finalizada.</Aviso>
            <div className="so-pfoot">
              {editando && <button type="button" className="so-btn so-danger" style={{ marginRight: 'auto' }} onClick={() => remover(editando)}>Remover</button>}
              <button type="button" className="so-btn so-ghost" onClick={() => abrir(null)}>Cancelar</button>
              <button type="button" className="so-btn so-primary" disabled={salvando} onClick={salvar}><Ic n="check" />Salvar {nomeTipo}</button>
            </div>
          </div>
        </section>
      </div>

      <BarraAcoes esquerda={<><b>{dados.contagem.veiculos}</b> veículos<Sep /><b>{dados.contagem.equipamentos}</b> equipamentos<Sep />passo 4 de 6 · opcional</>}>
        <Link to={rotaTenant(entityId, 'cadastros/equipes')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Pessoas</Link>
        <Link to={rotaTenant(entityId, 'cadastros/centros-de-custo')} className="so-btn so-ghost">Pular este passo</Link>
        <Link to={rotaTenant(entityId, 'cadastros/centros-de-custo')} className="so-btn so-primary">Continuar: Centros de custo<Ic n="seta" className="arrow" /></Link>
      </BarraAcoes>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
