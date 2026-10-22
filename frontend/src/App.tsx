import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PlatformGuard } from './platform/PlatformGuard';
import { LoginPage } from './platform/pages/LoginPage';
import { EntityListPage } from './platform/pages/EntityListPage';
import { EntityCreatePage } from './platform/pages/EntityCreatePage';
import { EntityDetailPage } from './platform/pages/EntityDetailPage';
import { NotFoundPage } from './platform/pages/NotFoundPage';
import { ForbiddenPage } from './platform/pages/ForbiddenPage';
import { TenantLoginPage } from './tenant/pages/TenantLoginPage';
import { TenantGuard } from './tenant/TenantGuard';
import { useTenant } from './tenant/TenantContext';
import { TenantPermissionGuard } from './tenant/TenantPermissionGuard';
import { SalaSituacaoPage } from './tenant/pages/SalaSituacaoPage';
import { TenantForbiddenPage } from './tenant/pages/TenantForbiddenPage';
import { LicitacaoListPage } from './tenant/pages/LicitacaoListPage';
import { LicitacaoCreatePage } from './tenant/pages/LicitacaoCreatePage';
import { LicitacaoDetailPage } from './tenant/pages/LicitacaoDetailPage';
import { ServicosPage } from './tenant/pages/ServicosPage';
import { ServicoDetailPage } from './tenant/pages/ServicoDetailPage';
import { CadastrosAuxiliaresPage } from './tenant/pages/CadastrosAuxiliaresPage';
import { ComprasPage } from './tenant/pages/ComprasPage';
import { MapaFullPage } from './tenant/pages/MapaFullPage';
import { ultimoTenant } from './lib/offline/pwa';
import { CentralMunicipePage } from './municipe/CentralMunicipePage';
import { CentralSolicitacoesPage } from './tenant/pages/CentralSolicitacoesPage';
import { PedidosCompraPage } from './tenant/pages/PedidosCompraPage';
import { SaldosPage } from './tenant/pages/SaldosPage';
import { OrcamentosPage, OrcamentoEditorPage } from './tenant/pages/OrcamentosPage';
import { CadastrosInicioPage } from './tenant/pages/cadastros/CadastrosInicioPage';
import { FluxoAprovacoesPage } from './tenant/pages/cadastros/FluxoAprovacoesPage';
import { FluxogramaOSPage, FluxogramaPedidoPage } from './tenant/pages/cadastros/FluxogramaPage';
import { OrgaoPage } from './tenant/pages/cadastros/OrgaoPage';
import { LugaresPage } from './tenant/pages/cadastros/LugaresPage';
import { PessoasPage } from './tenant/pages/cadastros/PessoasPage';
import { AcessosPage } from './tenant/pages/cadastros/AcessosPage';
import { EquipesPage } from './tenant/pages/cadastros/EquipesPage';
import { EquipamentosPage, VeiculosPage } from './tenant/pages/cadastros/VeiculosPage';
import { CentrosCustoPage } from './tenant/pages/cadastros/CentrosCustoPage';
import { ServicosListaPage } from './tenant/pages/cadastros/ServicosListaPage';
import { LinkAcessoPage } from './municipe/LinkAcessoPage';

/** Tela inicial: Sala de Situação para quem tem a caixa; senão, Serviços */
function InicioTenant() {
  const { session } = useTenant();
  const sala = session.adminGeral || session.acessos?.includes('painel.sala');
  return <Navigate to={sala ? 'dashboard' : 'servicos'} replace />;
}

/** Entrada do app instalado: abre direto na última prefeitura usada */
function InicioApp() {
  const id = ultimoTenant();
  return <Navigate to={id ? `/t/${id}/servicos` : '/platform/login'} replace />;
}

/** /t/:id/users/:userId (tela antiga) → Pessoas com a pessoa aberta */
function RedirecionaUsuario() {
  const { id, userId } = useParams<{ id: string; userId: string }>();
  return <Navigate to={`/t/${id}/cadastros/pessoas?editar=${userId}`} replace />;
}

/** Ficha antiga do serviço e a antiga "Estrutura dos serviços" → Cadastros › Serviços (abre a janela do serviço) */
function RedirecionaServico() {
  const { id, servicoId, centroId } = useParams<{ id: string; servicoId?: string; centroId?: string }>();
  const alvo = servicoId ?? (centroId && centroId !== 'new' && centroId !== 'propriedades' ? centroId : null);
  return <Navigate to={`/t/${id}/cadastros/servicos${alvo ? `?abrir=${alvo}` : ''}`} replace />;
}

