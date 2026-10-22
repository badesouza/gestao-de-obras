import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { publicApi, type EntradaPublica } from '../../lib/api-client';
import { SimboloSisObras } from '../marca/SimboloSisObras';
import { MapaVivo } from './MapaVivo';
import { LoginSaudacao } from './LoginVitrine';
import './login.css';
import './login-cidade.css';

/* ─── Entrada da prefeitura: a cidade sendo atendida ──────────────────────
   Mapa vivo na tela inteira, login de vidro por cima e os números do dia
   embaixo. Números e últimas OS vêm da consulta pública (só totais);
   a cidade e as luzes são ilustração. */

const CORES_PADRAO = ['#8B84FF', '#3DD6A6', '#22D3EE', '#F5A524'];
const ETAPA: Record<string, string> = {
  AGUARDANDO_APROVACAO: 'aguardando aprovação', REGISTRADA: 'aprovada', EXECUTADA: 'executada', FINALIZADA: 'finalizada',
};
const ORIGEM: Record<string, string> = { MUNICIPE: 'pedida pelo munícipe', CAMPO: 'aberta no campo', ESCRITORIO: 'aberta pelo escritório' };
type Ultima = Omit<EntradaPublica['ultimas'][number], 'cor'> & { cor: string };

function useLargo() {
  const [largo, setLargo] = useState(() => window.matchMedia('(min-width: 1000px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1000px)');
    const muda = () => setLargo(mq.matches);
    mq.addEventListener('change', muda);
    return () => mq.removeEventListener('change', muda);
  }, []);
  return largo;
}

