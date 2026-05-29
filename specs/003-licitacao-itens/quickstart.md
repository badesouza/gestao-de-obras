# Quickstart: Spec 03 — Licitações e Importação de Itens

**Date**: 2026-05-28 | **Plan**: [plan.md](./plan.md)

## Prerequisites

- Specs 01 e 02 implementadas (entidade, auth tenant, RBAC, layout)
- Docker PostgreSQL rodando
- Entidade ativa com admin tenant bootstrapped

```powershell
cd docker
docker compose up -d

cd ..\api
npm install
npm install xlsx
npx prisma migrate deploy
npm run db:seed
npm run dev

cd ..\frontend
npm run dev
```

## Verify RBAC seed

Após migration + seed, confirmar permissões:

```sql
SELECT code, module FROM tenant_permissions WHERE module = 'licitacoes';
```

Esperado: `licitacoes.view`, `licitacoes.manage`, `licitacoes.items.import`, `licitacoes.items.deactivate`.

## Manual test flow

### 1. Login tenant

1. Abrir plataforma → copiar link tenant (`/t/{entityId}/login`)
2. Login como admin tenant
3. Menu lateral deve exibir **Licitações**

### 2. Criar licitação

```http
POST /api/tenant/v1/licitacoes
Authorization: Bearer {token}
Content-Type: application/json

{
  "identificacao": "001/2026",
  "objeto": "Aquisição de materiais de construção"
}
```

Verificar resposta com `createdBy` e `createdAt`.

### 3. Download modelo

```http
GET /api/tenant/v1/licitacoes/import-template?format=csv
Authorization: Bearer {token}
```

Preencher planilha:

| categoria | descricao | unidade | valor |
|-----------|-----------|---------|-------|
| Material | Cimento CP II | saco 50kg | 32,50 |
| Serviço | Alvenaria | m² | 85,00 |

### 4. Importar planilha

```http
POST /api/tenant/v1/licitacoes/{id}/items/import/spreadsheet
Authorization: Bearer {token}
Content-Type: multipart/form-data

file=@itens.csv
```

Esperado: `201` com `{ importedCount: 2 }`.

### 5. Importar via textarea

```http
POST /api/tenant/v1/licitacoes/{id}/items/import/columns
Authorization: Bearer {token}
Content-Type: application/json

{
  "columns": {
    "descricao": "Tinta acrílica\nPorta de madeira",
    "unidade": "L\nun",
    "valor": "45,90\n320,00"
  }
}
```

### 6. Testar paridade (deve falhar)

```json
{
  "columns": {
    "descricao": "Item A\nItem B",
    "unidade": "un"
  }
}
```

Esperado: `422` código `IMPORT_COLUMN_MISMATCH` com contagem por coluna.

### 7. Desativar item

```http
PATCH /api/tenant/v1/licitacoes/{licitacaoId}/items/{itemId}/status
Authorization: Bearer {token}

{ "status": "INACTIVE" }
```

Listagem padrão de itens não deve incluir o item; `includeInactive=true` deve incluir.

### 8. Auditoria

```sql
SELECT action, resource, metadata, created_at
FROM tenant_audit_logs
WHERE action LIKE 'LICITACAO%'
ORDER BY created_at DESC
LIMIT 10;
```

## Frontend routes (após implementação)

| URL | Descrição |
|-----|-----------|
| `/t/{entityId}/licitacoes` | Listagem |
| `/t/{entityId}/licitacoes/new` | Nova licitação |
| `/t/{entityId}/licitacoes/{id}` | Detalhe + importação |

## Role smoke tests

| Perfil | Criar licitação | Importar | Desativar item |
|--------|-----------------|----------|----------------|
| Admin | ✅ | ✅ | ✅ |
| Engenheiro | ❌ | ✅ | ❌ |
| Operador | ❌ | ❌ | ❌ (view only) |

## Troubleshooting

| Problema | Causa provável |
|----------|----------------|
| 403 ENTITY_INACTIVE | Entidade desativada na plataforma |
| 422 IMPORT_VALIDATION_ERROR | Linha sem descrição/unidade |
| 422 IMPORT_COLUMN_MISMATCH | Textareas com linhas diferentes |
| Menu Licitações ausente | Usuário sem `licitacoes.view` — re-seed |
