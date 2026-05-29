# Quickstart: Spec 04 — Centros de Custo e Registro Diário

**Date**: 2026-05-29 (atualizado) | **Plan**: [plan.md](./plan.md) | **Status**: [docs/IMPLEMENTACAO.md](../../docs/IMPLEMENTACAO.md)

## Prerequisites

- Specs 01–03 implementadas (entidade, auth tenant, licitações com itens)
- PostgreSQL + API + frontend rodando
- Usuário tenant **Administrador** (gestão completa) ou **Engenheiro** (registros)

```powershell
cd docker; docker compose up -d
cd ..\api; npm install; npx prisma migrate deploy; npm run db:seed; npm run dev
cd ..\frontend; npm install; npm run dev
```

Migration aplicada: `20260529103541_centros_custo`.

> Após seed ou novas permissões: **logout e login** no tenant.

## 1. Verificar RBAC

```sql
SELECT code FROM tenant_permissions WHERE module = 'centros_custo';
```

Esperado: `centros_custo.view`, `centros_custo.manage`, `centros_custo.propriedades.manage`, `centros_custo.registros.edit`.

## 2. Criar propriedades no catálogo (UI)

1. Tenant → **Centros de Custo** → **Catálogo de propriedades**
2. Criar exemplos:

| Nome | Tipo | Uso |
|------|------|-----|
| Atividade | TEXTO | Coluna normal |
| Iniciada | BOOLEAN | Marcador **Início** (produção) |
| Concluída | BOOLEAN | Marcador **Conclusão** (produção) |
| Item | ITEM_LICITACAO | Célula com busca de item |

Via API:

```http
POST /api/tenant/v1/centros-custo/propriedades
Authorization: Bearer {token}
X-Tenant-Id: {entityId}
Content-Type: application/json

{ "nome": "Atividade", "tipo": "TEXTO" }
```

## 3. Criar licitação com itens (pré-requisito)

Siga [Spec 03 quickstart](../003-licitacao-itens/quickstart.md) se ainda não houver licitação ativa com itens importados.

## 4. Criar centro de custo (UI)

1. **Centros de Custo** → **Novo centro**
2. Informar **nome** e vincular **uma licitação** (busca por número/objeto)
3. Datas **não** são preenchidas no cadastro — apenas na edição

Via API:

```http
POST /api/tenant/v1/centros-custo
Content-Type: application/json

{
  "nome": "Obra Escola Municipal",
  "licitacaoIds": ["{licitacao-uuid}"]
}
```

> Máximo **1** licitação por centro (`licitacaoIds` com no máximo um UUID).

## 5. Configurar propriedades do centro (aba Home)

1. Abrir detalhe do centro → aba **Home**
2. Seção **Propriedades do centro** → adicionar propriedades do catálogo
3. Definir **ordem**, **marcador** (Nenhum / Início / Conclusão) e **Ativa**
4. Clicar **Salvar configuração** (obrigatório antes de ver colunas no registro)

Via API:

```http
PUT /api/tenant/v1/centros-custo/{id}/propriedades-config

{
  "items": [
    { "propriedadeId": "...", "columnOrder": 0, "productionRole": "NONE", "active": true },
    { "propriedadeId": "...", "columnOrder": 1, "productionRole": "INICIO", "active": true },
    { "propriedadeId": "...", "columnOrder": 2, "productionRole": "CONCLUSAO", "active": true }
  ]
}
```

## 6. Editar datas e licitação (aba Home)

Na mesma aba **Home**:

- Período **previsto** e **realizado**
- Alterar licitação vinculada
- **Salvar alterações**

## 7. Registro diário (aba Registro diário)

1. Aba **Registro diário**
2. Navegar mês (‹ ›)
3. **+ Adicionar linha** → preencher **Data** e células
4. **Salvar alterações** (salvamento em lote de todas as linhas novas/editadas/excluídas)

Via API (linha individual):

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

Excluir linha:

```http
DELETE /api/tenant/v1/centros-custo/{id}/registros/{registroId}
```

(Sem body — não enviar `Content-Type: application/json` em DELETE vazio.)

## 8. Produção diária (aba Produção diária)

```http
GET /api/tenant/v1/centros-custo/{id}/producao?year=2026&month=5
```

Por dia: `cadastradas`, `iniciadas`, `concluidas` (marcadores Início/Conclusão).

## 9. Busca de item (célula)

```http
GET /api/tenant/v1/centros-custo/{id}/itens-busca?q=cimento&limit=10
```

Retorna apenas itens da licitação vinculada ao centro.

## URLs frontend

| URL | Descrição |
|-----|-----------|
| `/t/{entityId}/centros-custo` | Listagem |
| `/t/{entityId}/centros-custo/new` | Novo centro |
| `/t/{entityId}/centros-custo/propriedades` | Catálogo |
| `/t/{entityId}/centros-custo/{centroId}?tab=home` | Detalhe — Home (edição) |
| `/t/{entityId}/centros-custo/{centroId}?tab=registro&year=2026&month=5` | Registro diário |
| `/t/{entityId}/centros-custo/{centroId}?tab=producao&year=2026&month=5` | Produção diária |
| `/t/{entityId}/centros-custo/{centroId}?tab=desempenho` | Placeholder desempenho |

Query params: `tab` = `home` \| `registro` \| `desempenho` \| `producao`; `year`, `month` para registro/produção.

## Smoke tests por perfil

| Perfil | Criar centro | Catálogo | Config/Home | Editar registro |
|--------|:------------:|:--------:|:-------------:|:---------------:|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Engenheiro | ❌ | ❌ | ❌ | ✅ |
| Operador | ❌ | ❌ | ❌ | ❌ (somente leitura) |

## Troubleshooting

| Problema | Causa / solução |
|----------|-----------------|
| Sem colunas no registro | Salvar configuração na Home; marcar propriedades como **Ativa** |
| Só coluna Data | Normal se nenhuma propriedade ativa — ainda é possível lançar datas |
| Config item bloqueada | Vincular licitação antes de propriedades tipo item |
| Itens-busca vazio | Licitação sem itens ativos ou não vinculada |
| Produção iniciadas = 0 | Marcador INICIO não configurado ou célula vazia |
| DELETE com erro JSON | Cliente não deve enviar body vazio com Content-Type JSON (corrigido no frontend) |
| Permissão negada | Re-login após seed |
| Aba desempenho vazia | Esperado — placeholder até spec futura |
