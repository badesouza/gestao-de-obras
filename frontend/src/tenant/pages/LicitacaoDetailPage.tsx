import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ApiError, contratosApi, tenantApi,
  type AditivoContrato, type ContratoLicitacao, type DocumentoRef, type EstruturaLicitacao, type FornecedorConsulta,
  type ItemContrato, type SituacaoVigencia, type TipoAditivo, type TipoLicitacao,
} from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';
import { Anel, Dialogo, Kpi } from '../components/obras/ui';
import { TIPOS } from '../components/obras/licitacao-tipos';
import { CamposProcesso } from '../components/obras/CamposProcesso';
import { dataBr } from '../components/obras/util';
import { ImportInstructions, useImportTemplateDownload } from '../components/ImportInstructions';
import '../styles/compras-ui.css';
import '../styles/orcamento.css';
import '../styles/licitacao.css';

/* ── Licitação no padrão do Object ───────────────────────────────
   licitação → contratos (fornecedor, vigência) → lotes → itens,
   com os aditivos de prazo, valor e quantidade e os PDFs.          */

const COR = '#2563EB';
const SITUACAO: Record<SituacaoVigencia, { rotulo: (d: number) => string; classe: string }> = {
  VIGENTE:   { rotulo: d => `Vigente · ${d} dias`, classe: 'is-concluida' },
  VENCENDO:  { rotulo: d => d === 0 ? 'Vence hoje' : `Vence em ${d} ${d === 1 ? 'dia' : 'dias'}`, classe: 'is-execucao' },
  VENCIDO:   { rotulo: d => `Vencido há ${-d} ${d === -1 ? 'dia' : 'dias'}`, classe: 'is-atrasada' },
  A_INICIAR: { rotulo: () => 'A iniciar', classe: 'is-aprovacao' },
};
const ADITIVO: Record<TipoAditivo, { rotulo: string; desc: string; cor: string; icone: string }> = {
  PRAZO:      { rotulo: 'Prazo',      desc: 'Estende a vigência do contrato para uma nova data', cor: '#2563EB', icone: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM12 14v3l2 1' },
  VALOR:      { rotulo: 'Valor',      desc: 'Reajusta o valor unitário dos itens',               cor: '#7C3AED', icone: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  QUANTIDADE: { rotulo: 'Quantidade', desc: 'Acrescenta um percentual às quantidades de um lote', cor: '#0F766E', icone: 'M12 5v14M5 12h14' },
};

const real = (v: string | number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: string | number | null | undefined) => v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const msgErro = (e: unknown) => e instanceof ApiError ? e.body.message : e instanceof Error ? e.message : 'Não foi possível concluir';
const hoje = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
/** um ano de vigência: de 21/10/2026 até 20/10/2027 */
const umAnoDepois = (v: string) => { const d = new Date(`${v}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + 1); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const paraDecimal = (s: string) => { const t = s.trim(); return t ? (t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) : null; };
const mascaraCnpj = (v: string) => v.replace(/\D/g, '').slice(0, 14)
  .replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');

function Icone({ d, tamanho = 16 }: { d: string; tamanho?: number }) {
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const I = {
  mais: 'M12 5v14M5 12h14', lapis: 'M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z', lixo: 'M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2',
  clipe: 'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48',
  pdf: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6', planilha: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
  seta: 'M9 18l6-6-6-6', lupa: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35', desfazer: 'M3 7v6h6M21 17a9 9 0 00-15-6.7L3 13',
};

/* ── documentos ── */
function Documentos({ entityId, docs, alvo, podeGerir, onMudou, rotulo = 'Anexar PDF' }: {
  entityId: string; docs: DocumentoRef[]; alvo: { licitacaoId?: string; contratoId?: string }; podeGerir: boolean; onMudou: () => void; rotulo?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const enviar = async (f: File | undefined) => {
    if (!f) return;
    setOcupado(true); setErro('');
    try { await contratosApi.anexar(entityId, alvo, f); onMudou(); } catch (e) { setErro(msgErro(e)); } finally { setOcupado(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <div className="lc-docs">
      {docs.map(d => (
        <span key={d.id} className="lc-doc">
          <button type="button" onClick={() => void contratosApi.abrirDocumento(entityId, d.id).catch(e => setErro(msgErro(e)))} title="Abrir">
            <Icone d={I.pdf} tamanho={14} />{d.nome}
          </button>
          {podeGerir && <button type="button" className="lc-doc-x" aria-label={`Tirar ${d.nome}`} onClick={() => { if (window.confirm(`Tirar o arquivo ${d.nome}?`)) void contratosApi.removerDocumento(entityId, d.id).then(onMudou).catch(e => setErro(msgErro(e))); }}>×</button>}
        </span>
      ))}
      {podeGerir && <>
        <input ref={ref} type="file" accept="application/pdf,image/*" hidden onChange={e => void enviar(e.target.files?.[0])} />
        <button type="button" className="lc-doc-novo" disabled={ocupado} onClick={() => ref.current?.click()}><Icone d={I.clipe} tamanho={14} />{ocupado ? 'Enviando…' : rotulo}</button>
      </>}
      {erro && <span className="lc-erro-mini">{erro}</span>}
    </div>
  );
}

/* ── barra da vigência ── */
function Vigencia({ c }: { c: ContratoLicitacao }) {
  const de = new Date(c.vigenciaDe).getTime(), ate = new Date(c.vigenciaAte).getTime(), h = new Date(hoje()).getTime();
  const total = Math.max(1, ate - de);
  const pct = Math.min(100, Math.max(0, ((h - de) / total) * 100));
  const original = c.vigenciaOriginal ? Math.min(100, ((new Date(c.vigenciaOriginal).getTime() - de) / total) * 100) : null;
  return (
    <div className={`lc-vig is-${c.situacao.toLowerCase()}`}>
      <div className="lc-vig-datas"><span>{dataBr(c.vigenciaDe)}</span><span>{c.vigenciaOriginal ? <><s>{dataBr(c.vigenciaOriginal)}</s> → </> : null}<b>{dataBr(c.vigenciaAte)}</b></span></div>
      <div className="lc-vig-barra" role="img" aria-label={`Vigência ${Math.round(pct)}% decorrida`}>
        <span style={{ width: `${pct}%` }} />
        {original !== null && <i className="lc-vig-original" style={{ left: `${original}%` }} title="Fim original (antes do aditivo)" />}
        {pct > 0 && pct < 100 && <i className="lc-vig-hoje" style={{ left: `${pct}%` }} title="Hoje" />}
      </div>
    </div>
  );
}

/* ═════════════════ diálogos ═════════════════ */

function DialogoContrato({ entityId, licitacaoId, contrato, objeto, onFechar, onSalvo }: {
  entityId: string; licitacaoId: string; contrato: ContratoLicitacao | null; objeto: string; onFechar: () => void; onSalvo: () => void;
}) {
  const [numero, setNumero] = useState(contrato?.numero ?? '');
  const [de, setDe] = useState(contrato?.vigenciaDe ?? hoje());
  const [ate, setAte] = useState(contrato?.vigenciaAte ?? umAnoDepois(hoje()));
  const [valor, setValor] = useState(contrato?.valor ? Number(contrato.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
  const [cnpj, setCnpj] = useState(contrato?.fornecedor?.cnpj ?? '');
  const [consulta, setConsulta] = useState<FornecedorConsulta | null>(null);
  const [razao, setRazao] = useState(contrato?.fornecedor?.razaoSocial ?? '');
  const [buscando, setBuscando] = useState(false);
  const [loteNum, setLoteNum] = useState('01');
  const [loteDesc, setLoteDesc] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const manterFornecedor = !!contrato?.fornecedor && !consulta && razao === contrato.fornecedor.razaoSocial && (cnpj || '') === (contrato.fornecedor.cnpj ?? '');

  const buscar = async () => {
    if (cnpj.replace(/\D/g, '').length !== 14) { setErro('Digite os 14 números do CNPJ.'); return; }
    setBuscando(true); setErro('');
    try { const r = await contratosApi.consultarCnpj(entityId, cnpj); setConsulta(r); setRazao(r.fornecedor.razaoSocial); }
    catch (e) { setErro(msgErro(e)); setConsulta(null); }
    finally { setBuscando(false); }
  };
  /* 12 meses é o mais comum: preenche o fim sozinho */
  const aoMudarInicio = (v: string) => {
    /* se o fim ainda é o automático (1 ano), acompanha o novo início */
    if (v && !contrato && (!ate || ate === umAnoDepois(de))) setAte(umAnoDepois(v));
    setDe(v);
  };

  const salvar = async () => {
    if (!numero.trim()) return setErro('Informe o número do contrato.');
    if (!de || !ate) return setErro('Informe a vigência (início e fim).');
    setSalvando(true); setErro('');
    const dados = {
      numero: numero.trim(), vigenciaDe: de, vigenciaAte: ate, valor: paraDecimal(valor),
      ...(manterFornecedor ? { fornecedorId: contrato!.fornecedor!.id }
        : consulta?.fornecedor.id ? { fornecedorId: consulta.fornecedor.id }
        : razao.trim() ? { fornecedorNovo: { cnpj: cnpj || null, razaoSocial: razao.trim(), nomeFantasia: consulta?.fornecedor.nomeFantasia ?? null, telefone: consulta?.fornecedor.telefone ?? null, email: consulta?.fornecedor.email ?? null, endereco: consulta?.fornecedor.endereco ?? null } }
        : {}),
      ...(!contrato ? { primeiroLote: { numero: loteNum.trim() || '01', descricao: loteDesc.trim() || null } } : {}),
    };
    try {
      if (contrato) await contratosApi.atualizar(entityId, contrato.id, dados); else await contratosApi.criar(entityId, licitacaoId, dados);
      onSalvo();
    } catch (e) { setErro(msgErro(e)); setSalvando(false); }
  };

  return (
    <Dialogo titulo={contrato ? `Editar contrato ${contrato.numero}` : 'Novo contrato'} subtitulo={contrato ? undefined : 'O contrato liga a licitação ao fornecedor vencedor e define até quando dá para comprar.'}
      onFechar={onFechar}
      acoes={<>
        <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={onFechar}>Cancelar</button>
        <button type="button" className="ob-btn" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : contrato ? 'Salvar' : 'Lançar contrato'}</button>
      </>}>
      <div className="lc-form">
        <label className="cc-campo"><span>Nº do contrato</span><input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex.: 045/2026" autoFocus /></label>
        <label className="cc-campo"><span>Valor do contrato <em>(opcional)</em></span><input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" /></label>
        <label className="cc-campo"><span>Vigência — início</span><input type="date" value={de} onChange={e => aoMudarInicio(e.target.value)} /></label>
        <label className="cc-campo"><span>Vigência — fim</span><input type="date" value={ate} min={de} onChange={e => setAte(e.target.value)} /></label>

        <div className="cc-campo cc-largo">
          <span>Fornecedor</span>
          <div className="lc-cnpj">
            <input inputMode="numeric" value={cnpj} onChange={e => { setCnpj(mascaraCnpj(e.target.value)); setConsulta(null); }} placeholder="CNPJ" onKeyDown={e => { if (e.key === 'Enter') void buscar(); }} />
            <button type="button" className="ob-btn-ghost ob-btn-alto" disabled={buscando} onClick={() => void buscar()}><Icone d={I.lupa} tamanho={15} />{buscando ? 'Buscando…' : 'Buscar na Receita'}</button>
          </div>
        </div>
        {consulta && (
          <div className={`lc-forn-achado cc-largo is-${consulta.origem}`}>
            <b>{consulta.origem === 'cadastro' ? 'Já cadastrado' : 'Encontrado na Receita'}</b>
            <span>{consulta.fornecedor.razaoSocial}{consulta.fornecedor.nomeFantasia ? ` · ${consulta.fornecedor.nomeFantasia}` : ''}</span>
            {consulta.fornecedor.endereco && <small>{consulta.fornecedor.endereco}</small>}
            {consulta.fornecedor.situacao && consulta.fornecedor.situacao !== 'ATIVA' && <small className="lc-alerta">Situação na Receita: {consulta.fornecedor.situacao}</small>}
          </div>
        )}
        <label className="cc-campo cc-largo"><span>Razão social {consulta ? <em>— veio da consulta</em> : <em>— ou digite, se não tiver CNPJ</em>}</span>
          <input value={razao} onChange={e => setRazao(e.target.value)} placeholder="Nome da empresa vencedora" disabled={consulta?.origem === 'cadastro'} />
        </label>

        {!contrato && <>
          <label className="cc-campo"><span>Primeiro lote</span><input value={loteNum} onChange={e => setLoteNum(e.target.value)} placeholder="01" /></label>
          <label className="cc-campo"><span>Descrição do lote <em>(opcional)</em></span><input value={loteDesc} onChange={e => setLoteDesc(e.target.value)} placeholder={objeto.slice(0, 60)} /></label>
        </>}
      </div>
      {erro && <div className="ob-erro">{erro}</div>}
    </Dialogo>
  );
}

function DialogoLote({ entityId, contratoId, lote, onFechar, onSalvo }: {
  entityId: string; contratoId: string; lote: { id: string; numero: string; descricao: string | null } | null; onFechar: () => void; onSalvo: () => void;
}) {
  const [numero, setNumero] = useState(lote?.numero ?? '');
  const [descricao, setDescricao] = useState(lote?.descricao ?? '');
  const [erro, setErro] = useState('');
  const salvar = async () => {
    try {
      if (lote) await contratosApi.atualizarLote(entityId, lote.id, { numero, descricao: descricao || null });
      else await contratosApi.criarLote(entityId, contratoId, { numero, descricao: descricao || null });
      onSalvo();
    } catch (e) { setErro(msgErro(e)); }
  };
  return (
    <Dialogo titulo={lote ? `Editar lote ${lote.numero}` : 'Novo lote'} onFechar={onFechar}
      acoes={<><button type="button" className="ob-btn-ghost ob-btn-alto" onClick={onFechar}>Cancelar</button><button type="button" className="ob-btn" disabled={!numero.trim()} onClick={() => void salvar()}>Salvar</button></>}>
      <div className="lc-form">
        <label className="cc-campo"><span>Nº do lote</span><input value={numero} onChange={e => setNumero(e.target.value)} placeholder="02" autoFocus /></label>
        <label className="cc-campo"><span>Descrição <em>(opcional)</em></span><input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Agregados" /></label>
      </div>
      {erro && <div className="ob-erro">{erro}</div>}
    </Dialogo>
  );
}

function DialogoItem({ entityId, licitacaoId, loteId, item, onFechar, onSalvo }: {
  entityId: string; licitacaoId: string; loteId: string | null; item: ItemContrato | null; onFechar: () => void; onSalvo: (outro: boolean) => void;
}) {
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [marca, setMarca] = useState(item?.marca ?? '');
  const [unidade, setUnidade] = useState(item?.unidade ?? '');
  const [quantidade, setQuantidade] = useState(item?.quantidade ? num(item.quantidade) : '');
  const [valor, setValor] = useState(item?.valorUnitario ? Number(item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '');
  const [categoria, setCategoria] = useState(item?.categoria ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const total = (Number(paraDecimal(quantidade)) || 0) * (Number(paraDecimal(valor)) || 0);
  const salvar = async (outro: boolean) => {
    if (descricao.trim().length < 2 || !unidade.trim()) { setErro('Descrição e unidade são obrigatórias.'); return; }
    setSalvando(true); setErro('');
    try {
      if (item) await contratosApi.editarItem(entityId, licitacaoId, item.id, { descricao: descricao.trim(), marca: marca.trim() || null, unidadeMedida: unidade.trim(), quantidade: paraDecimal(quantidade), valorUnitario: paraDecimal(valor), categoria: categoria.trim() || undefined });
      else await contratosApi.adicionarItem(entityId, loteId!, { descricao, marca: marca || null, unidade, quantidade: paraDecimal(quantidade), valorUnitario: paraDecimal(valor), categoria: categoria || null });
      if (outro) { setDescricao(''); setMarca(''); setQuantidade(''); setValor(''); setSalvando(false); onSalvo(true); }
      else onSalvo(false);
    } catch (e) { setErro(msgErro(e)); setSalvando(false); }
  };
  return (
    <Dialogo titulo={item ? 'Editar item' : 'Novo item do lote'} onFechar={onFechar}
      acoes={<>
        <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={onFechar}>Fechar</button>
        {!item && <button type="button" className="ob-btn-ghost ob-btn-alto" disabled={salvando} onClick={() => void salvar(true)}>Salvar e lançar outro</button>}
        <button type="button" className="ob-btn" disabled={salvando} onClick={() => void salvar(false)}>Salvar</button>
      </>}>
      <div className="lc-form">
        <label className="cc-campo cc-largo"><span>Descrição</span><input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Cimento CP-II 50 kg" autoFocus /></label>
        <label className="cc-campo"><span>Marca <em>(opcional)</em></span><input value={marca} onChange={e => setMarca(e.target.value)} /></label>
        <label className="cc-campo"><span>Unidade</span><input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="SACO, M³, UN…" /></label>
        <label className="cc-campo"><span>Quantidade <em>(vazio = sem limite)</em></span><input inputMode="decimal" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" /></label>
        <label className="cc-campo"><span>Valor unitário</span><input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" /></label>
        <label className="cc-campo"><span>Categoria <em>(opcional)</em></span><input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex.: ALVENARIA" /></label>
        <div className="lc-item-total"><small>Total do item</small><b>{real(total)}</b></div>
      </div>
      {item?.emUso && <p className="lc-nota">Este item já foi usado em compras. Mudar o preço vale só para as próximas.</p>}
      {erro && <div className="ob-erro">{erro}</div>}
    </Dialogo>
  );
}

function DialogoImportar({ entityId, licitacaoId, lote, onFechar, onSalvo }: {
  entityId: string; licitacaoId: string; lote: { id: string; numero: string }; onFechar: () => void; onSalvo: (n: number) => void;
}) {
  const [aba, setAba] = useState<'planilha' | 'colar'>('planilha');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [cols, setCols] = useState({ descricao: '', unidade: '', quantidade: '', valor: '', categoria: '' });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const baixarModelo = useImportTemplateDownload();
  const linhas = (t: string) => t.split(/\r?\n/).filter(l => l.trim()).length;
  const enviar = async () => {
    setOcupado(true); setErro('');
    try {
      const r = aba === 'planilha'
        ? await contratosApi.importarPlanilha(entityId, licitacaoId, lote.id, arquivo!)
        : await contratosApi.importarColunas(entityId, licitacaoId, lote.id, Object.fromEntries(Object.entries(cols).filter(([, v]) => v.trim())));
      onSalvo(r.importedCount);
    } catch (e) {
      const det = e instanceof ApiError ? (e.body.details as { lineErrors?: { line: number; message: string }[] } | undefined)?.lineErrors : undefined;
      setErro(det?.length ? `${msgErro(e)}: ${det.slice(0, 4).map(l => `linha ${l.line} — ${l.message}`).join('; ')}` : msgErro(e));
      setOcupado(false);
    }
  };
  return (
    <Dialogo titulo={`Importar itens para o lote ${lote.numero}`} subtitulo="Os itens entram direto neste lote, em maiúsculas."
      onFechar={onFechar}
      acoes={<><button type="button" className="ob-btn-ghost ob-btn-alto" onClick={onFechar}>Cancelar</button>
        <button type="button" className="ob-btn" disabled={ocupado || (aba === 'planilha' ? !arquivo : !cols.descricao.trim())} onClick={() => void enviar()}>{ocupado ? 'Importando…' : 'Importar'}</button></>}>
      <div className="ob-chips lc-abas" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'planilha'} className={`ob-chip${aba === 'planilha' ? ' is-ativo' : ''}`} onClick={() => setAba('planilha')}><Icone d={I.planilha} tamanho={14} />Planilha</button>
        <button type="button" role="tab" aria-selected={aba === 'colar'} className={`ob-chip${aba === 'colar' ? ' is-ativo' : ''}`} onClick={() => setAba('colar')}>Colar colunas</button>
      </div>
      {aba === 'planilha' ? (
        <div className="lc-importar">
          <ImportInstructions onDownload={f => { void baixarModelo(f).catch(e => setErro(msgErro(e))); }} />
          <label className="lc-arquivo">
            <input type="file" accept=".csv,.xlsx" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            <Icone d={I.planilha} tamanho={22} />
            <span>{arquivo ? arquivo.name : 'Escolher planilha (.xlsx ou .csv)'}</span>
          </label>
        </div>
      ) : (
        <div className="lc-colunas">
          {(['descricao', 'unidade', 'quantidade', 'valor', 'categoria'] as const).map(k => (
            <label key={k} className="cc-campo">
              <span>{{ descricao: 'Descrição', unidade: 'Unidade', quantidade: 'Quantidade', valor: 'Valor unit.', categoria: 'Categoria' }[k]} <em>{linhas(cols[k]) || ''}</em></span>
              <textarea rows={7} value={cols[k]} onChange={e => setCols(c => ({ ...c, [k]: e.target.value }))} placeholder="uma linha por item" />
            </label>
          ))}
        </div>
      )}
      {erro && <div className="ob-erro">{erro}</div>}
    </Dialogo>
  );
}

function DialogoAditivo({ entityId, contrato, onFechar, onSalvo }: {
  entityId: string; contrato: ContratoLicitacao; onFechar: () => void; onSalvo: (msg: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoAditivo>('PRAZO');
  const [numero, setNumero] = useState(String(contrato.aditivos.length + 1).padStart(2, '0'));
  const [publicacao, setPublicacao] = useState(hoje());
  const [novaVigencia, setNovaVigencia] = useState('');
  const [percentual, setPercentual] = useState('25');
  const [loteId, setLoteId] = useState(contrato.lotes[0]?.id ?? '');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const pct = Number(paraDecimal(percentual)) || 0;
  const itensAfetados = (tipo === 'VALOR' && !loteId ? contrato.lotes.flatMap(l => l.itens) : contrato.lotes.find(l => l.id === loteId)?.itens ?? [])
    .filter(i => i.status === 'ACTIVE' && (tipo === 'QUANTIDADE' ? i.quantidade : i.valorUnitario));
  const impacto = itensAfetados.reduce((t, i) => t + (tipo === 'QUANTIDADE'
    ? Number(i.quantidade) * (pct / 100) * Number(i.valorUnitario ?? 0)
    : Number(i.valorUnitario) * (pct / 100) * Number(i.quantidade ?? 0)), 0);

  const salvar = async () => {
    setSalvando(true); setErro('');
    try {
      const r = await contratosApi.criarAditivo(entityId, contrato.id, {
        tipo, numero, dataPublicacao: publicacao, observacao: observacao || null,
        ...(tipo === 'PRAZO' ? { novaVigencia } : { percentual: paraDecimal(percentual), loteId: loteId || null }),
      });
      onSalvo(tipo === 'PRAZO' ? `Aditivo ${numero}: vigência até ${dataBr(novaVigencia)}.` : `Aditivo ${numero} lançado (${real(r.valorAditivado)}).`);
    } catch (e) { setErro(msgErro(e)); setSalvando(false); }
  };

  return (
    <Dialogo titulo={`Aditivo ao contrato ${contrato.numero}`} onFechar={onFechar}
      acoes={<><button type="button" className="ob-btn-ghost ob-btn-alto" onClick={onFechar}>Cancelar</button>
        <button type="button" className="ob-btn" disabled={salvando || (tipo === 'PRAZO' ? !novaVigencia : !pct)} onClick={() => void salvar()}>{salvando ? 'Lançando…' : 'Lançar aditivo'}</button></>}>
      <div className="lc-tipos" role="radiogroup" aria-label="Tipo de aditivo">
        {(Object.keys(ADITIVO) as TipoAditivo[]).map(t => (
          <button key={t} type="button" role="radio" aria-checked={tipo === t} className={`lc-tipo${tipo === t ? ' is-ativo' : ''}`} style={{ '--tipo-cor': ADITIVO[t].cor } as React.CSSProperties}
            onClick={() => { setTipo(t); if (t === 'VALOR') setPercentual(''); if (t === 'QUANTIDADE') { setPercentual('25'); if (!loteId) setLoteId(contrato.lotes[0]?.id ?? ''); } }}>
            <span className="lc-tipo-icone"><Icone d={ADITIVO[t].icone} tamanho={18} /></span>
            <b>{ADITIVO[t].rotulo}</b><small>{ADITIVO[t].desc}</small>
          </button>
        ))}
      </div>
      <div className="lc-form">
        <label className="cc-campo"><span>Nº do aditivo</span><input value={numero} onChange={e => setNumero(e.target.value)} /></label>
        <label className="cc-campo"><span>Data de publicação</span><input type="date" value={publicacao} onChange={e => setPublicacao(e.target.value)} /></label>
        {tipo === 'PRAZO' ? (
          <label className="cc-campo cc-largo"><span>Nova vigência <em>— hoje vai até {dataBr(contrato.vigenciaAte)}</em></span><input type="date" value={novaVigencia} min={contrato.vigenciaAte} onChange={e => setNovaVigencia(e.target.value)} /></label>
        ) : <>
          <label className="cc-campo"><span>{tipo === 'VALOR' ? 'Reajuste (%)' : 'Acréscimo (%)'}</span><input inputMode="decimal" value={percentual} onChange={e => setPercentual(e.target.value)} placeholder={tipo === 'VALOR' ? 'Ex.: 5,32' : '25'} /></label>
          <label className="cc-campo"><span>Lote</span>
            <select value={loteId} onChange={e => setLoteId(e.target.value)}>
              {tipo === 'VALOR' && <option value="">Todos os lotes</option>}
              {contrato.lotes.map(l => <option key={l.id} value={l.id}>Lote {l.numero}{l.descricao ? ` · ${l.descricao}` : ''}</option>)}
            </select>
          </label>
        </>}
        <label className="cc-campo cc-largo"><span>Observação <em>(opcional)</em></span><input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: Termo aditivo publicado no DOM nº…" /></label>
      </div>
      {tipo === 'QUANTIDADE' && pct > 25 && <p className="lc-nota is-alerta">Acima de 25% a lei só permite para reforma (até 50%). Confira antes de lançar.</p>}
      {tipo !== 'PRAZO' && pct !== 0 && itensAfetados.length > 0 && (
        <div className="lc-previa">
          <div className="lc-previa-topo"><span>{itensAfetados.length} {itensAfetados.length === 1 ? 'item muda' : 'itens mudam'}</span><b>{impacto >= 0 ? '+' : ''}{real(impacto)}</b></div>
          {itensAfetados.slice(0, 5).map(i => (
            <div key={i.id} className="lc-previa-linha">
              <span>{i.descricao}</span>
              {tipo === 'QUANTIDADE'
                ? <em>{num(i.quantidade)} → <b>{num(Number(i.quantidade) * (1 + pct / 100))}</b> {i.unidade}</em>
                : <em>{real(i.valorUnitario)} → <b>{real(Number(i.valorUnitario) * (1 + pct / 100))}</b></em>}
            </div>
          ))}
          {itensAfetados.length > 5 && <small>…e mais {itensAfetados.length - 5}</small>}
        </div>
      )}
      {erro && <div className="ob-erro">{erro}</div>}
    </Dialogo>
  );
}

function DialogoProcesso({ entityId, est, onFechar, onSalvo }: { entityId: string; est: EstruturaLicitacao; onFechar: () => void; onSalvo: () => void }) {
  const [identificacao, setIdentificacao] = useState(est.identificacao);
  const [objeto, setObjeto] = useState(est.objeto);
  const [pa, setPa] = useState(est.numeroProcesso ?? '');
  const [modalidade, setModalidade] = useState(est.modalidade ?? '');
  const [tipo, setTipo] = useState<TipoLicitacao | ''>(est.tipo ?? '');
  const [homologacao, setHomologacao] = useState(est.dataHomologacao ?? '');
  const [erro, setErro] = useState('');
  const salvar = async () => {
    try {
      await tenantApi.licitacoes.update(entityId, est.id, { identificacao: identificacao.trim(), objeto: objeto.trim(), fornecedorId: est.fornecedorLegado?.id ?? null });
      await contratosApi.salvarProcesso(entityId, est.id, { numeroProcesso: pa || null, modalidade: modalidade || null, tipo: tipo || null, dataHomologacao: homologacao || null });
      onSalvo();
    } catch (e) { setErro(msgErro(e)); }
  };
  return (
    <Dialogo titulo="Dados da licitação" onFechar={onFechar}
      acoes={<><button type="button" className="ob-btn-ghost ob-btn-alto" onClick={onFechar}>Cancelar</button><button type="button" className="ob-btn" onClick={() => void salvar()}>Salvar</button></>}>
      <CamposProcesso {...{ identificacao, setIdentificacao, objeto, setObjeto, pa, setPa, modalidade, setModalidade, tipo, setTipo, homologacao, setHomologacao, modalidades: est.modalidades }} />
      {erro && <div className="ob-erro">{erro}</div>}
    </Dialogo>
  );
}


/* ═════════════════ página ═════════════════ */

type Dialogos =
  | { tipo: 'processo' } | { tipo: 'contrato'; contrato: ContratoLicitacao | null }
  | { tipo: 'lote'; contratoId: string; lote: { id: string; numero: string; descricao: string | null } | null }
  | { tipo: 'item'; loteId: string | null; item: ItemContrato | null }
  | { tipo: 'importar'; lote: { id: string; numero: string } }
  | { tipo: 'aditivo'; contrato: ContratoLicitacao }
  | { tipo: 'confirmar'; titulo: string; texto: string; rotulo: string; acao: () => Promise<unknown> };

export function LicitacaoDetailPage() {
  const { entityId } = useTenant();
  const { licitacaoId = '' } = useParams<{ licitacaoId: string }>();
  const [busca] = useSearchParams();
  const navigate = useNavigate();
  const podeGerir = useTenantPermission('licitacoes.manage');
  const podeImportar = useTenantPermission('licitacoes.items.import');
  const podeEditarItem = useTenantPermission('licitacoes.items.deactivate');
  const [est, setEst] = useState<EstruturaLicitacao | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [dialogo, setDialogo] = useState<Dialogos | null>(busca.get('novoContrato') ? { tipo: 'contrato', contrato: null } : null);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [destino, setDestino] = useState('');

  const carregar = useCallback(() => contratosApi.estrutura(entityId, licitacaoId).then(r => { setEst(r); setErro(''); }).catch(e => setErro(msgErro(e))), [entityId, licitacaoId]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 4000); return () => clearTimeout(t); }, [aviso]);

  const fechar = () => setDialogo(null);
  const salvo = (msg?: string) => { setDialogo(null); if (msg) setAviso(msg); void carregar(); };
  const contratoAberto = (c: ContratoLicitacao) => abertos[c.id] ?? (est!.contratos.length <= 2 || c.situacao !== 'VENCIDO');
  const lotesDestino = useMemo(() => est?.contratos.filter(c => c.status === 'ACTIVE').flatMap(c => c.lotes.map(l => ({ id: l.id, rotulo: `Contrato ${c.numero} · Lote ${l.numero}` }))) ?? [], [est]);

  if (!est) return (
    <div className="ob-page ob-claro">
      {erro ? <><div className="ob-erro">{erro}</div><Link to={`/t/${entityId}/licitacoes`} className="ob-btn-ghost ob-btn-alto">Voltar</Link></>
        : <><span className="ob-skeleton" style={{ height: 120, borderRadius: 20 }} /><span className="ob-skeleton" style={{ height: 320, borderRadius: 20, marginTop: 16 }} /></>}
    </div>
  );

  const ativa = est.status === 'ACTIVE';
  const tipo = est.tipo ? TIPOS[est.tipo] : null;
  const usoPct = Number(est.resumo.valorGlobal) ? Math.round((Number(est.resumo.valorUsado) / Number(est.resumo.valorGlobal)) * 100) : null;

  const confirmar = (titulo: string, texto: string, rotulo: string, acao: () => Promise<unknown>) => setDialogo({ tipo: 'confirmar', titulo, texto, rotulo, acao });

  return (
    <div className="ob-page ob-claro lc-pagina" style={{ '--serv-cor': tipo?.cor ?? COR } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone"><Icone d={tipo?.icone ?? I.pdf} tamanho={30} /></span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv"><Link to={`/t/${entityId}/licitacoes`} className="or-voltar">← Licitações</Link>{est.modalidade ? ` · ${est.modalidade}` : ''}</span>
            <h1 className="ob-h1">{est.identificacao}</h1>
            <p className="ob-sub">{est.objeto}</p>
            <div className="lc-meta">
              {tipo && <span className="lc-meta-chip" style={{ '--tipo-cor': tipo.cor } as React.CSSProperties}><Icone d={tipo.icone} tamanho={13} />{tipo.rotulo}</span>}
              {est.numeroProcesso && <span className="lc-meta-chip">P.A. {est.numeroProcesso}</span>}
              {est.dataHomologacao && <span className="lc-meta-chip">Homologada em {dataBr(est.dataHomologacao)}</span>}
              {!ativa && <span className="ob-badge is-cancelada"><i />Desativada</span>}
            </div>
          </div>
        </div>
        <div className="ob-head-acoes">
          {podeGerir && <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setDialogo({ tipo: 'processo' })}><Icone d={I.lapis} />Dados</button>}
          {podeGerir && ativa && <button type="button" className="ob-btn" onClick={() => setDialogo({ tipo: 'contrato', contrato: null })}><Icone d={I.mais} />Novo contrato</button>}
        </div>
      </header>

      <section className="ob-kpis" aria-label="Resumo">
        <Kpi i={1} rotulo="Contratos vigentes" valor={est.resumo.vigentes} cor="var(--ob-green)"
          nota={est.resumo.vencendo ? `${est.resumo.vencendo} ${est.resumo.vencendo === 1 ? 'vence' : 'vencem'} em até 30 dias` : est.resumo.vencidos ? `${est.resumo.vencidos} vencido${est.resumo.vencidos > 1 ? 's' : ''}` : `${est.resumo.contratos} no total`}
          tom={est.resumo.vencendo ? 'alerta' : est.resumo.vencidos ? 'ruim' : 'neutro'} grafico={null} />
        <div className="ob-kpi ob-reveal" style={{ '--i': 2, '--kpi-cor': COR } as React.CSSProperties}>
          <span className="ob-kpi-rotulo">Valor dos itens</span>
          <div className="ob-kpi-linha"><span className="ob-kpi-valor cp-kpi-dinheiro">{real(est.resumo.valorGlobal)}</span></div>
          <div className="ob-kpi-rodape"><span className="ob-kpi-nota tom-neutro">{est.resumo.itens} {est.resumo.itens === 1 ? 'item ativo' : 'itens ativos'}</span></div>
        </div>
        <div className="ob-kpi ob-reveal" style={{ '--i': 3, '--kpi-cor': '#F59E0B' } as React.CSSProperties}>
          <span className="ob-kpi-rotulo">Já comprometido</span>
          <div className="ob-kpi-linha"><span className="ob-kpi-valor cp-kpi-dinheiro">{real(est.resumo.valorUsado)}</span><Anel pct={usoPct} cor="#F59E0B" /></div>
          <div className="ob-kpi-rodape"><span className="ob-kpi-nota tom-neutro">em pedidos e solicitações</span></div>
        </div>
        <div className="ob-kpi ob-reveal" style={{ '--i': 4, '--kpi-cor': '#64748B' } as React.CSSProperties}>
          <span className="ob-kpi-rotulo">Documentos</span>
          <Documentos entityId={entityId} docs={est.arquivos} alvo={{ licitacaoId: est.id }} podeGerir={podeGerir} onMudou={() => void carregar()} rotulo="Anexar edital / ata" />
        </div>
      </section>

      {aviso && <div className="cp-aviso" role="status">{aviso}</div>}
      {erro && <div className="ob-erro">{erro}</div>}

      {est.contratos.length === 0 && (
        <section className="ob-card lc-vazio ob-reveal" style={{ '--i': 5 } as React.CSSProperties}>
          <Icone d={I.pdf} tamanho={40} />
          <strong>Nenhum contrato lançado</strong>
          <span>No padrão do Object, cada fornecedor vencedor vira um contrato, com vigência, lotes e itens.</span>
          {podeGerir && ativa && <button type="button" className="ob-btn" onClick={() => setDialogo({ tipo: 'contrato', contrato: null })}><Icone d={I.mais} />Lançar o primeiro contrato</button>}
        </section>
      )}

      <div className="lc-contratos">
        {est.contratos.map((c, idx) => {
          const sit = SITUACAO[c.situacao];
          const aberto = contratoAberto(c);
          const usoC = Number(c.valorItens) ? Math.min(100, (Number(c.valorUsado) / Number(c.valorItens)) * 100) : 0;
          const ultimoAditivo = c.aditivos[c.aditivos.length - 1];
          return (
            <article key={c.id} className={`ob-card lc-contrato ob-reveal is-${c.situacao.toLowerCase()}${c.status === 'INACTIVE' ? ' is-inativo' : ''}`} style={{ '--i': 5 + Math.min(idx, 6) } as React.CSSProperties}>
              <div className="lc-contrato-cab">
                <button type="button" className="lc-contrato-abrir" onClick={() => setAbertos(a => ({ ...a, [c.id]: !aberto }))} aria-expanded={aberto}>
                  <span className={`lc-seta${aberto ? ' is-aberta' : ''}`}><Icone d={I.seta} /></span>
                  <span className="lc-contrato-id">
                    <span className="lc-contrato-num">Contrato {c.numero}</span>
                    {c.status === 'INACTIVE' ? <span className="ob-badge is-cancelada"><i />Desativado</span> : <span className={`ob-badge ${sit.classe}`}><i />{sit.rotulo(c.diasRestantes)}</span>}
                    {c.aditivos.length > 0 && <span className="lc-tag-aditivo">{c.aditivos.length} aditivo{c.aditivos.length > 1 ? 's' : ''}</span>}
                  </span>
                  <strong className="lc-forn">{c.fornecedor?.razaoSocial ?? 'Fornecedor não informado'}</strong>
                  {c.fornecedor?.cnpj && <span className="lc-cnpj-txt">CNPJ {c.fornecedor.cnpj}</span>}
                </button>
                <div className="lc-contrato-valores">
                  <span><small>Itens</small><b>{real(c.valorItens)}</b></span>
                  <span><small>Comprometido</small><b>{real(c.valorUsado)}</b></span>
                  <div className="lc-uso" aria-label={`${Math.round(usoC)}% comprometido`}><span style={{ width: `${usoC}%` }} /></div>
                </div>
              </div>
              <Vigencia c={c} />

              {aberto && <>
                {podeGerir && (
                  <div className="lc-contrato-acoes">
                    {c.status === 'ACTIVE' ? <>
                      <button type="button" className="lc-acao" onClick={() => setDialogo({ tipo: 'aditivo', contrato: c })}><Icone d={I.mais} tamanho={14} />Aditivo</button>
                      <button type="button" className="lc-acao" onClick={() => setDialogo({ tipo: 'lote', contratoId: c.id, lote: null })}><Icone d={I.mais} tamanho={14} />Lote</button>
                      <button type="button" className="lc-acao" onClick={() => setDialogo({ tipo: 'contrato', contrato: c })}><Icone d={I.lapis} tamanho={14} />Editar</button>
                      <button type="button" className="lc-acao is-perigo" onClick={() => confirmar(`Excluir o contrato ${c.numero}?`, 'Se algum item já foi usado em compras, o contrato fica só desativado (o histórico é preservado).', 'Excluir', async () => {
                        const r = await contratosApi.remover(entityId, c.id); setAviso(r.removido ? `Contrato ${c.numero} excluído.` : `Contrato ${c.numero} desativado (já tinha compras).`);
                      })}><Icone d={I.lixo} tamanho={14} />Excluir</button>
                    </> : (
                      <button type="button" className="lc-acao" onClick={() => void contratosApi.reativar(entityId, c.id).then(() => salvo(`Contrato ${c.numero} reativado.`)).catch(e => setErro(msgErro(e)))}>Reativar contrato</button>
                    )}
                    <Documentos entityId={entityId} docs={c.arquivos} alvo={{ contratoId: c.id }} podeGerir={podeGerir} onMudou={() => void carregar()} />
                  </div>
                )}
                {!podeGerir && c.arquivos.length > 0 && <Documentos entityId={entityId} docs={c.arquivos} alvo={{ contratoId: c.id }} podeGerir={false} onMudou={() => void carregar()} />}

                {c.aditivos.length > 0 && (
                  <ol className="lc-aditivos" aria-label="Aditivos">
                    {c.aditivos.map((a: AditivoContrato) => (
                      <li key={a.id} style={{ '--tipo-cor': ADITIVO[a.tipo].cor } as React.CSSProperties}>
                        <span className="lc-aditivo-icone"><Icone d={ADITIVO[a.tipo].icone} tamanho={14} /></span>
                        <span className="lc-aditivo-texto">
                          <b>Aditivo {a.numero} · {ADITIVO[a.tipo].rotulo}</b>
                          <small>
                            {a.tipo === 'PRAZO' ? `${dataBr(a.vigenciaAnterior!)} → ${dataBr(a.novaVigencia!)}` : `${Number(a.percentual) > 0 ? '+' : ''}${num(a.percentual)}% ${a.lote ? `no lote ${a.lote}` : 'em todos os lotes'} · ${a.itensAfetados} itens · ${real(a.valorAditivado)}`}
                            {' · publicado em '}{dataBr(a.dataPublicacao)}{a.observacao ? ` · ${a.observacao}` : ''}
                          </small>
                        </span>
                        {podeGerir && a.id === ultimoAditivo?.id && (
                          <button type="button" className="lc-acao is-mini" onClick={() => confirmar(`Desfazer o aditivo ${a.numero}?`, a.tipo === 'PRAZO' ? 'A vigência volta à data anterior.' : 'Quantidades e preços voltam ao que eram antes.', 'Desfazer', () => contratosApi.desfazerAditivo(entityId, a.id))}>
                            <Icone d={I.desfazer} tamanho={13} />Desfazer
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {c.lotes.map(l => (
                  <section key={l.id} className="lc-lote">
                    <div className="lc-lote-cab">
                      <span className="lc-lote-num">Lote {l.numero}</span>
                      <span className="lc-lote-desc">{l.descricao}</span>
                      <b className="lc-lote-valor">{real(l.valor)}</b>
                      {c.status === 'ACTIVE' && (podeGerir || podeImportar) && (
                        <span className="lc-lote-acoes">
                          {podeGerir && <button type="button" className="lc-acao" onClick={() => setDialogo({ tipo: 'item', loteId: l.id, item: null })}><Icone d={I.mais} tamanho={14} />Item</button>}
                          {podeImportar && <button type="button" className="lc-acao" onClick={() => setDialogo({ tipo: 'importar', lote: l })}><Icone d={I.planilha} tamanho={14} />Importar</button>}
                          {podeGerir && <button type="button" className="lc-icone" title="Editar lote" onClick={() => setDialogo({ tipo: 'lote', contratoId: c.id, lote: l })}><Icone d={I.lapis} tamanho={14} /></button>}
                          {podeGerir && l.itens.length === 0 && <button type="button" className="lc-icone is-perigo" title="Excluir lote" onClick={() => confirmar(`Excluir o lote ${l.numero}?`, 'O lote está vazio.', 'Excluir', () => contratosApi.removerLote(entityId, l.id))}><Icone d={I.lixo} tamanho={14} /></button>}
                        </span>
                      )}
                    </div>
                    {l.itens.length === 0 ? <p className="lc-lote-vazio">Lote sem itens. {podeGerir ? 'Lance um a um ou importe uma planilha.' : ''}</p> : (
                      <TabelaItens itens={l.itens} podeEditar={podeEditarItem} onEditar={i => setDialogo({ tipo: 'item', loteId: l.id, item: i })}
                        onExcluir={i => confirmar(`Tirar o item ${i.descricao}?`, i.emUso ? 'O item já foi usado: ele fica inativo, sem apagar o histórico.' : 'O item será apagado.', 'Tirar', () => contratosApi.excluirItem(entityId, est.id, i.id))} />
                    )}
                  </section>
                ))}
              </>}
            </article>
          );
        })}
      </div>

      {est.itensSemContrato.length > 0 && (
        <section className="ob-card lc-soltos ob-reveal" style={{ '--i': 8 } as React.CSSProperties}>
          <div className="lc-soltos-cab">
            <div>
              <h2 className="or-secao-titulo">Itens sem contrato <small>{est.itensSemContrato.length}</small></h2>
              <p className="lc-nota">Itens lançados antes dos contratos. Marque e mova para o lote certo — assim valem a vigência e os aditivos.</p>
            </div>
            {podeGerir && lotesDestino.length > 0 && (
              <div className="lc-mover">
                <select value={destino} onChange={e => setDestino(e.target.value)} aria-label="Lote de destino">
                  <option value="">Mover para…</option>
                  {lotesDestino.map(l => <option key={l.id} value={l.id}>{l.rotulo}</option>)}
                </select>
                <button type="button" className="ob-btn" disabled={!destino || !selecionados.length}
                  onClick={() => void contratosApi.vincularItens(entityId, destino, selecionados).then(r => { setSelecionados([]); salvo(`${r.vinculados} ${r.vinculados === 1 ? 'item movido' : 'itens movidos'} para o lote.`); }).catch(e => setErro(msgErro(e)))}>
                  Mover {selecionados.length || ''}
                </button>
              </div>
            )}
          </div>
          <TabelaItens itens={est.itensSemContrato} podeEditar={podeEditarItem}
            selecao={podeGerir && lotesDestino.length > 0 ? { ids: selecionados, alternar: id => setSelecionados(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]), todos: v => setSelecionados(v ? est.itensSemContrato.map(i => i.id) : []) } : undefined}
            onEditar={i => setDialogo({ tipo: 'item', loteId: null, item: i })}
            onExcluir={i => confirmar(`Tirar o item ${i.descricao}?`, i.emUso ? 'O item já foi usado: ele fica inativo.' : 'O item será apagado.', 'Tirar', () => contratosApi.excluirItem(entityId, est.id, i.id))} />
        </section>
      )}

      {podeGerir && ativa && est.contratos.length > 0 && (
        <div className="lc-rodape">
          <button type="button" className="or-cancelar" onClick={() => confirmar('Desativar esta licitação?', 'Ela deixa de aparecer para novas compras. O histórico fica guardado.', 'Desativar', async () => {
            await tenantApi.licitacoes.deactivate(entityId, est.id);
          })}>Desativar licitação</button>
        </div>
      )}
      {podeGerir && est.contratos.length === 0 && est.itensSemContrato.length === 0 && (
        <div className="lc-rodape">
          <button type="button" className="or-cancelar" onClick={() => confirmar('Apagar esta licitação?', 'Ela ainda não tem contratos nem itens.', 'Apagar', async () => {
            await tenantApi.licitacoes.delete(entityId, est.id); navigate(`/t/${entityId}/licitacoes`);
          })}>Apagar licitação</button>
        </div>
      )}

      {dialogo?.tipo === 'processo' && <DialogoProcesso entityId={entityId} est={est} onFechar={fechar} onSalvo={() => salvo('Dados da licitação salvos.')} />}
      {dialogo?.tipo === 'contrato' && <DialogoContrato entityId={entityId} licitacaoId={est.id} contrato={dialogo.contrato} objeto={est.objeto} onFechar={fechar} onSalvo={() => salvo(dialogo.contrato ? 'Contrato atualizado.' : 'Contrato lançado. Agora inclua os itens do lote.')} />}
      {dialogo?.tipo === 'lote' && <DialogoLote entityId={entityId} contratoId={dialogo.contratoId} lote={dialogo.lote} onFechar={fechar} onSalvo={() => salvo('Lote salvo.')} />}
      {dialogo?.tipo === 'item' && <DialogoItem entityId={entityId} licitacaoId={est.id} loteId={dialogo.loteId} item={dialogo.item} onFechar={fechar}
        onSalvo={outro => { if (outro) { setAviso('Item lançado.'); void carregar(); } else salvo(dialogo.item ? 'Item atualizado.' : 'Item lançado.'); }} />}
      {dialogo?.tipo === 'importar' && <DialogoImportar entityId={entityId} licitacaoId={est.id} lote={dialogo.lote} onFechar={fechar} onSalvo={n => salvo(`${n} ${n === 1 ? 'item importado' : 'itens importados'} no lote ${dialogo.lote.numero}.`)} />}
      {dialogo?.tipo === 'aditivo' && <DialogoAditivo entityId={entityId} contrato={dialogo.contrato} onFechar={fechar} onSalvo={salvo} />}
      {dialogo?.tipo === 'confirmar' && (
        <Dialogo titulo={dialogo.titulo} subtitulo={dialogo.texto} onFechar={fechar}
          acoes={<><button type="button" className="ob-btn-ghost ob-btn-alto" onClick={fechar}>Cancelar</button>
            <button type="button" className="ob-acao is-conferir" onClick={() => { const a = dialogo.acao; setDialogo(null); void a().then(() => carregar()).catch(e => setErro(msgErro(e))); }}>{dialogo.rotulo}</button></>} />
      )}
    </div>
  );
}

function TabelaItens({ itens, podeEditar, onEditar, onExcluir, selecao }: {
  itens: ItemContrato[]; podeEditar: boolean; onEditar: (i: ItemContrato) => void; onExcluir: (i: ItemContrato) => void;
  selecao?: { ids: string[]; alternar: (id: string) => void; todos: (v: boolean) => void };
}) {
  return (
    <div className="lc-tabela">
      <table>
        <thead>
          <tr>
            {selecao && <th className="lc-col-check"><input type="checkbox" aria-label="Marcar todos" checked={selecao.ids.length === itens.length} onChange={e => selecao.todos(e.target.checked)} /></th>}
            <th>Item</th><th className="is-num">Qtd.</th><th className="is-num">Valor unit.</th><th className="is-num">Total</th><th>Saldo</th>{podeEditar && <th />}
          </tr>
        </thead>
        <tbody>
          {itens.map(i => {
            const q = Number(i.quantidade ?? 0), usado = Number(i.usado);
            const pct = q ? Math.min(100, (usado / q) * 100) : 0;
            return (
              <tr key={i.id} className={i.status !== 'ACTIVE' ? 'is-inativo' : undefined}>
                {selecao && <td className="lc-col-check"><input type="checkbox" aria-label={`Marcar ${i.descricao}`} checked={selecao.ids.includes(i.id)} onChange={() => selecao.alternar(i.id)} /></td>}
                <td><span className="lc-item-desc">{i.descricao}</span>{(i.marca || i.categoria) && <small className="lc-item-sub">{[i.marca, i.categoria].filter(Boolean).join(' · ')}</small>}</td>
                <td className="is-num">{num(i.quantidade)} <small>{i.unidade}</small></td>
                <td className="is-num">{i.valorUnitario ? real(i.valorUnitario) : '—'}</td>
                <td className="is-num"><b>{i.valorTotal ? real(i.valorTotal) : '—'}</b></td>
                <td className="lc-col-saldo">
                  {i.disponivel === null ? <small className="lc-sem-limite">sem limite</small> : <>
                    <span className="lc-saldo-barra"><span style={{ width: `${pct}%` }} className={pct >= 100 ? 'is-cheio' : pct >= 80 ? 'is-quase' : ''} /></span>
                    <small>{num(i.disponivel)} livres</small>
                  </>}
                </td>
                {podeEditar && (
                  <td className="lc-col-acoes">
                    <button type="button" className="lc-icone" title="Editar" onClick={() => onEditar(i)}><Icone d={I.lapis} tamanho={14} /></button>
                    {i.status === 'ACTIVE' && <button type="button" className="lc-icone is-perigo" title="Tirar" onClick={() => onExcluir(i)}><Icone d={I.lixo} tamanho={14} /></button>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
