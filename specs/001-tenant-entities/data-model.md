# Data Model: Spec 01 — Cadastro de Entidades (Tenants)

**Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

## Entity Relationship Overview

```text
PlatformOperator ──< PlatformAuditLog
       │
       │ (actor)
       ▼
    Entity (Tenant) ──< PlatformAuditLog (target)
```

Future (Spec 02): `Entity ──< TenantUser`

---

## Entity (Tenant)

Raiz de isolamento multi-tenant. Tabela: `entities`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, default uuid | |
| name | VARCHAR(200) | NOT NULL | Razão social / nome |
| slug | VARCHAR(50) | NOT NULL, UNIQUE | Imutável após insert |
| status | ENUM | NOT NULL, default ACTIVE | ACTIVE, INACTIVE |
| cnpj | VARCHAR(14) | NULL, UNIQUE where not null | Apenas dígitos |
| email | VARCHAR(255) | NULL | Institucional |
| phone | VARCHAR(20) | NULL | |
| city | VARCHAR(100) | NULL | Município |
| address | VARCHAR(500) | NULL | |
| createdAt | TIMESTAMPTZ | NOT NULL | |
| updatedAt | TIMESTAMPTZ | NOT NULL | |

**Validation rules**:
- `slug`: normalized, reserved list check, unique
- `cnpj`: optional; validate checksum if present
- `status` transitions: ACTIVE ↔ INACTIVE only (no DELETE)

**Computed (API response, not stored)**:
- `tenantAccessUrl`: `/t/{slug}/login`

**Indexes**:
- UNIQUE (`slug`)
- INDEX (`status`)
- INDEX (`name`) — for search

---

## PlatformOperator

Usuário da camada plataforma. Tabela: `platform_operators`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| name | VARCHAR(200) | NOT NULL | |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Login identifier |
| passwordHash | VARCHAR(255) | NOT NULL | bcrypt |
| status | ENUM | NOT NULL, default ACTIVE | ACTIVE, INACTIVE |
| createdAt | TIMESTAMPTZ | NOT NULL | |
| updatedAt | TIMESTAMPTZ | NOT NULL | |

**Notes**: Sem RBAC granular nesta spec — todo operador ativo tem permissão full platform entity CRUD.

---

## PlatformAuditLog

Trilha imutável. Tabela: `platform_audit_logs`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK | |
| operatorId | UUID | FK → platform_operators, NOT NULL | Quem |
| entityId | UUID | FK → entities, NULL | Alvo (nullable p/ login failures) |
| action | VARCHAR(50) | NOT NULL | Ver enum abaixo |
| resource | VARCHAR(50) | NOT NULL | `entity`, `auth` |
| previousValue | JSONB | NULL | Snapshot antes |
| newValue | JSONB | NULL | Snapshot depois |
| metadata | JSONB | NULL | IP, userAgent |
| createdAt | TIMESTAMPTZ | NOT NULL | Quando |

**Action enum**:
- `ENTITY_CREATED`
- `ENTITY_UPDATED`
- `ENTITY_ACTIVATED`
- `ENTITY_DEACTIVATED`
- `AUTH_LOGIN_SUCCESS`
- `AUTH_LOGIN_FAILURE`
- `AUTH_LOGOUT`

**Immutability**: No UPDATE/DELETE via application layer.

---

## Prisma Schema (draft)

```prisma
enum EntityStatus {
  ACTIVE
  INACTIVE
}

enum OperatorStatus {
  ACTIVE
  INACTIVE
}

model Entity {
  id        String       @id @default(uuid())
  name      String
  slug      String       @unique
  status    EntityStatus @default(ACTIVE)
  cnpj      String?      @unique
  email     String?
  phone     String?
  city      String?
  address   String?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  auditLogs PlatformAuditLog[]

  @@map("entities")
}

model PlatformOperator {
  id           String         @id @default(uuid())
  name         String
  email        String         @unique
  passwordHash String
  status       OperatorStatus @default(ACTIVE)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  auditLogs PlatformAuditLog[]

  @@map("platform_operators")
}

model PlatformAuditLog {
  id            String   @id @default(uuid())
  operatorId    String
  entityId      String?
  action        String
  resource      String
  previousValue Json?
  newValue      Json?
  metadata      Json?
  createdAt     DateTime @default(now())

  operator PlatformOperator @relation(fields: [operatorId], references: [id])
  entity   Entity?          @relation(fields: [entityId], references: [id])

  @@index([entityId])
  @@index([operatorId])
  @@index([createdAt])
  @@map("platform_audit_logs")
}
```

---

## State Transitions — Entity.status

```text
        ┌──────────┐
        │  ACTIVE  │◄──── reactivate (PATCH status)
        └────┬─────┘
             │ deactivate
             ▼
        ┌──────────┐
        │ INACTIVE │
        └──────────┘
```

No terminal delete state — INACTIVE is reversible.

---

## Reserved Slugs (application constant)

`platform`, `admin`, `api`, `t`, `static`, `assets`, `login`, `health`, `www`, `app`
