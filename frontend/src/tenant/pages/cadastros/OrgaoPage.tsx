import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cadastrosBaseApi } from '../../../lib/api-client';
import type { Orgao } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import { formatCnpj, formatPhone } from '../../../lib/masks';
import {
  BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Pagina, Selinho, Sep, msgErro, rotaTenant, useResumoCadastros,
} from '../../components/sisobras/so';

interface Form { nome: string; cnpj: string; secretario: string; telefone: string; email: string; endereco: string }

function paraForm(o: Orgao): Form {
  return {
    nome: o.nome ?? '', cnpj: o.cnpj ? formatCnpj(o.cnpj) : '', secretario: o.secretario ?? '',
    telefone: o.telefone ? formatPhone(o.telefone) : '', email: o.email ?? '', endereco: o.endereco ?? '',
  };
}

function Brasao({ url, cor, w, h }: { url: string | null; cor: string; w: number; h: number }) {
  if (url) return <img src={url} alt="" style={{ width: w, height: h, objectFit: 'contain' }} />;
  return <svg aria-hidden="true" width={w} height={h} viewBox="0 0 84 96" fill="none" stroke={cor} strokeWidth="6"><path d="M42 4L76 14V46C76 68 60 84 42 92C24 84 8 68 8 46V14Z" /></svg>;
}

