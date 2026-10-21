import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../TenantContext';
import { BarraAcoes, Ic, Mira, Pagina, Selo, Sep, rotaTenant } from '../../components/sisobras/so';
import type { NomeIcone } from '../../components/sisobras/so';

/* Prancha fixa de 1840 × 1140 (como no canvas); encolhe para caber na largura, sem rolar de lado */
const LARG = 1840;
const ALT = 1140;

function Prancha({ tipo, children }: { tipo: 'os' | 'pedido'; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.6);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setK(Math.min(1, el.clientWidth / LARG));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="so-fluxograma" style={{ height: ALT * k }}>
      <div className={`so-flow ${tipo}`} style={{ width: LARG, height: ALT, transform: `scale(${k})` }}>{children}</div>
    </div>
  );
}

/** Seta reta: (x, y) do canto, largura/altura e o caminho dentro da caixa */
function Seta({ x, y, w, h, d, volta, ponta = true, marca }: { x: number; y: number; w: number; h: number; d: string; volta?: boolean; ponta?: boolean; marca: string }) {
  return (
    <svg className={`ar${volta ? ' back' : ''}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ left: x, top: y, width: w, height: h }} aria-hidden="true">
      <path d={d} markerEnd={ponta ? `url(#${marca})` : undefined} />
    </svg>
  );
}

function Faixas() {
  return <>
    <div className="so-lane first" style={{ top: 170 }} />
    <div className="so-lane alt" style={{ top: 360 }} />
    <div className="so-lane" style={{ top: 550 }} />
    <div className="so-lane alt last" style={{ top: 740 }} />
  </>;
}

function Rotulo({ top, icone, tom, nome, children }: { top: number; icone: NomeIcone; tom?: 'amber' | 'mint' | 'cyan'; nome: string; children: ReactNode }) {
  return <div className="so-lane-l" style={{ top }}><span className={`so-cic${tom ? ` ${tom}` : ''}`}><Ic n={icone} /></span><div><b>{nome}</b><small>{children}</small></div></div>;
}

function No({ x, y, tom, titulo, children }: { x: number; y: number; tom?: string; titulo: string; children: ReactNode }) {
  return <div className={`so-node${tom ? ` ${tom}` : ''}`} style={{ left: x, top: y }}><span><b>{titulo}</b>{children}</span></div>;
}

function Rot({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  return <div className="so-edge" style={{ left: x, top: y, width: w }}>{children}</div>;
}

function Marcador({ id }: { id: string }) {
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs><marker id={id} orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible"><path d="M0 0 L4 2 L0 4 Z" /></marker></defs></svg>;
}

function Titulo({ icone, titulo, texto }: { icone: NomeIcone; titulo: string; texto: string }) {
  const { entityId } = useTenant();
  return (
    <div className="ttl" style={{ left: 64, top: 34 }}>
      <Selo icone={icone} pequeno />
      <div>
        <div className="so-eyebrow">Fluxograma · <Link to={rotaTenant(entityId, 'cadastros/fluxo')}>Fluxo e aprovações</Link></div>
        <h1>{titulo}</h1>
        <p>{texto}</p>
      </div>
    </div>
  );
}

/** Fluxo da Ordem de Serviço */
export function FluxogramaOSPage() {
  const { entityId } = useTenant();
  const m = 'soArrOS';
  return (
    <Pagina semMira>
      <Prancha tipo="os">
        <Marcador id={m} />
        <Titulo icone="osCheck" titulo="Fluxo da Ordem de Serviço" texto="Cada faixa mostra quem faz o passo. Quem pode fazer cada passo é decidido pelas caixas marcadas nos acessos de cada pessoa. Linha tracejada = volta atrás." />
        <Faixas />
        <Rotulo top={186} icone="user" tom="amber" nome="Munícipe">sem login · link ou QR Code</Rotulo>
        <Rotulo top={376} icone="orgao" nome="Escritório">caixas: Abrir OS · Triar pedido do munícipe</Rotulo>
        <Rotulo top={566} icone="shieldCheck" nome="Coordenador">caixas: Aprovar abertura de OS · Conferir a baixa · Cancelar OS</Rotulo>
        <Rotulo top={756} icone="hardhat" tom="mint" nome="Fiscal e equipe">caixas: Abrir OS · Dar baixa com foto</Rotulo>

        <Seta marca={m} x={615} y={307} w={8} h={105} d="M 4 0 L 4 101" />
        <Seta marca={m} x={681} y={308} w={8} h={105} d="M 4 105 L 4 4" volta />
        <Seta marca={m} x={648} y={497} w={8} h={134} d="M 4 0 L 4 134" ponta={false} />
        <Seta marca={m} x={652} y={627} w={147} h={8} d="M 0 4 L 143 4" />
        <Seta marca={m} x={400} y={497} w={8} h={162} d="M 4 0 L 4 162" ponta={false} />
        <Seta marca={m} x={404} y={655} w={395} h={8} d="M 0 4 L 391 4" />
        <Seta marca={m} x={504} y={831} w={396} h={8} d="M 0 4 L 396 4" ponta={false} />
        <Seta marca={m} x={896} y={688} w={8} h={147} d="M 4 147 L 4 4" />
        <Seta marca={m} x={896} y={498} w={8} h={105} d="M 4 105 L 4 4" volta />
        <Seta marca={m} x={1000} y={641} w={148} h={8} d="M 0 4 L 148 4" ponta={false} />
        <Seta marca={m} x={1144} y={645} w={8} h={147} d="M 4 0 L 4 143" />
        <Seta marca={m} x={1248} y={817} w={115} h={8} d="M 0 4 L 115 4" ponta={false} />
        <Seta marca={m} x={1359} y={688} w={8} h={133} d="M 4 133 L 4 4" />
        <Seta marca={m} x={1425} y={687} w={8} h={162} d="M 4 0 L 4 162" volta ponta={false} />
        <Seta marca={m} x={1249} y={845} w={180} h={8} d="M 180 4 L 4 4" volta />
        <Seta marca={m} x={1496} y={641} w={47} h={8} d="M 0 4 L 43 4" />
        <Seta marca={m} x={1640} y={308} w={8} h={295} d="M 4 295 L 4 4" />

        <No x={552} y={223} tom="amber" titulo="Pede o serviço">foto, endereço e bairro · recebe protocolo</No>
        <No x={1544} y={223} tom="amber" titulo={'Vê "Concluído"'}>no acompanhamento do protocolo</No>
        <No x={304} y={413} titulo="Abre OS no escritório">pedido por telefone, ofício ou visita</No>
        <No x={552} y={413} titulo="Triagem">vira OS ou é recusado</No>
        <No x={800} y={413} tom="gray" titulo="Cancelada">o motivo fica registrado</No>
        <No x={800} y={603} tom="brand" titulo="Aprovar a abertura">etapa: Aguardando aprovação</No>
        <No x={1296} y={603} tom="brand" titulo="Conferir a baixa">olha as fotos do antes e depois</No>
        <No x={1544} y={603} tom="mint" titulo="Finalizada">entra no painel e nos relatórios</No>
        <No x={304} y={793} titulo="Abre ocorrência em campo">foto com GPS, até sem internet</No>
        <No x={1048} y={793} titulo="Executa e dá baixa">fotos do depois + quem trabalhou</No>
        <Link to={rotaTenant(entityId, 'cadastros/fluxo/pedido')} className="so-node dash" style={{ left: 1544, top: 793 }}><span><b>Faltou material?</b>o fiscal abre um orçamento → ver o fluxo do pedido</span></Link>

        <Rot x={697} y={352} w={140}>recusa, com motivo</Rot>
        <Rot x={676} y={603} w={72}>vira OS</Rot>
        <Rot x={912} y={542} w={64}>reprova</Rot>
        <Rot x={1042} y={617} w={64}>aprova</Rot>
        <Rot x={1261} y={746} w={90}>baixa feita</Rot>
        <Rot x={1269} y={861} w={140}>reabre, com motivo</Rot>
        <Rot x={1508} y={447} w={124}>avisa o munícipe</Rot>

        <div className="so-card box" style={{ left: 64, top: 964, width: 840, height: 140 }}><b>Regras que você liga ou desliga</b> <span className="muted">(Cadastros › Fluxo e aprovações)</span><br />• OS precisa de aprovação antes de ir a campo? Desligado: vai direto para o fiscal.<br />• A baixa precisa ser conferida? Desligado: a baixa já finaliza a OS.<br />• Prazo padrão de atendimento (dias) para o painel marcar atraso.</div>
        <div className="so-card box" style={{ left: 936, top: 964, width: 840, height: 140 }}><b>Etapas que aparecem na OS</b><br /><span className="mono" style={{ fontSize: 12, color: 'var(--brand-ink)' }}>Aguardando aprovação → Registrada → Executada → Finalizada</span><br />ou Cancelada (sempre com motivo)<br /><span className="muted">Quem deu a baixa não confere a própria baixa.</span></div>

        <Mira />
      </Prancha>
      <Rodape outro="cadastros/fluxo/pedido" outroNome="Fluxo do pedido" />
    </Pagina>
  );
}

/** Fluxo do Pedido de compra */
export function FluxogramaPedidoPage() {
  const m = 'soArrPD';
  return (
    <Pagina semMira>
      <Prancha tipo="pedido">
        <Marcador id={m} />
        <Titulo icone="carrinho" titulo="Fluxo do Pedido de compra" texto="Cada faixa mostra quem faz o passo. Quem pode fazer cada passo é decidido pelas caixas marcadas nos acessos de cada pessoa. Linha tracejada = devolvido para corrigir." />
        <Faixas />
        <Rotulo top={200} icone="hardhat" tom="mint" nome="Quem pede">caixas: Fazer orçamento · Lançar pedido<br />ex.: fiscal, coordenador</Rotulo>
        <Rotulo top={376} icone="search" nome="Quem revisa">caixa: Revisar pedido<br />ex.: engenheiro, setor de compras</Rotulo>
        <Rotulo top={566} icone="shieldCheck" nome="Quem aprova">caixa: Aprovar pedido<br />ex.: secretário</Rotulo>
        <Rotulo top={756} icone="truck" tom="cyan" nome="Compras e almoxarifado">caixas: Enviar ao fornecedor · Registrar recebimento</Rotulo>

        <Seta marca={m} x={504} y={261} w={47} h={8} d="M 0 4 L 43 4" />
        <Seta marca={m} x={752} y={261} w={148} h={8} d="M 0 4 L 148 4" ponta={false} />
        <Seta marca={m} x={896} y={265} w={8} h={147} d="M 4 0 L 4 143" />
        <Seta marca={m} x={652} y={451} w={148} h={8} d="M 0 4 L 148 4" volta ponta={false} />
        <Seta marca={m} x={648} y={308} w={8} h={147} d="M 4 147 L 4 4" volta />
        <Seta marca={m} x={1000} y={451} w={148} h={8} d="M 0 4 L 148 4" ponta={false} />
        <Seta marca={m} x={1144} y={455} w={8} h={147} d="M 4 0 L 4 143" />
        <Seta marca={m} x={1177} y={184} w={8} h={419} d="M 4 0 L 4 419" volta ponta={false} />
        <Seta marca={m} x={652} y={180} w={529} h={8} d="M 0 4 L 529 4" volta ponta={false} />
        <Seta marca={m} x={648} y={184} w={8} h={38} d="M 4 0 L 4 34" volta />
        <Seta marca={m} x={1248} y={641} w={148} h={8} d="M 0 4 L 148 4" ponta={false} />
        <Seta marca={m} x={1392} y={645} w={8} h={147} d="M 4 0 L 4 143" />
        <Seta marca={m} x={1496} y={831} w={47} h={8} d="M 0 4 L 43 4" />

        <No x={304} y={223} titulo="Orçamento no local">fotos + materiais do contrato, por serviço</No>
        <No x={552} y={223} titulo="Pedido">do orçamento ou lançado direto · Rascunho</No>
        <No x={1296} y={223} tom="dash" titulo="Trava">contrato vencido ou sem saldo não deixa lançar</No>
        <No x={800} y={413} tom="brand" titulo="Revisar">quantidades e saldo · Em revisão</No>
        <No x={1048} y={603} tom="brand" titulo="Aprovar">não pode ser quem revisou</No>
        <No x={1296} y={793} titulo="Enviar ao fornecedor">PDF do pedido · Enviado</No>
        <No x={1544} y={793} tom="mint" titulo="Registrar recebimento">parcial ou total · baixa o saldo</No>

        <Rot x={790} y={237} w={56}>envia</Rot>
        <Rot x={490} y={373} w={150}>devolve, com motivo</Rot>
        <Rot x={1042} y={427} w={64}>confere</Rot>
        <Rot x={960} y={196} w={150}>devolve, com motivo</Rot>
        <Rot x={1290} y={617} w={64}>aprova</Rot>

        <div className="so-card box" style={{ left: 64, top: 964, width: 840, height: 140 }}><b>Regras</b> <span className="muted">(Cadastros › Fluxo e aprovações)</span><br />• Pedido passa por revisão e aprovação? Desligado: vai direto ao fornecedor.<br />• Um pedido por contrato: orçamento com itens de 2 contratos vira 2 pedidos.<br />• Cada item guarda o serviço e o centro de custo para onde o material vai.</div>
        <div className="so-card box" style={{ left: 936, top: 964, width: 840, height: 140 }}><b>Etapas que aparecem no pedido</b><br /><span className="mono" style={{ fontSize: 12, color: 'var(--brand-ink)' }}>Rascunho → Em revisão → Aguardando aprovação → Aprovado → Enviado → Recebido parcial / Recebido</span><br />ou Cancelado<br /><span className="muted">Devolver sempre pede o motivo e o pedido volta para Rascunho.</span></div>

        <Mira />
      </Prancha>
      <Rodape outro="cadastros/fluxo/os" outroNome="Fluxo da OS" />
    </Pagina>
  );
}

function Rodape({ outro, outroNome }: { outro: string; outroNome: string }) {
  const { entityId } = useTenant();
  return (
    <BarraAcoes esquerda={<>Fluxograma<Sep />linha tracejada = volta atrás</>}>
      <Link to={rotaTenant(entityId, 'cadastros/fluxo')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Fluxo e aprovações</Link>
      <Link to={rotaTenant(entityId, outro)} className="so-btn so-primary">{outroNome}<Ic n="seta" className="arrow" /></Link>
    </BarraAcoes>
  );
}
