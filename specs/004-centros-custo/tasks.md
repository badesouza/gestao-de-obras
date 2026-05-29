---
description: "Task list for Spec 04 — Centros de Custo e Registro Diário"
---

# Tasks: Spec 04 — Centros de Custo e Registro Diário

**Input**: Design documents from `specs/004-centros-custo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tenant-centros-custo.openapi.yaml

**Depends on**: Specs 01–03 implementadas (entidade, auth tenant, licitações/itens)

**Tests**: Unit tests para `cell-value.validator` e `production.service`; integração para cross-tenant, busca itens scoped e agregação mensal. Validação manual via `quickstart.md` na fase Polish.

**Organization**: Tasks grouped by user story (US1–US8) for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: Maps to spec user stories US1–US8

## Path Conventions

- **API**: `api/src/`, `api/prisma/`, `api/tests/`
- **Frontend**: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Estrutura de módulo centros-custo

- [ ] T001 Create centros-custo module directory structure per plan in `api/src/modules/tenant/centros-custo/`
- [ ] T002 [P] Create frontend folders `frontend/src/tenant/components/centros-custo/` and `frontend/src/tenant/hooks/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, RBAC e validador de células — MUST complete before user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [ ] T003 Implement Prisma models (CentroCusto, CentroCustoLicitacao, CentroCustoPropriedade, CentroCustoPropriedadeConfig, RegistroDiario, RegistroDiarioValor, RegistroDiarioValorItem) and relations in `api/prisma/schema.prisma`
- [ ] T004 Create and apply migration `20260529120000_centros_custo` in `api/prisma/migrations/`
- [ ] T005 [P] Add centros_custo permission constants in `api/src/shared/constants.ts`
- [ ] T006 Extend seed with centros_custo permissions and role mappings (ADMIN all, ENGINEER view+registros.edit, OPERATOR view) in `api/prisma/seed.ts`
- [ ] T007 [P] Implement typed cell value validator in `api/src/modules/tenant/centros-custo/cell-value.validator.ts`
- [ ] T008 [P] Create Zod schemas for centro, propriedade, registro in `centro-custo.schema.ts`, `propriedade.schema.ts`, `registro-diario.schema.ts`
- [ ] T009 [P] Add entity-active and centro-active guard helpers in `centro-custo.service.ts`
- [ ] T010 Unit tests for cell-value.validator (all PropriedadeTipo) in `api/tests/unit/centros-custo/cell-value.validator.test.ts`

**Checkpoint**: Schema migrado, RBAC seeded, validador testado

---

## Phase 3: User Story 1 — Cadastrar Centro de Custo (Priority: P1) 🎯 MVP

**Goal**: Cadastro de centro com nome e datas previstas/realizadas; metadados e auditoria

**Independent Test**: Admin cria centro → aparece na listagem com status ACTIVE e createdBy

### Implementation for User Story 1

- [ ] T011 [US1] Implement centro-custo service (create, list, getById, update, deactivate) in `api/src/modules/tenant/centros-custo/centro-custo.service.ts`
- [ ] T012 [US1] Write audit on centro create/update/deactivate in `centro-custo.service.ts`
- [ ] T013 [US1] Implement routes GET/POST `/centros-custo`, GET/PATCH `/centros-custo/:id`, PATCH status in `centro-custo.routes.ts`
- [ ] T014 [US1] Register centros-custo routes in `api/src/modules/tenant/tenant.routes.ts`
- [ ] T015 [P] [US1] Add `tenantApi.centrosCusto` methods (list, create, get, update, deactivate) in `frontend/src/lib/api-client.ts`
- [ ] T016 [P] [US1] Add Centros de Custo nav item with icon and `centros_custo.view` in `frontend/src/tenant/components/TenantSidebar.tsx`
- [ ] T017 [US1] Implement `CentroCustoListPage` in `frontend/src/tenant/pages/CentroCustoListPage.tsx`
- [ ] T018 [US1] Implement `CentroCustoCreatePage` with date fields validation UX in `frontend/src/tenant/pages/CentroCustoCreatePage.tsx`
- [ ] T019 [US1] Wire routes `/t/:id/centros-custo` and `/t/:id/centros-custo/new` with permission guards in `frontend/src/App.tsx`

**Checkpoint**: US1 complete — cadastro e listagem de centros end-to-end

---

## Phase 4: User Story 2 — Vincular Licitações ao Centro (Priority: P1)

