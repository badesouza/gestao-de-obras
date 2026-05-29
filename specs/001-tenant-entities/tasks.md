---
description: "Task list for Spec 01 — Cadastro de Entidades (Tenants)"
---

# Tasks: Spec 01 — Cadastro de Entidades (Tenants)

**Input**: Design documents from `specs/001-tenant-entities/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/platform-api.openapi.yaml

**Tests**: Not requested in spec — omitted. Validate via quickstart.md manual flow in Polish phase.

**Organization**: Tasks grouped by user story (US1–US4) for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: Maps to spec user stories US1–US4

## Path Conventions

- **API**: `api/src/`, `api/prisma/`, `api/tests/`
- **Frontend**: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize project structure and dependencies

- [x] T001 Create API module directory structure per plan in `api/src/` (server, plugins, modules/platform, shared)
- [x] T002 Add npm scripts (`dev`, `build`, `start`, `test`) and dependencies (`@fastify/jwt`, `@fastify/cors`, `bcrypt`, `dotenv`) in `api/package.json`
- [x] T003 [P] Add `react-router-dom` dependency and update scripts if needed in `frontend/package.json`
- [x] T004 [P] Create environment template with DATABASE_URL, JWT_SECRET, PLATFORM_ADMIN_* in `api/.env.example`
- [x] T005 [P] Create TypeScript config for API in `api/tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before user stories

**⚠️ CRITICAL**: No user story work until this phase is complete

- [x] T006 Implement Prisma models (Entity, PlatformOperator, PlatformAuditLog) in `api/prisma/schema.prisma`
- [x] T007 Create and apply initial migration in `api/prisma/migrations/`
- [x] T008 Create platform operator seed script in `api/prisma/seed.ts` and register in `api/package.json`
- [x] T009 Bootstrap Fastify server with CORS, health check, and route prefix in `api/src/server.ts`
- [x] T010 [P] Create Prisma Fastify plugin in `api/src/plugins/prisma.ts`
- [x] T011 [P] Create shared HTTP error helpers in `api/src/shared/errors.ts`
- [x] T012 [P] Define RESERVED_SLUGS constant in `api/src/shared/constants.ts`
- [x] T013 [P] Implement append-only audit writer in `api/src/modules/platform/audit/audit.service.ts`
- [x] T014 [P] Map DESIGN.md color/typography tokens to CSS variables in `frontend/src/styles/tokens.css`
- [x] T015 [P] Create base UI components (Button, Input, Card) in `frontend/src/components/ui/`
- [x] T016 [P] Create typed API client with auth header support in `frontend/src/lib/api-client.ts`

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Acesso à Área de Gestão (Priority: P1) 🎯 MVP

**Goal**: Operador autentica via `/platform/login` e acessa área dedicada separada do tenant

**Independent Test**: Acessar `http://localhost:5173/platform/login`, autenticar com seed, ser redirecionado à área interna; credenciais inválidas permanecem no login; logout invalida acesso

### Implementation for User Story 1

- [x] T017 [US1] Implement platform auth service (login, logout, me, bcrypt verify) in `api/src/modules/platform/auth/auth.service.ts`
- [x] T018 [P] [US1] Create Zod schemas for login request/response in `api/src/modules/platform/auth/auth.schema.ts`
- [x] T019 [US1] Implement auth routes (POST login/logout, GET me) in `api/src/modules/platform/auth/auth.routes.ts`
- [x] T020 [US1] Create JWT plugin with `scope: platform` guard in `api/src/plugins/auth-platform.ts`
- [x] T021 [US1] Register platform auth routes under `/api/platform/v1` in `api/src/server.ts`
- [x] T022 [P] [US1] Create platform shell layout (header, logout, content area) in `frontend/src/platform/layouts/PlatformLayout.tsx`
- [x] T023 [US1] Define platform routes and auth guard in `frontend/src/platform/routes.tsx`
- [x] T024 [US1] Implement login form page per DESIGN.md in `frontend/src/platform/pages/LoginPage.tsx`
- [x] T025 [US1] Wire React Router root and platform routes in `frontend/src/App.tsx`
- [x] T026 [US1] Import design tokens in `frontend/src/main.tsx`

**Checkpoint**: US1 complete — login/logout platform funcional end-to-end

---

## Phase 4: User Story 2 — Cadastrar Nova Entidade (Priority: P2)

**Goal**: Operador cria entidade tenant com slug único, status ativo, link de acesso e auditoria

**Independent Test**: Após login, cadastrar entidade via formulário; aparece na API; slug duplicado rejeitado; detalhe exibe `tenantAccessUrl`

### Implementation for User Story 2

- [x] T027 [P] [US2] Implement slug normalize/validate utilities in `api/src/modules/platform/entities/slug.utils.ts`
- [x] T028 [P] [US2] Create Zod schemas for create entity (incl. CNPJ optional) in `api/src/modules/platform/entities/entity.schema.ts`
- [x] T029 [US2] Implement entity create service with audit log in `api/src/modules/platform/entities/entity.service.ts`
- [x] T030 [US2] Implement POST `/entities` route in `api/src/modules/platform/entities/entity.routes.ts`
- [x] T031 [US2] Register entity routes with platform auth guard in `api/src/server.ts`
- [x] T032 [P] [US2] Create reusable entity form component in `frontend/src/platform/components/EntityForm.tsx`
- [x] T033 [P] [US2] Create tenant access URL badge/copy component in `frontend/src/platform/components/TenantLinkBadge.tsx`
- [x] T034 [US2] Implement entity create page with validation feedback in `frontend/src/platform/pages/EntityCreatePage.tsx`

