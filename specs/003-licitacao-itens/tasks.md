---
description: "Task list for Spec 03 — Licitações e Importação de Itens"
---

# Tasks: Spec 03 — Licitações e Importação de Itens

**Input**: Design documents from `specs/003-licitacao-itens/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tenant-licitacoes.openapi.yaml

**Depends on**: Spec 01 (Entity) + Spec 02 (auth tenant, RBAC, layout, auditoria) implementadas

**Tests**: Unit tests para parsers de importação; integração para atomicidade e cross-tenant. Validação manual via `quickstart.md` na fase Polish.

**Organization**: Tasks grouped by user story (US1–US5) for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: Maps to spec user stories US1–US5

## Path Conventions

- **API**: `api/src/`, `api/prisma/`, `api/tests/`
- **Frontend**: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências e estrutura de módulo

- [ ] T001 Add `xlsx` dependency in `api/package.json`
- [ ] T002 [P] Create licitacoes module directory structure per plan in `api/src/modules/tenant/licitacoes/` (incl. `import/`)
- [ ] T003 [P] Register `@fastify/multipart` plugin in `api/src/server.ts` if not already registered (upload planilha)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, RBAC e utilitários de importação — MUST complete before user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [ ] T004 Implement Prisma models `Licitacao`, `LicitacaoItem` and relations on `Entity`/`TenantUser` in `api/prisma/schema.prisma`
- [ ] T005 Create and apply migration `20260528180000_licitacoes_itens` in `api/prisma/migrations/`
- [ ] T006 [P] Add licitacao permission constants in `api/src/shared/constants.ts`
- [ ] T007 Extend seed with licitacoes permissions and role mappings (ADMIN all, ENGINEER view+import, OPERATOR view) in `api/prisma/seed.ts`
- [ ] T008 [P] Implement header normalizer with PT/EN aliases in `api/src/modules/tenant/licitacoes/import/header-normalizer.ts`
- [ ] T009 [P] Implement pt-BR decimal value parser in `api/src/modules/tenant/licitacoes/import/value.parser.ts`
- [ ] T010 [P] Implement columns parser (split, trim, trailing empty lines, parity check) in `api/src/modules/tenant/licitacoes/import/columns.parser.ts`
- [ ] T011 Implement spreadsheet parser (CSV/XLSX via xlsx, header mapping) in `api/src/modules/tenant/licitacoes/import/spreadsheet.parser.ts`
- [ ] T012 [P] Implement import template generator (CSV/XLSX) in `api/src/modules/tenant/licitacoes/import/template.generator.ts`
- [ ] T013 [P] Create shared Zod schemas for licitacao and import row validation in `api/src/modules/tenant/licitacoes/licitacao.schema.ts` and `item.schema.ts`
- [ ] T014 [P] Add entity-active guard helper (reject if Entity INACTIVE) in licitacao service layer
- [ ] T015 Unit tests for header-normalizer, value.parser, columns.parser in `api/tests/unit/licitacoes/`

**Checkpoint**: Schema migrado, RBAC seeded, parsers testados — user stories podem iniciar

---

## Phase 3: User Story 1 — Cadastrar Licitação no Tenant (Priority: P1) 🎯 MVP

**Goal**: Usuário autorizado cadastra licitação com identificação e objeto; metadados `createdAt`/`createdBy` visíveis; auditoria registrada

**Independent Test**: Login tenant admin → criar licitação → aparece na listagem com status ACTIVE e dados de cadastro

### Implementation for User Story 1

- [ ] T016 [US1] Implement licitacao service (create, list, getById, assertEntityScope) in `api/src/modules/tenant/licitacoes/licitacao.service.ts`
- [ ] T017 [US1] Write audit on licitacao create (`LICITACAO_CREATED`) via `writeTenantAudit` in `licitacao.service.ts`
- [ ] T018 [US1] Implement routes GET/POST `/licitacoes`, GET `/licitacoes/:id` with permission guards in `api/src/modules/tenant/licitacoes/licitacao.routes.ts`
- [ ] T019 [US1] Register licitacao routes in `api/src/modules/tenant/tenant.routes.ts`
- [ ] T020 [P] [US1] Add `tenantApi.licitacoes` methods (list, create, get) in `frontend/src/lib/api-client.ts`
- [ ] T021 [P] [US1] Add Licitações nav item with icon and `licitacoes.view` guard in `frontend/src/tenant/components/TenantSidebar.tsx`
- [ ] T022 [US1] Implement licitacao list page (search, status, paginação) in `frontend/src/tenant/pages/LicitacaoListPage.tsx`
- [ ] T023 [US1] Implement licitacao create form page in `frontend/src/tenant/pages/LicitacaoCreatePage.tsx`
- [ ] T024 [US1] Wire routes `/t/:id/licitacoes` and `/t/:id/licitacoes/new` with permission guards in `frontend/src/App.tsx`

**Checkpoint**: US1 complete — cadastro e listagem de licitações end-to-end

---

## Phase 4: User Story 2 — Importar Itens via Planilha (Priority: P2)

**Goal**: Upload CSV/XLSX importa itens com validação backend atômica; instruções claras e modelo para download na UI

**Independent Test**: Na licitação ativa, upload planilha válida → N itens criados; planilha com linha inválida → 422 sem persistência parcial; template baixável

### Implementation for User Story 2

- [ ] T025 [US2] Implement item import service (validate rows, atomic transaction, createMany) in `api/src/modules/tenant/licitacoes/item.service.ts`
- [ ] T026 [US2] Write audit on import (`LICITACAO_ITEMS_IMPORTED` + metadata source/count) in `item.service.ts`
- [ ] T027 [US2] Implement POST `/licitacoes/:id/items/import/spreadsheet` (multipart, 5MB/2000 lines limit) in `licitacao.routes.ts`
- [ ] T028 [US2] Implement GET `/licitacoes/import-template?format=csv|xlsx` in `licitacao.routes.ts`
- [ ] T029 [P] [US2] Create `ImportInstructions` component (colunas, exemplo, links download) in `frontend/src/tenant/components/ImportInstructions.tsx`
- [ ] T030 [US2] Create `SpreadsheetImportPanel` (file input, upload, error display per line) in `frontend/src/tenant/components/SpreadsheetImportPanel.tsx`
- [ ] T031 [US2] Add `tenantApi.licitacoes.importSpreadsheet` and `downloadTemplate` in `frontend/src/lib/api-client.ts`

**Checkpoint**: US2 complete — importação planilha funcional com instruções na UI

---

## Phase 5: User Story 3 — Importar Itens via Colunas em Textarea (Priority: P2)

**Goal**: Textareas por coluna com paridade de linhas validada no servidor; bloqueio com mensagem detalhada se divergir

**Independent Test**: Colar linhas alinhadas → itens criados; descrição 2 linhas + unidade 1 linha → 422 `IMPORT_COLUMN_MISMATCH`

### Implementation for User Story 3

- [ ] T032 [US3] Implement POST `/licitacoes/:id/items/import/columns` reusing item import pipeline in `licitacao.routes.ts`
- [ ] T033 [US3] Return structured `IMPORT_COLUMN_MISMATCH` error with per-column line counts from `columns.parser.ts`
- [ ] T034 [P] [US3] Create `ColumnsImportPanel` (4 textareas, live line count preview, submit) in `frontend/src/tenant/components/ColumnsImportPanel.tsx`
- [ ] T035 [US3] Add client-side parity pre-check (UX only) mirroring server rules in `ColumnsImportPanel.tsx`
- [ ] T036 [US3] Add `tenantApi.licitacoes.importColumns` in `frontend/src/lib/api-client.ts`

**Checkpoint**: US3 complete — importação textarea com paridade enforced server-side

---

## Phase 6: User Story 4 — Consultar Licitações e Itens (Priority: P3)

**Goal**: Detalhe da licitação com tabela de itens, filtros e metadados de cadastro; view-only para perfil Operador

**Independent Test**: Abrir licitação → ver itens importados, createdBy, filtros por descrição/categoria; Operador vê sem botões de ação

### Implementation for User Story 4

- [ ] T037 [US4] Implement list items service (pagination, search, categoria filter, exclude inactive by default) in `item.service.ts`
- [ ] T038 [US4] Implement GET `/licitacoes/:id/items` with query params in `licitacao.routes.ts`
- [ ] T039 [US4] Implement `LicitacaoDetailPage` header (identificação, objeto, status, createdAt, createdBy) in `frontend/src/tenant/pages/LicitacaoDetailPage.tsx`
- [ ] T040 [US4] Add items table with filters and `includeInactive` toggle in `LicitacaoDetailPage.tsx`
- [ ] T041 [US4] Integrate import tabs (Planilha | Colunas) + `ImportInstructions` on detail page in `LicitacaoDetailPage.tsx`
- [ ] T042 [US4] Wire route `/t/:id/licitacoes/:licitacaoId` with `licitacoes.view` guard in `frontend/src/App.tsx`
- [ ] T043 [US4] Hide import/deactivate actions when user lacks respective permissions in detail page components

**Checkpoint**: US4 complete — consulta operacional de licitações e itens

---

## Phase 7: User Story 5 — Desativar Itens de Licitação (Priority: P3)

**Goal**: Desativação lógica de itens (e licitação) com auditoria; itens inativos ocultos na listagem padrão

**Independent Test**: Desativar item → some da listagem padrão; `includeInactive=true` exibe; auditoria com ator e timestamp

### Implementation for User Story 5

- [ ] T044 [US5] Implement deactivate licitacao (PATCH status INACTIVE, idempotent) in `licitacao.service.ts`
- [ ] T045 [US5] Implement deactivate item (PATCH status INACTIVE, idempotent) in `item.service.ts`
- [ ] T046 [US5] Write audit on deactivate (`LICITACAO_DEACTIVATED`, `LICITACAO_ITEM_DEACTIVATED`) in respective services
- [ ] T047 [US5] Implement PATCH `/licitacoes/:id/status` and PATCH `/licitacoes/:licitacaoId/items/:itemId/status` in `licitacao.routes.ts`
- [ ] T048 [US5] Add deactivate licitacao control on detail page (confirm dialog) in `LicitacaoDetailPage.tsx`
- [ ] T049 [US5] Add per-row deactivate item action with permission guard in `LicitacaoDetailPage.tsx`
- [ ] T050 [US5] Add `tenantApi.licitacoes.deactivate` and `deactivateItem` in `frontend/src/lib/api-client.ts`

**Checkpoint**: US5 complete — ciclo de vida lógico de itens e licitações

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Testes de integração, hardening e validação final

- [ ] T051 [P] Integration test: atomic import rollback on invalid row in `api/tests/integration/licitacoes/import.test.ts`
- [ ] T052 [P] Integration test: cross-tenant access returns 404 in `api/tests/integration/licitacoes/access.test.ts`
- [ ] T053 [P] Integration test: column mismatch returns 422 in `api/tests/integration/licitacoes/import-columns.test.ts`
- [ ] T054 [P] Integration test: ENTITY_INACTIVE blocks create/import in `api/tests/integration/licitacoes/entity-inactive.test.ts`
- [ ] T055 Run end-to-end validation following `specs/003-licitacao-itens/quickstart.md`
- [ ] T056 [P] Update `plan.md` artifact status if implementation diverges; document env/deps in `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)
    └── Phase 2 (Foundational) ← BLOCKS all user stories
            ├── Phase 3 (US1) 🎯 MVP — cadastro licitação
            │       ├── Phase 4 (US2) — import planilha (needs licitação)
            │       └── Phase 5 (US3) — import textarea (needs licitação + item service)
            ├── Phase 6 (US4) — consulta (needs items from US2/US3 for full test)
            └── Phase 7 (US5) — desativar (needs items)
                    └── Phase 8 (Polish)
