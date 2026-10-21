import { useEffect, useState } from 'react';
import { ApiError, ordensApi, type ConfiguracaoObras, type PapelCodigo } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';
import '../styles/obras-ui.css';

/* ── Regras das ordens de serviço (configuráveis pela secretaria) ── */

const PAPEIS: { code: PapelCodigo; nome: string; dica: string }[] = [
  { code: 'COORDENADOR', nome: 'Coordenador', dica: 'Chefe de equipe / setor' },
  { code: 'FISCAL', nome: 'Fiscal', dica: 'Quem vai a campo' },
  { code: 'ENGINEER', nome: 'Engenheiro', dica: 'Responsável técnico' },
  { code: 'OPERATOR', nome: 'Operador', dica: 'Apoio administrativo' },
];

function Interruptor({ ligado, onMudar, rotulo }: { ligado: boolean; onMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} className={`cf-switch${ligado ? ' is-on' : ''}`} onClick={() => onMudar(!ligado)}>
      <span />
    </button>
  );
}

function EscolhaPapeis({ valor, onMudar, desabilitado }: { valor: PapelCodigo[]; onMudar: (v: PapelCodigo[]) => void; desabilitado?: boolean }) {
  return (
    <div className="cf-papeis">
      <span className="cf-papel is-fixo" title="O administrador sempre pode"><b>Administrador</b><small>sempre pode</small></span>
      {PAPEIS.map(p => {
        const on = valor.includes(p.code);
        return (
          <button key={p.code} type="button" disabled={desabilitado} aria-pressed={on} className={`cf-papel${on ? ' is-on' : ''}`}
            onClick={() => onMudar(on ? valor.filter(x => x !== p.code) : [...valor, p.code])}>
            <b>{p.nome}</b><small>{p.dica}</small>
          </button>
        );
      })}
    </div>
  );
}

