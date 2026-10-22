import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { frotaApi } from '../../../lib/api-client';
import type { ItemFrota, ListaFrota, SituacaoFrota, TipoFrota } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import {
  AcoesLinha, Aviso, BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Janela, Pagina, Selinho, Sep, msgErro, rotaTenant, useConfirmarExclusao, useResumoCadastros,
} from '../../components/sisobras/so';
import { TipoFrotaCampo } from './TipoFrotaCampo';
import { padroesDoServico } from './servico-padroes';

/* serviço sem cor salva: a mesma cor padrão da lista de Serviços */
const corDoServico = (sv: { id: string; cor: string | null }) => sv.cor ?? padroesDoServico(sv.id).cor ?? 'var(--brand)';

const SITUACAO: Record<SituacaoFrota, { texto: string; tom: string }> = {
  EM_USO: { texto: 'Em uso', tom: 'mint' },
  NA_OFICINA: { texto: 'Na oficina', tom: 'amber' },
  PARADO: { texto: 'Parado', tom: '' },
};

interface Form { nome: string; tipoFrotaId: string; placa: string; patrimonio: string; equipeId: string; servicoIds: string[] }
const VAZIO: Form = { nome: '', tipoFrotaId: '', placa: '', patrimonio: '', equipeId: '', servicoIds: [] };

/** Passo 4 — Veículos, cada um ligado aos serviços que atende. O endereço antigo ?aba=equipamentos vai para o passo 5. */
export function VeiculosPage() {
  const [params] = useSearchParams();
  if (params.get('aba') === 'equipamentos') return <Navigate to="../equipamentos" relative="path" replace />;
  return <FrotaPage tipo="VEICULO" />;
}

/** Passo 5 — Equipamentos, cada um ligado aos serviços que o usam */
export function EquipamentosPage() {
  return <FrotaPage tipo="EQUIPAMENTO" />;
}