/** Tela 2 · Passo 1 — Órgão */
export function OrgaoPage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const [orgao, setOrgao] = useState<Orgao | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroNome, setErroNome] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cadastrosBaseApi.orgao(entityId).then(o => { setOrgao(o); setForm(paraForm(o)); })
      .catch(e => showToast(msgErro(e, 'Não foi possível abrir o órgão'), 'error'));
  }, [entityId, showToast]);

  if (!orgao || !form) return <Pagina><Carregando /></Pagina>;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    if (k === 'cnpj') v = formatCnpj(v);
    if (k === 'telefone') v = formatPhone(v);
    if (k === 'nome' && v.trim()) setErroNome(false);
    setForm({ ...form, [k]: v });
  };

  async function salvar(depois?: string) {
    if (!form) return;
    if (!form.nome.trim()) { setErroNome(true); showToast('Informe o nome do órgão', 'warning'); return; }
    setSalvando(true);
    try {
      const o = await cadastrosBaseApi.salvarOrgao(entityId, {
        nome: form.nome, cnpj: form.cnpj || null, secretario: form.secretario || null,
        telefone: form.telefone || null, email: form.email || null, endereco: form.endereco || null,
      });
      setOrgao(o); setForm(paraForm(o)); recarregar();
      if (depois) navigate(rotaTenant(entityId, depois));
      else showToast('Órgão salvo');
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  async function trocarBrasao(file: File | undefined) {
    if (!file) return;
    setEnviando(true);
    try { setOrgao(await cadastrosBaseApi.enviarBrasao(entityId, file)); showToast('Brasão trocado'); }
    catch (e) { showToast(msgErro(e, 'Não foi possível enviar a imagem'), 'error'); }
    finally { setEnviando(false); if (arquivo.current) arquivo.current.value = ''; }
  }

  async function removerBrasao() {
    try { setOrgao(await cadastrosBaseApi.removerBrasao(entityId)); showToast('Brasão removido'); }
    catch (e) { showToast(msgErro(e), 'error'); }
  }

  const municipioUf = [orgao.municipio, orgao.uf].filter(Boolean).join(' / ');
  const agora = new Date();
  const carimboData = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <Pagina>
      <CabecalhoPasso passo={1} resumo={resumo} sub="Os dados da prefeitura ou secretaria que usa o sistema. Preencha uma vez; muda pouco." />

      <div className="so-split">
        <Cartao className="grow so-rise" icone="idcard" titulo="Identificação" meta="sai no carimbo das fotos e nos PDFs" ajuda="Ajuda: Identificação">
          <div className="so-fgrid">
            <label className="so-field all"><span className="so-lbl">Nome do órgão <span className="req">*</span></span>
              <span className={`so-ctrl${erroNome ? ' invalid' : ''}`}><Ic n="orgao" /><input type="text" value={form.nome} onChange={set('nome')} /></span>
            </label>
            <label className="so-field"><span className="so-lbl">Município / UF</span>
              <span className="so-ctrl off"><Ic n="lock" /><input type="text" value={municipioUf} disabled /></span>
              <span className="so-help">Vem da implantação. Não muda aqui.</span>
            </label>
            <label className="so-field"><span className="so-lbl">CNPJ</span>
              <span className="so-ctrl mono"><input type="text" inputMode="numeric" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={set('cnpj')} /></span>
            </label>
            <label className="so-field"><span className="so-lbl">Secretário(a) responsável</span>
              <span className="so-ctrl"><input type="text" placeholder="Nome do secretário" value={form.secretario} onChange={set('secretario')} /></span>
              <span className="so-help">Sai nos documentos impressos.</span>
            </label>
            <label className="so-field"><span className="so-lbl">Telefone</span>
              <span className="so-ctrl mono"><input type="tel" placeholder="(75) 0000-0000" value={form.telefone} onChange={set('telefone')} /></span>
            </label>
            <label className="so-field"><span className="so-lbl">E-mail</span>
              <span className="so-ctrl"><input type="email" placeholder="infraestrutura@prefeitura.gov.br" value={form.email} onChange={set('email')} /></span>
            </label>
            <label className="so-field all"><span className="so-lbl">Endereço</span>
              <span className="so-ctrl"><Ic n="pin" /><input type="text" placeholder="Rua, número, bairro" value={form.endereco} onChange={set('endereco')} /></span>
            </label>
          </div>
        </Cartao>

        <Cartao className="side so-rise d1" icone="shield" titulo="Brasão" ajuda="Ajuda: Brasão">
          <div style={{ position: 'relative', height: 176, borderRadius: 14, border: '1.5px dashed var(--line-2)', backgroundColor: 'var(--surface-2)', backgroundImage: 'linear-gradient(var(--gridc) 1px, transparent 1px), linear-gradient(90deg, var(--gridc) 1px, transparent 1px)', backgroundSize: '16px 16px', display: 'grid', placeItems: 'center' }}>
            {orgao.brasaoUrl
              ? <img className="so-brasao-img" src={orgao.brasaoUrl} alt="Brasão do município" />
              : <svg role="img" aria-label="Sem brasão" width="78" height="90" viewBox="0 0 84 96" fill="none" stroke="#635BFF" strokeWidth="2.5" strokeLinejoin="round"><path d="M42 4L76 14V46C76 68 60 84 42 92C24 84 8 68 8 46V14Z" fill="rgba(99,91,255,0.08)" /><path d="M42 24V72M24 44H60" /></svg>}
            <span className="so-badge brand" style={{ position: 'absolute', left: 10, bottom: 10 }}>PNG · JPG</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => trocarBrasao(e.target.files?.[0])} />
            <button type="button" className="so-btn so-ghost" disabled={enviando} onClick={() => arquivo.current?.click()}>
              <Ic n="image" />{enviando ? 'Enviando…' : orgao.brasaoUrl ? 'Trocar imagem' : 'Enviar imagem'}
            </button>
            {orgao.brasaoUrl && <button type="button" className="so-btn so-danger" onClick={removerBrasao}>Remover</button>}
          </div>
          <p className="so-help">PNG ou JPG. Com fundo transparente fica melhor no carimbo.</p>
        </Cartao>
      </div>

      <Cartao className="so-rise d2" icone="eye" tomIcone="cyan" titulo="Onde esses dados aparecem"
        meta="Uma prévia do resultado. Muda na hora, conforme você preenche."
        direita={<Selinho tom="cyan" ponto vivo>prévia</Selinho>} ajuda="Ajuda: Prévia">
        <div className="so-previas">
          <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 150, borderRadius: 12, position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg, #5C6A80 0%, #3A4558 55%, #2A3242 100%)', boxShadow: 'var(--shadow)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(260px 120px at 70% 20%, rgba(255,255,255,0.18), transparent 70%)' }} />
              <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, borderRadius: 9, background: 'rgba(10,12,25,0.78)', color: '#FFFFFF', padding: '7px 9px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Brasao url={orgao.brasaoUrl} cor="#FFFFFF" w={20} h={24} />
                <div style={{ font: "500 10.5px/1.4 'JetBrains Mono', monospace" }}>{carimboData} · Centro<br />-12.5271, -40.3070 · [Servidor]</div>
              </div>
            </div>
            <figcaption style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}><span className="mono" style={{ fontSize: 10, color: 'var(--brand)' }}>01</span>Carimbo das fotos tiradas no app</figcaption>
          </figure>
          <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 150, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '2px solid transparent', borderImage: 'linear-gradient(90deg, #635BFF, #10C6D4, #19B88A) 1' }}>
                <Brasao url={orgao.brasaoUrl} cor="#635BFF" w={20} h={24} />
                <div style={{ fontSize: 10.5, lineHeight: 1.35, color: 'var(--ink-2)', minWidth: 0 }}>
                  <strong style={{ color: 'var(--ink)' }}>Prefeitura Municipal de {orgao.municipio ?? '…'}</strong><br />{form.nome || 'Nome do órgão'}
                </div>
              </div>
              <div style={{ height: 6, width: '80%', background: 'var(--surface-3)', borderRadius: 3 }} />
              <div style={{ height: 6, width: '64%', background: 'var(--surface-3)', borderRadius: 3 }} />
              <div style={{ height: 6, width: '72%', background: 'var(--surface-3)', borderRadius: 3 }} />
            </div>
            <figcaption style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}><span className="mono" style={{ fontSize: 10, color: 'var(--brand)' }}>02</span>Cabeçalho dos PDFs (OS, pedidos, relatórios)</figcaption>
          </figure>
          <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 150, borderRadius: 12, border: '1px solid var(--line)', backgroundColor: 'var(--surface-2)', backgroundImage: 'linear-gradient(var(--gridc) 1px, transparent 1px), linear-gradient(90deg, var(--gridc) 1px, transparent 1px)', backgroundSize: '14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 118, height: 132, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg)', padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center' }}>
                <Brasao url={orgao.brasaoUrl} cor="#635BFF" w={18} h={22} />
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink)' }}>{orgao.municipio ?? 'Município'}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>Peça um serviço</div>
                <div style={{ marginTop: 'auto', width: '100%', height: 18, borderRadius: 6, background: 'linear-gradient(100deg, #635BFF, #756CFF 57%, #657CFF)' }} />
              </div>
            </div>
            <figcaption style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}><span className="mono" style={{ fontSize: 10, color: 'var(--brand)' }}>03</span>Página do munícipe (link / QR Code)</figcaption>
          </figure>
        </div>
      </Cartao>

      <BarraAcoes esquerda={<><b>{form.nome || 'Sem nome'}</b><Sep />{municipioUf}<Sep />passo 1 de 6</>}>
        <Link to={rotaTenant(entityId, 'cadastros')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar aos Cadastros</Link>
        <button type="button" className="so-btn so-ghost" disabled={salvando} onClick={() => salvar()}>Salvar</button>
        <button type="button" className="so-btn so-primary" disabled={salvando} onClick={() => salvar('cadastros/lugares')}>Salvar e ir para Lugares<Ic n="seta" className="arrow" /></button>
      </BarraAcoes>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
