# Implementation Plan: Spec 01 — Cadastro de Entidades (Tenants)

**Branch**: `001-tenant-entities` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-tenant-entities/spec.md`

## Summary

Implementar a camada **plataforma** do sistema multi-tenant: área dedicada em `/platform` para autenticação de operadores e CRUD cadastral de **Entidades (tenants)**. Cada entidade recebe slug único imutável que gera o link operacional `/t/{slug}/login` (consumido na Spec 02). Backend Fastify + Prisma + PostgreSQL concentra regras de negócio, validação, auditoria e autorização; frontend React + TypeScript consome API REST e aplica `frontend/DESIGN.md`.

## Technical Context

**Language/Version**: TypeScript 6.x (api + frontend), Node.js 20+

**Primary Dependencies**:
- API: Fastify 5, Prisma 7, Zod 4, `@fastify/jwt`, `@fastify/cors`, bcrypt
- Frontend: React 19, Vite 8, Tailwind CSS 4, React Router 7 (a adicionar)

**Storage**: PostgreSQL 16 (`docker/docker-compose.yml`), Prisma Migrate

**Testing**: Vitest (api + frontend), testes de integração API com banco de teste

**Target Platform**: Web (desktop + mobile responsive), API local porta 3000, frontend porta 5173

**Project Type**: Web application — monorepo `api/` + `frontend/`

**Performance Goals**: Listagem de entidades < 500ms p95 com até 500 tenants; login plataforma < 1s p95

**Constraints**:
- Regras de negócio exclusivamente em `api/`
- Slug imutável após criação
- Sem exclusão física de entidades
- Dois domínios de auth separados: `platform` vs `tenant` (tenant na Spec 02)

**Scale/Scope**: ~5 telas plataforma (login, listagem, cadastro, detalhe/edição, 403/404); 8 endpoints REST; 3 modelos Prisma iniciais

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Gestão de Obras Públicas v1.0.0)

| Gate | Requirement | Status |
|------|-------------|--------|
| G1 | Feature has approved spec in `specs/001-tenant-entities/spec.md` | ✅ |
| G2 | Business rules implemented in `api/`, not in React screens | ✅ |
| G3 | UI follows `frontend/DESIGN.md` design tokens | ✅ |
| G4 | PostgreSQL schema via migrations; no direct frontend DB access | ✅ |
| G5 | Critical entities have audit trail (who/when/what/before/after) | ✅ |
| G6 | Endpoints enforce profile/permission checks on backend | ✅ |
| G7 | Costs, balances, measurements are traceable | N/A — sem dados financeiros nesta spec |
| G8 | Financial records use soft delete — no physical delete | ✅ — entidades usam desativação lógica (`status`) |
| G9 | Dashboard metrics from consolidated data | N/A — sem dashboard nesta spec |

**Post-design re-check (Phase 1)**: All applicable gates pass. G7/G9 marked N/A with scope justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-tenant-entities/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 dev guide
├── contracts/
│   └── platform-api.openapi.yaml
└── tasks.md             # Phase 2 (/speckit-tasks — not yet)
```

### Source Code (repository root)

```text
api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── server.ts                 # Fastify bootstrap
│   ├── plugins/
│   │   ├── prisma.ts
│   │   └── auth-platform.ts      # JWT platform scope
│   ├── modules/
│   │   └── platform/
│   │       ├── entities/
│   │       │   ├── entity.routes.ts
│   │       │   ├── entity.service.ts
│   │       │   ├── entity.schema.ts    # Zod
│   │       │   └── slug.utils.ts
│   │       ├── auth/
│   │       │   ├── auth.routes.ts
│   │       │   └── auth.service.ts
│   │       └── audit/
│   │           └── audit.service.ts
│   └── shared/
│       ├── errors.ts
│       └── constants.ts            # RESERVED_SLUGS
└── tests/
    ├── integration/
    └── unit/

frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx                     # Router root
│   ├── styles/
│   │   └── tokens.css              # DESIGN.md → CSS vars
│   ├── lib/
│   │   └── api-client.ts
│   ├── platform/
│   │   ├── routes.tsx
│   │   ├── layouts/
│   │   │   └── PlatformLayout.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── EntityListPage.tsx
│   │   │   ├── EntityCreatePage.tsx
│   │   │   └── EntityDetailPage.tsx
│   │   └── components/
│   │       ├── EntityForm.tsx
│   │       └── TenantLinkBadge.tsx
│   └── components/ui/              # Button, Input, Card (DESIGN.md)
└── tests/

docker/
└── docker-compose.yml
```

**Structure Decision**: Monorepo existente com `api/` (Fastify) e `frontend/` (Vite/React). Módulo `platform/` isolado em ambos os lados prepara Spec 02 (`tenant/` espelhando o mesmo padrão).

## Phase 0 & 1 Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](./research.md) | ✅ Complete |
| Data Model | [data-model.md](./data-model.md) | ✅ Complete |
| API Contract | [contracts/platform-api.openapi.yaml](./contracts/platform-api.openapi.yaml) | ✅ Complete |
| Quickstart | [quickstart.md](./quickstart.md) | ✅ Complete |

## Implementation Phases (high-level)

### Phase A — API foundation
1. Bootstrap Fastify (`api/src/server.ts`), CORS, health check
2. Prisma schema: `Entity`, `PlatformOperator`, `PlatformAuditLog`
3. Migration + seed operador plataforma
4. Módulo audit reutilizável

### Phase B — Platform auth
1. POST `/api/platform/v1/auth/login`, POST `/api/platform/v1/auth/logout`
2. GET `/api/platform/v1/auth/me`
3. JWT com claim `scope: "platform"`, middleware `requirePlatformAuth`

### Phase C — Entity CRUD
1. Endpoints conforme OpenAPI
2. Validação Zod (slug, CNPJ opcional, slugs reservados)
3. Auditoria em create/update/activate/deactivate
4. Geração de `tenantAccessUrl` na resposta

### Phase D — Frontend platform
1. React Router: rotas `/platform/*`
2. Tokens CSS de `DESIGN.md`
3. Login → listagem → create → detail/edit
4. Guard de rota (token platform); redirect se não autenticado
5. Exibir link tenant `/t/{slug}/login` (read-only, login funcional na Spec 02)

## Complexity Tracking

> No constitution violations requiring justification.

| Item | Notes |
|------|-------|
| G7, G9 N/A | Spec 01 não inclui financeiro nem dashboard operacional |

## Next Step

Run `/speckit-tasks` on `specs/001-tenant-entities` to generate actionable `tasks.md`.