**Goal**: Associar uma ou mais licitações ativas ao centro para uso de itens

**Independent Test**: Editar centro com 2 licitações → detalhe exibe ambas; licitação inativa rejeitada

### Implementation for User Story 2

- [ ] T020 [US2] Implement `setCentroCustoLicitacoes` with ACTIVE entity/licitacao validation in `centro-custo.service.ts`
- [ ] T021 [US2] Write audit `CENTRO_CUSTO_LICITACOES_UPDATED` in `centro-custo.service.ts`
- [ ] T022 [US2] Implement PUT `/centros-custo/:id/licitacoes` in `centro-custo.routes.ts`
- [ ] T023 [P] [US2] Include licitacoes in GET detail response in `centro-custo.service.ts`
- [ ] T024 [US2] Add licitacao multi-select on create/edit pages in `CentroCustoCreatePage.tsx` and edit form (detail or dedicated edit section)
- [ ] T025 [US2] Add `tenantApi.centrosCusto.setLicitacoes` in `frontend/src/lib/api-client.ts`

**Checkpoint**: US2 complete — vínculo licitação funcional

---

## Phase 5: User Story 3 — Cadastrar Propriedades Reutilizáveis (Priority: P1)

**Goal**: Catálogo entity-level de propriedades tipadas reutilizáveis

**Independent Test**: Criar propriedades TEXTO, BOOLEAN, ITEM_LICITACAO; listar no catálogo

### Implementation for User Story 3

- [ ] T026 [US3] Implement propriedade service (create, list, update name, deactivate, block tipo change after use) in `propriedade.service.ts`
- [ ] T027 [US3] Write audit on propriedade create/deactivate in `propriedade.service.ts`
- [ ] T028 [US3] Implement GET/POST `/centros-custo/propriedades`, PATCH `/centros-custo/propriedades/:id` in `centro-custo.routes.ts`
- [ ] T029 [P] [US3] Implement `PropriedadeCatalogPage` with tipo help text in `frontend/src/tenant/pages/PropriedadeCatalogPage.tsx`
- [ ] T030 [US3] Add `tenantApi.centrosCusto.propriedades` CRUD in `frontend/src/lib/api-client.ts`
- [ ] T031 [US3] Wire route `/t/:id/centros-custo/propriedades` with `centros_custo.propriedades.manage` guard in `frontend/src/App.tsx`

**Checkpoint**: US3 complete — catálogo de propriedades operacional

---

## Phase 6: User Story 4 — Configurar Propriedades do Centro (Priority: P2)

**Goal**: Selecionar propriedades, ordem de colunas e marcadores INICIO/CONCLUSAO

**Independent Test**: Configurar 4 propriedades com ordem e marcadores → salvar → GET detail reflete config

### Implementation for User Story 4

- [ ] T032 [US4] Implement `setPropriedadesConfig` (order, productionRole, active flag, item-type requires licitacao) in `centro-custo.service.ts`
- [ ] T033 [US4] Write audit `CENTRO_PROPRIEDADES_CONFIG_UPDATED` in `centro-custo.service.ts`
- [ ] T034 [US4] Implement PUT `/centros-custo/:id/propriedades-config` in `centro-custo.routes.ts`
- [ ] T035 [US4] Implement `PropriedadeConfigPanel` (drag/order or numeric order, role selectors) in `frontend/src/tenant/components/centros-custo/PropriedadeConfigPanel.tsx`
- [ ] T036 [US4] Integrate config panel on centro edit section or detail settings area
- [ ] T037 [US4] Add `tenantApi.centrosCusto.setPropriedadesConfig` in `frontend/src/lib/api-client.ts`

**Checkpoint**: US4 complete — configuração de colunas por centro

---

## Phase 7: User Story 7 — Listar e Detalhar Centros (Priority: P3)

**Goal**: Detalhe com cabeçalho entidade+centro e menu horizontal de abas (shell para US5/US6/US8)

**Independent Test**: Detalhar centro → header completo → tabs Registro | Desempenho | Produção visíveis

### Implementation for User Story 7

