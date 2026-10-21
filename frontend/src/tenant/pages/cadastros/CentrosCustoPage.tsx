import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { centrosDeCustoApi, frotaApi, pessoasApi } from '../../../lib/api-client';
import type { CentroDeCusto, TipoCentroDeCusto } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import {
  Ajuda, Aviso, BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Pagina, Sep, msgErro, rotaTenant, useResumoCadastros,
} from '../../components/sisobras/so';

const TIPOS: { code: TipoCentroDeCusto; nome: string; tom: string }[] = [
  { code: 'SECRETARIA', nome: 'Secretaria', tom: 'ink' },
  { code: 'SETOR', nome: 'Setor', tom: 'brand' },
  { code: 'PROGRAMA', nome: 'Programa', tom: 'cyan' },
  { code: 'OBRA', nome: 'Obra', tom: 'amber' },
  { code: 'OUTRO', nome: 'Outro', tom: '' },
];

interface Form { codigo: string; nome: string; tipo: TipoCentroDeCusto; paiId: string; responsavel: string }

/** Árvore: cada centro seguido dos que ficam dentro dele */
function emArvore(itens: CentroDeCusto[]) {
  const porPai = new Map<string | null, CentroDeCusto[]>();
  itens.forEach(c => { const k = c.paiId && itens.some(x => x.id === c.paiId) ? c.paiId : null; porPai.set(k, [...(porPai.get(k) ?? []), c]); });
  const out: { c: CentroDeCusto; nivel: number }[] = [];
  const andar = (pai: string | null, nivel: number) => {
    (porPai.get(pai) ?? []).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })).forEach(c => { out.push({ c, nivel }); andar(c.id, nivel + 1); });
  };
  andar(null, 0);
  return out;
}

