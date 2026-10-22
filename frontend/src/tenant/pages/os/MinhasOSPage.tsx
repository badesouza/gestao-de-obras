import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { osApi, type LinhaOS, type PainelOS } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { Aviso, Carregando, Ic, Pagina, msgErro, rotaTenant } from '../../components/sisobras/so';
import { BarraPrazo, EtapaPill, MarcaServico, distanciaM, textoDistancia } from './os-ui';
import { NovaOSJanela } from './NovaOSJanela';

type Aba = 'fazer' | 'conferir' | 'devolvidas';
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
const ehHoje = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

/** Celular do fiscal: o que fazer, o que espera conferência e o que voltou para refazer */
export function MinhasOSPage() {
  const { entityId, session } = useTenant();
  const { toasts, showToast, closeToast } = useToast();
  const [dados, setDados] = useState<PainelOS | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('fazer');
  const [eu, setEu] = useState<{ lat: number; lng: number } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [nova, setNova] = useState(false);

  const carregar = useCallback(() => {
    osApi.painel(entityId).then(d => { setDados(d); setErro(''); }).catch(e => setErro(msgErro(e, 'Não foi possível carregar as suas OS')));
  }, [entityId]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const on = () => { setOnline(true); carregar(); }, off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    navigator.geolocation?.getCurrentPosition(p => setEu({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 10000, maximumAge: 120000 });
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [carregar]);

  if (!dados) return <Pagina semMira>{erro ? <Aviso tom="amber">{erro}</Aviso> : <Carregando />}</Pagina>;
  const L = dados.linhas;
  const grupos: Record<Aba, LinhaOS[]> = {
    fazer: L.filter(l => (l.etapa === 'REGISTRADA' && !l.devolvida) || (l.etapa === 'AGUARDANDO_APROVACAO' && l.minha))
      .sort((a, b) => Number(b.atrasada) - Number(a.atrasada) || Number(a.etapa === 'AGUARDANDO_APROVACAO') - Number(b.etapa === 'AGUARDANDO_APROVACAO')),
    conferir: L.filter(l => l.etapa === 'EXECUTADA'),
    devolvidas: L.filter(l => l.devolvida),
  };
  const praFazer = grupos.fazer.filter(l => l.etapa === 'REGISTRADA').length + grupos.devolvidas.length;
  const atrasadas = grupos.fazer.filter(l => l.atrasada).length + grupos.devolvidas.filter(l => l.atrasada).length;
  const feitasHoje = L.filter(l => ehHoje(l.executadoEm)).length;
  const totalDia = feitasHoje + praFazer;
  const ring = 170 - 170 * (totalDia ? feitasHoje / totalDia : 0);
  const itens = grupos[aba];

  return (
    <Pagina semMira>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <section className="os-hero" style={{ borderRadius: 22 }} aria-label="Resumo do dia">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="eb">Gestão de Obras · {session.entity.name}</span>
            {!online && <span className="os-pill glass" style={{ marginLeft: 'auto', height: 22, fontSize: 10.5 }}><i style={{ color: '#FDE68A' }} />sem sinal</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1>{saudacao()}, {session.name.split(' ')[0]}</h1>
              <p>{praFazer} {praFazer === 1 ? 'OS para fazer' : 'OS para fazer'}{atrasadas ? ` · ${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : ''}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
                {dados.equipes.slice(0, 3).map(e => <span key={e.id} className="os-pill glass" style={{ height: 21, fontSize: 10.5 }}>{e.nome}</span>)}
              </div>
            </div>
            <div style={{ position: 'relative', width: 64, height: 64 }} title={`${feitasHoje} de ${totalDia} feitas hoje`}>
              <svg className="os-hring" viewBox="0 0 64 64" aria-hidden="true"><circle className="bg" cx="32" cy="32" r="27" /><circle className="fg" cx="32" cy="32" r="27" strokeDashoffset={ring} /></svg>
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: '700 14px var(--font-mono)' }}>{feitasHoje}/{totalDia}</span>
            </div>
          </div>
        </section>

        <div className="os-tiles">
          <div className="os-tile"><b style={{ color: 'var(--brand-ink)' }}>{praFazer}</b><small>para fazer</small></div>
          <div className="os-tile"><b style={{ color: 'var(--cyan)' }}>{grupos.conferir.length}</b><small>a conferir</small></div>
          <div className="os-tile"><b style={{ color: 'var(--mint)' }}>{dados.kpis.noPrazoPct != null ? `${dados.kpis.noPrazoPct}%` : '—'}</b><small>no prazo</small></div>
        </div>

        <div style={{ padding: '14px 2px 0' }}>
          <div className="so-seg full" role="tablist">
            {([['fazer', 'Para fazer'], ['conferir', 'A conferir'], ['devolvidas', 'Devolvidas']] as [Aba, string][]).map(([k, nome]) => (
              <label key={k} className={aba === k ? 'on' : ''}><input type="radio" name="aba" checked={aba === k} onChange={() => setAba(k)} />{nome} <span className="mono" style={{ fontSize: 10.5 }}>{grupos[k].length}</span></label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 2px' }}>
          {itens.map(l => (
            <article key={l.id} className={`os-card${l.atrasada ? ' late' : ''}`}>
              <Link to={rotaTenant(entityId, `os/${l.id}`)} style={{ display: 'flex', flexDirection: 'column', gap: 9, color: 'inherit', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MarcaServico nome={l.tipo || l.servico.nome} iconeDe={l.servico.nome} cor={l.servico.cor} sub={<span className="mono">{l.numeroOS}</span>} />
                  <span style={{ marginLeft: 'auto' }}><EtapaPill etapa={l.etapa} devolvida={l.devolvida} curto /></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                  <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>{[l.logradouro, l.bairro].filter(Boolean).join(' · ') || 'sem endereço'}</span>
                  {eu && l.lat != null && l.lng != null && <span className="so-tag mono">{textoDistancia(distanciaM(eu.lat, eu.lng, l.lat, l.lng))}</span>}
                </div>
                <BarraPrazo l={l} />
                {l.equipe && <small style={{ fontSize: 11, color: 'var(--muted)' }}>{l.equipe.nome}{l.etapa === 'AGUARDANDO_APROVACAO' ? ' · esperando a aprovação' : ''}</small>}
              </Link>
              {l.devolvida && l.motivoDevolucao && <div className="so-note amber" style={{ padding: '8px 10px', fontSize: 12 }}><Ic n="voltar" /><span>{l.motivoDevolucao}</span></div>}
              {l.etapa === 'REGISTRADA' && dados.poderes.podeBaixa && (
                <Link to={rotaTenant(entityId, `os/${l.id}/baixa`)} className="so-btn so-mintbtn os-shine" style={{ height: 44, justifyContent: 'center' }}><Ic n="image" />{l.devolvida ? 'Refazer a baixa' : 'Dar baixa com foto'}</Link>
              )}
            </article>
          ))}
          {!itens.length && <div className="so-note plain"><Ic n="check" /><span>{aba === 'fazer' ? 'Nada para fazer agora.' : aba === 'conferir' ? 'Nenhuma baixa esperando conferência.' : 'Nenhuma OS devolvida.'}</span></div>}
        </div>

        {dados.poderes.podeAbrir && (
          <div style={{ position: 'sticky', bottom: 0, padding: '10px 2px 14px', background: 'linear-gradient(180deg, transparent, var(--bg) 30%)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" className="so-btn so-primary os-fab" style={{ height: 52, fontSize: 15, borderRadius: 13, justifyContent: 'center' }} onClick={() => setNova(true)}><Ic n="plus" />Abrir ocorrência</button>
            <span style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center' }}>Você vê as OS dos seus serviços e das suas equipes.</span>
          </div>
        )}
      </div>
      {nova && <NovaOSJanela onFechar={() => setNova(false)} onCriada={r => { setNova(false); showToast(`${r.numeroOS} aberta · aguardando aprovação`); carregar(); }} />}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
