# Gestão de Obras Públicas

Monorepo para gestão de obras públicas multi-tenant: plataforma operadora, portal por entidade (tenant), licitações, centros de custo e registro diário de produção.

## Stack

| Camada | Tecnologia |
|--------|------------|
| API | Node.js, Fastify 5, TypeScript, Prisma 7, PostgreSQL |
| Frontend | React 19, Vite, React Router, Tailwind CSS 4 |
| Auth | JWT (plataforma + tenant), RBAC por permissões |
| Infra local | Docker Compose (PostgreSQL 16) |

## Estrutura do repositório

```text
gestao-de-obras/
├── api/                 # Backend Fastify + Prisma
├── frontend/            # SPA React (plataforma + tenant)
├── docker/              # PostgreSQL local
├── specs/               # Spec Kit — especificações por feature
└── docs/                # Índice e status da documentação
```

## Pré-requisitos

- Node.js 20+
- Docker Desktop (PostgreSQL)
- npm

## Início rápido

### 1. Banco de dados

```powershell
cd docker
docker compose up -d
```

Credenciais padrão: `app` / `app` — banco `gestao_de_obras_db` em `localhost:5432`.

### 2. API

```powershell
cd api
copy .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

- API: http://localhost:3000  
- Health: `GET http://localhost:3000/health`

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173

### Credenciais seed (desenvolvimento)

| Contexto | E-mail | Senha |
|----------|--------|-------|
| Plataforma | `admin@plataforma.local` | `Admin@1234` |

Usuários tenant são criados por entidade (bootstrap admin na plataforma).

## Módulos implementados

| Spec | Módulo | Status |
|------|--------|--------|
| [01 — Entidades (Tenants)](specs/001-tenant-entities/spec.md) | Cadastro de entidades na plataforma | Implementado |
| [02 — Usuários Tenant](specs/002-system-base-users/spec.md) | Auth, RBAC, dashboard, usuários | Implementado |
| [03 — Licitações e Itens](specs/003-licitacao-itens/spec.md) | Licitações, importação CSV/XLSX | Implementado |
| [04 — Centros de Custo](specs/004-centros-custo/spec.md) | Centros, propriedades, registro diário, produção | Implementado* |

\* Testes automatizados da Spec 04 (unit/integration) ainda pendentes — ver [docs/IMPLEMENTACAO.md](docs/IMPLEMENTACAO.md).

## URLs principais

### Plataforma

| URL | Descrição |
|-----|-----------|
| `/platform/login` | Login operador plataforma |
| `/platform/entities` | Listagem de entidades |

### Tenant (por entidade)

| URL | Descrição |
|-----|-----------|
| `/t/{entityId}/login` | Login tenant |
| `/t/{entityId}/dashboard` | Dashboard |
| `/t/{entityId}/licitacoes` | Licitações |
| `/t/{entityId}/centros-custo` | Centros de custo |
| `/t/{entityId}/centros-custo/{centroId}?tab=home` | Detalhe do centro (aba Home) |
| `/t/{entityId}/centros-custo/{centroId}?tab=registro&year=2026&month=5` | Registro diário |
| `/t/{entityId}/centros-custo/propriedades` | Catálogo de propriedades |
| `/t/{entityId}/users` | Usuários tenant |

## API

Base paths:

- Plataforma: `/api/platform/v1`
- Tenant: `/api/tenant/v1` (header `X-Tenant-Id` + JWT)
- Público: `/api/public/v1`

Contratos OpenAPI por spec em `specs/*/contracts/`.

## Documentação

- [Índice da documentação](docs/README.md)
- [Status de implementação](docs/IMPLEMENTACAO.md)
- Especificações: pasta [`specs/`](specs/)
- Quickstarts por feature: `specs/*/quickstart.md`

## Scripts úteis

```powershell
# API
cd api
npm run dev          # desenvolvimento
npm run build        # compilar TypeScript
npm run db:migrate   # nova migration (dev)
npm run db:seed      # RBAC e operador plataforma

# Frontend
cd frontend
npm run dev
npm run build
```

## RBAC tenant (centros de custo)

| Permissão | Admin | Engenheiro | Operador |
|-----------|:-----:|:----------:|:--------:|
| `centros_custo.view` | ✅ | ✅ | ✅ |
| `centros_custo.manage` | ✅ | ❌ | ❌ |
| `centros_custo.propriedades.manage` | ✅ | ❌ | ❌ |
| `centros_custo.registros.edit` | ✅ | ✅ | ❌ |

Após alterações no seed, faça **logout e login** no tenant para carregar novas permissões.

## Regras de negócio (Spec 04 — resumo)

- Cada centro de custo vincula **no máximo uma licitação** ativa.
- Cadastro do centro: apenas **nome** e licitação opcional; **datas previstas/realizadas** na edição (aba Home).
- Registro diário: planilha com coluna **Data** fixa + colunas das propriedades configuradas.
- Salvamento em lote: botão único **Salvar alterações** na aba Registro diário.
- Marcadores **Início** / **Conclusão** alimentam a aba **Produção diária**.

## Licença

ISC (pacote API). Demais pacotes conforme `package.json` de cada workspace.