- [ ] T038 [US7] Implement `CentroCustoHeader` (entity name, centro nome/datas/licitações/createdBy) in `frontend/src/tenant/components/centros-custo/CentroCustoHeader.tsx`
- [ ] T039 [US7] Implement `CentroCustoTabs` and `useCentroCustoMonthNav` hook (URL `tab`, `year`, `month`) in `CentroCustoTabs.tsx` and `useCentroCustoMonthNav.ts`
- [ ] T040 [US7] Implement `CentroCustoDetailPage` shell (header + tabs + outlet) in `frontend/src/tenant/pages/CentroCustoDetailPage.tsx`
- [ ] T041 [US7] Wire route `/t/:id/centros-custo/:centroId` with `centros_custo.view` guard in `frontend/src/App.tsx`
- [ ] T042 [US7] Enhance list page with licitacaoCount and propriedadeCount from API in `CentroCustoListPage.tsx`

**Checkpoint**: US7 shell complete — navegação para abas operacionais

---

## Phase 8: User Story 5 — Registro Diário em Grade (Priority: P2)

**Goal**: Grade estilo planilha com coluna Data fixa, navegação mensal, editores por tipo, busca de item

**Independent Test**: Mês corrente → adicionar linha → preencher células → recarregar mês → dados persistidos

### Implementation for User Story 5

- [ ] T043 [US5] Implement registro-diario service (listByMonth, create, update, delete row) in `registro-diario.service.ts`
- [ ] T044 [US5] Persist typed cell values + item junction rows in `registro-diario.service.ts`
- [ ] T045 [US5] Write audit REGISTRO_DIARIO_* on create/update/delete in `registro-diario.service.ts`
- [ ] T046 [US5] Implement item-search service (scoped to centro licitacoes, active items) in `item-search.service.ts`
- [ ] T047 [US5] Implement GET/POST/PATCH/DELETE registro routes and GET itens-busca in `centro-custo.routes.ts`
- [ ] T048 [P] [US5] Implement `DailyRegisterCellEditors` per PropriedadeTipo in `DailyRegisterCellEditors.tsx`
- [ ] T049 [P] [US5] Implement `ItemPickerCombobox` with async search in `ItemPickerCombobox.tsx`
- [ ] T050 [US5] Implement `DailyRegisterGrid` (table, add row, month filter, save row) in `DailyRegisterGrid.tsx`
- [ ] T051 [US5] Integrate grid on detail page tab `registro` with empty state when no propriedades configured
- [ ] T052 [US5] Add registro and itens-busca methods to `tenantApi.centrosCusto` in `frontend/src/lib/api-client.ts`
- [ ] T053 [US5] Enforce read-only grid for users without `centros_custo.registros.edit`

**Checkpoint**: US5 complete — registro diário editável end-to-end

---

## Phase 9: User Story 6 — Produção Diária (Priority: P2)

**Goal**: Dashboard agregado por dia (cadastradas, iniciadas, concluídas) com sync de mês

**Independent Test**: 3 registros em um dia com marcadores → produção reflete contagens corretas

### Implementation for User Story 6

- [ ] T054 [US6] Implement production aggregation service (all days in month, marker rules) in `production.service.ts`
- [ ] T055 [US6] Implement GET `/centros-custo/:id/producao?year=&month=` in `centro-custo.routes.ts`
- [ ] T056 [US6] Unit tests for marker counting rules in `api/tests/unit/centros-custo/production.service.test.ts`
- [ ] T057 [US6] Implement `ProductionDailyPanel` table in `frontend/src/tenant/components/centros-custo/ProductionDailyPanel.tsx`
- [ ] T058 [US6] Integrate panel on detail tab `producao` sharing month nav with registro tab
- [ ] T059 [US6] Show explanatory note when marcadores INICIO/CONCLUSAO not configured
- [ ] T060 [US6] Add `tenantApi.centrosCusto.getProducao` in `frontend/src/lib/api-client.ts`

**Checkpoint**: US6 complete — produção diária sincronizada com mês

---

## Phase 10: User Story 8 — Painel de Desempenho Placeholder (Priority: P4)

**Goal**: Aba acessível com placeholder explícito, sem métricas inventadas

**Independent Test**: Aba Desempenho exibe mensagem "em definição" sem erro

### Implementation for User Story 8

- [ ] T061 [US8] Implement `PerformancePanelPlaceholder` in `frontend/src/tenant/components/centros-custo/PerformancePanelPlaceholder.tsx`
- [ ] T062 [US8] Wire tab `desempenho` content on `CentroCustoDetailPage.tsx`

**Checkpoint**: US8 complete — placeholder navegável

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Testes de integração, hardening e validação final

