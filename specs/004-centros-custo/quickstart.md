# Quickstart: Spec 04 — Centros de Custo e Registro Diário

**Date**: 2026-05-29 | **Plan**: [plan.md](./plan.md)

## Prerequisites

- Specs 01–03 implementadas (entidade, auth tenant, licitações com itens)
- PostgreSQL + API + frontend rodando
- Usuário tenant **Administrador** (gestão completa) ou **Engenheiro** (registros)

```powershell
cd docker; docker compose up -d
cd ..\api; npx prisma migrate deploy; npm run db:seed; npm run dev
cd ..\frontend; npm run dev
```

Após implementação: migration `20260529120000_centros_custo`.

## 1. Seed RBAC

Verificar permissões:

```sql
SELECT code FROM tenant_permissions WHERE module = 'centros_custo';
```

## 2. Criar propriedades no catálogo

```http
POST /api/tenant/v1/centros-custo/propriedades
Authorization: Bearer {token}
X-Tenant-Id: {entityId}

{ "nome": "Atividade", "tipo": "TEXTO" }
```

Repetir para: `Iniciada` (BOOLEAN, marcador), `Concluída` (BOOLEAN, marcador), `Item` (ITEM_LICITACAO).

## 3. Criar centro de custo

```http
POST /api/tenant/v1/centros-custo
{
  "nome": "Obra Escola Municipal",
  "dataPrevistaInicio": "2026-01-01",
  "dataPrevistaFim": "2026-12-31",
  "licitacaoIds": ["{licitacao-uuid}"]
}
```

## 4. Configurar propriedades do centro

```http
PUT /api/tenant/v1/centros-custo/{id}/propriedades-config
{
  "items": [
    { "propriedadeId": "...", "columnOrder": 0, "productionRole": "NONE" },
    { "propriedadeId": "...", "columnOrder": 1, "productionRole": "INICIO" },
    { "propriedadeId": "...", "columnOrder": 2, "productionRole": "CONCLUSAO" }
  ]
}
```

## 5. Registro diário

```http
POST /api/tenant/v1/centros-custo/{id}/registros
{
  "data": "2026-05-15",
  "values": {
    "{prop-atividade-id}": { "text": "Alvenaria bloco A" },
    "{prop-iniciada-id}": { "boolean": true },
    "{prop-concluida-id}": { "boolean": false }
  }
}
```

Listar mês:

```http
GET /api/tenant/v1/centros-custo/{id}/registros?year=2026&month=5
```

## 6. Produção diária

```http
GET /api/tenant/v1/centros-custo/{id}/producao?year=2026&month=5
```

Esperado: array de dias com `cadastradas`, `iniciadas`, `concluidas`.

## 7. Busca de item (célula)

```http
GET /api/tenant/v1/centros-custo/{id}/itens-busca?q=cimento&limit=10
```

Deve retornar apenas itens de licitações vinculadas.

## Frontend (após implementação)

| URL | Descrição |
|-----|-----------|
| `/t/{entityId}/centros-custo` | Listagem |
| `/t/{entityId}/centros-custo/new` | Novo centro |
| `/t/{entityId}/centros-custo/propriedades` | Catálogo |
| `/t/{entityId}/centros-custo/{id}?tab=registro&year=2026&month=5` | Detalhe + abas |

## Smoke tests por perfil

| Perfil | Criar centro | Catálogo propriedades | Editar registro |
|--------|--------------|----------------------|-----------------|
| Admin | ✅ | ✅ | ✅ |
| Engenheiro | ❌ | ❌ | ✅ |
| Operador | ❌ | ❌ | ❌ (view) |

## Troubleshooting

| Problema | Causa |
|----------|-------|
| Config item bloqueada | Centro sem licitação vinculada |
| Itens-busca vazio | Licitação sem itens ativos ou não vinculada |
| Produção iniciadas = 0 | Marcador INICIO não configurado |
| Aba desempenho vazia | Esperado — placeholder até spec futura |
