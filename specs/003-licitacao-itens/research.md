# Research: Spec 03 — Licitações e Importação de Itens

**Date**: 2026-05-28

## 1. Modelagem de domínio

**Decision**: Duas tabelas principais — `Licitacao` (agregador) e `LicitacaoItem` (produto/serviço) — ambas com `entityId` denormalizado para filtros e validação cross-tenant.

**Rationale**: Isolamento tenant em toda query; itens sempre pertencem a uma licitação e à mesma entidade. Metadados `createdByUserId` + `createdAt` em ambas (FR-006, FR-011).

**Alternatives considered**:
- *Item sem entityId (só via licitação)*: join extra em toda listagem; rejeitado por performance e defesa em profundidade.
- *Tabela LoteImportacao dedicada*: útil para histórico detalhado; nesta spec o lote fica em `TenantAuditLog.metadata` (quantidade, origem).

## 2. Parsing de planilha

**Decision**: Biblioteca **`xlsx`** (SheetJS) para `.xlsx` e `.csv`; primeira aba/planilha; cabeçalhos mapeados por **nome normalizado**, não só posição.

**Rationale**: `@fastify/multipart` já está no projeto; `xlsx` cobre CSV e XLSX com uma API. Normalização de cabeçalhos atende edge cases da spec (`descrição`/`descricao`, `unidade de medida`/`unidade`).

**Header aliases** (backend):

| Campo interno | Aliases aceitos |
|---------------|-----------------|
| categoria | categoria, category |
| descricao | descricao, descrição, description |
| unidade | unidade, unidade de medida, un |
| valor | valor, valor unitario, valor unitário, preco, preço |

**Alternatives considered**:
- *Papa Parse só para CSV + xlsx separado*: duas libs; rejeitado.
- *Validação só no frontend*: viola constitution VI; rejeitado.

## 3. Importação atômica

**Decision**: `prisma.$transaction` — validar **todas** as linhas em memória; se qualquer linha falhar, abortar sem `createMany`.

**Rationale**: FR-018; evita lote parcial inconsistente.

**Limites operacionais**:
- Máximo **2.000 linhas** por importação (configurável via constante).
- Arquivo máximo **5 MB**.

## 4. Importação via textarea (colunas)

**Decision**: Endpoint JSON `POST .../items/import/columns` com payload:

```json
{
  "columns": {
    "categoria": "linha1\nlinha2",
    "descricao": "...\n...",
    "unidade": "...\n...",
    "valor": "...\n..."
  }
}
```

Backend:
1. Split por `\n`, trim, descartar linhas vazias no **final** de cada coluna.
2. Colunas opcionais **omitidas ou string vazia** → ignoradas na paridade.
3. Coluna opcional **presente com conteúdo** → entra na paridade (FR-023).
4. Se contagens divergirem → `422` com detalhe por coluna (FR-022).
5. Mesmo pipeline de validação de item que planilha.

**Rationale**: Paridade validada no servidor (SC-002); frontend pode pré-validar para UX.

## 5. Valores monetários (pt-BR)

**Decision**: Parser backend aceita:
- `32,50` → 32.50
- `1.234,56` → 1234.56
- `85.00` (ponto decimal) → 85.00 quando não há vírgula

Armazenamento: `Decimal(15,4)` no PostgreSQL; API retorna string decimal; UI formata pt-BR.

**Rationale**: Assumption da spec; locale único no backend.

## 6. Desativação lógica

**Decision**: Enum compartilhado `ACTIVE | INACTIVE` (mesmo padrão de `Entity`, `TenantUser`). Sem `DELETE`; PATCH status em licitação e item.

**Rationale**: Constitution VIII; FR-005, FR-012.

**Listagens padrão**: filtro implícito `status = ACTIVE` em itens; query param `includeInactive=true` para visão administrativa (US5).

## 7. RBAC — matriz de permissões

**Decision**: Quatro permissões no módulo `licitacoes`:

| Permissão | Descrição |
|-----------|-----------|
| `licitacoes.view` | Listar licitações e itens |
| `licitacoes.manage` | Criar licitação; desativar licitação |
| `licitacoes.items.import` | Importar itens (planilha e textarea) |
| `licitacoes.items.deactivate` | Desativar item |

| Perfil | Permissões |
|--------|------------|
| Administrador | todas |
| Engenheiro/Fiscal | `licitacoes.view`, `licitacoes.items.import` |
| Operador | `licitacoes.view` |

**Rationale**: FR-024–FR-027; engenheiro importa mas não desativa nem cria licitação (gestão cadastral fica com admin).

## 8. Auditoria

**Decision**: Reutilizar `TenantAuditLog` (Spec 02) com ações:

| action | resource | Quando |
|--------|----------|--------|
| `LICITACAO_CREATED` | `licitacao` | POST licitação |
| `LICITACAO_DEACTIVATED` | `licitacao` | PATCH status INACTIVE |
| `LICITACAO_ITEMS_IMPORTED` | `licitacao_item` | Importação planilha/textarea |
| `LICITACAO_ITEM_DEACTIVATED` | `licitacao_item` | PATCH item INACTIVE |

`metadata`: `{ source: 'spreadsheet'|'textarea', itemCount, licitacaoId }` em importações.

**Rationale**: FR-032–FR-034; `createdAt`/`createdBy` também persistidos nas entidades para consulta rápida na UI.

## 9. Modelo de planilha para download

**Decision**: `GET /licitacoes/import-template?format=csv|xlsx` gera arquivo on-the-fly (sem arquivo estático versionado).

**Rationale**: Sempre sincronizado com colunas esperadas; evita drift entre template e validador.

## 10. Entidade inativa

**Decision**: Middleware de serviço verifica `Entity.status === ACTIVE` antes de create/import; retorna `403` com código `ENTITY_INACTIVE`.

**Rationale**: Edge case da spec; reutiliza padrão existente de auth tenant.

## 11. Frontend — fluxo de importação

**Decision**: Aba única na página de detalhe da licitação com toggle **Planilha** | **Colunas (textarea)**; bloco de instruções fixo acima (FR-015); preview de contagem de linhas no modo textarea antes de enviar.

**Rationale**: FR-031; instruções visíveis sem suporte externo (SC-005).
