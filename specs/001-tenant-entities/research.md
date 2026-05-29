# Research: Spec 01 — Cadastro de Entidades (Tenants)

**Date**: 2026-05-28

## 1. Multi-tenancy strategy

**Decision**: Shared database, shared schema, tenant isolation via `entityId` foreign key on future tables.

**Rationale**: PostgreSQL único simplifica operações, backups e auditoria para órgãos públicos com volume moderado de tenants. A tabela `Entity` é a raiz; Spec 02 adicionará `TenantUser.entityId`.

**Alternatives considered**:
- *Database per tenant*: isolamento forte, custo operacional alto para muitos municípios pequenos.
- *Schema per tenant*: complexidade de migrations multiplicada.

## 2. Platform vs tenant authentication

**Decision**: Dois fluxos JWT separados com claim `scope`:
- `platform` — operadores em `/api/platform/v1/*`
- `tenant` — usuários em `/api/tenant/v1/*` (Spec 02)

Tokens platform MUST NOT aceitar rotas tenant e vice-versa.

**Rationale**: Atende FR-002/FR-003 da spec; evita escalada de privilégio entre camadas.

**Alternatives considered**:
- *Sessão cookie única*: mais simples, porém mistura contextos; rejeitado.
- *OAuth/SSO*: fora de escopo.

## 3. Slug rules

**Decision**:
- Normalização: lowercase, NFKD strip accents, non-alphanumeric → `-`, trim hyphens
- Regex: `^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$` (2–50 chars)
- Imutável após `POST /entities`
- Reservados: `platform`, `admin`, `api`, `t`, `static`, `assets`, `login`, `health`

**Rationale**: URLs previsíveis, SEO-safe, evita colisão com rotas do app.

**Alternatives considered**:
- *Slug editável*: rejeitado — quebra links repassados a administradores tenant.

## 4. Entity deactivation (soft delete)

**Decision**: Campo `status: ACTIVE | INACTIVE`; sem `DELETE` HTTP.

**Rationale**: Alinhado à constitution (integridade) e FR-015; dados preservados para Spec 02+.

## 5. Platform operator bootstrap

**Decision**: Seed Prisma cria um `PlatformOperator` a partir de env:
- `PLATFORM_ADMIN_EMAIL`
- `PLATFORM_ADMIN_PASSWORD`
- `PLATFORM_ADMIN_NAME`

**Rationale**: Atende assumption da spec; sem self-service.

## 6. Audit log storage

**Decision**: Tabela append-only `PlatformAuditLog` com JSON `previousValue` / `newValue`.

**Rationale**: Entidade crítica (constitution VII); consultável, imutável via API.

**Alternatives considered**:
- *Event sourcing completo*: over-engineering para Spec 01.

## 7. CNPJ validation

**Decision**: Opcional; quando informado, validar dígitos verificadores. Se CNPJ já existir, API retorna aviso `cnpjDuplicateWarning` na resposta; UI exige checkbox de confirmação antes de submeter novamente com `acknowledgeCnpjDuplicate: true`.

**Rationale**: Spec assumption — alertar, permitir com confirmação.

## 8. Frontend routing

**Decision**: React Router 7, prefixo `/platform`:
- `/platform/login`
- `/platform/entities`
- `/platform/entities/new`
- `/platform/entities/:id`

Tenant preview link displayed as `{origin}/t/{slug}/login` (route stub until Spec 02).

## 9. API framework

**Decision**: Fastify (já no `package.json`) com plugins modulares por domínio (`platform/`).

**Rationale**: Performance, validação Zod, alinhado ao stack existente.

## 10. Password hashing

**Decision**: bcrypt, cost factor 12.

**Rationale**: Padrão maduro; suficiente para credenciais internas.
