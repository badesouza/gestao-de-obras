# Research: Spec 04 — Centros de Custo e Registro Diário

**Date**: 2026-05-29

## 1. Modelagem de valores de célula (EAV tipado)

**Decision**: Tabela `registro_diario_valores` com colunas tipadas nullable (`valor_texto`, `valor_data`, `valor_decimal`, `valor_boolean`) + tabela filha `registro_diario_valor_itens` para `ITENS_LICITACAO` (N:N com `licitacao_items`).

**Rationale**: Produção Diária precisa agregar marcadores com SQL eficiente; JSONB único dificulta índices e validação. Uma linha por (registro, propriedade) com coluna preenchida conforme tipo da propriedade.

**Alternatives considered**:
- *JSONB por célula*: flexível, pior para agregações e constraints.
- *Coluna física por propriedade*: explosão de schema a cada nova propriedade; rejeitado.

## 2. Catálogo vs configuração por centro

**Decision**: Duas camadas:
1. `CentroCustoPropriedade` — catálogo da entidade (nome único, tipo imutável após primeiro uso).
2. `CentroCustoPropriedadeConfig` — join ordenado centro ↔ propriedade com `columnOrder` e `productionRole` (`NONE` | `INICIO` | `CONCLUSAO`).

**Rationale**: FR-011 reutilização; FR-014 ordem por centro; FR-016 marcadores de produção.

## 3. Vínculo centro ↔ licitação

**Decision**: Tabela join `centro_custo_licitacoes` (N:N). Validação: apenas licitações `ACTIVE` da mesma entidade.

**Rationale**: FR-007; busca de itens filtra por licitações vinculadas.

## 4. Coluna Data fixa

**Decision**: Campo `data` (`DATE`) em `RegistroDiario`; **não** é propriedade do catálogo.

**Rationale**: Assumption da spec; simplifica filtro mensal (`WHERE data BETWEEN firstDay AND lastDay`).

## 5. Marcadores de Produção Diária

**Decision**: Regras no backend (`production.service.ts`):

| Tipo propriedade | Conta como iniciada/concluída quando |
|------------------|--------------------------------------|
| `BOOLEAN` | `valor_boolean = true` |
| `DATA` | `valor_data IS NOT NULL` |
| `TEXTO` | `valor_texto` trim length > 0 |

Propriedades com `productionRole = INICIO` ou `CONCLUSAO` devem ser `BOOLEAN`, `DATA` ou `TEXTO` (validado ao salvar config).

**Rationale**: FR-016, FR-026; evita ambiguidade com `VALOR`/`ITEM_*`.

## 6. Grade Registro Diário (UI)

**Decision**: Componente `DailyRegisterGrid` — `<table>` semântico com editores inline por tipo; sem biblioteca spreadsheet pesada na v1.

**Rationale**: Escopo funcional Excel-like sem fórmulas; acessibilidade e controle total. Se performance degradar (>200 linhas/mês), avaliar `react-data-grid` na spec futura.

**Cell editors**:
- TEXTO → `<input type="text">`
- DATA → `<input type="date">`
- VALOR → input mascarado pt-BR
- BOOLEAN → checkbox
- ITEM_LICITACAO → combobox com busca async
- ITENS_LICITACAO → multi-select com busca async

## 7. Sincronização de mês entre abas

**Decision**: Query params na rota de detalhe: `?tab=registro|desempenho|producao&year=2026&month=5` via React Router `useSearchParams`.

**Rationale**: FR-027; URL compartilhável; abas leem mesmo `year`/`month`.

## 8. Persistência de edição

**Decision**: Salvar **por linha** (`PATCH /registros/:id`) ao blur da linha ou botão "Salvar linha"; payload inclui `data` + mapa `propertyId → value`.

**Rationale**: Menos requisições que por célula; auditoria por linha com diff de células alteradas em `metadata`.

**Alternatives considered**:
- *Autosave por célula*: muitas escritas e logs; rejeitado para v1.

## 9. Exclusão de linha

**Decision**: Permitir **excluir linha** de registro diário (hard delete da linha + valores) apenas para usuários com `centros_custo.registros.edit`; auditoria `REGISTRO_DIARIO_DELETED`.

**Rationale**: UX planilha; spec não proíbe; histórico via audit. Centro inativo bloqueia delete.

## 10. Imutabilidade de tipo de propriedade

**Decision**: Após propriedade associada a ≥1 centro **ou** possuir ≥1 valor em registro, `tipo` MUST NOT change (HTTP 409).

**Rationale**: US3 cenário 3; integridade de células históricas.

## 11. RBAC

**Decision**:

| Perfil | Permissões |
|--------|------------|
| Administrador | todas |
| Engenheiro/Fiscal | `view`, `registros.edit` |
| Operador | `view` |

Gestão de catálogo (`propriedades.manage`) e CRUD centro (`manage`) apenas **Administrador** nesta spec.

**Rationale**: FR-031; operador consulta; engenheiro opera registro diário.

## 12. Painel de Desempenho

**Decision**: Componente `PerformancePanelPlaceholder` — Card com texto "Indicadores em definição" (FR-028).

**Rationale**: Escopo explícito placeholder; spec futura substitui componente.

## 13. Busca de itens para célula

**Decision**: `GET /centros-custo/:id/itens-busca?q=&limit=20` — join `licitacao_items` via licitações vinculadas, `status=ACTIVE`, ILIKE em `descricao`.

**Rationale**: FR-023; endpoint dedicado evita expor lógica no frontend.

## 14. Produção diária — agregação

**Decision**: Query SQL agrupa por `DATE(registro.data)` no mês:
- `cadastradas` = COUNT(*)
- `iniciadas` = COUNT WHERE marcador início satisfeito
- `concluidas` = COUNT WHERE marcador conclusão satisfeito

Retorna array com **todos os dias do mês** (1..28/29/30/31), zeros incluídos.

**Rationale**: FR-026, edge case "exibir dias com zero".
