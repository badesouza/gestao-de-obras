# Status de implementação

**Atualizado:** 2026-05-29

## Resumo

| Spec | Feature | Backend | Frontend | Testes auto | Docs |
|------|---------|:-------:|:--------:|:-----------:|:----:|
| 01 | Entidades plataforma | ✅ | ✅ | Parcial | ✅ |
| 02 | Auth/RBAC tenant | ✅ | ✅ | Parcial | ✅ |
| 03 | Licitações e itens | ✅ | ✅ | Parcial | ✅ |
| 04 | Centros de custo | ✅ | ✅ | ❌ | ✅ |

Legenda: ✅ concluído · ❌ pendente · Parcial = smoke manual, sem suite dedicada

## Migrations aplicadas

| Migration | Spec |
|-----------|------|
| `20260528120000_init_platform_entities` | 01 |
| `20260528140000_entity_fields_refactor` | 01 |
| `20260528160000_tenant_users_rbac` | 02 |
| `20260528180000_entity_coat_of_arms` | 01 |
| `20260529100052_licitacoes_itens` | 03 |
| `20260529103541_centros_custo` | 04 |

## Spec 04 — Detalhes implementados

### API (`api/src/modules/tenant/centros-custo/`)

- CRUD centro de custo + desativação  
- Catálogo de propriedades (entity-level)  
- Configuração de propriedades por centro (ordem, marcadores, ativo)  
- Registro diário (listagem mensal, CRUD linhas, células tipadas)  
- Busca de itens de licitação (escopo da licitação vinculada)  
- Produção diária agregada por dia  
- Auditoria tenant nas mutações  

### Frontend

- Listagem, criação, detalhe com abas  
- Aba **Home**: edição (datas, licitação, config propriedades)  
- Aba **Registro diário**: planilha inline, salvamento em lote  
- Aba **Produção diária** e **Desempenho** (placeholder)  
- Busca de licitação com datalist (vínculo único)  

### Regras de negócio aplicadas (pós-spec)

Estas regras estão no código e no [README](../README.md); a spec original ainda menciona N licitações em alguns trechos:

- **Uma licitação** por centro de custo (máx. 1 em `licitacaoIds`)  
- Datas previstas/realizadas **somente na edição** (aba Home)  
- Registro diário disponível mesmo sem colunas de propriedade (apenas Data)  

### Pendências Spec 04

- [ ] Testes unitários: `cell-value.validator`, `production.service`  
- [ ] Testes integração: cross-tenant, item-search, produção, validação células  
- [ ] Alinhar `spec.md` US2 com regra de licitação única (opcional)  

## Permissões tenant (seed)

Módulo `centros_custo`:

- `centros_custo.view`  
- `centros_custo.manage`  
- `centros_custo.propriedades.manage`  
- `centros_custo.registros.edit`  

## Como validar

Siga os quickstarts:

1. [Spec 01](../specs/001-tenant-entities/quickstart.md) — criar entidade  
2. [Spec 03](../specs/003-licitacao-itens/quickstart.md) — licitação + itens  
3. [Spec 04](../specs/004-centros-custo/quickstart.md) — centro + registro + produção  
