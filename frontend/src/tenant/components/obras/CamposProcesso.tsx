import type { TipoLicitacao } from '../../../lib/api-client';
import { TIPOS } from './licitacao-tipos';

function Icone({ d }: { d: string }) {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

/** Campos comuns da licitação (criação e edição) */
export function CamposProcesso(p: {
  identificacao: string; setIdentificacao: (v: string) => void; objeto: string; setObjeto: (v: string) => void;
  pa: string; setPa: (v: string) => void; modalidade: string; setModalidade: (v: string) => void;
  tipo: TipoLicitacao | ''; setTipo: (v: TipoLicitacao) => void; homologacao: string; setHomologacao: (v: string) => void; modalidades: string[];
}) {
  return (
    <div className="lc-form">
      <div className="cc-campo cc-largo"><span>Tipo</span>
        <div className="lc-tipos is-compacto" role="radiogroup" aria-label="Tipo da licitação">
          {(Object.keys(TIPOS) as TipoLicitacao[]).map(t => (
            <button key={t} type="button" role="radio" aria-checked={p.tipo === t} className={`lc-tipo${p.tipo === t ? ' is-ativo' : ''}`} style={{ '--tipo-cor': TIPOS[t].cor } as React.CSSProperties} onClick={() => p.setTipo(t)}>
              <span className="lc-tipo-icone"><Icone d={TIPOS[t].icone} /></span><b>{TIPOS[t].rotulo}</b><small>{TIPOS[t].desc}</small>
            </button>
          ))}
        </div>
      </div>
      <label className="cc-campo"><span>Número da licitação</span><input value={p.identificacao} onChange={e => p.setIdentificacao(e.target.value)} placeholder="Ex.: PE 012/2026" /></label>
      <label className="cc-campo"><span>Processo administrativo (P.A.)</span><input value={p.pa} onChange={e => p.setPa(e.target.value)} placeholder="Ex.: 1.234/2026" /></label>
      <label className="cc-campo"><span>Modalidade</span>
        <select value={p.modalidade} onChange={e => p.setModalidade(e.target.value)}>
          <option value="">Escolha…</option>
          {p.modalidades.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="cc-campo"><span>Data de homologação</span><input type="date" value={p.homologacao} onChange={e => p.setHomologacao(e.target.value)} /></label>
      <label className="cc-campo cc-largo"><span>Objeto</span><textarea rows={3} value={p.objeto} onChange={e => p.setObjeto(e.target.value)} maxLength={500} placeholder="O que foi licitado" /></label>
    </div>
  );
}
