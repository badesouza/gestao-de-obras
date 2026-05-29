# Implementation Plan: Spec 04 — Centros de Custo e Registro Diário

**Branch**: `004-centros-custo` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-centros-custo/spec.md`

## Summary

Implementar o módulo **tenant** de centros de custo: cadastro com datas previstas/realizadas, vínculo N:N com licitações, **catálogo reutilizável de propriedades** tipadas, configuração ordenada por centro (com marcadores de produção), **registro diário em grade estilo planilha** com navegação mensal, **produção diária** agregada por dia e aba **Painel de Desempenho** placeholder. Backend Fastify + Prisma concentra validação tipada de células, agregações e RBAC; frontend React com grade editável e abas sincronizadas via query params.

**Depends on**: Spec 01 (Entity), Spec 02 (auth/RBAC/audit), Spec 03 (Licitacao/LicitacaoItem).

## Technical Context

**Language/Version**: TypeScript 6.x (api + frontend), Node.js 20+

**Primary Dependencies**:
- API: Fastify 5, Prisma 7, Zod 4 (reutilizar `value.parser.ts` da Spec 03 para VALOR)
- Frontend: React 19, Vite 8, Tailwind CSS 4, React Router 7 (`useSearchParams` para mês/aba)

**Storage**: PostgreSQL 16; tabelas `centros_custo`, catálogo/config propriedades, `registros_diarios`, valores tipados

**Testing**: Vitest — unit (validação células, marcadores produção, date range); integração (cross-tenant, item search scoped, agregação mensal)

**Target Platform**: Web responsive; rotas `/t/{entityId}/centros-custo/*`

**Performance Goals**:
- Listagem centros < 500ms p95 (200 centros/tenant)
- Registros do mês < 600ms p95 (até 500 linhas/mês)
- Busca itens célula < 300ms p95
- Produção diária agregada < 400ms p95

**Constraints**:
- Regras de negócio exclusivamente em `api/`
- Coluna **Data** fixa (não é propriedade do catálogo)
- Sem exclusão física de centro/propriedade; soft delete
- Painel de Desempenho = placeholder only
- Entidade/centro INACTIVE bloqueia mutações

**Scale/Scope**: ~6 telas tenant; ~15 endpoints REST; 7 modelos Prisma; 4 permissões RBAC

## Constitution Check

| Gate | Requirement | Status |
|------|-------------|--------|
| G1 | Approved spec in `specs/004-centros-custo/spec.md` | ✅ |
| G2 | Business rules in `api/` | ✅ |
| G3 | UI follows `frontend/DESIGN.md` | ✅ |
| G4 | PostgreSQL via migrations | ✅ |
| G5 | Audit trail on critical entities | ✅ — centro, propriedade, registro |
| G6 | Backend permission checks | ✅ |
| G7 | Costs traceable | ✅ — células VALOR + auditoria |
| G8 | Soft delete | ✅ |
| G9 | Dashboard metrics | ✅ — Produção Diária (parcial); Painel placeholder |

**Post-design re-check**: All applicable gates pass.

## Project Structure

### Documentation (this feature)

```text
specs/004-centros-custo/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 dev guide
├── contracts/
│   └── tenant-centros-custo.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — actionable task list
```

### Source Code (repository root)

```text
api/src/modules/tenant/
├── centros-custo/
│   ├── centro-custo.routes.ts
│   ├── centro-custo.service.ts
│   ├── centro-custo.schema.ts
│   ├── propriedade.service.ts
│   ├── propriedade.schema.ts
│   ├── registro-diario.service.ts
│   ├── registro-diario.schema.ts
│   ├── cell-value.validator.ts      # validação tipada por PropriedadeTipo
│   ├── production.service.ts        # agregação Produção Diária
│   └── item-search.service.ts       # busca itens p/ células
└── tenant.routes.ts                   # register centros-custo routes

frontend/src/tenant/
├── pages/
│   ├── CentroCustoListPage.tsx
│   ├── CentroCustoCreatePage.tsx
│   ├── CentroCustoDetailPage.tsx    # header + tabs + ?year&month&tab
│   └── PropriedadeCatalogPage.tsx   # catálogo entity-level
├── components/centros-custo/
│   ├── CentroCustoHeader.tsx
│   ├── CentroCustoTabs.tsx
│   ├── DailyRegisterGrid.tsx
│   ├── DailyRegisterCellEditors.tsx # por tipo
│   ├── ItemPickerCombobox.tsx
│   ├── PropriedadeConfigPanel.tsx
│   ├── ProductionDailyPanel.tsx
│   └── PerformancePanelPlaceholder.tsx
└── hooks/
    └── useCentroCustoMonthNav.ts      # year/month shared state
```

## Phase 0 & 1 Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](./research.md) | ✅ Complete |
| Data Model | [data-model.md](./data-model.md) | ✅ Complete |
| API Contract | [contracts/tenant-centros-custo.openapi.yaml](./contracts/tenant-centros-custo.openapi.yaml) | ✅ Complete |
| Quickstart | [quickstart.md](./quickstart.md) | ✅ Complete |

## API Design

Base path: `/api/tenant/v1`

### Centros de custo

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/centros-custo` | `centros_custo.view` | Listar (search, status, paginação) |
| POST | `/centros-custo` | `centros_custo.manage` | Criar centro |
| GET | `/centros-custo/:id` | `centros_custo.view` | Detalhe + licitações + config propriedades |
| PATCH | `/centros-custo/:id` | `centros_custo.manage` | Atualizar dados e datas |
| PATCH | `/centros-custo/:id/status` | `centros_custo.manage` | Desativar |
| PUT | `/centros-custo/:id/licitacoes` | `centros_custo.manage` | Substituir conjunto de licitações |

### Catálogo de propriedades

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/centros-custo/propriedades` | `centros_custo.view` | Listar catálogo |
| POST | `/centros-custo/propriedades` | `centros_custo.propriedades.manage` | Criar propriedade |
| PATCH | `/centros-custo/propriedades/:id` | `centros_custo.propriedades.manage` | Renomear / desativar |
| PUT | `/centros-custo/:id/propriedades-config` | `centros_custo.manage` | Config ordenada + marcadores |

### Registro diário

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/centros-custo/:id/registros?year=&month=` | `centros_custo.view` | Linhas do mês + células |
| POST | `/centros-custo/:id/registros` | `centros_custo.registros.edit` | Nova linha (data + valores opcionais) |
| PATCH | `/centros-custo/:id/registros/:registroId` | `centros_custo.registros.edit` | Atualizar linha/células |
| DELETE | `/centros-custo/:id/registros/:registroId` | `centros_custo.registros.edit` | Remover linha |

### Produção e busca

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/centros-custo/:id/producao?year=&month=` | `centros_custo.view` | Agregação diária |
| GET | `/centros-custo/:id/itens-busca?q=&limit=` | `centros_custo.view` | Itens ativos licitações vinculadas |

Contrato completo: [contracts/tenant-centros-custo.openapi.yaml](./contracts/tenant-centros-custo.openapi.yaml).

### Payload de célula (PATCH registro)

```json
{
  "data": "2026-05-15",
  "values": {
    "propriedade-uuid-1": { "text": "Frente A" },
    "propriedade-uuid-2": { "boolean": true },
    "propriedade-uuid-3": { "itemIds": ["item-uuid"] }
  }
}
```

Validação em `cell-value.validator.ts` conforme `PropriedadeTipo`.

## Frontend — Detalhe do Centro

### Rota

`/t/:entityId/centros-custo/:centroId?tab=registro&year=2026&month=5`

### Layout

1. **CentroCustoHeader** — entidade (nome, brasão se houver), centro (nome, datas, licitações, createdBy)
2. **CentroCustoTabs** — Registro Diário | Painel de Desempenho | Produção Diária
3. **MonthNavigator** — compartilhado entre Registro e Produção (`useCentroCustoMonthNav`)
4. Conteúdo da aba ativa

### Aba Registro Diário

- `DailyRegisterGrid`: thead = `Data` + propriedades ativas ordenadas; tbody = linhas do mês
- Botão **Adicionar linha** → POST registro com data default = hoje (se no mês visível) ou dia 1
- Editores inline; salvar linha ao sair (onBlur row) ou botão explícito
- Sem propriedades configuradas → empty state + link para configuração

### Aba Produção Diária

- `ProductionDailyPanel`: tabela 31 linhas max com colunas Dia | Cadastradas | Iniciadas | Concluídas
- Nota se marcadores não configurados

### Aba Painel de Desempenho

- `PerformancePanelPlaceholder` apenas

## RBAC Seed

```text
PERMISSION_CENTROS_CUSTO_VIEW             = 'centros_custo.view'
PERMISSION_CENTROS_CUSTO_MANAGE          = 'centros_custo.manage'
PERMISSION_CENTROS_CUSTO_PROPRIEDADES    = 'centros_custo.propriedades.manage'
PERMISSION_CENTROS_CUSTO_REGISTROS_EDIT  = 'centros_custo.registros.edit'
```

| Role | Permissions |
|------|-------------|
| ADMIN | all four |
| ENGINEER | view + registros.edit |
| OPERATOR | view |

## Implementation Phases (high-level)

### Phase A — Schema & RBAC
1. Prisma models (7 tabelas) + migration
2. Constants + seed permissions
3. `cell-value.validator.ts` unit tests

### Phase B — Centro & catálogo API
1. CRUD centro + licitações PUT
2. Catálogo propriedades CRUD
3. PUT propriedades-config com validação marcadores/item types

### Phase C — Registro diário API
1. GET registros by month (join valores + items)
2. POST/PATCH/DELETE registro com validação tipada
3. Item search endpoint
4. Audit hooks

### Phase D — Produção diária API
1. `production.service.ts` — agregação SQL
2. GET producao endpoint

### Phase E — Frontend
1. List/create/detail routes + sidebar
2. Header + tabs + month nav (URL state)
3. DailyRegisterGrid + cell editors + ItemPicker
4. PropriedadeConfigPanel (no create/edit centro ou página dedicada)
5. ProductionDailyPanel + placeholder
6. PropriedadeCatalogPage (admin)

### Phase F — Verification
1. Fluxo: criar centro → vincular licitação → propriedades → config → registros → produção
2. Cross-tenant + item search scope tests
3. quickstart.md manual run

## Complexity Tracking

| Item | Notes |
|------|-------|
| EAV tipado vs JSONB | Justificado por agregação Produção Diária |
| DELETE linha registro | UX planilha; audit preserva histórico |
| Custom grid vs lib | v1 custom; upgrade path documentada |

## Next Step

Execute tasks in [tasks.md](./tasks.md) starting with Phase 1 (Setup) and Phase 2 (Foundational).