```

### User Story Dependencies

| Story | Depends on | Independent test |
|-------|------------|------------------|
| US1 (P1) | Phase 2 | Criar e listar licitação |
| US2 (P2) | US1 (licitação existe) | Import planilha 50 itens |
| US3 (P2) | US1 + T025 item service | Import textarea com paridade |
| US4 (P3) | US1; items opcional US2/US3 | Detalhe + tabela itens |
| US5 (P3) | US4 (detail page) | Desativar item + audit |

### Parallel Opportunities

**Phase 2** (after T004–T005 sequential):

```text
T006 ∥ T008 ∥ T009 ∥ T010 ∥ T012 ∥ T013 ∥ T014
T011 after T008
T015 after T008–T010
```

**Phase 3 US1**:

```text
T020 ∥ T021 ∥ T022  (while T016–T019 backend)
```

**Phase 4 US2**:

```text
T029 ∥ T031  (while T025–T028 backend)
T030 after T029
```

---

## Parallel Example: User Story 2

```bash
# Backend import pipeline:
T025 item.service.ts (shared import core)
T026 audit in import
T027 spreadsheet route
T028 template route

# Frontend in parallel:
T029 ImportInstructions.tsx
T031 api-client methods

# Then wire upload UI:
T030 SpreadsheetImportPanel.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T015)
3. Complete Phase 3: User Story 1 (T016–T024)
4. **STOP and VALIDATE**: Criar licitação via UI e API
5. Demo listagem tenant com menu Licitações