/** Tela 8 · Passo 5 — Centros de custo */
export function CentrosCustoPage() {
  const { entityId } = useTenant();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const [itens, setItens] = useState<CentroDeCusto[] | null>(null);
  const [semCentro, setSemCentro] = useState<{ id: string; nome: string }[]>([]);
  const [pessoas, setPessoas] = useState<string[]>([]);
  const [editando, setEditando] = useState<CentroDeCusto | null>(null);
  const [form, setForm] = useState<Form>({ codigo: '', nome: '', tipo: 'SETOR', paiId: '', responsavel: '' });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([centrosDeCustoApi.listar(entityId), frotaApi.servicosSemCentro(entityId)]);
      setItens(l.itens.filter(c => c.ativo)); setSemCentro(p.servicosSemCentro);
    } catch (e) { showToast(msgErro(e, 'Não foi possível abrir os centros de custo'), 'error'); setItens([]); }
  }, [entityId, showToast]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { pessoasApi.listar(entityId).then(d => setPessoas(d.usuarios.filter(u => u.situacao !== 'INATIVO').map(u => u.nome))).catch(() => setPessoas([])); }, [entityId]);

  const arvore = useMemo(() => emArvore(itens ?? []), [itens]);
  const topo = arvore.find(x => x.nivel === 0 && x.c.tipo === 'SECRETARIA')?.c ?? null;

  const proximoCodigo = useCallback((paiId: string) => {
    const pai = itens?.find(c => c.id === paiId);
    if (!pai) return '';
    const filhos = (itens ?? []).filter(c => c.paiId === pai.id).map(c => Number(c.codigo.split('.').pop())).filter(n => !Number.isNaN(n));
    return `${pai.codigo}.${String((filhos.length ? Math.max(...filhos) : 0) + 1).padStart(2, '0')}`;
  }, [itens]);

  function novo() {
    setEditando(null);
    const paiId = topo?.id ?? '';
    setForm({ codigo: paiId ? proximoCodigo(paiId) : '', nome: '', tipo: 'SETOR', paiId, responsavel: '' });
  }
  useEffect(() => { if (itens && !editando && !form.nome && !form.codigo) novo(); /* primeira carga */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens]);

  if (!itens) return <Pagina><Carregando /></Pagina>;

  function abrir(c: CentroDeCusto) {
    setEditando(c);
    setForm({ codigo: c.codigo, nome: c.nome, tipo: c.tipo, paiId: c.paiId ?? '', responsavel: c.responsavel ?? '' });
  }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  async function salvar() {
    if (!form.codigo.trim() || !form.nome.trim()) { showToast('Informe o código e o nome', 'warning'); return; }
    setSalvando(true);
    const d = { codigo: form.codigo.trim(), nome: form.nome.trim(), tipo: form.tipo, paiId: form.paiId || null, responsavel: form.responsavel.trim() || null };
    try {
      if (editando) await centrosDeCustoApi.atualizar(entityId, editando.id, { ...d, descricao: editando.descricao, ativo: true });
      else await centrosDeCustoApi.criar(entityId, d);
      showToast(editando ? 'Centro salvo' : 'Centro criado');
      setEditando(null); setForm({ codigo: '', nome: '', tipo: 'SETOR', paiId: '', responsavel: '' });
      await carregar(); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  async function remover(c: CentroDeCusto) {
    if (!window.confirm(`Tirar "${c.codigo} ${c.nome}" da estrutura?`)) return;
    try {
      const r = await centrosDeCustoApi.remover(entityId, c.id);
      showToast(r.desativado ? 'Já recebeu lançamento: foi desativado e some das listas novas' : 'Centro removido', r.desativado ? 'warning' : 'success');
      setEditando(null); await carregar(); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  async function estrutura() {
    const codigo = window.prompt('Código da secretaria (o topo da estrutura):', topo?.codigo ?? '02');
    if (!codigo) return;
    const nome = window.prompt('Nome da secretaria:', topo?.nome ?? 'Secretaria de Infraestrutura');
    if (!nome) return;
    try {
      const r = await centrosDeCustoApi.estruturaSugerida(entityId, { codigoSecretaria: codigo, nomeSecretaria: nome });
      showToast(r.criados.length ? `${r.criados.length} centros criados` : 'A estrutura sugerida já estava montada');
      await carregar(); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  const nomesSem = semCentro.map(s => s.nome);
  const listaSem = nomesSem.length > 1 ? `${nomesSem.slice(0, -1).join(', ')} e ${nomesSem[nomesSem.length - 1]}` : nomesSem[0];
  const opcoesPai = arvore.filter(x => x.c.id !== editando?.id);

  return (
    <Pagina>
      <CabecalhoPasso passo={5} resumo={resumo} sub="Para onde vai o gasto de cada OS e de cada compra. Aqui você só cria os centros — quem escolhe o centro é o serviço, no passo 6." />

      {semCentro.length > 0 && (
        <div className="so-note amber row so-rise" role="status">
          <Ic n="alerta" />
          <span style={{ flex: '1 1 360px' }}><strong>{semCentro.length} {semCentro.length === 1 ? 'serviço ainda sem' : 'serviços ainda sem'} centro de custo:</strong> {listaSem}. O que for lançado neles fica sem destino no relatório de gastos.</span>
          <Link to={rotaTenant(entityId, 'cadastros/servicos')} className="so-btn so-amberbtn acts">Resolver no passo 6<Ic n="seta" className="arrow" /></Link>
        </div>
      )}

      <div className="so-split">
        <Cartao className="grow so-rise d1" icone="layers" titulo="Estrutura" meta={<><span className="mono">{itens.length}</span> centros</>} ajuda="Ajuda: Estrutura"
          direita={<>
            <button type="button" className="so-btn so-ghost sm" onClick={estrutura}>Montar estrutura sugerida</button>
            <button type="button" className="so-btn so-primary sm" onClick={novo}><Ic n="plus" />Novo centro</button>
          </>}>
          <div className="so-tw">
            <table className="so-table">
              <thead><tr><th scope="col">Código</th><th scope="col">Centro de custo</th><th scope="col">Tipo</th><th scope="col">Serviços que lançam aqui</th></tr></thead>
              <tbody>
                {arvore.map(({ c, nivel }) => {
                  const t = TIPOS.find(x => x.code === c.tipo);
                  return (
                    <tr key={c.id} className={editando?.id === c.id ? 'sel' : ''}>
                      <td data-l="Código" className="mono" style={{ whiteSpace: 'nowrap' }}>{c.codigo}</td>
                      <td data-l="Centro de custo">
                        <div className="nm" style={{ paddingLeft: nivel * 14 }}>
                          {nivel > 0 && <span className="mono" aria-hidden="true" style={{ color: 'var(--line-2)', fontSize: 14, lineHeight: 1 }}>└</span>}
                          <span style={{ minWidth: 0 }}><button type="button" className="so-link-nome" onClick={() => abrir(c)}>{c.nome}</button>{c.responsavel && <span className="sub">resp.: {c.responsavel}</span>}</span>
                        </div>
                      </td>
                      <td data-l="Tipo"><span className={`so-badge ${t?.tom ?? ''}`}>{t?.nome ?? c.tipo}</span></td>
                      <td data-l="Serviços">
                        <div className="so-tags">
                          {c.servicos.map(s => <span key={s.id} className="so-tag">{s.nome}</span>)}
                          {!c.servicos.length && <span style={{ fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic' }}>{nivel === 0 ? 'soma tudo que está dentro' : 'lançado direto na OS ou no pedido'}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!arvore.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>Nenhum centro ainda. Use "Montar estrutura sugerida" ou "Novo centro".</td></tr>}
              </tbody>
            </table>
          </div>
          <Aviso tom="plain">Centro que já recebeu lançamento não é apagado: é desativado e some das listas novas.</Aviso>
        </Cartao>

        <section className="so-panel side" aria-label={editando ? 'Editar centro de custo' : 'Novo centro de custo'} key={editando?.id ?? 'novo'}>
          <header className="so-chead">
            <span className="so-cic"><Ic n={editando ? 'editar' : 'plus'} /></span>
            <h2>{editando ? 'Editar centro de custo' : 'Novo centro de custo'}</h2>
            <div className="right"><Ajuda texto="Ajuda: Centro de custo" />{editando && <button type="button" className="so-x" aria-label="Fechar" onClick={novo}><Ic n="x" /></button>}</div>
          </header>
          <div className="so-cbody">
            <div style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: 10 }}>
              <label className="so-field"><span className="so-lbl">Código</span><span className="so-ctrl mono"><input type="text" value={form.codigo} onChange={e => set('codigo', e.target.value)} /></span></label>
              <label className="so-field"><span className="so-lbl">Nome</span><span className="so-ctrl"><input type="text" placeholder="Praças e Áreas Verdes" value={form.nome} onChange={e => set('nome', e.target.value)} /></span></label>
            </div>
            <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0, gap: 7 }}>
              <legend className="so-lbl" style={{ marginBottom: 6 }}>Tipo</legend>
              <div className="so-seg">
                {TIPOS.map(t => <label key={t.code} className={form.tipo === t.code ? 'on' : ''}><input type="radio" name="tipo" checked={form.tipo === t.code} onChange={() => set('tipo', t.code)} /> {t.nome}</label>)}
              </div>
              <p className="so-help">Use <strong style={{ color: 'var(--ink)' }}>Obra</strong> para uma obra com dinheiro próprio (convênio, emenda) e ver o gasto dela separado.</p>
            </fieldset>
            <label className="so-field"><span className="so-lbl">Fica dentro de</span>
              <span className="so-ctrl"><select value={form.paiId} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, paiId: v, codigo: !editando && v ? proximoCodigo(v) : f.codigo })); }}>
                <option value="">Nenhum (é o topo)</option>
                {opcoesPai.map(({ c, nivel }) => <option key={c.id} value={c.id}>{'  '.repeat(nivel)}{c.codigo} · {c.nome}</option>)}
              </select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
            </label>
            <label className="so-field"><span className="so-lbl">Responsável <span className="opt">opcional</span></span>
              <span className="so-ctrl"><input list="cc-responsaveis" placeholder="Ninguém" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} /></span>
              <datalist id="cc-responsaveis">{pessoas.map(p => <option key={p} value={p} />)}</datalist>
            </label>
            <div className="so-pfoot">
              {editando && <button type="button" className="so-btn so-danger" style={{ marginRight: 'auto' }} onClick={() => remover(editando)}>Remover</button>}
              <button type="button" className="so-btn so-ghost" onClick={novo}>Cancelar</button>
              <button type="button" className="so-btn so-primary" disabled={salvando} onClick={salvar}><Ic n="check" />Salvar centro</button>
            </div>
          </div>
        </section>
      </div>

      <BarraAcoes esquerda={<><b>{itens.length}</b> centros{semCentro.length > 0 && <><Sep /><span style={{ color: 'var(--amber)', fontWeight: 800 }}>{semCentro.length} {semCentro.length === 1 ? 'serviço' : 'serviços'} sem centro</span></>}<Sep />passo 5 de 6</>}>
        <Link to={rotaTenant(entityId, 'cadastros/veiculos')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Veículos</Link>
        <Link to={rotaTenant(entityId, 'cadastros/servicos')} className="so-btn so-primary">Continuar: Serviços<Ic n="seta" className="arrow" /></Link>
      </BarraAcoes>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