function quando(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/** linha de tendência dos 14 dias (vazios repetem o último valor) */
function Tendencia({ valores, cor }: { valores: (number | null)[]; cor: string }) {
  const v = valores.reduce<number[]>((acc, x) => [...acc, x ?? acc[acc.length - 1] ?? 0], []);
  const max = Math.max(...v), min = Math.min(...v), amp = max - min || 1;
  const d = v.map((y, i) => `${i ? 'L' : 'M'}${(1 + i * 78 / (v.length - 1)).toFixed(1)} ${(23 - (y - min) / amp * 19).toFixed(1)}`).join(' ');
  return <svg className="cid-sp" viewBox="0 0 80 26" preserveAspectRatio="none" aria-hidden="true"><path d={d} style={{ stroke: cor }} /></svg>;
}

function Kpi({ rotulo, valor, sufixo, cor, serie, barra }: { rotulo: string; valor: string; sufixo?: string; cor: string; serie: (number | null)[]; barra: number }) {
  return (
    <div className="cid-kpi" style={{ '--c': cor } as CSSProperties}>
      <span>{rotulo}</span>
      <div className="kl"><strong>{valor}{sufixo && <small>{sufixo}</small>}</strong><Tendencia valores={serie} cor={cor} /></div>
      <div className="tr"><i style={{ width: `${Math.max(0, Math.min(100, barra))}%` }} /></div>
    </div>
  );
}

export function LoginCidade({ entityId, orgao, children }: { entityId?: string; orgao?: string; children: ReactNode }) {
  const largo = useLargo();
  const cartao = useRef<HTMLDivElement>(null);
  const [dados, setDados] = useState<EntradaPublica | null>(null);
  const [aoVivo, setAoVivo] = useState<Ultima | null>(null);
  const [pulso, setPulso] = useState(0);
  const fila = useRef(0);

  /* números do dia: busca ao abrir e de minuto em minuto */
  useEffect(() => {
    if (!entityId) return;
    let vivo = true;
    const busca = () => publicApi.entrada(entityId).then(d => { if (vivo) setDados(d); }).catch(() => { /* a tela segue só com o mapa */ });
    busca();
    const t = window.setInterval(busca, 60_000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [entityId]);

  const coresServ = (dados?.servicos ?? []).map((s, i) => s.cor || CORES_PADRAO[i % 4]);
  const cores = coresServ.length ? coresServ : CORES_PADRAO;
  const corDe = (nome: string, cor: string | null) => {
    const i = dados?.servicos.findIndex(s => s.nome === nome) ?? -1;
    return cor || (i >= 0 ? cores[i] : CORES_PADRAO[0]);
  };

  /* cada fio de luz leva a próxima OS real até o cartão; sem OS, a luz é só enfeite */
  const proximoPedido = useCallback((): Ultima | null => {
    const l = dados?.ultimas ?? [];
    if (!l.length) return null;
    const u = l[fila.current++ % l.length];
    return { ...u, cor: corDe(u.servico, u.cor) };
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  /* o cartão pisca na cor do serviço (sem remontar o formulário) */
  const aoChegar = useCallback((p: Ultima) => {
    setAoVivo(p); setPulso(n => n + 1);
    const el = cartao.current;
    if (el) { el.classList.remove('chegou'); void el.offsetWidth; el.classList.add('chegou'); }
  }, []);

  const k = dados?.kpis;
  const s = dados?.series;
  const numeros = !!(dados?.mostrarNumeros && k && s);
  const ultimoAbertas = s ? Math.max(1, ...s.abertas) : 1;

  return (
    <div className={`cid${largo ? ' largo' : ''}`}>
      <section className="cid-mapa">
        <MapaVivo<Ultima> cores={cores} alvo={cartao} largCartao={largo ? 440 : 0} proximoPedido={proximoPedido} aoChegar={aoChegar} />
        <div className="cid-topo">
          <div className="cid-marca sbs-gatilho">
            <span className="cid-logo"><SimboloSisObras tamanho={30} animacao="montar" /></span>
            <span><b>SisObras</b><small>Gestão de Obras e Serviços</small></span>
          </div>
          <span className="cid-pilula"><i />{orgao ? `${orgao} · agora` : 'Agora na cidade'}</span>
          <h1 className="cid-hl">A cidade sendo <em>atendida</em>, em tempo real.</h1>
        </div>
        {largo && dados && dados.servicos.length > 0 && (
          <div className="cid-leg">
            <b>Serviços{numeros ? ' · hoje' : ''}</b>
            {dados.servicos.map((sv, i) => (
              <span key={sv.nome} style={{ '--c': sv.cor || CORES_PADRAO[i % 4] } as CSSProperties}>
                <i />{sv.nome}{numeros && <em>{sv.hoje}</em>}
              </span>
            ))}
          </div>
        )}
      </section>

      <main className="cid-lado">
        <div className="lg-cartao-wrap cid-cartao-wrap">
          <div ref={cartao} className="lg-cartao cid-cartao" style={aoVivo ? { '--c': aoVivo.cor } as CSSProperties : undefined}>
            <LoginSaudacao />
            {largo && aoVivo && (
              <div key={pulso} className="cid-aovivo" style={{ '--c': aoVivo.cor } as CSSProperties}>
                <i /><span><b>OS {aoVivo.numero}</b> · {aoVivo.servico} · {ETAPA[aoVivo.etapa] ?? ORIGEM[aoVivo.origem] ?? ''}</span><em>{quando(aoVivo.criadoEm)}</em>
              </div>
            )}
            {children}
          </div>
        </div>
      </main>

      {numeros && k && s && (
        <section className="cid-kpis" aria-label="Números de hoje">
          <Kpi rotulo="OS abertas hoje" valor={String(k.abertasHoje)} cor="#8B84FF" serie={s.abertas} barra={k.abertasHoje / ultimoAbertas * 100} />
          <Kpi rotulo="Finalizadas hoje" valor={String(k.finalizadasHoje)} cor="#3DD6A6" serie={s.finalizadas} barra={k.abertasHoje ? k.finalizadasHoje / k.abertasHoje * 100 : 0} />
          <Kpi rotulo="No prazo · 30 dias" valor={k.noPrazoPct == null ? '—' : String(k.noPrazoPct)} sufixo={k.noPrazoPct == null ? undefined : '%'} cor="#22D3EE" serie={s.noPrazo} barra={k.noPrazoPct ?? 0} />
          <Kpi rotulo="Equipes em campo" valor={String(k.equipesEmCampo)} sufixo={k.equipesTotal ? `de ${k.equipesTotal}` : undefined} cor="#F5A524" serie={s.equipes} barra={k.equipesTotal ? k.equipesEmCampo / k.equipesTotal * 100 : 0} />
          <Kpi rotulo="Tempo médio de atendimento" valor={k.tempoMedioDias == null ? '—' : String(k.tempoMedioDias).replace('.', ',')} sufixo={k.tempoMedioDias == null ? undefined : 'dias'} cor="#FF7D75" serie={s.tempo} barra={k.tempoMedioDias == null ? 0 : k.tempoMedioDias / 10 * 100} />
        </section>
      )}
    </div>
  );
}