- [ ] T063 [P] Integration test: cross-tenant centro access 404 in `api/tests/integration/centros-custo/access.test.ts`
- [ ] T064 [P] Integration test: itens-busca scoped to linked licitacoes in `api/tests/integration/centros-custo/item-search.test.ts`
- [ ] T065 [P] Integration test: producao aggregation for sample month in `api/tests/integration/centros-custo/producao.test.ts`
- [ ] T066 [P] Integration test: cell validation rejects wrong type in `api/tests/integration/centros-custo/registro.test.ts`
- [ ] T067 Run end-to-end validation following `specs/004-centros-custo/quickstart.md`
- [ ] T068 [P] Mark completed tasks in `specs/004-centros-custo/tasks.md` after implementation

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)
    └── Phase 2 (Foundational) ← BLOCKS all user stories
            ├── Phase 3 (US1) 🎯 MVP — cadastro centro
            ├── Phase 4 (US2) — licitações (needs centro)
            ├── Phase 5 (US3) — catálogo propriedades
            ├── Phase 6 (US4) — config (needs US3 + centro)
            ├── Phase 7 (US7) — detail shell (needs US1)
            ├── Phase 8 (US5) — registro (needs US4 + US7)
            ├── Phase 9 (US6) — produção (needs US5 data + US4 markers)
            ├── Phase 10 (US8) — placeholder (needs US7)
            └── Phase 11 (Polish)
```

### User Story Dependencies

| Story | Depends on | Independent test |
|-------|------------|------------------|
| US1 (P1) | Phase 2 | Criar e listar centro |
| US2 (P1) | US1 | Vincular licitações |
| US3 (P1) | Phase 2 | Catálogo propriedades |
| US4 (P2) | US1, US3 | Config colunas + marcadores |
| US7 (P3) | US1 | Detail header + tabs |
| US5 (P2) | US4, US7 | Grade registro mensal |
| US6 (P2) | US5, US4 | Agregação produção |
| US8 (P4) | US7 | Placeholder desempenho |

### Parallel Opportunities

**Phase 2**:

```text
T005 ∥ T007 ∥ T008 ∥ T009
T010 after T007
```

**Phase 3 US1**:

```text
T015 ∥ T016 ∥ T017  (while T011–T014 backend)
```

**Phase 8 US5**:

```text
T048 ∥ T049  (while T043–T047 backend)
T050 after T048–T049
```

---

## Parallel Example: User Story 5

```bash
# Backend registro pipeline:
T043 registro-diario.service.ts
T044 cell persistence
T046 item-search.service.ts
T047 routes

# Frontend editors in parallel:
T048 DailyRegisterCellEditors.tsx
T049 ItemPickerCombobox.tsx

# Then grid integration:
T050 DailyRegisterGrid.tsx
T051 detail tab wiring
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1–2 (T001–T010)
2. Complete Phase 3 US1 (T011–T019)
3. **STOP and VALIDATE**: Criar centro via UI
4. Demo listagem tenant com menu Centros de Custo

### Incremental Delivery

1. Setup + Foundational → schema + validador
2. US1 → cadastro centro (MVP)
3. US2 + US3 → licitações + catálogo
4. US4 → config propriedades
5. US7 → detail shell
6. US5 → registro diário
7. US6 → produção diária
8. US8 → placeholder desempenho
9. Polish → testes + quickstart

### Suggested commit checkpoints

- `feat(tenant): add centros_custo schema and rbac seed`
- `feat(tenant): add centro crud (US1)`
- `feat(tenant): add licitacao links and propriedade catalog (US2–US3)`
- `feat(tenant): add propriedade config per centro (US4)`
- `feat(tenant): add centro detail shell (US7)`
- `feat(tenant): add daily register grid (US5)`
- `feat(tenant): add producao diaria (US6)`
- `feat(tenant): add performance panel placeholder (US8)`
- `test(tenant): add centros-custo integration tests`

---

## Notes

- Total tasks: **68**
- Coluna **Data** é fixa — não cadastrar como propriedade do catálogo
- Validação de células MUST occur no servidor (`cell-value.validator.ts`)
- Mês/aba sincronizados via URL search params (`tab`, `year`, `month`)
- Painel de Desempenho: placeholder only — sem KPIs nesta spec
- DELETE de linha de registro permitido com auditoria (research.md §9)
- Re-login tenant necessário após seed de novas permissões
