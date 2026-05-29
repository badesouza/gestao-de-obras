# Quickstart: Spec 01 — Cadastro de Entidades (Tenants)

**Date**: 2026-05-28

## Prerequisites

- Node.js 20+
- Docker Desktop (PostgreSQL)
- uv/specify CLI (optional)

## 1. Start PostgreSQL

```powershell
cd docker
docker compose up -d
```

Database: `gestao_de_obras_db` @ `localhost:5432` (user/pass: `app`/`app`)

## 2. Configure API

```powershell
cd api
copy .env.example .env   # create if missing
```

`.env` minimum:

```env
DATABASE_URL="postgresql://app:app@localhost:5432/gestao_de_obras_db"
JWT_SECRET="change-me-in-production"
JWT_EXPIRES_IN="8h"
PLATFORM_ADMIN_EMAIL="admin@plataforma.local"
PLATFORM_ADMIN_PASSWORD="Admin@1234"
PLATFORM_ADMIN_NAME="Operador Plataforma"
PORT=3000
CORS_ORIGIN="http://localhost:5173"
```

## 3. Install & migrate

```powershell
cd api
npm install
npx prisma migrate dev --name init_platform_entities
npx prisma db seed
npm run dev
```

API: `http://localhost:3000`
Health: `GET http://localhost:3000/health`

## 4. Start frontend

```powershell
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

## 5. Manual test flow

1. Open `http://localhost:5173/platform/login`
2. Login with seed credentials (`PLATFORM_ADMIN_*`)
3. Navigate to **Entidades** → **Nova entidade**
4. Create entity:
   - Nome: `Prefeitura Municipal Exemplo`
   - Slug: `prefeitura-exemplo`
5. Verify list shows entity with status **Ativo**
6. Copy **Link tenant**: `/t/prefeitura-exemplo/login`
7. Deactivate entity → status **Inativo**
8. Verify audit logs via `GET /api/platform/v1/entities/{id}/audit-logs` (when implemented)

## 6. API smoke tests (curl)

```powershell
# Login
curl -X POST http://localhost:3000/api/platform/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@plataforma.local","password":"Admin@1234"}'

# List entities (replace TOKEN)
curl http://localhost:3000/api/platform/v1/entities `
  -H "Authorization: Bearer TOKEN"

# Create entity
curl -X POST http://localhost:3000/api/platform/v1/entities `
  -H "Authorization: Bearer TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"name":"Prefeitura Teste","slug":"prefeitura-teste"}'
```

## 7. Run tests

```powershell
cd api
npm test

cd ../frontend
npm test
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| DB connection refused | Ensure `docker compose up -d` and `DATABASE_URL` correct |
| CORS error | Set `CORS_ORIGIN` to frontend URL |
| Slug reserved | Use slug not in reserved list (see data-model.md) |
| 401 on platform routes | Token must have `scope: platform` |

## Next

After implementation, run `/speckit-tasks` then `/speckit-implement` for Spec 01.
Then `/speckit-plan` for Spec 02 (usuários tenant).
