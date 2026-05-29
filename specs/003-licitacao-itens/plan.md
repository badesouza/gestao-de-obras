# Implementation Plan: Spec 03 — Licitações e Importação de Itens

**Branch**: `003-licitacao-itens` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-licitacao-itens/spec.md`

## Summary

Implementar o módulo **tenant** de licitações: cadastro de processos licitatórios, importação em lote de itens (produtos/serviços) via **planilha** (CSV/XLSX) ou **textareas por coluna**, desativação lógica de itens, RBAC granular e auditoria completa. Backend Fastify + Prisma concentra parsing, validação atômica, paridade de linhas e permissões; frontend React consome API REST e expõe instruções claras de importação conforme `frontend/DESIGN.md`.

**Depends on**: Spec 01 (Entity), Spec 02 (auth tenant, RBAC, layout, `TenantAuditLog`).

## Technical Context

**Language/Version**: TypeScript 6.x (api + frontend), Node.js 20+

**Primary Dependencies**:
- API: Fastify 5, Prisma 7, Zod 4, `@fastify/multipart` (já instalado), **`xlsx`** (nova — parsing CSV/XLSX)
- Frontend: React 19, Vite 8, Tailwind CSS 4, React Router 7

**Storage**: PostgreSQL 16; novas tabelas `licitacoes`, `licitacao_items`

**Testing**: Vitest — unit (parser colunas/valores pt-BR, normalização cabeçalhos); integração (importação atômica, paridade textarea, cross-tenant 403)

**Target Platform**: Web responsive; API `:3000`, frontend `:5173`; rotas tenant `/t/{entityId}/licitacoes/*`

**Project Type**: Monorepo `api/` + `frontend/`

**Performance Goals**:
- Importação de 500 itens < 3s p95 (transação única)
- Listagem licitações < 500ms p95 (até 200 licitações/tenant)
- Listagem itens paginada < 400ms p95 (pageSize 50)

**Constraints**:
- Regras de negócio exclusivamente em `api/`
- Importação atômica (rollback total se uma linha falhar)
- Paridade de linhas textarea validada no **servidor**
- Sem exclusão física; soft delete via status
- Entidade INACTIVE bloqueia cadastro/importação

**Scale/Scope**: ~4 telas tenant; 8 endpoints REST; 2 modelos Prisma; 4 permissões RBAC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Gestão de Obras Públicas v1.0.0)

| Gate | Requirement | Status |
|------|-------------|--------|
| G1 | Feature has approved spec in `specs/003-licitacao-itens/spec.md` | ✅ |
| G2 | Business rules in `api/`, not React | ✅ |
| G3 | UI follows `frontend/DESIGN.md` | ✅ |
| G4 | PostgreSQL via migrations; no frontend DB | ✅ |
| G5 | Critical entities have audit trail | ✅ — licitação, item, importações |
| G6 | Backend permission checks on all endpoints | ✅ |
| G7 | Costs traceable | ✅ — `valorUnitario` opcional, imutável na criação nesta spec |
| G8 | Soft delete — no physical delete | ✅ |
| G9 | Dashboard metrics | N/A — sem alteração de dashboard nesta spec |

**Post-design re-check (Phase 1)**: All applicable gates pass. G9 N/A.

## Project Structure

### Documentation (this feature)

```text
specs/003-licitacao-itens/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 dev guide
├── contracts/
│   └── tenant-licitacoes.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — actionable task list
```

### Source Code (repository root)

```text
api/
├── prisma/
│   ├── schema.prisma              # + Licitacao, LicitacaoItem
│   └── migrations/
│       └── 20260528180000_licitacoes_itens/
├── src/
│   ├── shared/
│   │   └── constants.ts           # + permissões licitacoes.*
│   ├── modules/tenant/
│   │   ├── tenant.routes.ts       # register licitacoes routes
│   │   ├── licitacoes/
│   │   │   ├── licitacao.routes.ts
│   │   │   ├── licitacao.service.ts
│   │   │   ├── licitacao.schema.ts
│   │   │   ├── item.service.ts
│   │   │   ├── import/
│   │   │   │   ├── spreadsheet.parser.ts
│   │   │   │   ├── columns.parser.ts
│   │   │   │   ├── header-normalizer.ts
│   │   │   │   ├── value.parser.ts      # pt-BR decimal
│   │   │   │   └── template.generator.ts
│   │   │   └── item.schema.ts
│   │   └── audit/
│   │       └── audit.service.ts   # (existente)
│   └── plugins/
│       └── auth-tenant.ts         # (existente)
└── tests/
    ├── unit/licitacoes/
    └── integration/licitacoes/

frontend/
├── src/
│   ├── lib/
│   │   └── api-client.ts          # + tenantApi.licitacoes
│   ├── tenant/
│   │   ├── components/
│   │   │   ├── TenantSidebar.tsx  # + menu Licitações
│   │   │   ├── ImportInstructions.tsx
│   │   │   ├── SpreadsheetImportPanel.tsx
│   │   │   └── ColumnsImportPanel.tsx
│   │   └── pages/
│   │       ├── LicitacaoListPage.tsx
│   │       ├── LicitacaoCreatePage.tsx
│   │       └── LicitacaoDetailPage.tsx  # itens + import tabs
│   └── App.tsx                    # + rotas licitacoes
```

**Structure Decision**: Espelhar módulo `users/` (routes → service → schema). Lógica de importação isolada em `import/` para testes unitários sem HTTP.

## Phase 0 & 1 Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](./research.md) | ✅ Complete |
| Data Model | [data-model.md](./data-model.md) | ✅ Complete |
| API Contract | [contracts/tenant-licitacoes.openapi.yaml](./contracts/tenant-licitacoes.openapi.yaml) | ✅ Complete |
| Quickstart | [quickstart.md](./quickstart.md) | ✅ Complete |

## API Design

Base path: `/api/tenant/v1` (JWT scope `tenant`, header `Authorization: Bearer`, contexto `entityId` do token).

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/licitacoes` | `licitacoes.view` | Listar licitações (search, status, paginação) |
| POST | `/licitacoes` | `licitacoes.manage` | Criar licitação |
| GET | `/licitacoes/:id` | `licitacoes.view` | Detalhe + metadados createdBy |
| PATCH | `/licitacoes/:id/status` | `licitacoes.manage` | Desativar licitação |
| GET | `/licitacoes/:id/items` | `licitacoes.view` | Listar itens (filtros, includeInactive) |
| POST | `/licitacoes/:id/items/import/spreadsheet` | `licitacoes.items.import` | Multipart file |
| POST | `/licitacoes/:id/items/import/columns` | `licitacoes.items.import` | JSON textareas |
| PATCH | `/licitacoes/:licitacaoId/items/:itemId/status` | `licitacoes.items.deactivate` | Desativar item |
| GET | `/licitacoes/import-template` | `licitacoes.items.import` | Download modelo CSV/XLSX |

Detalhes completos: [contracts/tenant-licitacoes.openapi.yaml](./contracts/tenant-licitacoes.openapi.yaml).

### Error codes (domínio)

| Code | HTTP | When |
|------|------|------|
| `ENTITY_INACTIVE` | 403 | Entidade desativada |
| `LICITACAO_NOT_FOUND` | 404 | ID inexistente ou outro tenant |
| `LICITACAO_INACTIVE` | 409 | Importação em licitação inativa |
| `IMPORT_VALIDATION_ERROR` | 422 | Linhas inválidas (detalhe por linha) |
| `IMPORT_COLUMN_MISMATCH` | 422 | Textareas com contagem divergente |
| `IMPORT_EMPTY` | 422 | Planilha/textareas sem dados |
| `IMPORT_TOO_LARGE` | 413 | > 2000 linhas ou > 5 MB |

## Import Pipeline (shared)

```text
[spreadsheet | columns] → parse rows
       → normalize headers / split lines
       → validate row count & limits
       → validate each row (descricao, unidade, valor)
       → assert column parity (textarea only)
       → prisma.$transaction(createMany items + audit)
       → return { importedCount, licitacaoId }
```

**Row validation** (single source in `item.schema.ts`):
- `descricao`: required, 1–500 chars
- `unidadeMedida`: required, 1–50 chars
- `categoria`: optional, max 100
- `valorUnitario`: optional, parsed pt-BR, ≥ 0

## RBAC Seed Changes

Em `api/prisma/seed.ts` e `api/src/shared/constants.ts`:

```text
PERMISSION_LICITACOES_VIEW           = 'licitacoes.view'
PERMISSION_LICITACOES_MANAGE         = 'licitacoes.manage'
PERMISSION_LICITACOES_ITEMS_IMPORT   = 'licitacoes.items.import'
PERMISSION_LICITACOES_ITEMS_DEACTIVATE = 'licitacoes.items.deactivate'
```

| Role | Permissions added |
|------|-------------------|
| ADMIN | all four |
| ENGINEER | view + items.import |
| OPERATOR | view |

Migration de seed: idempotente via upsert (padrão Spec 02).

## Frontend Routes

| Route | Permission | Page |
|-------|------------|------|
| `/t/:id/licitacoes` | `licitacoes.view` | Listagem |
| `/t/:id/licitacoes/new` | `licitacoes.manage` | Formulário criação |
| `/t/:id/licitacoes/:licitacaoId` | `licitacoes.view` | Detalhe, tabela itens, importação |

**LicitacaoDetailPage** sections:
1. Cabeçalho (identificação, objeto, status, createdAt, createdBy)
2. Tabela itens (filtro descrição/categoria; toggle incluir inativos)
3. Painel importação com tabs **Planilha** | **Colunas**
4. `ImportInstructions` — colunas, exemplo, links download template, regra paridade

**TenantSidebar**: item "Licitações" com ícone, `permission: licitacoes.view`.

## Implementation Phases (high-level)

### Phase A — Schema & RBAC
1. Prisma models `Licitacao`, `LicitacaoItem` + relations
2. Migration `20260528180000_licitacoes_itens`
3. Constants + seed permissões e role mappings
4. `npm run db:seed`

### Phase B — Import utilities (unit-tested)
1. `header-normalizer.ts` — aliases PT/EN
2. `value.parser.ts` — decimal pt-BR
3. `columns.parser.ts` — paridade, trim, trailing empty lines
4. `spreadsheet.parser.ts` — xlsx + csv → rows
5. `template.generator.ts` — CSV/XLSX modelo
6. Vitest unit tests

### Phase C — API licitações
1. CRUD licitação (create, list, get, deactivate)
2. List items com paginação/filtros
3. Import spreadsheet (multipart) + import columns (json)
4. Deactivate item (idempotent)
5. GET import-template
6. Auditoria em todas mutações
7. Integração tests: atomic rollback, cross-tenant, column mismatch

### Phase D — Frontend
1. `tenantApi.licitacoes` no api-client
2. Rotas + guards de permissão
3. LicitacaoListPage, LicitacaoCreatePage
4. LicitacaoDetailPage com import panels
5. Menu sidebar
6. Estados loading/error/success; mensagens 422 detalhadas

### Phase E — Verification
1. Fluxo manual: criar licitação → import 50 itens planilha → desativar 1 item
2. Textarea mismatch → bloqueio server-side
3. Usuário Operador: view only
4. Engenheiro: import sem desativar

## Complexity Tracking

> No constitution violations requiring justification.

| Item | Notes |
|------|-------|
| G9 N/A | Dashboard não alterado nesta spec |
| Denormalized entityId on items | Defesa em profundidade + queries simples |
| New dep `xlsx` | Justificado — requisito CSV+XLSX único parser |

## Next Step

Execute tasks in [tasks.md](./tasks.md) starting with Phase 1 (Setup) and Phase 2 (Foundational).
