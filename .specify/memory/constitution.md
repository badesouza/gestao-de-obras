# Gestão de Obras Públicas Constitution

## Core Principles

### I. Spec-Driven Development (NON-NEGOTIABLE)

Toda funcionalidade MUST nascer de uma spec aprovada antes de qualquer implementação.

- Nenhum código de feature entra no repositório sem spec em `specs/[###-feature]/spec.md`.
- Specs descrevem o **o quê** e o **por quê**; detalhes técnicos ficam no plano (`plan.md`).
- Mudanças de escopo MUST atualizar a spec antes de alterar código.
- **Rationale**: Obras públicas exigem rastreabilidade de requisitos e decisões desde a origem.

### II. Frontend React + TypeScript

O frontend MUST ser implementado em React com TypeScript estrito.

- Código de UI reside em `frontend/` com tipagem explícita (sem `any` não justificado).
- Componentes MUST ser reutilizáveis, acessíveis e responsivos.
- Estado de apresentação pode existir no frontend; regras de negócio MUST NOT.
- **Rationale**: Consistência tecnológica, segurança de tipos e manutenibilidade da interface.

### III. Design System Compliance

A UI MUST seguir o design system definido em `frontend/DESIGN.md` (exportado via getdesign.md).

- Tokens de cor, tipografia, espaçamento e componentes MUST ser respeitados.
- Desvios MUST ser documentados na spec/plano com justificativa.
- Novos padrões visuais MUST ser incorporados ao `DESIGN.md` antes de uso amplo.
- **Rationale**: Identidade visual consistente e experiência previsível para operadores públicos.

### IV. Backend Separado do Frontend

Backend e frontend MUST ser projetos independentes, comunicando-se apenas via API.

- Backend reside em `api/`; frontend em `frontend/`.
- Contratos de API MUST ser versionados e documentados (OpenAPI ou equivalente).
- Frontend MUST NOT acessar banco de dados diretamente.
- **Rationale**: Separação de responsabilidades, deploy independente e segurança.

### V. PostgreSQL como Banco de Dados

O sistema MUST usar PostgreSQL como banco de dados relacional principal.

- Schema MUST ser versionado via migrations (ex.: Prisma Migrate).
- Ambiente local MUST usar o serviço definido em `docker/docker-compose.yml`.
- Integridade referencial e constraints MUST ser aplicadas no banco, não apenas na aplicação.
- **Rationale**: Consistência transacional, auditoria e confiabilidade para dados públicos.

### VI. Regras de Negócio no Backend (NON-NEGOTIABLE)

Toda regra de negócio MUST residir no backend; telas React MUST NOT implementar lógica decisória.

- Validações de domínio, cálculos, elegibilidade e workflows MUST ser executados no backend.
- Frontend pode formatar, exibir e coletar dados; decisões finais são do servidor.
- Duplicação de regras entre frontend e backend MUST NOT ocorrer (validações de UX são permitidas, mas não substituem o backend).
- **Rationale**: Fonte única de verdade, segurança contra manipulação client-side e conformidade.

### VII. Auditoria em Entidades Críticas

Todas as entidades críticas MUST ter trilha de auditoria completa.

- Entidades críticas incluem: contratos, obras, medições, custos, saldos, usuários, permissões e alterações financeiras.
- Cada operação MUST registrar: quem, quando, o quê, valor anterior e valor novo.
- Logs de auditoria MUST NOT ser editáveis ou apagáveis por usuários da aplicação.
- **Rationale**: Prestação de contas e investigação de irregularidades em gestão pública.

### VIII. Controle de Acesso por Perfil e Permissão

O sistema MUST implementar autorização baseada em perfis e permissões granulares.

- Cada endpoint e ação sensível MUST verificar permissão no backend.
- Perfis MUST ser configuráveis; permissões MUST seguir princípio do menor privilégio.
- Frontend pode ocultar ações não autorizadas, mas MUST NOT confiar nisso como controle de segurança.
- **Rationale**: Proteção de dados sensíveis e segregação de funções em ambiente público.

