import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PlatformGuard } from './platform/PlatformGuard';
import { LoginPage } from './platform/pages/LoginPage';
import { EntityListPage } from './platform/pages/EntityListPage';
import { EntityCreatePage } from './platform/pages/EntityCreatePage';
import { EntityDetailPage } from './platform/pages/EntityDetailPage';
import { NotFoundPage } from './platform/pages/NotFoundPage';
import { ForbiddenPage } from './platform/pages/ForbiddenPage';
import { TenantLoginPage } from './tenant/pages/TenantLoginPage';
import { TenantGuard } from './tenant/TenantGuard';
import { TenantPermissionGuard } from './tenant/TenantPermissionGuard';
import { TenantDashboardPage } from './tenant/pages/TenantDashboardPage';
import { TenantUserListPage } from './tenant/pages/TenantUserListPage';
import { TenantUserCreatePage } from './tenant/pages/TenantUserCreatePage';
import { TenantUserDetailPage } from './tenant/pages/TenantUserDetailPage';
import { TenantForbiddenPage } from './tenant/pages/TenantForbiddenPage';
import { LicitacaoListPage } from './tenant/pages/LicitacaoListPage';
import { LicitacaoCreatePage } from './tenant/pages/LicitacaoCreatePage';
import { LicitacaoDetailPage } from './tenant/pages/LicitacaoDetailPage';
import { CentroCustoListPage } from './tenant/pages/CentroCustoListPage';
import { CentroCustoCreatePage } from './tenant/pages/CentroCustoCreatePage';
import { CentroCustoDetailPage } from './tenant/pages/CentroCustoDetailPage';
import { PropriedadeCatalogPage } from './tenant/pages/PropriedadeCatalogPage';
import { ServicosPage } from './tenant/pages/ServicosPage';
import { ServicoDetailPage } from './tenant/pages/ServicoDetailPage';
import { CadastrosAuxiliaresPage } from './tenant/pages/CadastrosAuxiliaresPage';

/** Application router root */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/platform/login" replace />} />
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
        <Route path="/t/:id" element={<TenantGuard />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TenantDashboardPage />} />
          <Route path="servicos" element={<ServicosPage />} />
          <Route path="servicos/:slug" element={<ServicoDetailPage />} />
          <Route path="cadastros-auxiliares" element={<CadastrosAuxiliaresPage />} />
          <Route element={<TenantPermissionGuard permission="licitacoes.view" />}>
            <Route path="licitacoes" element={<LicitacaoListPage />} />
            <Route path="licitacoes/:licitacaoId" element={<LicitacaoDetailPage />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="licitacoes.manage" />}>
            <Route path="licitacoes/new" element={<LicitacaoCreatePage />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="centros_custo.view" />}>
            <Route path="centros-custo" element={<CentroCustoListPage />} />
            <Route path="centros-custo/:centroId" element={<CentroCustoDetailPage />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="centros_custo.manage" />}>
            <Route path="centros-custo/new" element={<CentroCustoCreatePage />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="centros_custo.propriedades.manage" />}>
            <Route path="centros-custo/propriedades" element={<PropriedadeCatalogPage />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="users.view" />}>
            <Route path="users" element={<TenantUserListPage />} />
            <Route path="users/:userId" element={<TenantUserDetailPage />} />
          </Route>
          <Route element={<TenantPermissionGuard permission="users.manage" />}>
            <Route path="users/new" element={<TenantUserCreatePage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
