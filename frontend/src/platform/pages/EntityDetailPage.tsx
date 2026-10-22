import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ApiError,
  entityApi,
  entityBootstrapApi,
  type AuditLog,
  type Entity,
} from '../../lib/api-client';
import { formatCnpj, formatPhone } from '../../lib/masks';
import { useToast } from '../../tenant/hooks/useToast';
import { ToastContainer } from '../../tenant/components/Toast';
import {
  Aviso, BarraAcoes, Cabecalho, Carregando, Cartao, Ic, Janela, Pagina, Selinho, Selo, Sep, msgErro, useConfirmarExclusao,
  type NomeIcone,
} from '../../tenant/components/sisobras/so';
import { EntityJanela, toEntityPayload, valoresDaEntidade, type EntityFormValues } from '../components/EntityForm';
import { BrasaoEntidade, linkDaEntidade } from './EntityListPage';

const ACOES: Record<string, { texto: string; icone: NomeIcone; tom: string }> = {
  ENTITY_CREATED: { texto: 'Entidade cadastrada', icone: 'plus', tom: 'brand' },
  ENTITY_UPDATED: { texto: 'Cadastro alterado', icone: 'editar', tom: 'cyan' },
  ENTITY_ACTIVATED: { texto: 'Entidade reativada', icone: 'check', tom: 'mint' },
  ENTITY_DEACTIVATED: { texto: 'Entidade desativada', icone: 'x', tom: 'coral' },
};

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Plataforma — ficha da entidade: acesso, primeiro administrador, cadastro e histórico */
export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { toasts, showToast, closeToast } = useToast();
  const { confirmar, janelaExclusao } = useConfirmarExclusao();
  const [entity, setEntity] = useState<Entity | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [erro, setErro] = useState('');
  const [editar, setEditar] = useState(false);
  const [criarAdmin, setCriarAdmin] = useState(false);
  const [cnpjAviso, setCnpjAviso] = useState<string | null>(null);
  const recemCriada = params.get('criada') === '1';

  const load = useCallback(async () => {
    if (!id) return;
    setErro('');
    try {
      const [entityData, logsData, adminStatus] = await Promise.all([
        entityApi.get(id),
        entityApi.auditLogs(id),
        entityBootstrapApi.adminStatus(id),
      ]);
      setEntity(entityData);
      setAuditLogs(logsData.data);
      setHasAdmin(adminStatus.hasAdmin);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (erro) {
    return (
      <Pagina>
        <Aviso tom="amber">{erro}</Aviso>
        <div><Link to="/platform/entities" className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar às entidades</Link></div>
      </Pagina>
    );
  }
  if (!entity) return <Pagina><Carregando /></Pagina>;

  const ativa = entity.status === 'ACTIVE';
  const link = linkDaEntidade(entity);

  async function salvar(values: EntityFormValues) {
    try {
      await entityApi.update(entity!.id, toEntityPayload(values));
      setEditar(false);
      setCnpjAviso(null);
      showToast('Cadastro salvo');
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'CNPJ_DUPLICATE') {
        setCnpjAviso(`Esse CNPJ já está cadastrado em "${String(err.body.details?.existingEntityName ?? '')}".`);
        throw new Error('Confirme o CNPJ repetido para continuar');
      }
      throw err;
    }
  }

  async function mudarSituacao(proxima: 'ACTIVE' | 'INACTIVE') {
    try {
      await entityApi.updateStatus(entity!.id, proxima);
      showToast(proxima === 'ACTIVE' ? 'Entidade reativada' : 'Entidade desativada', proxima === 'ACTIVE' ? 'success' : 'warning');
      await load();
    } catch (err) { showToast(msgErro(err), 'error'); }
  }

  function desativar() {
    confirmar({
      oque: 'entidade',
      nome: entity!.name,
      rotuloBotao: 'Desativar',
      texto: <>A entidade <b>não é apagada</b>: fica inativa, ninguém dela consegue entrar e todo o histórico continua guardado. Dá para reativar aqui mesmo.</>,
      acao: () => mudarSituacao('INACTIVE'),
    });
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(link); showToast('Link de acesso copiado'); }
    catch { showToast('Não foi possível copiar', 'error'); }
  }

  const dados: { rotulo: string; valor: string | null; mono?: boolean; icone: NomeIcone }[] = [
    { rotulo: 'CNPJ', valor: entity.cnpj ? formatCnpj(entity.cnpj) : null, mono: true, icone: 'idcard' },
    { rotulo: 'Representante legal', valor: entity.legalRepresentativeName, icone: 'user' },
    { rotulo: 'Município / UF', valor: entity.municipalityName ? `${entity.municipalityName}${entity.uf ? ` / ${entity.uf}` : ''}` : null, icone: 'pin' },
    { rotulo: 'E-mail', valor: entity.email, icone: 'mail' },
    { rotulo: 'Telefone', valor: entity.phone ? formatPhone(entity.phone) : null, mono: true, icone: 'chat' },
    { rotulo: 'Endereço', valor: entity.address, icone: 'map' },
  ];
  const faltando = dados.filter(d => !d.valor).length + (entity.coatOfArmsUrl ? 0 : 1);

  return (
    <Pagina>
      <Cabecalho
        rotulo={entity.name}
        selo={<Selo icone="orgao" tom={ativa ? undefined : 'coral'} />}
        eyebrow={<><Link to="/platform/entities">Plataforma · Entidades</Link></>}
        titulo={entity.name}
        extras={ativa ? <Selinho tom="mint" ponto vivo>Ativa</Selinho> : <Selinho tom="coral" ponto>Desativada</Selinho>}
        sub={<>{entity.municipalityName ? `${entity.municipalityName}${entity.uf ? ` · ${entity.uf}` : ''}` : 'Município não informado'} · cadastrada em {new Date(entity.createdAt).toLocaleDateString('pt-BR')}</>}
        direita={
          <div className="so-score pf-brasao-score">
            <BrasaoEntidade entity={entity} grande />
          </div>
        }
      />

      {recemCriada && hasAdmin === false && (
        <div className="pf-proximo so-rise">
          <span className="pf-proximo-ic"><Ic n="check" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Entidade cadastrada.</b> Falta só uma coisa: criar o primeiro administrador. É ele quem vai cadastrar o resto do pessoal lá dentro.
          </div>
          <button type="button" className="so-btn so-primary os-shine" onClick={() => setCriarAdmin(true)}><Ic n="userPlus" />Criar administrador</button>
          <button type="button" className="so-x" aria-label="Fechar aviso" onClick={() => setParams({}, { replace: true })}><Ic n="x" /></button>
        </div>
      )}

      <div className="so-split">
        <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Cartao className="so-rise" icone="link" tomIcone="cyan" titulo="Acesso da prefeitura" meta="o endereço que os usuários da entidade usam para entrar" ajuda="Ajuda: Acesso">
            <div className="pf-link">
              <span className="pf-link-url mono">{link}</span>
              <button type="button" className="so-btn so-ghost" onClick={() => void copiar()}><Ic n="copiar" />Copiar</button>
              <a href={entity.tenantAccessUrl} target="_blank" rel="noreferrer" className="so-btn so-ghost"><Ic n="seta" />Abrir</a>
            </div>
            {!ativa && <Aviso tom="amber">Enquanto estiver desativada, ninguém consegue entrar por esse link.</Aviso>}

            <div className={`pf-admin ${hasAdmin ? 'ok' : 'falta'}`}>
              <span className="pf-admin-ic"><Ic n={hasAdmin ? 'shieldCheck' : 'userPlus'} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{hasAdmin ? 'Administrador criado' : 'Falta o primeiro administrador'}</b>
                <span>{hasAdmin
                  ? 'A partir daqui, as senhas e os acessos são feitos lá dentro, em Cadastros › Pessoas.'
                  : 'Sem ele ninguém entra. Ele cadastra as outras pessoas lá dentro.'}</span>
              </div>
              {hasAdmin === false && <button type="button" className="so-btn so-primary" onClick={() => setCriarAdmin(true)}><Ic n="userPlus" />Criar administrador</button>}
            </div>
          </Cartao>

          <Cartao className="so-rise d1" icone="idcard" titulo="Cadastro"
            meta={faltando ? <span style={{ color: 'var(--amber)' }}>{faltando} {faltando === 1 ? 'dado faltando' : 'dados faltando'}</span> : 'completo'}
            direita={<button type="button" className="so-btn so-ghost" onClick={() => { setCnpjAviso(null); setEditar(true); }}><Ic n="editar" />Editar</button>}
            ajuda="Ajuda: Cadastro">
            <dl className="pf-dados">
              {dados.map(d => (
                <div key={d.rotulo} className={d.valor ? '' : 'vazio'}>
                  <dt><Ic n={d.icone} />{d.rotulo}</dt>
                  <dd className={d.mono ? 'mono' : undefined}>{d.valor ?? 'não informado'}</dd>
                </div>
              ))}
            </dl>
          </Cartao>
        </div>

        <Cartao className="side so-rise d2" icone="relogio" titulo="Histórico" meta={<><span className="mono">{auditLogs.length}</span> registros</>} ajuda="Ajuda: Histórico">
          {auditLogs.length === 0
            ? <p className="so-help">Nenhum registro ainda.</p>
            : (
              <ol className="pf-hist">
                {auditLogs.map(log => {
                  const a = ACOES[log.action] ?? { texto: log.action, icone: 'info' as NomeIcone, tom: '' };
                  return (
                    <li key={log.id} className={a.tom}>
                      <span className="pf-hist-ic"><Ic n={a.icone} /></span>
                      <div><b>{a.texto}</b><span className="mono">{quando(log.createdAt)}</span></div>
                    </li>
                  );
                })}
              </ol>
            )}
        </Cartao>
      </div>

      <BarraAcoes esquerda={<><b>{entity.name}</b><Sep />{ativa ? 'ativa' : 'desativada'}<Sep />{hasAdmin ? 'com administrador' : 'sem administrador'}</>}>
        <Link to="/platform/entities" className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar às entidades</Link>
        {ativa
          ? <button type="button" className="so-btn so-danger" onClick={desativar}>Desativar</button>
          : <button type="button" className="so-btn so-ghost" onClick={() => void mudarSituacao('ACTIVE')}><Ic n="check" />Reativar</button>}
        <button type="button" className="so-btn so-primary" onClick={() => { setCnpjAviso(null); setEditar(true); }}><Ic n="editar" />Editar cadastro</button>
      </BarraAcoes>

      {editar && (
        <EntityJanela
          editando={entity.name}
          initialValues={valoresDaEntidade(entity)}
          cnpjDuplicateWarning={cnpjAviso}
          onSubmit={salvar}
          onFechar={() => setEditar(false)}
        />
      )}
      {criarAdmin && (
        <JanelaAdmin
          entity={entity}
          onFechar={() => setCriarAdmin(false)}
          onCriado={() => {
            setCriarAdmin(false);
            setHasAdmin(true);
            setParams({}, { replace: true });
            showToast('Administrador criado. Mande o link de acesso para ele.');
          }}
        />
      )}
      {janelaExclusao}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}

/** Janela do primeiro administrador da entidade */
function JanelaAdmin({ entity, onFechar, onCriado }: { entity: Entity; onFechar: () => void; onCriado: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const senhaOk = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  async function criar() {
    setErro('');
    if (name.trim().length < 2) { setErro('Informe o nome'); return; }
    if (!email.includes('@')) { setErro('Informe um e-mail válido'); return; }
    if (!senhaOk) { setErro('A senha precisa de 8 caracteres, com letra e número'); return; }
    setSalvando(true);
    try {
      await entityBootstrapApi.bootstrapAdmin(entity.id, { name: name.trim(), email: email.trim(), password });
      onCriado();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro ao criar administrador');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Janela
      icone="userPlus"
      eyebrow={`${entity.name} · primeiro acesso`}
      titulo="Criar administrador"
      sub="A primeira senha da entidade. Depois, ele mesmo cadastra as outras pessoas lá dentro."
      ajuda="Ajuda: Administrador"
      largura={520}
      onFechar={onFechar}
      rodape={<>
        <button type="button" className="so-btn so-ghost" onClick={onFechar}>Cancelar</button>
        <button type="button" className="so-btn so-primary" disabled={salvando} onClick={() => void criar()}><Ic n="check" />{salvando ? 'Criando…' : 'Criar administrador'}</button>
      </>}
    >
      <label className="so-field"><span className="so-lbl">Nome <span className="req">*</span></span>
        <span className="so-ctrl"><Ic n="user" /><input type="text" placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)} /></span>
      </label>
      <label className="so-field"><span className="so-lbl">E-mail <span className="req">*</span></span>
        <span className="so-ctrl"><Ic n="mail" /><input type="email" placeholder="nome@prefeitura.gov.br" value={email} onChange={e => setEmail(e.target.value)} /></span>
        <span className="so-help">É o login dele.</span>
      </label>
      <label className="so-field"><span className="so-lbl">Senha <span className="req">*</span></span>
        <span className="so-ctrl mono"><Ic n="lock" />
          <input type={ver ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
          <button type="button" className="pf-ver" onClick={() => setVer(v => !v)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}><Ic n="eye" /></button>
        </span>
        <span className="so-help" style={password && !senhaOk ? { color: 'var(--amber)' } : password ? { color: 'var(--mint)' } : undefined}>
          {password && senhaOk ? 'Senha boa.' : 'Pelo menos 8 caracteres, com letra e número.'}
        </span>
      </label>
      {erro && <Aviso tom="amber">{erro}</Aviso>}
    </Janela>
  );
}