### IX. Rastreabilidade Financeira

Custos, saldos e medições MUST ser totalmente rastreáveis de ponta a ponta.

- Cada valor MUST ter origem identificável (documento, medição, contrato, lançamento).
- Histórico de alterações MUST ser consultável com linha do tempo.
- Relatórios MUST permitir reconciliação entre saldo, lançamentos e documentos de origem.
- **Rationale**: Transparência e controle orçamentário exigidos em obras públicas.

### X. Integridade Financeira — Sem Exclusão Física (NON-NEGOTIABLE)

Alterações financeiras MUST NOT ser apagadas fisicamente do banco de dados.

- Exclusões MUST ser lógicas (soft delete) ou reversíveis via estorno/contra-lançamento.
- Registros financeiros MUST permanecer consultáveis mesmo após "cancelamento".
- Operações de estorno MUST gerar novos registros vinculados ao original.
- **Rationale**: Impossibilitar ocultação de movimentações e garantir integridade contábil.

### XI. Dashboards com Dados Consolidados e Verificáveis

Dashboards MUST consumir dados consolidados, auditáveis e verificáveis.

- Métricas MUST ser calculadas a partir de fontes rastreáveis (não valores hardcoded ou cache stale sem TTL).
- Indicadores MUST permitir drill-down até o registro de origem.
- Discrepâncias entre dashboard e relatório detalhado MUST ser investigáveis.
- **Rationale**: Decisões gerenciais baseadas em dados confiáveis e auditáveis.

## Stack & Architecture Constraints

| Camada | Tecnologia / Local | Regra |
|--------|-------------------|-------|
| Frontend | React + TypeScript (`frontend/`) | UI e interação apenas |
| Backend | API REST/JSON (`api/`) | Regras de negócio, autorização, auditoria |
| Banco | PostgreSQL (`docker/docker-compose.yml`) | Migrations versionadas, constraints |
| Design | `frontend/DESIGN.md` | Tokens e padrões visuais obrigatórios |
| Specs | `specs/[###-feature]/` | Origem de toda feature |

## Development Workflow

1. **Constitution** — princípios deste documento (baseline).
2. **Specify** (`/speckit-specify`) — spec funcional com user stories e requisitos.
3. **Plan** (`/speckit-plan`) — plano técnico com Constitution Check aprovado.
4. **Tasks** (`/speckit-tasks`) — tarefas acionáveis por user story.
5. **Implement** (`/speckit-implement`) — código conforme spec, plano e constitution.

**Quality gates obrigatórios antes de merge:**

- Spec e plano existem e estão atualizados.
- Regras de negócio implementadas no backend com testes.
- Auditoria e permissões aplicadas em entidades/endpoints críticos.
- UI conforme `frontend/DESIGN.md`.
- Dados financeiros com rastreabilidade e sem exclusão física.

## Governance

Esta constitution é a autoridade máxima de governança do projeto. Em caso de conflito entre documentos, práticas ad hoc ou código existente, **esta constitution prevalece**.

**Emenda**:

1. Propor alteração com justificativa e impacto nos templates/specs ativas.
2. Incrementar versão conforme semver (MAJOR: remoção/redefinição; MINOR: novo princípio; PATCH: clarificação).
3. Atualizar `.specify/memory/constitution.md` e propagar para templates dependentes.
4. Revisar specs/planos em andamento para conformidade.

**Compliance**:

- Todo PR MUST verificar aderência aos princípios aplicáveis.
- Violações MUST ser documentadas em Complexity Tracking do plano ou corrigidas antes do merge.
- Revisões periódicas MUST ocorrer a cada release ou emenda significativa.

**Version**: 1.0.0 | **Ratified**: 2026-05-28 | **Last Amended**: 2026-05-28
