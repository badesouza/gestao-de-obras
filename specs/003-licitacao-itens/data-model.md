# Data Model: Spec 03 — Licitações e Importação de Itens

**Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

## Entity Relationship Overview

```text
Entity ──< Licitacao ──< LicitacaoItem
  │            │                │
  │            │                └── createdBy → TenantUser
  │            └── createdBy → TenantUser
  │
  └──< TenantAuditLog (ações de licitação/item)
```

---

## Enums

### LicitacaoStatus / LicitacaoItemStatus

Reutilizar padrão existente:

| Value | Meaning |
|-------|---------|
| ACTIVE | Visível em listagens operacionais |
| INACTIVE | Desativado logicamente; oculto por padrão |

---

## Licitacao

Processo licitatório cadastrado no tenant. Tabela: `licitacoes`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, default uuid | |
| entityId | UUID | FK → entities, NOT NULL | Isolamento tenant |
| identificacao | VARCHAR(100) | NOT NULL | Número/processo (ex.: "001/2026") |
| objeto | VARCHAR(500) | NOT NULL | Descrição resumida do objeto |
| status | ENUM | NOT NULL, default ACTIVE | ACTIVE, INACTIVE |
| createdByUserId | UUID | FK → tenant_users, NOT NULL | Imutável |
| createdAt | TIMESTAMPTZ | NOT NULL, default now() | Imutável |
| updatedAt | TIMESTAMPTZ | NOT NULL | |

**Validation rules**:
- `identificacao`: trim, min 1, max 100; único por `(entityId, identificacao)` entre licitações **ACTIVE** (duplicata inativa permitida — assumption: reutilização futura)
- `objeto`: trim, min 3, max 500
- Sem DELETE físico

**Indexes**:
- INDEX (`entityId`, `status`)
- INDEX (`entityId`, `createdAt` DESC)
- UNIQUE (`entityId`, `identificacao`) — opcional se negócio exigir; **decisão**: unique parcial apenas ACTIVE via app + index composto `(entityId, identificacao)`

**API computed fields**:
- `activeItemCount`: count itens ACTIVE
- `createdBy`: `{ id, name }` join TenantUser

---

## LicitacaoItem

Produto ou serviço vinculado a uma licitação. Tabela: `licitacao_items`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| licitacaoId | UUID | FK → licitacoes, NOT NULL | |
| entityId | UUID | FK → entities, NOT NULL | Denormalizado |
| categoria | VARCHAR(100) | NULL | Opcional |
| descricao | VARCHAR(500) | NOT NULL | |
| unidadeMedida | VARCHAR(50) | NOT NULL | Texto livre |
| valorUnitario | DECIMAL(15,4) | NULL | Opcional |
| status | ENUM | NOT NULL, default ACTIVE | |
| createdByUserId | UUID | FK → tenant_users, NOT NULL | |
| createdAt | TIMESTAMPTZ | NOT NULL | |
| updatedAt | TIMESTAMPTZ | NOT NULL | |

**Validation rules**:
- `descricao`: trim, min 1, max 500
- `unidadeMedida`: trim, min 1, max 50
- `categoria`: trim ou null; max 100
- `valorUnitario`: null ou ≥ 0; max 99999999999.9999
- `entityId` MUST match parent `Licitacao.entityId` (validado no serviço)
- Licitação MUST estar ACTIVE para importação
- Sem DELETE físico

**Indexes**:
- INDEX (`licitacaoId`, `status`)
- INDEX (`entityId`, `licitacaoId`)
- INDEX (`licitacaoId`, `descricao`) — busca/filtro

---

## Prisma Schema (draft)

```prisma
enum LicitacaoStatus {
  ACTIVE
  INACTIVE
}

model Licitacao {
  id              String          @id @default(uuid())
  entityId        String          @map("entity_id")
  identificacao   String          @db.VarChar(100)
  objeto          String          @db.VarChar(500)
  status          LicitacaoStatus @default(ACTIVE)
  createdByUserId String          @map("created_by_user_id")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  entity    Entity          @relation(fields: [entityId], references: [id])
  createdBy TenantUser      @relation("LicitacaoCreatedBy", fields: [createdByUserId], references: [id])
  items     LicitacaoItem[]

  @@unique([entityId, identificacao])
  @@index([entityId, status])
  @@map("licitacoes")
}

model LicitacaoItem {
  id              String          @id @default(uuid())
  licitacaoId     String          @map("licitacao_id")
  entityId        String          @map("entity_id")
  categoria       String?         @db.VarChar(100)
  descricao       String          @db.VarChar(500)
  unidadeMedida   String          @map("unidade_medida") @db.VarChar(50)
  valorUnitario   Decimal?        @map("valor_unitario") @db.Decimal(15, 4)
  status          LicitacaoStatus @default(ACTIVE)
  createdByUserId String          @map("created_by_user_id")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  licitacao Licitacao  @relation(fields: [licitacaoId], references: [id])
  entity    Entity     @relation(fields: [entityId], references: [id])
  createdBy TenantUser @relation("LicitacaoItemCreatedBy", fields: [createdByUserId], references: [id])

  @@index([licitacaoId, status])
  @@index([entityId, licitacaoId])
  @@map("licitacao_items")
}
```

**Relations to add on existing models**:
- `Entity`: `licitacoes Licitacao[]`, `licitacaoItems LicitacaoItem[]`
- `TenantUser`: `licitacoesCreated Licitacao[]`, `licitacaoItemsCreated LicitacaoItem[]`

---

## TenantAuditLog — novas ações

Sem alteração de schema. Valores de `action` / `resource`:

| action | resource |
|--------|----------|
| LICITACAO_CREATED | licitacao |
| LICITACAO_DEACTIVATED | licitacao |
| LICITACAO_ITEMS_IMPORTED | licitacao_item |
| LICITACAO_ITEM_DEACTIVATED | licitacao_item |

---

## TenantPermission — novos registros (seed)

| code | module | description |
|------|--------|-------------|
| licitacoes.view | licitacoes | Visualizar licitações e itens |
| licitacoes.manage | licitacoes | Cadastrar e desativar licitações |
| licitacoes.items.import | licitacoes | Importar itens de licitação |
| licitacoes.items.deactivate | licitacoes | Desativar itens de licitação |

---

## Migration

Nome sugerido: `20260528180000_licitacoes_itens`
