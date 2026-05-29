# Tasks: Spec 02 — Base do Sistema e Usuários (Tenant)

**Branch**: `002-system-base-users`

## Phase 1 — Data model & seed

- [x] T001 Prisma models: TenantUser, TenantRole, TenantPermission, TenantRolePermission, TenantAuditLog
- [x] T002 Migration `20260528160000_tenant_users_rbac`
- [x] T003 Seed roles (ADMIN, ENGINEER, OPERATOR) and permissions

## Phase 2 — Backend tenant API

- [x] T010 JWT scope `tenant` + plugin `auth-tenant.ts` (cross-tenant + permission guards)
- [x] T011 Auth routes: login, logout, me (`/api/tenant/v1/auth/*`)
- [x] T012 User CRUD scoped to entity + password reset + last-admin protection
- [x] T013 Dashboard placeholder route
- [x] T014 Platform bootstrap admin: `POST /entities/:id/bootstrap-admin`

## Phase 3 — Frontend tenant area

- [x] T020 Tenant login at `/t/:id/login`
- [x] T021 TenantGuard + TenantLayout (sidebar, header, mobile menu)
- [x] T022 Dashboard placeholder page
- [x] T023 Users list/create/detail with permission guards
- [x] T024 Bootstrap admin form on platform entity detail

## Notes

- URLs usam **UUID** da entidade (`/t/{uuid}/...`), não slug (Spec 01 refatorada).
- Domínios de auth separados: `platform_token` vs `tenant_tokens` (por entityId).
