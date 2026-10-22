import { useEffect, useMemo, useState } from 'react';
import { centrosDeCustoApi, frotaApi, servicosFichaApi } from '../../../lib/api-client';
import type { CampoServico, CamposComuns, FichaServico, ItemFrotaSimples, TipoCampo, TipoLocal, TipoServico, UsoCampo } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { Aviso, Carregando, Ic, Janela, msgErro } from '../../components/sisobras/so';
import { SLUG_POR_CENTRO_ID } from '../servico-config';
import { CORES, camposComunsNovos, padroesDoServico } from './servico-padroes';

/**
 * Janela do serviço em passos — cadastro e edição no mesmo lugar, sem rolar a página:
 * 1 Identificação (com o centro de custo) · 2 Campos comuns · 3 Equipamentos · 4 Ações e atividades · 5 Conferir.
 * Ação = o que caracteriza o serviço (ex.: "Porte da árvore"); atividades = as opções dela (Pequeno, Médio, Grande).
 */

type Base = Pick<FichaServico, 'centros' | 'frota' | 'origens' | 'metaDiasGeral'>;
type Toast = (msg: string, tipo?: 'success' | 'error' | 'warning') => void;

interface Form {
  nome: string; ativo: boolean; tipoServico: TipoServico; cor: string; prazoDias: string;
  subtipos: string[]; municipePode: boolean; nomeMunicipe: string; centroDeCustoId: string;
  campos: CampoServico[]; comuns: CamposComuns;
}

const PASSOS = [
  { n: 1, nome: 'Identificação', ic: 'clipboard' },
  { n: 2, nome: 'Campos comuns', ic: 'list' },
  { n: 3, nome: 'Equipamentos', ic: 'engrenagem' },
  { n: 4, nome: 'Ações e atividades', ic: 'layers' },
  { n: 5, nome: 'Conferir', ic: 'check' },
] as const;

const COMO: { v: TipoCampo; t: string; d: string }[] = [
  { v: 'LISTA', t: 'Uma opção', d: 'o fiscal escolhe uma atividade' },
  { v: 'VARIAS', t: 'Várias', d: 'o fiscal marca quantas quiser' },
  { v: 'NUMERO', t: 'Medidas', d: 'cada atividade é um número com unidade' },
  { v: 'TEXTO', t: 'Texto livre', d: 'o fiscal escreve' },
  { v: 'SIM_NAO', t: 'Sim / Não', d: 'uma pergunta de sim ou não' },
];
const COM_ATIVIDADES: TipoCampo[] = ['LISTA', 'VARIAS', 'NUMERO'];
const NOME_COMO: Record<TipoCampo, string> = { LISTA: 'uma opção', VARIAS: 'várias', NUMERO: 'medidas', TEXTO: 'texto livre', SIM_NAO: 'sim / não' };

const LOCAIS: { v: TipoLocal; t: string; d: string }[] = [
  { v: 'ENDERECO', t: 'Endereço', d: 'bairro e rua, com GPS' },
  { v: 'ROTA', t: 'Rota', d: 'rotas fixas (ex.: varrição)' },
  { v: 'LOCAL', t: 'Local com nome', d: 'praças, prédios, canteiros' },
  { v: 'VEICULO', t: 'Veículo da frota', d: 'o serviço é no veículo (oficina)' },
];
const COMUNS: { k: 'origem' | 'equipe' | 'fotos' | 'observacoes'; t: string; d: string }[] = [
  { k: 'origem', t: 'Origem da demanda', d: 'Ouvidoria, munícipe, vereador…' },
  { k: 'equipe', t: 'Equipe e quem trabalhou', d: 'vem do cadastro de Equipes' },
  { k: 'fotos', t: 'Fotos do antes e do depois', d: 'com carimbo de data, hora e GPS' },
  { k: 'observacoes', t: 'Observações', d: 'texto livre do fiscal' },
];

function paraForm(f: FichaServico): Form {
  const p = padroesDoServico(f.id);
  const salva = !!f.fichaSalvaEm;
  return {
    nome: f.nome, ativo: f.ativo, tipoServico: f.tipoServico ?? p.tipoServico, cor: f.cor ?? p.cor,
    prazoDias: f.prazoDias ? String(f.prazoDias) : '',
    subtipos: salva ? f.subtipos : p.subtipos,
    municipePode: salva ? f.municipePode !== false : p.municipePode,
    nomeMunicipe: (salva ? f.nomeMunicipe : p.nomeMunicipe) ?? '',
    centroDeCustoId: f.centroDeCustoId ?? '',
    campos: salva ? f.campos.map(c => ({ ...c, detalhe: c.detalhe ?? null })) : p.campos,
    comuns: f.camposComuns ?? (f.frotaVinculada.length ? { ...p.camposComuns(f.frota), equipamentos: f.frotaVinculada } : p.camposComuns(f.frota)),
  };
}

function novoForm(): Form {
  return {
    nome: '', ativo: true, tipoServico: 'MANUTENCAO', cor: CORES[0][1], prazoDias: '', subtipos: [],
    municipePode: false, nomeMunicipe: '', centroDeCustoId: '', campos: [], comuns: camposComunsNovos(),
  };
}

