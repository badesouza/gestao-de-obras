# Documentação — Gestão de Obras Públicas

Este diretório complementa as especificações em [`specs/`](../specs/) com índices e status do projeto.

## Índice

| Documento | Descrição |
|-----------|-----------|
| [README.md](../README.md) | Visão geral, setup e URLs |
| [IMPLEMENTACAO.md](./IMPLEMENTACAO.md) | Status por spec e pendências |
| [specs/](../specs/) | Spec Kit — requisitos, planos, contratos |

## Specs por feature

### Spec 01 — Entidades (Tenants)

| Arquivo | Conteúdo |
|---------|----------|
| [spec.md](../specs/001-tenant-entities/spec.md) | Requisitos |
| [plan.md](../specs/001-tenant-entities/plan.md) | Plano técnico |
| [quickstart.md](../specs/001-tenant-entities/quickstart.md) | Setup e testes manuais |
| [contracts/platform-api.openapi.yaml](../specs/001-tenant-entities/contracts/platform-api.openapi.yaml) | API plataforma |

### Spec 02 — Base e usuários tenant

| Arquivo | Conteúdo |
|---------|----------|
| [spec.md](../specs/002-system-base-users/spec.md) | Requisitos |
| [tasks.md](../specs/002-system-base-users/tasks.md) | Tarefas |

### Spec 03 — Licitações e itens

| Arquivo | Conteúdo |
|---------|----------|
| [spec.md](../specs/003-licitacao-itens/spec.md) | Requisitos |
| [plan.md](../specs/003-licitacao-itens/plan.md) | Plano técnico |
| [quickstart.md](../specs/003-licitacao-itens/quickstart.md) | Fluxo de teste |
| [contracts/tenant-licitacoes.openapi.yaml](../specs/003-licitacao-itens/contracts/tenant-licitacoes.openapi.yaml) | API licitações |

### Spec 04 — Centros de custo e registro diário

| Arquivo | Conteúdo |
|---------|----------|
| [spec.md](../specs/004-centros-custo/spec.md) | Requisitos |
| [plan.md](../specs/004-centros-custo/plan.md) | Plano técnico |
| [research.md](../specs/004-centros-custo/research.md) | Decisões técnicas |
| [data-model.md](../specs/004-centros-custo/data-model.md) | Modelo de dados |
| [quickstart.md](../specs/004-centros-custo/quickstart.md) | Fluxo de teste (atualizado) |
| [tasks.md](../specs/004-centros-custo/tasks.md) | Tarefas e checklist |
| [contracts/tenant-centros-custo.openapi.yaml](../specs/004-centros-custo/contracts/tenant-centros-custo.openapi.yaml) | API centros de custo |

## Metodologia

O projeto segue **Spec Kit** (pasta `.specify/` e `specs/`):

1. **spec.md** — o quê e por quê  
2. **plan.md** / **research.md** — como  
3. **tasks.md** — checklist de implementação  
4. **quickstart.md** — validação manual  
5. **contracts/** — OpenAPI  

## Contribuindo

1. Leia a spec da feature em `specs/NNN-nome/`.  
2. Implemente conforme `plan.md` e `tasks.md`.  
3. Atualize `quickstart.md` se o fluxo de UI/API mudar.  
4. Marque tarefas concluídas em `tasks.md`.  
5. Atualize [IMPLEMENTACAO.md](./IMPLEMENTACAO.md) em entregas relevantes.