export function ConfiguracoesPage() {
  const { entityId } = useTenant();
  const podeEditar = useTenantPermission('users.manage');
  const [cfg, setCfg] = useState<ConfiguracaoObras | null>(null);
  const [salvo, setSalvo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    ordensApi.config(entityId).then(c => { setCfg(c); setSalvo(JSON.stringify(c)); }).catch(() => setMsg({ tipo: 'erro', texto: 'Não foi possível carregar as regras.' }));
  }, [entityId]);

  const mudou = cfg != null && JSON.stringify(cfg) !== salvo;
  const set = <K extends keyof ConfiguracaoObras>(k: K, v: ConfiguracaoObras[K]) => setCfg(c => c && { ...c, [k]: v });
  /* o administrador sempre pode: garante pelo menos ele na lista */
  const comAdmin = (l: PapelCodigo[]) => (l.includes('ADMIN') ? l : ['ADMIN', ...l]) as PapelCodigo[];

  const salvar = async () => {
    if (!cfg) return;
    setSalvando(true); setMsg(null);
    try {
      const r = await ordensApi.salvarConfig(entityId, { ...cfg, aprovadores: comAdmin(cfg.aprovadores), conferentes: comAdmin(cfg.conferentes) });
      setCfg(r); setSalvo(JSON.stringify(r));
      setMsg({ tipo: 'ok', texto: 'Regras salvas. Valem para as próximas OS; cada pessoa vê a mudança no próximo acesso.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof ApiError ? e.body.message : 'Não foi possível salvar.' });
    } finally { setSalvando(false); }
  };

  const etapas = cfg ? [
    { nome: 'Registrada', quem: 'fiscal ou equipe interna', cor: 'var(--ob-blue)', on: true },
    { nome: 'Aprovada', quem: cfg.aprovadores.filter(p => p !== 'ADMIN').map(p => PAPEIS.find(x => x.code === p)?.nome).filter(Boolean).join(' ou ') || 'administrador', cor: 'var(--ob-violeta)', on: cfg.exigeAprovacaoOS },
    { nome: 'Executada', quem: 'fiscal dá a baixa com foto', cor: 'var(--ob-amber)', on: true },
    { nome: 'Finalizada', quem: cfg.exigeConferencia ? `conferida por ${cfg.conferentes.filter(p => p !== 'ADMIN').map(p => PAPEIS.find(x => x.code === p)?.nome).filter(Boolean).join(' ou ') || 'administrador'}` : 'automática após a baixa', cor: 'var(--ob-green)', on: true },
  ].filter(e => e.on) : [];

  return (
    <div className="ob-page ob-claro" style={{ '--serv-cor': '#7C3AED' } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">Configurações</span>
            <h1 className="ob-h1">Regras das ordens de serviço</h1>
            <p className="ob-sub">Defina o caminho de cada OS e quem pode aprovar e conferir.</p>
          </div>
        </div>
        {podeEditar && (
          <div className="ob-head-acoes">
            <button type="button" className="ob-btn" onClick={() => void salvar()} disabled={!mudou || salvando}>{salvando ? 'Salvando…' : 'Salvar regras'}</button>
          </div>
        )}
      </header>

      {msg && <div className={msg.tipo === 'ok' ? 'cf-msg is-ok' : 'ob-erro'}>{msg.texto}</div>}

      {!cfg ? <span className="ob-skeleton" style={{ height: 320 }} /> : (
        <>
          <section className="ob-card cf-fluxo ob-reveal" style={{ '--i': 1 } as React.CSSProperties} aria-label="Caminho da OS">
            <span className="cf-rotulo">Caminho de cada OS</span>
            <ol>
              {etapas.map((e, i) => (
                <li key={e.nome} style={{ '--cor': e.cor, '--i': i } as React.CSSProperties}>
                  <span className="cf-etapa-num">{i + 1}</span>
                  <strong>{e.nome}</strong>
                  <small>{e.quem}</small>
                </li>
              ))}
            </ol>
          </section>

          <div className="cf-grade">
            <section className="ob-card cf-bloco ob-reveal" style={{ '--i': 2 } as React.CSSProperties}>
              <div className="cf-linha">
                <div>
                  <h2>Aprovar a OS antes da execução</h2>
                  <p>Cada nova OS fica "Aguardando aprovação" e o fiscal só pode dar baixa depois de aprovada.</p>
                </div>
                <Interruptor ligado={cfg.exigeAprovacaoOS} onMudar={v => podeEditar && set('exigeAprovacaoOS', v)} rotulo="Exigir aprovação da OS" />
              </div>
              {cfg.exigeAprovacaoOS && <>
                <span className="cf-rotulo">Quem aprova</span>
                <EscolhaPapeis valor={cfg.aprovadores} onMudar={v => set('aprovadores', v)} desabilitado={!podeEditar} />
              </>}
            </section>

            <section className="ob-card cf-bloco ob-reveal" style={{ '--i': 3 } as React.CSSProperties}>
              <div className="cf-linha">
                <div>
                  <h2>Conferir a baixa do fiscal</h2>
                  <p>Depois da baixa, a OS fica "Executada" até alguém conferir as fotos e finalizar — ou devolver ao fiscal.</p>
                </div>
                <Interruptor ligado={cfg.exigeConferencia} onMudar={v => podeEditar && set('exigeConferencia', v)} rotulo="Exigir conferência" />
              </div>
              {cfg.exigeConferencia && <>
                <span className="cf-rotulo">Quem confere e finaliza</span>
                <EscolhaPapeis valor={cfg.conferentes} onMudar={v => set('conferentes', v)} desabilitado={!podeEditar} />
              </>}
            </section>

            <section className="ob-card cf-bloco ob-reveal" style={{ '--i': 4 } as React.CSSProperties}>
              <div className="cf-linha">
                <div>
                  <h2>Meta de atendimento</h2>
                  <p>Prazo, em dias, que a Sala de Situação usa para medir o tempo até concluir.</p>
                </div>
                <div className="cf-meta">
                  <button type="button" aria-label="Diminuir" disabled={!podeEditar || cfg.metaDias <= 1} onClick={() => set('metaDias', cfg.metaDias - 1)}>−</button>
                  <span><b>{cfg.metaDias}</b> {cfg.metaDias === 1 ? 'dia' : 'dias'}</span>
                  <button type="button" aria-label="Aumentar" disabled={!podeEditar || cfg.metaDias >= 90} onClick={() => set('metaDias', cfg.metaDias + 1)}>+</button>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