/** Lista de textos com "+ adicionar" (atividades, rotas, origens) */
function ListaTextos({ itens, onMudar, placeholder, rotulo }: { itens: string[]; onMudar: (l: string[]) => void; placeholder: string; rotulo: string }) {
  const [novo, setNovo] = useState('');
  function add() {
    const v = novo.split(/\n|;/).map(x => x.trim()).filter(Boolean);
    if (!v.length) return;
    onMudar([...itens, ...v.filter(x => !itens.some(i => i.toLowerCase() === x.toLowerCase()))]);
    setNovo('');
  }
  return (
    <div className="so-wz-lista">
      {itens.map((t, i) => (
        <div key={`${t}-${i}`} className="so-wz-li">
          <span className="n mono">{String(i + 1).padStart(2, '0')}</span>
          <input aria-label={`${rotulo} ${i + 1}`} value={t} onChange={e => onMudar(itens.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" aria-label={`Tirar ${t || 'item'}`} onClick={() => onMudar(itens.filter((_, j) => j !== i))}><Ic n="x" /></button>
        </div>
      ))}
      <div className="so-wz-li add">
        <Ic n="plus" />
        <input aria-label={`Novo: ${rotulo}`} placeholder={placeholder} value={novo} onChange={e => setNovo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} onBlur={add} />
      </div>
    </div>
  );
}

export function ServicoJanela({ servicoId, onFechar, onSalvo, showToast }: {
  servicoId: string | null; onFechar: () => void; onSalvo: (id: string) => void; showToast: Toast;
}) {
  const { entityId } = useTenant();
  const [id, setId] = useState<string | null>(servicoId);
  const [base, setBase] = useState<Base | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [passo, setPasso] = useState(1);
  const [visto, setVisto] = useState(servicoId ? 5 : 1);
  const [salvando, setSalvando] = useState(false);
  const [origens, setOrigens] = useState<string[]>([]);
  const [origensMudou, setOrigensMudou] = useState(false);
  const [verOrigens, setVerOrigens] = useState(false);
  const [semCentroAntigos, setSemCentroAntigos] = useState(0);
  const [acertarAntigos, setAcertarAntigos] = useState(true);
  const [novoCentro, setNovoCentro] = useState<{ nome: string; paiId: string } | null>(null);
  const [novoEquip, setNovoEquip] = useState<{ tipo: 'EQUIPAMENTO' | 'VEICULO'; nome: string; patrimonio: string } | null>(null);
  const [buscaEquip, setBuscaEquip] = useState('');
  const [acaoSel, setAcaoSel] = useState<number>(-1); // -1 = "Tipo de serviço"
  const [copiar, setCopiar] = useState<{ servicos: { id: string; nome: string }[]; de: string; acoes: CampoServico[] | null; marcadas: number[] } | null>(null);
  const [erroNome, setErroNome] = useState(false);
  const slug = id ? SLUG_POR_CENTRO_ID[id] ?? '' : '';

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (servicoId) {
          const f = await servicosFichaApi.obter(entityId, servicoId);
          if (!vivo) return;
          setBase(f); setForm(paraForm(f)); setOrigens(f.origens);
          const s = SLUG_POR_CENTRO_ID[servicoId];
          centrosDeCustoApi.vinculos(entityId, s ? { [s]: servicoId } : {})
            .then(v => { const x = v.find(i => i.servicoId === servicoId); if (vivo && x) setSemCentroAntigos(x.ocorrenciasSemCentro + x.comprasSemCentro); })
            .catch(() => {});
        } else {
          const b = await servicosFichaApi.base(entityId);
          if (!vivo) return;
          setBase(b); setForm(novoForm()); setOrigens(b.origens);
        }
      } catch (e) { showToast(msgErro(e, 'Não foi possível abrir o serviço'), 'error'); onFechar(); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, servicoId]);

  const centrosOrdenados = useMemo(() => base?.centros ?? [], [base]);

  if (!base || !form) {
    return <Janela icone="wrench" titulo="Serviço" largura={980} onFechar={onFechar}><div className="so-wz-corpo"><Carregando /></div></Janela>;
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const setComum = (k: keyof Omit<CamposComuns, 'local' | 'equipamentos'>, v: Partial<UsoCampo>) =>
    setForm(f => (f ? { ...f, comuns: { ...f.comuns, [k]: { ...f.comuns[k], ...v } } } : f));
  const setCampo = (i: number, c: Partial<CampoServico>) => set('campos', form.campos.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const centro = base.centros.find(c => c.id === form.centroDeCustoId);
  const marcados = new Set(form.comuns.equipamentos);
  const equipMarcados = base.frota.filter(f => marcados.has(f.id));

  /* ── conferências de cada passo ── */
  function problemas(n: number): string | null {
    if (n === 1) {
      if (form!.nome.trim().length < 2) return 'Informe o nome do serviço';
      if (!form!.centroDeCustoId) return 'Escolha o centro de custo (ou crie um novo aqui mesmo)';
      const prazo = form!.prazoDias ? Number(form!.prazoDias) : null;
      if (prazo !== null && (!Number.isInteger(prazo) || prazo < 1)) return 'O prazo precisa ser um número de dias';
    }
    if (n === 2) {
      const l = form!.comuns.local;
      if ((l.tipo === 'ROTA' || l.tipo === 'LOCAL') && !l.lista.some(x => x.trim())) return l.tipo === 'ROTA' ? 'Cadastre as rotas do serviço' : 'Cadastre os locais do serviço';
    }
    if (n === 4) {
      const nomes = form!.campos.map(c => c.nome.trim().toLowerCase());
      if (nomes.some(x => !x)) return 'Dê nome a todas as ações';
      if (new Set(nomes).size !== nomes.length) return 'Há duas ações com o mesmo nome';
      const vazia = form!.campos.find(c => (c.tipo === 'LISTA' || c.tipo === 'VARIAS') && !c.opcoes.some(o => o.trim()));
      if (vazia) return `A ação "${vazia.nome}" precisa de ao menos uma atividade`;
    }
    return null;
  }
  function ir(n: number) {
    if (n > passo) {
      for (let k = passo; k < n; k++) {
        const p = problemas(k);
        if (p) { setPasso(k); if (k === 1 && form!.nome.trim().length < 2) setErroNome(true); showToast(p, 'warning'); return; }
      }
    }
    setPasso(n); setVisto(v => Math.max(v, n));
  }

  async function salvar() {
    for (let k = 1; k <= 4; k++) {
      const p = problemas(k);
      if (p) { setPasso(k); showToast(p, 'warning'); return; }
    }
    const f = form!;
    setSalvando(true);
    try {
      let alvo = id;
      if (!alvo) { alvo = (await servicosFichaApi.criar(entityId, f.nome, f.tipoServico)).id; setId(alvo); }
      if (origensMudou) { await servicosFichaApi.salvarOrigens(entityId, origens); setOrigensMudou(false); }
      const veiculoUsa = f.comuns.equipamentos.length > 0;
      await servicosFichaApi.salvar(entityId, alvo, {
        nome: f.nome, ativo: f.ativo, tipoServico: f.tipoServico, cor: f.cor, prazoDias: f.prazoDias ? Number(f.prazoDias) : null,
        subtipos: f.subtipos.map(x => x.trim()).filter(Boolean), municipePode: f.municipePode, nomeMunicipe: f.nomeMunicipe || null,
        centroDeCustoId: f.centroDeCustoId || null,
        camposComuns: { ...f.comuns, veiculo: { usa: veiculoUsa, obrigatorio: veiculoUsa && f.comuns.veiculo.obrigatorio } },
        campos: f.campos.map(c => ({ ...c, nome: c.nome.trim(), opcoes: COM_ATIVIDADES.includes(c.tipo) ? c.opcoes.map(o => o.trim()).filter(Boolean) : [] })),
      });
      if (semCentroAntigos > 0 && acertarAntigos && f.centroDeCustoId) {
        const r = await centrosDeCustoApi.definirCentroDoServico(entityId, alvo, { centroDeCustoId: f.centroDeCustoId, slug, aplicarAntigos: true });
        const n = r.ocorrencias + r.solicitacoes + r.pedidos + r.orcamentos;
        if (n) showToast(`${n} lançamentos antigos foram para o centro ${centro?.codigo ?? ''}`);
      }
      showToast(servicoId ? 'Serviço salvo' : 'Serviço cadastrado');
      onSalvo(alvo);
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  async function criarCentro() {
    if (!novoCentro) return;
    if (novoCentro.nome.trim().length < 2) { showToast('Informe o nome do centro', 'warning'); return; }
    try {
      const c = await centrosDeCustoApi.criar(entityId, { nome: novoCentro.nome.trim(), tipo: 'SETOR', paiId: novoCentro.paiId || null });
      setBase(b => (b ? { ...b, centros: [...b.centros, { id: c.id, codigo: c.codigo, nome: c.nome, paiId: c.paiId }].sort((a, z) => a.codigo.localeCompare(z.codigo, 'pt-BR', { numeric: true })) } : b));
      set('centroDeCustoId', c.id); setNovoCentro(null);
      showToast(`Centro ${c.codigo} criado`);
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  async function criarEquip() {
    if (!novoEquip) return;
    if (novoEquip.nome.trim().length < 2) { showToast('Informe como a equipe chama', 'warning'); return; }
    try {
      const r = await frotaApi.criar(entityId, { tipo: novoEquip.tipo, nome: novoEquip.nome.trim(), subtipo: null, placa: null, patrimonio: novoEquip.patrimonio.trim() || null, equipeId: null, servicoIds: id ? [id] : [], vincularDepois: !id });
      const item: ItemFrotaSimples = { id: r.id, tipo: novoEquip.tipo, nome: novoEquip.nome.trim(), subtipo: null, placa: null, patrimonio: novoEquip.patrimonio.trim() || null };
      setBase(b => (b ? { ...b, frota: [...b.frota, item] } : b));
      set('comuns', { ...form!.comuns, equipamentos: [...form!.comuns.equipamentos, r.id] });
      setNovoEquip(null);
      showToast(`${novoEquip.tipo === 'VEICULO' ? 'Veículo' : 'Equipamento'} cadastrado e marcado`);
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  function marcarEquip(fid: string, on: boolean) {
    const l = on ? [...form!.comuns.equipamentos, fid] : form!.comuns.equipamentos.filter(x => x !== fid);
    set('comuns', { ...form!.comuns, equipamentos: l });
  }

  function novaAcao() {
    const c: CampoServico = { nome: '', detalhe: null, tipo: 'LISTA', opcoes: [], momento: 'BAIXA', obrigatorio: false };
    set('campos', [...form!.campos, c]); setAcaoSel(form!.campos.length); setCopiar(null);
  }

  async function abrirCopiar() {
    try {
      const l = await servicosFichaApi.listar(entityId);
      setCopiar({ servicos: l.servicos.filter(s => s.id !== id && s.ativo).map(s => ({ id: s.id, nome: s.nome })), de: '', acoes: null, marcadas: [] });
    } catch (e) { showToast(msgErro(e), 'error'); }
  }
  async function escolherOrigemCopia(de: string) {
    if (!copiar) return;
    setCopiar({ ...copiar, de, acoes: null, marcadas: [] });
    if (!de) return;
    try {
      const f = await servicosFichaApi.obter(entityId, de);
      const acoes = (f.fichaSalvaEm ? f.campos : padroesDoServico(de).campos).map(c => ({ ...c, id: undefined, detalhe: c.detalhe ?? null }));
      setCopiar(c => (c ? { ...c, de, acoes, marcadas: acoes.map((_, i) => i) } : c));
    } catch (e) { showToast(msgErro(e), 'error'); }
  }
  function confirmarCopia() {
    if (!copiar?.acoes) return;
    const existentes = new Set(form!.campos.map(c => c.nome.trim().toLowerCase()));
    const novas = copiar.marcadas.map(i => copiar.acoes![i]).filter(c => !existentes.has(c.nome.trim().toLowerCase()));
    if (!novas.length) { showToast('Essas ações já estão neste serviço', 'warning'); return; }
    set('campos', [...form!.campos, ...novas]);
    setAcaoSel(form!.campos.length); setCopiar(null);
    showToast(`${novas.length} ${novas.length === 1 ? 'ação copiada' : 'ações copiadas'}`);
  }

  const acao = acaoSel >= 0 ? form.campos[acaoSel] : null;
  const ehNovo = !servicoId;
  const local = form.comuns.local;
  const filtroEquip = (f: ItemFrotaSimples) => !buscaEquip.trim() || `${f.nome} ${f.subtipo ?? ''} ${f.patrimonio ?? ''}`.toLowerCase().includes(buscaEquip.trim().toLowerCase());

  return (
    <Janela icone={ehNovo ? 'plus' : 'editar'} eyebrow={<>Cadastros · Serviços{centro ? <> · <span className="mono">{centro.codigo}</span> {centro.nome}</> : ''}</>}
      titulo={ehNovo ? (form.nome.trim() ? `Novo serviço: ${form.nome}` : 'Novo serviço') : `Editar ${form.nome || 'serviço'}`}
      sub="Tudo o que compõe o serviço, em 5 passos. Nada fica valendo até você clicar em Salvar."
      largura={980} onFechar={onFechar} ajuda="Ajuda: Serviço"
      rodape={<>
        <span className="esq so-wz-pe">Passo <b className="mono">{passo}</b> de 5 · {PASSOS[passo - 1].nome}</span>
        <button type="button" className="so-btn so-ghost" onClick={onFechar}>Cancelar</button>
        {passo > 1 && <button type="button" className="so-btn so-ghost" onClick={() => setPasso(passo - 1)}><Ic n="voltar" className="back" />Voltar</button>}
        {passo < 5 && <button type="button" className={`so-btn ${ehNovo ? 'so-primary' : 'so-ghost'}`} onClick={() => ir(passo + 1)}>Avançar<Ic n="seta" className="arrow" /></button>}
        {(passo === 5 || !ehNovo) && <button type="button" className="so-btn so-primary" disabled={salvando} onClick={salvar}><Ic n="check" />{ehNovo ? 'Salvar serviço' : 'Salvar'}</button>}
      </>}>

      <ol className="so-regua c5 so-wz-regua" aria-label="Passos do serviço">
        {PASSOS.map(p => {
          const pode = p.n <= visto;
          const ok = p.n < 5 && p.n <= visto && !problemas(p.n) && p.n !== passo;
          return (
            <li key={p.n} className={`so-sg ${p.n === passo ? 'cur' : ok ? 'ok' : 'opt'}`}>
              <a href={`#passo-${p.n}`} aria-current={p.n === passo ? 'step' : undefined} aria-disabled={!pode}
                onClick={e => { e.preventDefault(); if (pode || p.n === visto + 1) ir(p.n); }}>
                <span className="sg-ic"><Ic n={p.ic} /></span>
                <span className="sg-tx"><b>{p.nome}</b><small><span>0{p.n}</span>{p.n === passo ? 'Você está aqui' : ok ? 'Pronto' : pode ? 'Ver' : 'A seguir'}</small></span>
              </a>
            </li>
          );
        })}
      </ol>

      <div className="so-wz-corpo" id={`passo-${passo}`}>
        {/* ── 1 · Identificação ── */}
        {passo === 1 && (
          <div className="so-wz-2col">
            <div className="so-wz-col">
              <div className="so-fs-t">O serviço</div>
              <label className="so-field"><span className="so-lbl">Nome do serviço <span className="req">*</span></span>
                <span className={`so-ctrl${erroNome ? ' invalid' : ''}`}><input placeholder="Ex.: Drenagem" value={form.nome} onChange={e => { set('nome', e.target.value); if (e.target.value.trim().length >= 2) setErroNome(false); }} /></span>
              </label>
              <div className="so-row2">
                <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0 }}>
                  <legend className="so-lbl" style={{ marginBottom: 5 }}>Tipo</legend>
                  <div className="so-seg full">
                    <label className={form.tipoServico === 'MANUTENCAO' ? 'on' : ''}><input type="radio" name="wz-tipo" checked={form.tipoServico === 'MANUTENCAO'} onChange={() => set('tipoServico', 'MANUTENCAO')} /> Manutenção</label>
                    <label className={form.tipoServico === 'CONSTRUCAO' ? 'on' : ''}><input type="radio" name="wz-tipo" checked={form.tipoServico === 'CONSTRUCAO'} onChange={() => set('tipoServico', 'CONSTRUCAO')} /> Construção</label>
                  </div>
                </fieldset>
                <label className="so-field"><span className="so-lbl">Prazo de atendimento <span className="opt">padrão: {base.metaDiasGeral} dias</span></span>
                  <span className="so-ctrl num"><input type="number" min={1} placeholder={String(base.metaDiasGeral)} aria-label="Prazo em dias" value={form.prazoDias} onChange={e => set('prazoDias', e.target.value)} /><span className="suf">dias</span></span>
                </label>
              </div>
              <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="so-lbl" style={{ marginBottom: 5 }}>Cor no mapa e no painel</legend>
                <div className="so-sws">
                  {CORES.map(([nome, cor]) => <button key={cor} type="button" className={`so-sw${form.cor.toLowerCase() === cor ? ' on' : ''}`} aria-label={nome} aria-pressed={form.cor.toLowerCase() === cor} style={{ background: cor }} onClick={() => set('cor', cor)} />)}
                </div>
              </fieldset>
              <div className="so-wz-box">
                <label className={`so-ckrow${form.municipePode ? ' on' : ''}`}><input type="checkbox" className="so-ck" checked={form.municipePode} onChange={e => set('municipePode', e.target.checked)} /> <span style={{ fontWeight: 800 }}>O munícipe pode pedir este serviço</span></label>
                {form.municipePode && (
                  <label className="so-field"><span className="so-lbl">Como aparece para o munícipe</span>
                    <span className="so-ctrl"><input placeholder="Ex.: Lâmpada apagada ou poste com problema" value={form.nomeMunicipe} onChange={e => set('nomeMunicipe', e.target.value)} /></span>
                  </label>
                )}
              </div>
            </div>

            <div className="so-wz-col">
              <div className="so-fs-t">Centro de custo <span className="tag">obrigatório</span></div>
              <p className="so-help">Tudo o que for lançado neste serviço — OS e compras — vai para este centro.</p>
              <label className="so-field"><span className="so-lbl">De qual centro de custo ele faz parte <span className="req">*</span></span>
                <span className={`so-ctrl${!form.centroDeCustoId ? ' warn' : ''}`}><Ic n="pie" />
                  <select value={form.centroDeCustoId} onChange={e => set('centroDeCustoId', e.target.value)}>
                    <option value="">Escolha o centro…</option>
                    {centrosOrdenados.map(c => <option key={c.id} value={c.id}>{c.paiId ? ' ' : ''}{c.codigo} · {c.nome}</option>)}
                  </select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
              </label>
              {!novoCentro ? (
                <button type="button" className="so-btn so-dashed" style={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    const topo = base.centros.find(c => !c.paiId);
                    setNovoCentro({ nome: form.nome, paiId: topo?.id ?? '' });
                  }}><Ic n="plus" />Criar um centro novo aqui</button>
              ) : (
                <div className="so-wz-box">
                  <div className="so-fs-t">Novo centro de custo</div>
                  <label className="so-field"><span className="so-lbl">Nome <span className="opt">o código (CC-…) sai sozinho</span></span><span className="so-ctrl"><input value={novoCentro.nome} placeholder="Ex.: Drenagem" onChange={e => setNovoCentro({ ...novoCentro, nome: e.target.value })} /></span></label>
                  <label className="so-field"><span className="so-lbl">Fica dentro de</span>
                    <span className="so-ctrl"><select value={novoCentro.paiId} onChange={e => setNovoCentro({ ...novoCentro, paiId: e.target.value })}><option value="">Nenhum (é o topo)</option>{base.centros.filter(c => !c.paiId).map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
                  </label>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" className="so-btn so-ghost sm" onClick={() => setNovoCentro(null)}>Cancelar</button>
                    <button type="button" className="so-btn so-primary sm" onClick={criarCentro}><Ic n="check" />Criar centro</button>
                  </div>
                </div>
              )}
              {semCentroAntigos > 0 && (
                <label className={`so-ckrow${acertarAntigos ? ' on' : ''}`}><input type="checkbox" className="so-ck" checked={acertarAntigos} onChange={e => setAcertarAntigos(e.target.checked)} />
                  <span>Levar também para este centro os <b>{semCentroAntigos}</b> lançamentos antigos que ficaram sem centro</span></label>
              )}
            </div>
          </div>
        )}

        {/* ── 2 · Campos comuns ── */}
        {passo === 2 && (
          <div className="so-wz-2col">
            <div className="so-wz-col">
              <div className="so-fs-t">Onde o serviço acontece</div>
              <div className="so-wz-opts">
                {LOCAIS.map(l => (
                  <label key={l.v} className={`so-wz-opt${local.tipo === l.v ? ' on' : ''}`}>
                    <input type="radio" name="wz-local" checked={local.tipo === l.v} onChange={() => set('comuns', { ...form.comuns, local: { ...local, tipo: l.v } })} />
                    <b>{l.t}</b><small>{l.d}</small>
                  </label>
                ))}
              </div>
              {(local.tipo === 'ROTA' || local.tipo === 'LOCAL') && (
                <>
                  <div className="so-fs-t">{local.tipo === 'ROTA' ? 'Rotas' : 'Locais'} <span className="tag">{local.lista.length}</span></div>
                  <div className="so-wz-scroll">
                    <ListaTextos itens={local.lista} rotulo={local.tipo === 'ROTA' ? 'Rota' : 'Local'}
                      placeholder={local.tipo === 'ROTA' ? 'Nova rota (pode colar várias, uma por linha)' : 'Novo local (ex.: Praça da Liberdade)'}
                      onMudar={l => set('comuns', { ...form.comuns, local: { ...local, lista: l } })} />
                  </div>
                </>
              )}
              {local.tipo === 'ENDERECO' && <p className="so-help">O fiscal escolhe o bairro (cadastro de Lugares), informa a rua e o GPS marca o ponto.</p>}
              {local.tipo === 'VEICULO' && <p className="so-help">O fiscal escolhe o veículo do cadastro de Veículos (placa ou patrimônio).</p>}
            </div>

            <div className="so-wz-col">
              <div className="so-fs-t">O que vem em toda OS deste serviço</div>
              <div className="so-wz-comuns">
                <div className="h"><span>Campo</span><span>Usa</span><span>Obrigatório</span></div>
                {COMUNS.map(c => {
                  const u = form.comuns[c.k];
                  return (
                    <div key={c.k} className={`r${u.usa ? '' : ' off'}`}>
                      <span><b>{c.t}</b><small>{c.d}{c.k === 'origem' && <> · <button type="button" className="so-linkbtn" onClick={() => setVerOrigens(v => !v)}>{verOrigens ? 'fechar a lista' : 'editar a lista'}</button></>}</small></span>
                      <span><input type="checkbox" role="switch" className="so-switch" aria-label={`Usa ${c.t}`} checked={u.usa} onChange={e => setComum(c.k, { usa: e.target.checked, obrigatorio: e.target.checked && u.obrigatorio })} /></span>
                      <span><input type="checkbox" className="so-ck" aria-label={`${c.t} obrigatório`} disabled={!u.usa} checked={u.obrigatorio} onChange={e => setComum(c.k, { obrigatorio: e.target.checked })} /></span>
                    </div>
                  );
                })}
                <div className="r fixo"><span><b>Etapa da OS</b><small>o fluxo de aprovação (Fluxo e aprovações)</small></span><span className="so-badge ink">sempre</span><span /></div>
              </div>
              {verOrigens && (
                <div className="so-wz-box">
                  <div className="so-fs-t">Origens da demanda <span className="tag">vale para todos os serviços</span></div>
                  <div className="so-wz-scroll sm">
                    <ListaTextos itens={origens} rotulo="Origem" placeholder="Nova origem (ex.: Ministério Público)" onMudar={l => { setOrigens(l); setOrigensMudou(true); }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 3 · Equipamentos ── */}
        {passo === 3 && (
          <div className="so-wz-col" style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <p className="so-help" style={{ flex: '1 1 320px', fontSize: 12.5 }}>Marque o que este serviço <b>pode usar</b>. Na baixa da OS, o fiscal só vê estes. <b className="mono">{equipMarcados.length}</b> marcados.</p>
              <span className="so-ctrl" style={{ flex: '0 1 220px' }}><Ic n="search" /><input placeholder="Buscar" aria-label="Buscar equipamento" value={buscaEquip} onChange={e => setBuscaEquip(e.target.value)} /></span>
              {!novoEquip && <button type="button" className="so-btn so-dashed" onClick={() => setNovoEquip({ tipo: 'EQUIPAMENTO', nome: '', patrimonio: '' })}><Ic n="plus" />Cadastrar aqui</button>}
            </div>
            {novoEquip && (
              <div className="so-wz-box so-wz-novoeq">
                <div className="so-seg">
                  <label className={novoEquip.tipo === 'EQUIPAMENTO' ? 'on' : ''}><input type="radio" name="wz-eqt" checked={novoEquip.tipo === 'EQUIPAMENTO'} onChange={() => setNovoEquip({ ...novoEquip, tipo: 'EQUIPAMENTO' })} /> Equipamento</label>
                  <label className={novoEquip.tipo === 'VEICULO' ? 'on' : ''}><input type="radio" name="wz-eqt" checked={novoEquip.tipo === 'VEICULO'} onChange={() => setNovoEquip({ ...novoEquip, tipo: 'VEICULO' })} /> Veículo</label>
                </div>
                <span className="so-ctrl" style={{ flex: '2 1 220px' }}><input aria-label="Como a equipe chama" placeholder={novoEquip.tipo === 'VEICULO' ? 'Ex.: Caminhão basculante 02' : 'Ex.: Roçadeira costal 03'} value={novoEquip.nome} onChange={e => setNovoEquip({ ...novoEquip, nome: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') criarEquip(); }} /></span>
                <span className="so-ctrl mono" style={{ flex: '1 1 110px' }}><input aria-label="Patrimônio" placeholder="Patrimônio" value={novoEquip.patrimonio} onChange={e => setNovoEquip({ ...novoEquip, patrimonio: e.target.value })} /></span>
                <button type="button" className="so-btn so-ghost sm" onClick={() => setNovoEquip(null)}>Cancelar</button>
                <button type="button" className="so-btn so-primary sm" onClick={criarEquip}><Ic n="check" />Cadastrar e marcar</button>
              </div>
            )}
            <div className="so-wz-eqcols">
              {(['EQUIPAMENTO', 'VEICULO'] as const).map(t => {
                const itens = base.frota.filter(f => f.tipo === t && filtroEquip(f));
                const todos = base.frota.filter(f => f.tipo === t);
                return (
                  <div key={t} className="so-wz-col">
                    <div className="so-fs-t">{t === 'EQUIPAMENTO' ? 'Equipamentos' : 'Veículos'} <span className="tag">{todos.filter(f => marcados.has(f.id)).length} de {todos.length}</span></div>
                    <div className="so-wz-scroll">
                      {itens.map(f => (
                        <label key={f.id} className={`so-ckrow${marcados.has(f.id) ? ' on' : ''}`}>
                          <input type="checkbox" className="so-ck" checked={marcados.has(f.id)} onChange={e => marcarEquip(f.id, e.target.checked)} />
                          <span>{f.nome}{f.subtipo && f.subtipo !== f.nome ? <small className="so-wz-sub"> · {f.subtipo}</small> : null}</span>
                          {(f.placa || f.patrimonio) && <span className="et">{f.placa ?? f.patrimonio}</span>}
                        </label>
                      ))}
                      {!todos.length && <p className="so-help" style={{ padding: 8 }}>Nada cadastrado ainda. Use "Cadastrar aqui".</p>}
                      {todos.length > 0 && !itens.length && <p className="so-help" style={{ padding: 8 }}>Nada com essa busca.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            {equipMarcados.length > 0 && (
              <label className={`so-ckrow${form.comuns.veiculo.obrigatorio ? ' on' : ''}`} style={{ alignSelf: 'flex-start' }}>
                <input type="checkbox" className="so-ck" checked={form.comuns.veiculo.obrigatorio} onChange={e => setComum('veiculo', { usa: true, obrigatorio: e.target.checked })} />
                O fiscal é obrigado a dizer o que usou na baixa
              </label>
            )}
          </div>
        )}

        {/* ── 4 · Ações e atividades ── */}
        {passo === 4 && (
          <div className="so-wz-md">
            <div className="so-wz-acoes">
              <div className="so-fs-t">Ações <span className="tag">{form.campos.length + 1}</span></div>
              <div className="so-wz-scroll">
                <button type="button" className={`so-wz-acao${acaoSel === -1 && !copiar ? ' on' : ''}`} onClick={() => { setAcaoSel(-1); setCopiar(null); }}>
                  <b>Tipo de serviço</b><small>{form.subtipos.length} atividades · uma opção · fixa</small>
                </button>
                {form.campos.map((c, i) => (
                  <button key={i} type="button" className={`so-wz-acao${acaoSel === i && !copiar ? ' on' : ''}${!c.nome.trim() ? ' vazia' : ''}`} onClick={() => { setAcaoSel(i); setCopiar(null); }}>
                    <b>{c.nome.trim() || 'Ação sem nome'}</b>
                    <small>{COM_ATIVIDADES.includes(c.tipo) ? `${c.opcoes.filter(o => o.trim()).length} atividades · ` : ''}{NOME_COMO[c.tipo]} · {c.momento === 'ABERTURA' ? 'abertura' : 'baixa'}</small>
                  </button>
                ))}
              </div>
              <button type="button" className="so-btn so-dashed" onClick={novaAcao}><Ic n="plus" />Nova ação</button>
              <button type="button" className="so-btn so-ghost sm" onClick={abrirCopiar}><Ic n="copiar" />Copiar de outro serviço</button>
            </div>

            <div className="so-wz-det">
              {copiar ? (
                <>
                  <div className="so-fs-t">Copiar ações de outro serviço</div>
                  <label className="so-field"><span className="so-lbl">De qual serviço</span>
                    <span className="so-ctrl"><select value={copiar.de} onChange={e => escolherOrigemCopia(e.target.value)}><option value="">Escolha…</option>{copiar.servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
                  </label>
                  {copiar.de && !copiar.acoes && <Carregando />}
                  {copiar.acoes && (
                    <div className="so-wz-scroll">
                      {copiar.acoes.map((c, i) => (
                        <label key={i} className={`so-ckrow${copiar.marcadas.includes(i) ? ' on' : ''}`}>
                          <input type="checkbox" className="so-ck" checked={copiar.marcadas.includes(i)} onChange={e => setCopiar({ ...copiar, marcadas: e.target.checked ? [...copiar.marcadas, i] : copiar.marcadas.filter(x => x !== i) })} />
                          <span><b>{c.nome}</b>{c.opcoes.length ? <small className="so-wz-sub"> · {c.opcoes.join(', ')}</small> : null}</span>
                        </label>
                      ))}
                      {!copiar.acoes.length && <p className="so-help">Esse serviço não tem ações próprias.</p>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 'auto' }}>
                    <button type="button" className="so-btn so-ghost sm" onClick={() => setCopiar(null)}>Cancelar</button>
                    <button type="button" className="so-btn so-primary sm" disabled={!copiar.acoes || !copiar.marcadas.length} onClick={confirmarCopia}><Ic n="copiar" />Copiar marcadas</button>
                  </div>
                </>
              ) : acaoSel === -1 ? (
                <>
                  <div className="so-fs-t">Tipo de serviço <span className="tag">ação fixa</span></div>
                  <p className="so-help">O que se faz neste serviço. O fiscal escolhe <b>uma</b> atividade ao abrir a OS. Ex.: na Poda — Poda, Supressão, Remoção de toco.</p>
                  <div className="so-fs-t">Atividades <span className="tag">{form.subtipos.length}</span></div>
                  <div className="so-wz-scroll">
                    <ListaTextos itens={form.subtipos} rotulo="Atividade" placeholder="Nova atividade (pode colar várias, uma por linha)" onMudar={l => set('subtipos', l)} />
                  </div>
                </>
              ) : acao ? (
                <>
                  <div className="so-wz-cab">
                    <label className="so-field" style={{ flex: 1 }}><span className="so-lbl">Nome da ação <span className="req">*</span></span>
                      <span className={`so-ctrl${!acao.nome.trim() ? ' warn' : ''}`}><input placeholder="Ex.: Porte da árvore" value={acao.nome} onChange={e => setCampo(acaoSel, { nome: e.target.value })} /></span>
                    </label>
                    <button type="button" className="so-acao del" aria-label={`Tirar a ação ${acao.nome || ''}`} title="Tirar esta ação"
                      onClick={() => { set('campos', form.campos.filter((_, j) => j !== acaoSel)); setAcaoSel(-1); }}><Ic n="lixeira" /></button>
                  </div>
                  <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0 }}>
                    <legend className="so-lbl" style={{ marginBottom: 5 }}>Como o fiscal preenche</legend>
                    <div className="so-seg full">
                      {COMO.map(o => <label key={o.v} title={o.d} className={acao.tipo === o.v ? 'on' : ''}><input type="radio" name="wz-como" checked={acao.tipo === o.v} onChange={() => setCampo(acaoSel, { tipo: o.v })} /> {o.t}</label>)}
                    </div>
                    <span className="so-help" style={{ marginTop: 4 }}>{COMO.find(o => o.v === acao.tipo)?.d}.</span>
                  </fieldset>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                    <div className="so-seg">
                      <label className={acao.momento === 'ABERTURA' ? 'on' : ''}><input type="radio" name="wz-quando" checked={acao.momento === 'ABERTURA'} onChange={() => setCampo(acaoSel, { momento: 'ABERTURA' })} /> Na abertura</label>
                      <label className={acao.momento === 'BAIXA' ? 'on' : ''}><input type="radio" name="wz-quando" checked={acao.momento === 'BAIXA'} onChange={() => setCampo(acaoSel, { momento: 'BAIXA' })} /> Na baixa</label>
                    </div>
                    <label className={`so-ckrow${acao.obrigatorio ? ' on' : ''}`}><input type="checkbox" className="so-ck" checked={acao.obrigatorio} onChange={e => setCampo(acaoSel, { obrigatorio: e.target.checked })} /> Obrigatório</label>
                  </div>
                  {COM_ATIVIDADES.includes(acao.tipo) ? (
                    <>
                      <div className="so-fs-t">{acao.tipo === 'NUMERO' ? 'Medidas' : 'Atividades'} <span className="tag">{acao.opcoes.filter(o => o.trim()).length}</span></div>
                      <div className="so-wz-scroll">
                        <ListaTextos itens={acao.opcoes} rotulo={acao.tipo === 'NUMERO' ? 'Medida' : 'Atividade'}
                          placeholder={acao.tipo === 'NUMERO' ? 'Nova medida com a unidade (ex.: Área (m²))' : 'Nova atividade (pode colar várias, uma por linha)'}
                          onMudar={l => setCampo(acaoSel, { opcoes: l })} />
                      </div>
                      {acao.tipo === 'NUMERO' && !acao.opcoes.some(o => o.trim()) && <p className="so-help">Sem medidas: o fiscal informa um número só, com o nome da ação.</p>}
                    </>
                  ) : (
                    <p className="so-help">{acao.tipo === 'TEXTO' ? 'O fiscal escreve a resposta. Não tem atividades.' : 'O fiscal responde Sim ou Não. Não tem atividades.'}</p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* ── 5 · Conferir ── */}
        {passo === 5 && (
          <div className="so-wz-conf">
            <section>
              <h3><Ic n="clipboard" />Identificação <button type="button" className="so-linkbtn" onClick={() => setPasso(1)}>alterar</button></h3>
              <p><span className="so-dotc" style={{ background: form.cor }} /> <b>{form.nome || '—'}</b> · {form.tipoServico === 'CONSTRUCAO' ? 'Construção' : 'Manutenção'}</p>
              <p>Centro de custo: {centro ? <b><span className="mono">{centro.codigo}</span> {centro.nome}</b> : <span className="so-badge amber">falta</span>}</p>
              <p>Prazo: <b>{form.prazoDias || base.metaDiasGeral} dias</b>{!form.prazoDias && ' (padrão)'}</p>
              <p>Munícipe: <b>{form.municipePode ? `pode pedir${form.nomeMunicipe ? ` — "${form.nomeMunicipe}"` : ''}` : 'não pede'}</b></p>
            </section>
            <section>
              <h3><Ic n="list" />Campos comuns <button type="button" className="so-linkbtn" onClick={() => setPasso(2)}>alterar</button></h3>
              <p>Onde: <b>{LOCAIS.find(l => l.v === local.tipo)?.t}</b>{(local.tipo === 'ROTA' || local.tipo === 'LOCAL') && ` · ${local.lista.length} ${local.tipo === 'ROTA' ? 'rotas' : 'locais'}`}</p>
              {COMUNS.map(c => <p key={c.k}>{form.comuns[c.k].usa ? <Ic n="check" className="ok" /> : <Ic n="x" className="no" />} {c.t}{form.comuns[c.k].usa && form.comuns[c.k].obrigatorio && <span className="so-badge brand" style={{ marginLeft: 6 }}>obrigatório</span>}</p>)}
            </section>
            <section>
              <h3><Ic n="engrenagem" />Equipamentos <button type="button" className="so-linkbtn" onClick={() => setPasso(3)}>alterar</button></h3>
              {equipMarcados.length ? <p>{equipMarcados.map(e => e.nome).join(' · ')}</p> : <p className="so-help">Nenhum marcado: o fiscal não informa equipamento neste serviço.</p>}
            </section>
            <section>
              <h3><Ic n="layers" />Ações e atividades <button type="button" className="so-linkbtn" onClick={() => setPasso(4)}>alterar</button></h3>
              <p><b>Tipo de serviço</b> → {form.subtipos.length ? form.subtipos.join(', ') : <span className="so-help">sem atividades</span>}</p>
              {form.campos.map((c, i) => <p key={i}><b>{c.nome || 'sem nome'}</b> → {COM_ATIVIDADES.includes(c.tipo) ? c.opcoes.filter(o => o.trim()).join(', ') || '—' : NOME_COMO[c.tipo]}</p>)}
            </section>
            {!form.centroDeCustoId && <Aviso tom="amber">Falta o centro de custo (passo 1).</Aviso>}
          </div>
        )}
      </div>
    </Janela>
  );
}