function FrotaPage({ tipo }: { tipo: TipoFrota }) {
  const { entityId } = useTenant();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const ehVeiculo = tipo === 'VEICULO';
  const [dados, setDados] = useState<ListaFrota | null>(null);
  const [filtro, setFiltro] = useState<'todos' | SituacaoFrota>('todos');
  const [editando, setEditando] = useState<ItemFrota | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [erroNome, setErroNome] = useState(false);
  const [erroServicos, setErroServicos] = useState(false);
  const [erroTipo, setErroTipo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { confirmar, janelaExclusao } = useConfirmarExclusao();

  const carregar = useCallback(async () => {
    try { setDados(await frotaApi.listar(entityId, tipo)); }
    catch (e) { showToast(msgErro(e, 'Não foi possível abrir a lista'), 'error'); }
  }, [entityId, tipo, showToast]);
  useEffect(() => { setDados(null); setEditando(null); setAberto(false); setForm(VAZIO); setFiltro('todos'); carregar(); }, [carregar]);

  if (!dados) return <Pagina><Carregando /></Pagina>;

  const nomeTipo = ehVeiculo ? 'veículo' : 'equipamento';
  const qtd = (s: SituacaoFrota) => dados.itens.filter(i => i.situacao === s).length;
  const semServico = dados.itens.filter(i => !i.servicos.length).length;
  const visiveis = dados.itens.filter(i => filtro === 'todos' || i.situacao === filtro);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  function fechar() { setAberto(false); setEditando(null); }
  function abrir(i: ItemFrota | null) {
    setEditando(i); setErroNome(false); setErroServicos(false); setErroTipo(false); setAberto(true);
    setForm(i ? { nome: i.nome, tipoFrotaId: i.tipo?.id ?? '', placa: i.placa ?? '', patrimonio: i.patrimonio ?? '', equipeId: i.equipe?.id ?? '', servicoIds: i.servicos.map(x => x.id) } : VAZIO);
  }
  function marcarServico(id: string) {
    setErroServicos(false);
    setForm(f => ({ ...f, servicoIds: f.servicoIds.includes(id) ? f.servicoIds.filter(x => x !== id) : [...f.servicoIds, id] }));
  }

  async function salvar() {
    if (!form.tipoFrotaId) { setErroTipo(true); showToast('Escolha o tipo', 'warning'); return; }
    if (!form.nome.trim()) { setErroNome(true); showToast('Informe como a equipe chama', 'warning'); return; }
    if (!form.servicoIds.length) { setErroServicos(true); showToast('Marque ao menos um serviço que usa', 'warning'); return; }
    setSalvando(true);
    const d = { tipo, nome: form.nome, subtipo: editando?.subtipo ?? null, tipoFrotaId: form.tipoFrotaId, placa: ehVeiculo ? form.placa || null : null, patrimonio: form.patrimonio || null, equipeId: ehVeiculo ? form.equipeId || null : null, servicoIds: form.servicoIds };
    try {
      if (editando) await frotaApi.atualizar(entityId, editando.id, d);
      else await frotaApi.criar(entityId, d);
      showToast(editando ? 'Salvo' : `${ehVeiculo ? 'Veículo' : 'Equipamento'} cadastrado`);
      fechar(); await carregar(); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  function remover(i: ItemFrota) {
    confirmar({
      oque: nomeTipo, nome: i.nome,
      texto: 'Se já foi usado em alguma OS, não é apagado: fica inativo e o histórico continua.',
      acao: () => excluir(i),
    });
  }
  async function excluir(i: ItemFrota) {
    try {
      const r = await frotaApi.remover(entityId, i.id);
      showToast(r.desativado ? 'Já foi usado em OS: ficou inativo e o histórico continua' : 'Excluído', r.desativado ? 'warning' : 'success');
      fechar(); await carregar(); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  return (
    <Pagina>
      <CabecalhoPasso passo={ehVeiculo ? 4 : 5} resumo={resumo}
        extras={semServico > 0 ? <Selinho tom="amber" ponto>{semServico} sem serviço</Selinho> : undefined}
        sub={ehVeiculo
          ? 'Caminhões, caminhonetes e máquinas da frota. Cada veículo é ligado aos serviços que atende; na baixa da OS, o fiscal escolhe daqui o veículo usado.'
          : 'Roçadeiras, motosserras, compactadores… Cada equipamento é ligado aos serviços que o usam; na baixa da OS, o fiscal escolhe daqui.'} />

      <Cartao className="so-rise" icone={ehVeiculo ? 'truck' : 'engrenagem'} titulo={ehVeiculo ? 'Veículos' : 'Equipamentos'} meta={<><span className="mono">{dados.itens.length}</span> cadastrados</>} ajuda={`Ajuda: ${ehVeiculo ? 'Veículos' : 'Equipamentos'}`}>
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
              <thead><tr><th scope="col">{ehVeiculo ? 'Veículo' : 'Equipamento'}</th><th scope="col">{ehVeiculo ? 'Placa / patrimônio' : 'Patrimônio'}</th><th scope="col">Serviços que usam</th>{ehVeiculo && <th scope="col">Equipe</th>}<th scope="col">Situação</th><th scope="col" className="r">Uso no mês</th><th scope="col"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ações</span></th></tr></thead>
              <tbody>
                {visiveis.map(i => {
                  const s = SITUACAO[i.situacao];
                  return (
                    <tr key={i.id} className={editando?.id === i.id ? 'sel' : ''}>
                      <td data-l={ehVeiculo ? 'Veículo' : 'Equipamento'}><button type="button" className="so-link-nome" onClick={() => abrir(i)}>{i.nome}</button><span className="sub">{i.tipo?.nome ?? i.subtipo ?? '—'}</span></td>
                      <td data-l="Placa / patrimônio" className="mono">{ehVeiculo ? `${i.placa ?? '—'} · ${i.patrimonio ?? '—'}` : i.patrimonio ?? '—'}</td>
                      <td data-l="Serviços que usam">{i.servicos.length
                        ? <span className="so-frota-servs">{i.servicos.map(sv => <span key={sv.id} className="so-frota-serv"><i style={{ background: corDoServico(sv) }} />{sv.nome}</span>)}</span>
                        : <span className="so-badge amber"><span className="dot" />Sem serviço</span>}</td>
                      {ehVeiculo && <td data-l="Equipe">{i.equipe?.nome ?? 'Uso geral'}</td>}
                      <td data-l="Situação"><span className={`so-badge ${s.tom}`}><span className="dot" />{s.texto}</span></td>
                      <td data-l="Uso no mês" className="r mono">{i.situacao === 'NA_OFICINA' && i.osOficina ? i.osOficina : `${i.usoMes} OS`}</td>
                      <td data-l="" className="acoes"><AcoesLinha nome={i.nome} onEditar={() => abrir(i)} onExcluir={() => remover(i)} /></td>
                    </tr>
                  );
                })}
                {!visiveis.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>Nada aqui ainda.</td></tr>}
              </tbody>
            </table>
          </div>
      </Cartao>

      {aberto && (
        <Janela key={`${tipo}-${editando?.id ?? 'novo'}`} icone={editando ? 'editar' : ehVeiculo ? 'truck' : 'engrenagem'}
          eyebrow={`Cadastros · ${ehVeiculo ? 'veículos' : 'equipamentos'}`}
          titulo={editando ? `Editar ${editando.nome}` : `Novo ${nomeTipo}`}
          sub="Ligue aos serviços que usam. Na baixa da OS, o fiscal escolhe daqui o que foi usado."
          largura={620} onFechar={fechar} ajuda={`Ajuda: ${editando ? 'Editar' : 'Novo'} ${nomeTipo}`}
          rodape={<>
            {editando && <button type="button" className="so-btn so-danger esq" onClick={() => remover(editando)}><Ic n="lixeira" />Excluir</button>}
            <button type="button" className="so-btn so-ghost" onClick={fechar}>Cancelar</button>
            <button type="button" className="so-btn so-primary" disabled={salvando} onClick={salvar}><Ic n="check" />Salvar {nomeTipo}</button>
          </>}>
          <TipoFrotaCampo tipos={dados.tiposFrota} valor={form.tipoFrotaId} invalido={erroTipo} showToast={showToast} confirmar={confirmar}
            onEscolher={id => { set('tipoFrotaId', id); if (id) setErroTipo(false); }}
            onTipos={t => setDados(d => (d ? { ...d, tiposFrota: t } : d))} />
          <div className="so-row2">
            <label className="so-field"><span className="so-lbl">Como a equipe chama <span className="req">*</span></span>
              <span className={`so-ctrl${erroNome ? ' invalid' : ''}`}><input type="text" placeholder={ehVeiculo ? 'Caminhão basculante 02' : 'Roçadeira costal 03'} value={form.nome} onChange={e => { set('nome', e.target.value); if (e.target.value.trim()) setErroNome(false); }} /></span>
            </label>
            {ehVeiculo ? (
              <label className="so-field"><span className="so-lbl">Placa</span>
                <span className="so-ctrl mono"><input type="text" placeholder="ABC1D23" value={form.placa} onChange={e => set('placa', e.target.value.toUpperCase())} /></span>
              </label>
            ) : (
              <label className="so-field"><span className="so-lbl">Patrimônio</span>
                <span className="so-ctrl mono"><input type="text" placeholder="0000" value={form.patrimonio} onChange={e => set('patrimonio', e.target.value)} /></span>
              </label>
            )}
          </div>
          {ehVeiculo && (
            <div className="so-row2">
              <label className="so-field"><span className="so-lbl">Patrimônio</span>
                <span className="so-ctrl mono"><input type="text" placeholder="0000" value={form.patrimonio} onChange={e => set('patrimonio', e.target.value)} /></span>
              </label>
              <label className="so-field"><span className="so-lbl">Equipe que usa <span className="opt">opcional</span></span>
                <span className="so-ctrl"><select value={form.equipeId} onChange={e => set('equipeId', e.target.value)}><option value="">Nenhuma (uso geral)</option>{dados.equipes.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
              </label>
            </div>
          )}
          <div className="so-field">
            <span className="so-lbl">Serviços que usam <span className="req">*</span>
              <span className="opt">{form.servicoIds.length} de {dados.servicos.length} marcados</span>
              <button type="button" className="so-frota-todos" onClick={() => { setErroServicos(false); set('servicoIds', form.servicoIds.length === dados.servicos.length ? [] : dados.servicos.map(x => x.id)); }}>
                {form.servicoIds.length === dados.servicos.length ? 'Limpar' : 'Marcar todos'}
              </button>
            </span>
            <div className={`so-chips so-frota-escolha${erroServicos ? ' invalid' : ''}`}>
              {dados.servicos.map(sv => (
                <button key={sv.id} type="button" className={`so-chip${form.servicoIds.includes(sv.id) ? ' on' : ''}`} aria-pressed={form.servicoIds.includes(sv.id)} onClick={() => marcarServico(sv.id)}>
                  <i className="cor" style={{ background: corDoServico(sv) }} />{sv.nome}
                  {form.servicoIds.includes(sv.id) && <Ic n="check" />}
                </button>
              ))}
              {!dados.servicos.length && <span className="so-help">Nenhum serviço cadastrado ainda (passo 7).</span>}
            </div>
            {erroServicos && <span className="so-help" style={{ color: 'var(--coral)', fontWeight: 700 }}>Marque ao menos um serviço.</span>}
          </div>
          {ehVeiculo
            ? <Aviso>A situação muda sozinha: fica <strong>Na oficina</strong> quando abrem uma OS de Oficina / Frota para ele e volta a <strong>Em uso</strong> quando ela é finalizada.</Aviso>
            : <Aviso>O mesmo vínculo aparece na ficha de cada serviço (Cadastros › Serviços): marcar aqui ou lá dá no mesmo.</Aviso>}
        </Janela>
      )}
      {ehVeiculo ? (
        <BarraAcoes esquerda={<><b>{dados.contagem.veiculos}</b> veículos<Sep />passo 4 de 7</>}>
          <Link to={rotaTenant(entityId, 'cadastros/equipes')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Pessoas</Link>
          <Link to={rotaTenant(entityId, 'cadastros/equipamentos')} className="so-btn so-primary">Continuar: Equipamentos<Ic n="seta" className="arrow" /></Link>
        </BarraAcoes>
      ) : (
        <BarraAcoes esquerda={<><b>{dados.contagem.equipamentos}</b> equipamentos<Sep />passo 5 de 7</>}>
          <Link to={rotaTenant(entityId, 'cadastros/veiculos')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Veículos</Link>
          <Link to={rotaTenant(entityId, 'cadastros/centros-de-custo')} className="so-btn so-primary">Continuar: Centros de custo<Ic n="seta" className="arrow" /></Link>
        </BarraAcoes>
      )}
      {janelaExclusao}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
