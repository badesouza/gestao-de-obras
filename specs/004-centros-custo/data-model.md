# Data Model: Spec 04 — Centros de Custo e Registro Diário

**Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)

## Entity Relationship Overview

```text
Entity ──< CentroCusto ──< RegistroDiario ──< RegistroDiarioValor ──< RegistroDiarioValorItem
  │              │                    │                    │
  │              ├──< CentroCustoLicitacao >── Licitacao    └──> LicitacaoItem
  │              │
  │              └──< CentroCustoPropriedadeConfig >── CentroCustoPropriedade (catálogo)
  │
  └──< CentroCustoPropriedade (catálogo entity-level)
```

---

## Enums

### CentroCustoStatus

| Value | Meaning |
|-------|---------|
| ACTIVE | Operacional |
| INACTIVE | Desativado; sem novos registros |

(Reutilizar padrão `ACTIVE | INACTIVE` como Spec 03.)

### PropriedadeTipo

| Value | Storage column(s) |
|-------|-------------------|
| TEXTO | valor_texto |
| DATA | valor_data |
| VALOR | valor_decimal |
| BOOLEAN | valor_boolean |
| ITEM_LICITACAO | registro_diario_valor_itens (max 1 item enforced in service) |
| ITENS_LICITACAO | registro_diario_valor_itens (N items) |

### PropriedadeProductionRole

| Value | Meaning |
|-------|---------|
| NONE | Coluna normal |
| INICIO | Marcador Produção Diária — iniciadas |
| CONCLUSAO | Marcador Produção Diária — concluídas |

---

## CentroCusto

Tabela: `centros_custo`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| entityId | UUID | FK → entities, NOT NULL | |
| nome | VARCHAR(200) | NOT NULL | |
| dataPrevistaInicio | DATE | NULL | |
| dataPrevistaFim | DATE | NULL | |
| dataRealizadaInicio | DATE | NULL | |
| dataRealizadaFim | DATE | NULL | |
| status | ENUM | NOT NULL, default ACTIVE | |
| createdByUserId | UUID | FK → tenant_users, NOT NULL | |
| createdAt | TIMESTAMPTZ | NOT NULL | |
| updatedAt | TIMESTAMPTZ | NOT NULL | |

**Validation**:
- `nome`: trim, 1–200 chars; unique per `(entityId, nome)` among ACTIVE
- Se prevista início e fim: fim >= início
- Se realizada início e fim: fim >= início

**Indexes**: `(entityId, status)`, `(entityId, createdAt DESC)`

---

## CentroCustoLicitacao

Tabela: `centro_custo_licitacoes`

| Field | Type | Constraints |
|-------|------|-------------|
| centroCustoId | UUID | FK → centros_custo |
| licitacaoId | UUID | FK → licitacoes |
| entityId | UUID | FK → entities (denormalized) |
| createdAt | TIMESTAMPTZ | NOT NULL |

**PK**: `(centroCustoId, licitacaoId)`

---

## CentroCustoPropriedade (catálogo)

Tabela: `centro_custo_propriedades`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| entityId | UUID | FK, NOT NULL | |
| nome | VARCHAR(100) | NOT NULL | Unique per entity |
| tipo | ENUM | NOT NULL | PropriedadeTipo |
| status | ENUM | NOT NULL, default ACTIVE | |
| createdByUserId | UUID | FK, NOT NULL | |
| createdAt | TIMESTAMPTZ | NOT NULL | |
| updatedAt | TIMESTAMPTZ | NOT NULL | |

**Indexes**: UNIQUE `(entityId, nome)`, `(entityId, status)`

---

## CentroCustoPropriedadeConfig

Tabela: `centro_custo_propriedade_configs`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| centroCustoId | UUID | FK | |
| propriedadeId | UUID | FK | |
| entityId | UUID | FK | denormalized |
| columnOrder | INT | NOT NULL | 0-based after Data column |
| productionRole | ENUM | NOT NULL, default NONE | |
| active | BOOLEAN | NOT NULL, default true | false = removida da grade, histórico mantido |

**Unique**: `(centroCustoId, propriedadeId)`

**Constraint (app-level)**: max 1 `INICIO` e max 1 `CONCLUSAO` por centro