/** /t/:id/configuracoes (antiga tela Regras) → Fluxo e aprovações */
function RedirecionaRegras() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/t/${id}/cadastros/fluxo`} replace />;
}

/** Application router root */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/platform/login" replace />} />
        <Route path="/app" element={<InicioApp />} />
        <Route path="/s/:id" element={<CentralMunicipePage />} />
        <Route path="/acesso/:token" element={<LinkAcessoPage />} />
        <Route path="/platform/login" element={<LoginPage />} />
        <Route path="/platform" element={<PlatformGuard />}>
          <Route index element={<Navigate to="/platform/entities" replace />} />
          <Route path="entities" element={<EntityListPage />} />
          <Route path="entities/new" element={<EntityCreatePage />} />
          <Route path="entities/:id" element={<EntityDetailPage />} />
          <Route path="forbidden" element={<ForbiddenPage />} />
        </Route>

        <Route path="/t/:id/login" element={<TenantLoginPage />} />
        <Route path="/t/:id/forbidden" element={<TenantForbiddenPage />} />
        <Route path="/t/:id/mapa" element={<MapaFullPage />} />
        <Route path="/t/:id" element={<TenantGuard />}>
          <Route index element={<InicioTenant />} />
          <Route path="dashboard" element={<SalaSituacaoPage />} />
          <Route path="servicos" element={<ServicosPage />} />
          <Route path="central-municipe" element={<CentralSolicitacoesPage />} />
          <Route path="configuracoes" element={<RedirecionaRegras />} />
          <Route path="pedidos" element={<PedidosCompraPage />} />
          <Route path="saldos" element={<SaldosPage />} />
          <Route path="centros-de-custo" element={<Navigate to="../cadastros/centros-de-custo" replace />} />
          <Route path="orcamentos" element={<OrcamentosPage />} />
          <Route path="orcamentos/:orcamentoId" element={<OrcamentoEditorPage />} />
          <Route path="servicos/:slug" element={<ServicoDetailPage />} />
          <Route path="compras" element={<ComprasPage />} />
          <Route path="cadastros-auxiliares" element={<CadastrosAuxiliaresPage />} />
          <Route element={<TenantPermissionGuard permission="licitacoes.view" />}>
            <Route path="licitacoes" element={<LicitacaoListPage />} />
            <Route path="licitacoes/:licitacaoId" element={<LicitacaoDetailPage />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="licitacoes.manage" />}>
            <Route path="licitacoes/new" element={<LicitacaoCreatePage />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="centros_custo.view" />}>
            <Route path="cadastros" element={<CadastrosInicioPage />} />
            <Route path="cadastros/orgao" element={<OrgaoPage />} />
            <Route path="cadastros/lugares" element={<LugaresPage />} />
            <Route path="cadastros/veiculos" element={<VeiculosPage />} />
            <Route path="cadastros/equipamentos" element={<EquipamentosPage />} />
            <Route path="cadastros/centros-de-custo" element={<CentrosCustoPage />} />
            <Route path="cadastros/servicos" element={<ServicosListaPage />} />
            <Route path="cadastros/servicos/:servicoId" element={<RedirecionaServico />} />
            <Route path="cadastros/fluxo" element={<FluxoAprovacoesPage />} />
            <Route path="cadastros/fluxo/os" element={<FluxogramaOSPage />} />
            <Route path="cadastros/fluxo/pedido" element={<FluxogramaPedidoPage />} />
            {/* a antiga "Estrutura dos serviços" saiu: tudo do serviço está em Cadastros › Serviços */}
            <Route path="centros-custo" element={<RedirecionaServico />} />
            <Route path="centros-custo/:centroId" element={<RedirecionaServico />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="users.view" />}>
            <Route path="cadastros/pessoas" element={<PessoasPage />} />
            <Route path="cadastros/pessoas/:userId/acessos" element={<AcessosPage />} />
            <Route path="cadastros/equipes" element={<EquipesPage />} />
            {/* telas antigas de usuários: agora é o passo Pessoas */}
            <Route path="users" element={<Navigate to="../cadastros/pessoas" replace />} />
            <Route path="users/new" element={<Navigate to="../../cadastros/pessoas" replace />} />
            <Route path="users/:userId" element={<RedirecionaUsuario />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