**Checkpoint**: US2 complete — criar entidade com slug, auditoria e link tenant

---

## Phase 5: User Story 3 — Consultar e Editar Entidades (Priority: P3)

**Goal**: Listagem com busca/filtro, detalhe e edição cadastral (slug imutável)

**Independent Test**: Listar entidades, buscar por nome, abrir detalhe, editar nome/contato, confirmar slug não editável, auditoria registrada

### Implementation for User Story 3

- [x] T035 [US3] Add list/get/update methods with pagination and search in `api/src/modules/platform/entities/entity.service.ts`
- [x] T036 [US3] Add GET `/entities`, GET `/entities/:id`, PATCH `/entities/:id` routes in `api/src/modules/platform/entities/entity.routes.ts`
- [x] T037 [US3] Implement entity list page with search and status filter in `frontend/src/platform/pages/EntityListPage.tsx`
- [x] T038 [US3] Implement entity detail/edit page (slug read-only) in `frontend/src/platform/pages/EntityDetailPage.tsx`

**Checkpoint**: US3 complete — listagem, consulta e edição cadastral funcional

---

## Phase 6: User Story 4 — Ativar e Desativar Entidades (Priority: P4)

**Goal**: Toggle status ACTIVE/INACTIVE com auditoria; preparar bloqueio de login tenant

**Independent Test**: Desativar entidade → status INACTIVE; reativar → ACTIVE; audit logs consultáveis; stub tenant login exibe mensagem de suspensão

### Implementation for User Story 4

- [x] T039 [US4] Add activate/deactivate status transition logic in `api/src/modules/platform/entities/entity.service.ts`
- [x] T040 [US4] Add PATCH `/entities/:id/status` route in `api/src/modules/platform/entities/entity.routes.ts`
- [x] T041 [US4] Add GET `/entities/:id/audit-logs` route in `api/src/modules/platform/entities/entity.routes.ts`
- [x] T042 [US4] Add activate/deactivate controls and audit log section in `frontend/src/platform/pages/EntityDetailPage.tsx`
- [x] T043 [US4] Add tenant login stub route `/t/:slug/login` with inactive-entity message in `frontend/src/platform/routes.tsx`

**Checkpoint**: US4 complete — ciclo de vida da entidade governado

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and UX hardening

- [x] T044 [P] Add 403/404 and empty-state pages for platform area in `frontend/src/platform/pages/`
- [x] T045 [P] Add CNPJ duplicate warning UI flow (acknowledge checkbox) in `frontend/src/platform/components/EntityForm.tsx`
- [x] T046 Run end-to-end validation following `specs/001-tenant-entities/quickstart.md`
- [x] T047 [P] Document any env/script changes in `specs/001-tenant-entities/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)
    └── Phase 2 (Foundational) ← BLOCKS all user stories
            ├── Phase 3 (US1) 🎯 MVP
            ├── Phase 4 (US2) — depends on US1 auth
            ├── Phase 5 (US3) — depends on US2 entity model
            └── Phase 6 (US4) — depends on US3 entity pages
                    └── Phase 7 (Polish)
```

### User Story Dependencies

| Story | Depends on | Independent test |
|-------|------------|------------------|
| US1 (P1) | Phase 2 | Login/logout platform |
| US2 (P2) | US1 (auth) | Create entity + tenant URL |
| US3 (P3) | US2 (entity exists) | List/search/edit |
| US4 (P4) | US3 (detail page) | Activate/deactivate + audit |

### Parallel Opportunities

**Phase 2** (after T006–T009 sequential):

```text
T010 ∥ T011 ∥ T012 ∥ T013 ∥ T014 ∥ T015 ∥ T016
```

**Phase 3 US1**:

```text
T018 ∥ T022  (while T017–T021 auth backend progresses)
```

**Phase 4 US2**:

```text
T027 ∥ T028 ∥ T032 ∥ T033  (then T029 → T030 → T034)
```

---

## Parallel Example: User Story 2

```bash
# Parallel backend utilities + frontend components:
T027 slug.utils.ts
T028 entity.schema.ts
T032 EntityForm.tsx
T033 TenantLinkBadge.tsx

# Then sequential service → route → page:
T029 entity.service.ts (create)
T030 entity.routes.ts (POST)
T034 EntityCreatePage.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T016)
3. Complete Phase 3: User Story 1 (T017–T026)
4. **STOP and VALIDATE**: Login platform end-to-end via quickstart
5. Demo área `/platform` autenticada

### Incremental Delivery

1. Setup + Foundational → base técnica pronta
2. US1 → login platform (MVP)
3. US2 → cadastro de entidades
4. US3 → listagem e edição
5. US4 → ativar/desativar + audit logs
6. Polish → validação final

### Suggested commit checkpoints

- `feat(platform): bootstrap api and prisma foundation`
- `feat(platform): add platform auth (US1)`
- `feat(platform): add entity create (US2)`
- `feat(platform): add entity list and edit (US3)`
- `feat(platform): add entity lifecycle and audit (US4)`

---

## Notes

- Total tasks: **47**
- Slug MUST remain immutable after create (enforce in service + UI read-only)
- No DELETE endpoint for entities — status toggle only
- Business rules ONLY in `api/` — frontend validates UX only
- Spec 02 will implement full `/t/{slug}/login`; US4 stub is placeholder only
