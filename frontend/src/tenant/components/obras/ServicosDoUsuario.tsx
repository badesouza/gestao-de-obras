import { useEffect, useState } from 'react';
import { ApiError, ordensApi } from '../../../lib/api-client';
import { CENTRO_IDS, SERVICOS_CONFIG } from '../../pages/servico-config';
import '../../styles/obras-ui.css';

/** Cartão no cadastro do usuário: em quais serviços ele trabalha (nenhum marcado = todos) */
export function ServicosDoUsuario({ entityId, userId, podeEditar }: { entityId: string; userId: string; podeEditar: boolean }) {
  const [marcados, setMarcados] = useState<string[] | null>(null);
  const [salvo, setSalvo] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    ordensApi.servicosDoUsuario(entityId, userId)
      .then(r => { setMarcados(r.centroIds); setSalvo(r.centroIds); })
      .catch(() => setMsg({ tipo: 'erro', texto: 'Não foi possível carregar os serviços.' }));
  }, [entityId, userId]);

  const servicos = Object.values(SERVICOS_CONFIG);
  const todos = marcados?.length === 0;
  const mudou = marcados != null && (marcados.length !== salvo.length || marcados.some(m => !salvo.includes(m)));
  const alternar = (id: string) => setMarcados(m => m == null ? m : m.includes(id) ? m.filter(x => x !== id) : [...m, id]);

  const salvar = async () => {
    if (!marcados) return;
    setSalvando(true); setMsg(null);
    try {
      const r = await ordensApi.definirServicos(entityId, userId, marcados);
      setSalvo(r.centroIds); setMarcados(r.centroIds);
      setMsg({ tipo: 'ok', texto: 'Serviços salvos. Vale a partir do próximo acesso desta pessoa.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e instanceof ApiError ? e.body.message : 'Não foi possível salvar.' });
    } finally { setSalvando(false); }
  };

  return (
    <section className="ob-claro su-cartao" aria-label="Serviços que atende">
      <header className="su-cab">
        <div>
          <span className="su-pre">Acesso por serviço</span>
          <strong>Serviços que atende</strong>
        </div>
        <span className={`ob-badge ${todos ? 'is-concluida' : 'is-aberta'}`}><i />{todos ? 'Todos os serviços' : `${marcados?.length ?? 0} de ${servicos.length}`}</span>
      </header>
      <p className="su-ajuda">Marque só os serviços desta pessoa. Ela verá e registrará apenas neles. <b>Nenhum marcado = acesso a todos.</b></p>
      {marcados == null ? <span className="ob-skeleton" style={{ height: 120 }} /> : (
        <div className="su-grade">
          {servicos.map(s => {
            const id = CENTRO_IDS[s.slug];
            const ativo = marcados.includes(id);
            return (
              <button key={s.slug} type="button" className={`su-servico${ativo ? ' is-ativo' : ''}`} style={{ '--serv-cor': s.cor } as React.CSSProperties}
                onClick={() => podeEditar && alternar(id)} aria-pressed={ativo} disabled={!podeEditar}>
                <span className="su-icone">{s.icon}</span>
                {s.nome}
              </button>
            );
          })}
        </div>
      )}
      {podeEditar && (
        <div className="su-rodape">
          {msg && <span className={msg.tipo === 'ok' ? 'tom-ok' : 'tom-ruim'}>{msg.texto}</span>}
          {marcados && marcados.length > 0 && <button type="button" className="ob-btn-ghost" onClick={() => setMarcados([])}>Liberar todos</button>}
          <button type="button" className="ob-btn su-salvar" onClick={() => void salvar()} disabled={!mudou || salvando}>{salvando ? 'Salvando…' : 'Salvar serviços'}</button>
        </div>
      )}
    </section>
  );
}
