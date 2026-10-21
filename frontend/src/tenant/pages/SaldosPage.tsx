import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi, type SaldoLicitacao } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { Kpi, KpiCarregando } from '../components/obras/ui';
import '../styles/compras-ui.css';

/* ── Saldos dos contratos: o que foi pedido, reservado, entregue e o que ainda dá para comprar ── */

const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const realCurto = (v: number) => v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi` : v >= 10_000 ? `R$ ${Math.round(v / 1000)} mil` : real(v);
const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const pct = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);

type Situacao = 'ok' | 'acabando' | 'esgotado' | 'livre';
function situacao(contratado: number | null, disponivel: number | null): Situacao {
  if (contratado == null || disponivel == null) return 'livre';
  if (disponivel <= 0) return 'esgotado';
  if (disponivel / contratado < 0.2) return 'acabando';
  return 'ok';
}
const SIT: Record<Situacao, { rotulo: string; classe: string }> = {
  ok: { rotulo: 'Com saldo', classe: 'is-concluida' },
  acabando: { rotulo: 'Acabando', classe: 'is-execucao' },
  esgotado: { rotulo: 'Esgotado', classe: 'is-atrasada' },
  livre: { rotulo: 'Sem limite cadastrado', classe: 'is-cancelada' },
};

function Barra({ pedido, reservado, total }: { pedido: number; reservado: number; total: number }) {
  return (
    <div className="sd-barra" aria-hidden="true">
      <span className="sd-pedido" style={{ width: `${pct(pedido, total)}%` }} />
      <span className="sd-reservado" style={{ width: `${pct(reservado, total)}%` }} />
    </div>
  );
}

export function SaldosPage() {
  const { entityId } = useTenant();
  const [dados, setDados] = useState<SaldoLicitacao[] | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [soCriticos, setSoCriticos] = useState(false);
  const [lic, setLic] = useState<string>('TODAS');

  useEffect(() => {
    tenantApi.compras.saldos(entityId).then(r => setDados(r.licitacoes)).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
  }, [entityId]);

  const tot = useMemo(() => (dados ?? []).reduce((t, l) => ({
    contratado: t.contratado + Number(l.valores.contratado), pedido: t.pedido + Number(l.valores.pedido),
    reservado: t.reservado + Number(l.valores.reservado), recebido: t.recebido + Number(l.valores.recebido),
  }), { contratado: 0, pedido: 0, reservado: 0, recebido: 0 }), [dados]);
  const disponivel = tot.contratado - tot.pedido - tot.reservado;

  const todosItens = (dados ?? []).flatMap(l => l.itens.map(i => ({ ...i, sit: situacao(i.contratado == null ? null : Number(i.contratado), i.disponivel == null ? null : Number(i.disponivel)) })));
  const criticos = todosItens.filter(i => i.sit === 'acabando' || i.sit === 'esgotado').length;
  const termo = busca.trim().toLowerCase();

  return (
    <div className="ob-page ob-claro" style={{ '--serv-cor': '#0891B2' } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>
          </span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">Compras</span>
            <h1 className="ob-h1">Saldos dos contratos</h1>
            <p className="ob-sub">Quanto de cada item das licitações já foi pedido, quanto está reservado e quanto ainda pode ser comprado.</p>
          </div>
        </div>
        <div className="ob-head-acoes">
          <Link to={`/t/${entityId}/pedidos`} className="ob-btn-ghost ob-btn-alto">Pedidos de compra</Link>
        </div>
      </header>

      <section className="ob-kpis" aria-label="Resumo em reais">
        {!dados ? [1, 2, 3, 4].map(n => <KpiCarregando key={n} />) : (
          <>
            <div className="ob-kpi ob-reveal" style={{ '--i': 1, '--kpi-cor': 'var(--ob-ink)' } as React.CSSProperties}>
              <span className="ob-kpi-rotulo">Contratado</span>
              <div className="ob-kpi-linha"><span className="ob-kpi-valor cp-kpi-dinheiro">{realCurto(tot.contratado)}</span></div>
              <div className="ob-kpi-rodape"><span className="ob-kpi-nota tom-neutro">{dados.length} {dados.length === 1 ? 'licitação ativa' : 'licitações ativas'}</span></div>
            </div>
            <div className="ob-kpi ob-reveal" style={{ '--i': 2, '--kpi-cor': 'var(--ob-blue)' } as React.CSSProperties}>
              <span className="ob-kpi-rotulo">Já pedido</span>
              <div className="ob-kpi-linha"><span className="ob-kpi-valor cp-kpi-dinheiro">{realCurto(tot.pedido)}</span></div>
              <div className="ob-kpi-rodape"><span className="ob-kpi-nota tom-neutro">{Math.round(pct(tot.pedido, tot.contratado))}% do contratado · {realCurto(tot.recebido)} entregue</span></div>
            </div>
            <div className="ob-kpi ob-reveal" style={{ '--i': 3, '--kpi-cor': 'var(--ob-amber)' } as React.CSSProperties}>
              <span className="ob-kpi-rotulo">Reservado em solicitações</span>
              <div className="ob-kpi-linha"><span className="ob-kpi-valor cp-kpi-dinheiro">{realCurto(tot.reservado)}</span></div>
              <div className="ob-kpi-rodape"><span className="ob-kpi-nota tom-neutro">ainda não virou pedido</span></div>
            </div>
            <Kpi i={4} rotulo="Itens acabando ou esgotados" valor={criticos} cor={criticos ? 'var(--ob-rose)' : 'var(--ob-green)'}
              nota={`${realCurto(Math.max(disponivel, 0))} ainda disponíveis`} tom={criticos ? 'ruim' : 'ok'} grafico={null} />
          </>
        )}
      </section>

      {dados && dados.length > 0 && (
        <section className="ob-card sd-geral ob-reveal" style={{ '--i': 5 } as React.CSSProperties} aria-label="Consumo geral">
          <div className="sd-geral-topo">
            <strong>Consumo geral dos contratos</strong>
            <span>{Math.round(pct(tot.pedido + tot.reservado, tot.contratado))}% comprometido</span>
          </div>
          <div className="sd-barra sd-barra-grande" aria-hidden="true">
            <span className="sd-pedido" style={{ width: `${pct(tot.pedido, tot.contratado)}%` }} />
            <span className="sd-reservado" style={{ width: `${pct(tot.reservado, tot.contratado)}%` }} />
          </div>
          <div className="sd-legenda">
            <span><i className="sd-pedido" />Pedido · {real(tot.pedido)}</span>
            <span><i className="sd-reservado" />Reservado · {real(tot.reservado)}</span>
            <span><i className="sd-livre" />Disponível · {real(Math.max(disponivel, 0))}</span>
          </div>
        </section>
      )}

      <section className="ob-card ob-reveal" style={{ '--i': 6 } as React.CSSProperties} aria-label="Itens">
        <div className="ob-filtros">
          <div className="ob-chips" role="group" aria-label="Licitação">
            <button type="button" className={`ob-chip${lic === 'TODAS' ? ' is-ativo' : ''}`} onClick={() => setLic('TODAS')} aria-pressed={lic === 'TODAS'}>Todas<span>{dados?.length ?? 0}</span></button>
            {(dados ?? []).map(l => (
              <button key={l.id} type="button" className={`ob-chip${lic === l.id ? ' is-ativo' : ''}`} onClick={() => setLic(l.id)} aria-pressed={lic === l.id}>
                {l.identificacao}<span>{l.itens.length}</span>
              </button>
            ))}
            <button type="button" className={`ob-chip is-alerta${soCriticos ? ' is-ativo' : ''}`} onClick={() => setSoCriticos(v => !v)} aria-pressed={soCriticos}>
              <i style={{ background: 'var(--ob-rose)' }} />Só acabando / esgotados<span>{criticos}</span>
            </button>
          </div>
          <label className="ob-busca">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
            <span className="ob-sr">Buscar item</span>
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar item ou categoria" />
          </label>
        </div>

        {erro && <div className="ob-erro" style={{ margin: '0 16px 12px' }}>{erro}</div>}
        {!dados && !erro && <div className="ob-lista">{[1, 2, 3].map(n => <span key={n} className="ob-skeleton" style={{ height: 70 }} />)}</div>}
        {dados && dados.length === 0 && <p className="ob-vazio" style={{ padding: '8px 20px 24px' }}>Nenhuma licitação ativa com itens. Cadastre em Licitações.</p>}

        {(dados ?? []).filter(l => lic === 'TODAS' || l.id === lic).map(l => {
          const itens = l.itens
            .map(i => ({ ...i, sit: situacao(i.contratado == null ? null : Number(i.contratado), i.disponivel == null ? null : Number(i.disponivel)) }))
            .filter(i => (!soCriticos || i.sit === 'acabando' || i.sit === 'esgotado') && (!termo || `${i.descricao} ${i.categoria ?? ''}`.toLowerCase().includes(termo)));
          if (itens.length === 0) return null;
          return (
            <div key={l.id} className="sd-licitacao">
              <div className="sd-lic-cab">
                <div>
                  <strong>Licitação {l.identificacao}</strong>
                  <span>{l.objeto}{l.fornecedor ? ` · ${l.fornecedor}` : ''}</span>
                </div>
                <span className="sd-lic-valor">{real(Number(l.valores.disponivel))} <small>disponível</small></span>
              </div>
              <div className="sd-itens">
                {itens.map((i, idx) => {
                  const c = i.contratado == null ? null : Number(i.contratado);
                  const d = i.disponivel == null ? null : Number(i.disponivel);
                  const s = SIT[i.sit];
                  return (
                    <div key={i.id} className={`sd-item ob-reveal is-${i.sit}`} style={{ '--i': Math.min(idx, 14) } as React.CSSProperties}>
                      <div className="sd-item-texto">
                        <strong>{i.descricao}</strong>
                        <span>{i.categoria ? `${i.categoria} · ` : ''}{Number(i.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {i.unidade}</span>
                      </div>
                      <div className="sd-item-barra">
                        {c != null
                          ? <Barra pedido={Number(i.pedido)} reservado={Number(i.reservado)} total={c} />
                          : <div className="sd-barra sd-sem-limite" aria-hidden="true" />}
                        <span className="sd-item-nums">
                          pedido {qtd(Number(i.pedido))} · reservado {qtd(Number(i.reservado))} · entregue {qtd(Number(i.recebido))}{c != null ? ` de ${qtd(c)} ${i.unidade}` : ''}
                        </span>
                      </div>
                      <div className="sd-item-saldo">
                        <strong>{d != null ? qtd(Math.max(d, 0)) : '—'}</strong>
                        <span>{d != null ? `${i.unidade} disponíveis` : 'sem limite'}</span>
                        <span className={`ob-badge ${s.classe}`}><i />{s.rotulo}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