### Incremental Delivery

1. Setup + Foundational → schema + parsers prontos
2. US1 → cadastro licitação (MVP)
3. US2 → importação planilha + instruções
4. US3 → importação textarea + paridade
5. US4 → detalhe completo com consulta
6. US5 → desativação + auditoria
7. Polish → testes integração + quickstart

### Suggested commit checkpoints

- `feat(tenant): add licitacoes schema and rbac seed`
- `feat(tenant): add licitacao import parsers`
- `feat(tenant): add licitacao crud (US1)`
- `feat(tenant): add spreadsheet item import (US2)`
- `feat(tenant): add columns item import (US3)`
- `feat(tenant): add licitacao detail and item list (US4)`
- `feat(tenant): add licitacao item deactivate (US5)`
- `test(tenant): add licitacao integration tests`

---

## Notes

- Total tasks: **56**
- Importação MUST be atomic — nenhum item persistido se uma linha falhar (FR-018)
- Paridade textarea MUST be validated no servidor (SC-002); frontend só UX
- Sem DELETE físico — apenas `status: INACTIVE`
- Business rules ONLY in `api/` — frontend valida UX only
- Engenheiro: `licitacoes.view` + `licitacoes.items.import` — sem manage/deactivate
- URLs tenant usam UUID da entidade: `/t/{entityId}/licitacoes/*`