---

## RegistroDiario

Tabela: `registros_diarios`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| centroCustoId | UUID | FK | |
| entityId | UUID | FK | |
| data | DATE | NOT NULL | Coluna fixa |
| createdByUserId | UUID | FK | |
| updatedByUserId | UUID | FK, NULL | |
| createdAt | TIMESTAMPTZ | NOT NULL | |
| updatedAt | TIMESTAMPTZ | NOT NULL | |

**Indexes**: `(centroCustoId, data)`, `(entityId, centroCustoId, data)`

---

## RegistroDiarioValor

Tabela: `registro_diario_valores`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK |
| registroDiarioId | UUID | FK |
| propriedadeId | UUID | FK |
| entityId | UUID | FK |
| valorTexto | VARCHAR(2000) | NULL |
| valorData | DATE | NULL |
| valorDecimal | DECIMAL(15,4) | NULL |
| valorBoolean | BOOLEAN | NULL |

**Unique**: `(registroDiarioId, propriedadeId)`

**Rule**: exactly one value column populated matching property `tipo` (service validation).

---

## RegistroDiarioValorItem

Tabela: `registro_diario_valor_itens`

| Field | Type | Constraints |
|-------|------|-------------|
| registroDiarioValorId | UUID | FK |
| licitacaoItemId | UUID | FK |
| entityId | UUID | FK |

**PK**: `(registroDiarioValorId, licitacaoItemId)`

---

## Prisma Schema (draft)

```prisma
enum CentroCustoStatus {
  ACTIVE
  INACTIVE
}

enum PropriedadeTipo {
  TEXTO
  DATA
  VALOR
  BOOLEAN
  ITEM_LICITACAO
  ITENS_LICITACAO
}

enum PropriedadeProductionRole {
  NONE
  INICIO
  CONCLUSAO
}

model CentroCusto {
  id                   String            @id @default(uuid())
  entityId             String            @map("entity_id")
  nome                 String            @db.VarChar(200)
  dataPrevistaInicio   DateTime?         @map("data_prevista_inicio") @db.Date
  dataPrevistaFim      DateTime?         @map("data_prevista_fim") @db.Date
  dataRealizadaInicio  DateTime?         @map("data_realizada_inicio") @db.Date
  dataRealizadaFim     DateTime?         @map("data_realizada_fim") @db.Date
  status               CentroCustoStatus @default(ACTIVE)
  createdByUserId      String            @map("created_by_user_id")
  createdAt            DateTime          @default(now()) @map("created_at")
  updatedAt            DateTime          @updatedAt @map("updated_at")

  entity              Entity                        @relation(fields: [entityId], references: [id])
  createdBy           TenantUser                    @relation(fields: [createdByUserId], references: [id])
  licitacoes          CentroCustoLicitacao[]
  propriedadeConfigs  CentroCustoPropriedadeConfig[]
  registrosDiarios    RegistroDiario[]

  @@unique([entityId, nome])
  @@index([entityId, status])
  @@map("centros_custo")
}

// ... additional models per tables above
```

---

## TenantAuditLog — novas ações

| action | resource |
|--------|----------|
| CENTRO_CUSTO_CREATED | centro_custo |
| CENTRO_CUSTO_UPDATED | centro_custo |
| CENTRO_CUSTO_DEACTIVATED | centro_custo |
| CENTRO_CUSTO_LICITACOES_UPDATED | centro_custo |
| PROPRIEDADE_CREATED | centro_custo_propriedade |
| PROPRIEDADE_DEACTIVATED | centro_custo_propriedade |
| CENTRO_PROPRIEDADES_CONFIG_UPDATED | centro_custo |
| REGISTRO_DIARIO_CREATED | registro_diario |
| REGISTRO_DIARIO_UPDATED | registro_diario |
| REGISTRO_DIARIO_DELETED | registro_diario |

---

## TenantPermission — novos registros (seed)

| code | module |
|------|--------|
| centros_custo.view | centros_custo |
| centros_custo.manage | centros_custo |
| centros_custo.propriedades.manage | centros_custo |
| centros_custo.registros.edit | centros_custo |

---

## Migration

Nome sugerido: `20260529120000_centros_custo`
