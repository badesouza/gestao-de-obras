import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, entityApi, type Entity } from '../../lib/api-client';
import { formatCnpj } from '../../lib/masks';
import { useToast } from '../../tenant/hooks/useToast';
import { ToastContainer } from '../../tenant/components/Toast';
import {
  AcoesLinha, Cabecalho, Carregando, Cartao, Ic, Pagina, Placar, Selo, msgErro, useConfirmarExclusao,
} from '../../tenant/components/sisobras/so';
import { EntityJanela, toEntityPayload, valoresDaEntidade, type EntityFormValues } from '../components/EntityForm';
import '../../tenant/styles/os-premium.css';

type Filtro = 'todas' | 'ACTIVE' | 'INACTIVE';

export const linkDaEntidade = (e: Pick<Entity, 'tenantAccessUrl'>) => `${window.location.origin}${e.tenantAccessUrl}`;

/** Brasão pequeno da entidade (ou as iniciais, quando não tem) */
export function BrasaoEntidade({ entity, grande }: { entity: Pick<Entity, 'name' | 'coatOfArmsUrl'>; grande?: boolean }) {
  const [erro, setErro] = useState(false);
  const iniciais = entity.name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <span className={`pf-brasao${grande ? ' g' : ''}`}>
      {entity.coatOfArmsUrl && !erro ? <img src={entity.coatOfArmsUrl} alt="" onError={() => setErro(true)} /> : <b>{iniciais || '··'}</b>}
    </span>
  );
}

/** Plataforma — Entidades: as prefeituras e órgãos que usam o sistema */
export function EntityListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toasts, showToast, closeToast } = useToast();
  const { confirmar, janelaExclusao } = useConfirmarExclusao();
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [janela, setJanela] = useState<{ entity: Entity | null } | null>(params.get('nova') ? { entity: null } : null);
  const [cnpjAviso, setCnpjAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await entityApi.list(new URLSearchParams({ pageSize: '100' }));
      setEntities(r.data);
    } catch (e) {
      setEntities([]);
      showToast(msgErro(e, 'Não foi possível abrir a lista'), 'error');
    }
  }, [showToast]);
  useEffect(() => { void carregar(); }, [carregar]);

  if (!entities) return <Pagina><Carregando /></Pagina>;

  const ativas = entities.filter(e => e.status === 'ACTIVE').length;
  const inativas = entities.length - ativas;
  const comBrasao = entities.filter(e => e.coatOfArmsUrl).length;
  const termo = busca.trim().toLowerCase();
  const soDigitos = termo.replace(/\D/g, '');
  const visiveis = entities.filter(e =>
    (filtro === 'todas' || e.status === filtro)
    && (!termo
      || e.name.toLowerCase().includes(termo)
      || (e.municipalityName ?? '').toLowerCase().includes(termo)
      || (soDigitos.length >= 3 && (e.cnpj ?? '').includes(soDigitos))));

  function abrir(entity: Entity | null) {
    setCnpjAviso(null);
    setJanela({ entity });
  }
  function fechar() {
    setJanela(null);
    setCnpjAviso(null);
    if (params.get('nova')) setParams({}, { replace: true });
  }

  async function salvar(values: EntityFormValues) {
    const editando = janela?.entity;
    try {
      if (editando) {
        await entityApi.update(editando.id, toEntityPayload(values));
        showToast('Entidade salva');
        fechar();
        await carregar();
      } else {
        const nova = await entityApi.create(toEntityPayload(values));
        fechar();
        navigate(`/platform/entities/${nova.id}?criada=1`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'CNPJ_DUPLICATE') {
        setCnpjAviso(`Esse CNPJ já está cadastrado em "${String(err.body.details?.existingEntityName ?? '')}".`);
        throw new Error('Confirme o CNPJ repetido para continuar');
      }
      throw err;
    }
  }

  function desativar(e: Entity) {
    confirmar({
      oque: 'entidade',
      nome: e.name,
      rotuloBotao: 'Desativar',
      texto: <>A entidade <b>não é apagada</b>: fica inativa, ninguém dela consegue entrar e todo o histórico continua guardado. Dá para reativar na ficha.</>,
      acao: async () => {
        try {
          await entityApi.updateStatus(e.id, 'INACTIVE');
          showToast('Entidade desativada', 'warning');
          await carregar();
        } catch (err) { showToast(msgErro(err), 'error'); }
      },
    });
  }

  async function copiar(e: Entity) {
    try { await navigator.clipboard.writeText(linkDaEntidade(e)); showToast('Link de acesso copiado'); }
    catch { showToast('Não foi possível copiar', 'error'); }
  }

  return (
    <Pagina>
      <Cabecalho
        rotulo="Entidades"
        selo={<Selo />}
        eyebrow="Plataforma · SisObras"
        titulo="Entidades"
        sub="As prefeituras e órgãos que usam o Gestão de Obras. Cada uma tem o seu link de acesso, os seus usuários e os seus dados, separados das outras."
        direita={<Placar n={ativas} de={`de ${entities.length}`} rotulo={ativas === 1 ? 'entidade ativa' : 'entidades ativas'} />}
      />

      <section className="os-kpis" aria-label="Indicadores">
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#635BFF,#8B85FF)', '--ks': 'rgba(99,91,255,.8)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M3 21h18" /><path d="M6 17.5v-6M10 17.5v-6M14 17.5v-6M18 17.5v-6" /><path d="M12 3l8.5 5h-17z" /></svg></span>Cadastradas</div>
          <div className="v"><span className="os-num" key={entities.length}>{entities.length}</span></div>
          <small>entidades na plataforma</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#19B88A,#10C6D4)', '--ks': 'rgba(25,184,138,.8)', '--kg': 'rgba(25,184,138,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span>Em operação</div>
          <div className="v"><span className="os-num" key={ativas}>{ativas}</span>{ativas > 0 && <span className="os-pill mint" style={{ height: 20, fontSize: 10.5 }}><i />no ar</span>}</div>
          <small>os usuários delas estão entrando</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#8A93AD,#B8BED0)', '--ks': 'rgba(104,114,138,.7)', '--kg': 'rgba(104,114,138,.12)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg></span>Desativadas</div>
          <div className="v"><span className="os-num" key={inativas}>{inativas}</span></div>
          <small>ninguém entra; o histórico fica guardado</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#F2B44C,#E8962A)', '--ks': 'rgba(232,150,42,.8)', '--kg': 'rgba(242,180,76,.18)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></span>Com brasão</div>
          <div className="v"><span className="os-num" key={comBrasao}>{comBrasao}</span>{entities.length - comBrasao > 0 && <span className="os-delta ruim">{entities.length - comBrasao} sem</span>}</div>
          <small>o brasão sai no carimbo das fotos e nos PDFs</small>
        </article>
      </section>

      <Cartao className="so-rise d1" icone="orgao" titulo="Entidades cadastradas" meta={<><span className="mono">{visiveis.length}</span> na lista</>} ajuda="Ajuda: Entidades">
        <div className="pf-filtros">
          <div className="so-chips">
            <button type="button" className={`so-chip${filtro === 'todas' ? ' on' : ''}`} onClick={() => setFiltro('todas')}>Todas <span className="n">{entities.length}</span></button>
            <button type="button" className={`so-chip${filtro === 'ACTIVE' ? ' on' : ''}`} onClick={() => setFiltro('ACTIVE')}>Ativas <span className="n">{ativas}</span></button>
            <button type="button" className={`so-chip${filtro === 'INACTIVE' ? ' on' : ''}`} onClick={() => setFiltro('INACTIVE')}>Desativadas <span className="n">{inativas}</span></button>
          </div>
          <label className="so-ctrl pf-busca"><Ic n="search" />
            <input type="search" placeholder="Buscar por nome, município ou CNPJ…" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar entidade" />
          </label>
          <button type="button" className="so-btn so-primary os-shine" onClick={() => abrir(null)}><Ic n="plus" />Nova entidade</button>
        </div>

        <div className="so-tw">
          <table className="so-table">
            <thead>
              <tr>
                <th scope="col">Entidade</th>
                <th scope="col">CNPJ</th>
                <th scope="col">Link de acesso</th>
                <th scope="col">Situação</th>
                <th scope="col"><span className="pf-sr">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(e => {
                const ativa = e.status === 'ACTIVE';
                return (
                  <tr key={e.id} className={ativa ? '' : 'pf-inativa'}>
                    <td data-l="Entidade">
                      <span className="pf-ent">
                        <BrasaoEntidade entity={e} />
                        <span style={{ minWidth: 0 }}>
                          <Link to={`/platform/entities/${e.id}`} className="so-link-nome">{e.name}</Link>
                          <span className="sub">{e.municipalityName ? `${e.municipalityName}${e.uf ? ` · ${e.uf}` : ''}` : 'Município não informado'}</span>
                        </span>
                      </span>
                    </td>
                    <td data-l="CNPJ" className="mono">{e.cnpj ? formatCnpj(e.cnpj) : '—'}</td>
                    <td data-l="Link de acesso">
                      <button type="button" className="pf-copiar" onClick={() => void copiar(e)} title="Copiar o link de acesso">
                        <Ic n="link" /><span className="mono">{e.tenantAccessUrl}</span><Ic n="copiar" className="c" />
                      </button>
                    </td>
                    <td data-l="Situação">
                      {ativa
                        ? <span className="so-badge mint"><span className="dot live" />Ativa</span>
                        : <span className="so-badge"><span className="dot" />Desativada</span>}
                    </td>
                    <td data-l="" className="acoes">
                      <span className="so-acoes">
                        <Link to={`/platform/entities/${e.id}`} className="so-acao pf-abrir" title={`Abrir a ficha de ${e.name}`} aria-label={`Abrir a ficha de ${e.name}`}><Ic n="chevDir" /></Link>
                        <AcoesLinha nome={e.name} onEditar={() => abrir(e)} onExcluir={ativa ? () => desativar(e) : undefined} />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!visiveis.length && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 22 }}>
                  {entities.length ? 'Nenhuma entidade com esse filtro.' : 'Nenhuma entidade ainda. Clique em Nova entidade para cadastrar a primeira.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Cartao>

      {janela && (
        <EntityJanela
          key={janela.entity?.id ?? 'nova'}
          editando={janela.entity?.name}
          initialValues={janela.entity ? valoresDaEntidade(janela.entity) : undefined}
          cnpjDuplicateWarning={cnpjAviso}
          onSubmit={salvar}
          onFechar={fechar}
        />
      )}
      {janelaExclusao}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
