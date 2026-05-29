# Feature Specification: Spec 01 — Cadastro de Entidades (Tenants)

**Feature Branch**: `001-tenant-entities`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Spec 01 — Cadastro de entidades. Deve haver uma seção para cadastro de entidades; essas entidades serão os tenants para todo o sistema de gestão de obras; o usuário deve acessar um link específico para autenticação e realizar o CRUD de uma entidade."

**Constitution**: MUST comply with `.specify/memory/constitution.md` (Gestão de Obras Públicas). Specs define *what* and *why* only — no implementation stack unless required for constraints (React/TS frontend, PostgreSQL backend, audit, RBAC).

**Depends on**: Nenhuma (spec fundacional do sistema).

**Blocks**: [Spec 02 — Base do Sistema e Usuários](../002-system-base-users/spec.md) — usuários e dados operacionais são sempre escopados a uma entidade (tenant).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acesso à Área de Gestão de Entidades (Priority: P1)

Como operador da plataforma, quero acessar um link dedicado para autenticar e gerenciar entidades (tenants), separado do ambiente operacional das entidades.

**Why this priority**: O cadastro de tenants precede qualquer operação de obras; sem área dedicada não há como provisionar novos clientes/órgãos no sistema.

**Independent Test**: Pode ser testado acessando o link dedicado (`/platform` ou equivalente), autenticando com credencial de plataforma e verificando que a área de gestão de entidades é exibida — sem acesso ao ambiente tenant de obras.

**Acceptance Scenarios**:

1. **Given** um operador de plataforma com credenciais válidas, **When** acessa o link dedicado de autenticação da plataforma, **Then** autentica e é direcionado à área de gestão de entidades.
2. **Given** credenciais inválidas, **When** tenta autenticar na área de plataforma, **Then** recebe mensagem genérica de falha e permanece na tela de login.
3. **Given** um usuário autenticado apenas no ambiente de uma entidade (tenant), **When** tenta acessar a área de plataforma, **Then** o acesso é negado no servidor.
4. **Given** um operador de plataforma autenticado, **When** encerra a sessão, **Then** perde acesso imediato à área de gestão de entidades.
5. **Given** a identidade visual do projeto, **When** qualquer tela da área de plataforma é exibida, **Then** segue os tokens definidos em `frontend/DESIGN.md`.

---

### User Story 2 - Cadastrar Nova Entidade (Priority: P2)

Como operador de plataforma, quero cadastrar uma nova entidade (tenant) para que ela possa ser provisionada no sistema de gestão de obras com isolamento de dados.

**Why this priority**: Criação de tenants é o passo central desta spec; sem entidades cadastradas não há contexto para usuários ou obras.

**Independent Test**: Pode ser testado autenticando na área de plataforma, preenchendo formulário de cadastro e verificando que a entidade aparece na listagem com identificador único e status ativo.

**Acceptance Scenarios**:

1. **Given** um operador de plataforma autenticado, **When** cadastra entidade com nome, identificador (slug) e dados obrigatórios, **Then** a entidade é criada com status ativo e aparece na listagem.
2. **Given** um slug já existente, **When** tenta cadastrar nova entidade com o mesmo slug, **Then** o sistema rejeita com mensagem clara de duplicidade.
3. **Given** dados obrigatórios ausentes ou inválidos, **When** submete o formulário, **Then** o cadastro é bloqueado com indicação dos campos incorretos.
4. **Given** entidade recém-criada, **When** consulta detalhes, **Then** visualiza link de acesso exclusivo da entidade para login operacional (tenant URL).
5. **Given** criação bem-sucedida, **When** a operação conclui, **Then** fica registrada em auditoria com ator, timestamp e dados da entidade.

---

### User Story 3 - Consultar e Editar Entidades (Priority: P3)

Como operador de plataforma, quero listar, visualizar e editar entidades existentes para manter os dados cadastrais atualizados.

**Why this priority**: Manutenção cadastral é necessária após o provisionamento inicial; permite correções sem recriar tenants.

**Independent Test**: Pode ser testado listando entidades, abrindo detalhes, editando campos permitidos e verificando persistência e auditoria.

**Acceptance Scenarios**:

1. **Given** entidades cadastradas, **When** operador acessa listagem, **Then** vê nome, slug, status e data de criação com opção de busca/filtro por nome ou status.
2. **Given** uma entidade existente, **When** operador edita campos permitidos (nome, contato, configurações cadastrais), **Then** alterações são salvas e refletidas imediatamente.
3. **Given** uma entidade existente, **When** operador tenta alterar o slug, **Then** o sistema impede ou exige confirmação explícita com aviso de impacto em URLs (decisão no plano; por padrão: slug imutável após criação).
4. **Given** qualquer edição, **When** a operação conclui, **Then** auditoria registra valores anterior e novo.

---

### User Story 4 - Ativar e Desativar Entidades (Priority: P4)

Como operador de plataforma, quero ativar ou desativar entidades para controlar quais tenants podem operar no sistema.

**Why this priority**: Desativação permite suspender órgãos sem apagar dados históricos; essencial para governança multi-tenant.

**Independent Test**: Pode ser testado desativando entidade e verificando que login operacional (tenant) é bloqueado, enquanto dados permanecem consultáveis na plataforma.

**Acceptance Scenarios**:

1. **Given** entidade ativa, **When** operador desativa, **Then** status muda para inativo e novos logins no ambiente da entidade são bloqueados.
2. **Given** entidade inativa, **When** operador reativa, **Then** login operacional volta a ser permitido.
3. **Given** entidade desativada, **When** usuários tenant tentam autenticar, **Then** recebem mensagem informando suspensão da entidade.
4. **Given** desativação ou reativação, **When** a operação conclui, **Then** fica registrada em auditoria.
5. **Given** entidade com usuários ativos, **When** é desativada, **Then** sessões tenant existentes são invalidadas.

---

### Edge Cases

- Slug com caracteres inválidos ou reservados (`platform`, `admin`, `api`) → rejeitar na validação.
- Tentativa de excluir fisicamente entidade com dados operacionais → impedir; apenas desativação lógica permitida.
- Operador tenta acessar dados operacionais (obras, usuários) de um tenant pela área de plataforma → negado; plataforma gerencia apenas cadastro de entidades.
- Duas entidades com mesmo CNPJ (se informado) → alertar ou bloquear conforme política (padrão: alertar, permitir com confirmação — órgãos distintos podem compartilhar CNPJ em casos excepcionais).
- Entidade sem usuários cadastrados → permanece listável na plataforma; link tenant exibe login com mensagem orientando contato com administrador.

## Requirements *(mandatory)*

### Functional Requirements

**Área dedicada de plataforma**

- **FR-001**: Sistema MUST disponibilizar link/rota dedicada para autenticação na área de gestão de entidades, separada do login operacional de tenants (ex.: `/platform/login`).
- **FR-002**: Sistema MUST distinguir dois contextos de autenticação: **Operador de Plataforma** (gerencia entidades) e **Usuário Tenant** (opera dentro de uma entidade — Spec 02).
- **FR-003**: Credenciais de operador de plataforma MUST NOT permitir acesso ao ambiente operacional de tenants sem autenticação tenant separada.
- **FR-004**: Interface da área de plataforma MUST seguir `frontend/DESIGN.md`.

**Entidade (Tenant)**

- **FR-005**: Sistema MUST tratar **Entidade** como unidade de tenant — todo dado operacional futuro (usuários, obras, contratos, medições) MUST pertencer a exatamente uma entidade.
- **FR-006**: Sistema MUST permitir CRUD cadastral de entidades na área de plataforma (Create, Read, Update; Delete apenas lógico via desativação).
- **FR-007**: Cada entidade MUST possuir identificador único **slug** usado na URL de acesso operacional (ex.: `/t/{slug}/login` ou `{slug}.dominio/login`).
- **FR-008**: Cada entidade MUST possuir: nome/razão social, slug, status (ativo/inativo), data de criação e data de atualização.
- **FR-009**: Entidade MAY possuir campos opcionais: CNPJ, e-mail institucional, telefone, endereço/município.
- **FR-010**: Slug MUST ser único globalmente, imutável após criação e validado contra lista de slugs reservados.

**Operações CRUD**

- **FR-011**: Operador de plataforma MUST poder **criar** entidade com dados obrigatórios validados.
- **FR-012**: Operador de plataforma MUST poder **listar** entidades com busca por nome, slug e filtro por status.
- **FR-013**: Operador de plataforma MUST poder **visualizar** detalhes de entidade incluindo link de acesso tenant.
- **FR-014**: Operador de plataforma MUST poder **editar** dados cadastrais permitidos (exceto slug).
- **FR-015**: Operador de plataforma MUST poder **desativar/reativar** entidade; exclusão física MUST NOT ser permitida.

**Isolamento e provisionamento**

- **FR-016**: Entidade ativa MUST estar disponível para provisionamento de usuários e módulos operacionais (Spec 02 em diante).
- **FR-017**: Entidade inativa MUST bloquear autenticação e operações no ambiente tenant, preservando dados para consulta administrativa.
- **FR-018**: Sistema MUST exibir link de acesso exclusivo por entidade após cadastro, para repasse ao administrador tenant.

**Auditoria**

- **FR-019**: Sistema MUST registrar auditoria para: criação, edição, ativação e desativação de entidades.
- **FR-020**: Cada registro MUST conter: ator (operador de plataforma), timestamp, entidade afetada, ação, valores anterior/novo.
- **FR-021**: Registros de auditoria MUST NOT ser editáveis ou excluíveis por usuários da aplicação.

**Operador de plataforma**

- **FR-022**: Sistema MUST suportar perfil **Operador de Plataforma** com permissões exclusivas de gestão de entidades.
- **FR-023**: Operador de plataforma MUST NOT ter permissões operacionais de tenant (obras, medições, usuários tenant) por padrão.

### Key Entities

- **Entidade (Tenant)**: Órgão/organização pública que utiliza o sistema de gestão de obras. Atributos: nome, slug (único, imutável), status, CNPJ (opcional), contatos, datas. Raiz de isolamento de dados.
- **Operador de Plataforma**: Usuário com acesso à área dedicada de gestão de entidades. Distinto de usuários tenant (Spec 02). Atributos: nome, e-mail (único na plataforma), senha, status.
- **Registro de Auditoria (Plataforma)**: Trilha imutável de eventos na camada de plataforma. Atributos: ator, timestamp, entidade, ação, valores anterior/novo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operador de plataforma completa cadastro de nova entidade em menos de 3 minutos.
- **SC-002**: 100% das entidades ativas possuem slug único e link de acesso tenant gerado automaticamente.
- **SC-003**: Desativação de entidade bloqueia 100% das tentativas de login tenant testadas.
- **SC-004**: Zero vazamento de dados operacionais entre entidades em testes de isolamento (validação preparatória para Spec 02).
- **SC-005**: 100% das operações CRUD de entidade geram registro de auditoria consultável.
- **SC-006**: Área de plataforma permanece acessível apenas via link dedicado — usuários tenant não conseguem acessar CRUD de entidades.

## Assumptions

- **Operador de plataforma** é provisionado via seed/bootstrap na instalação inicial (similar ao admin tenant).
- Autenticação de plataforma via **e-mail e senha** na rota dedicada; SSO fica fora do escopo.
- Slug é gerado a partir do nome (com edição manual permitida no cadastro) e normalizado (minúsculas, hífens, sem acentos).
- Exclusão física de entidades não é permitida — apenas desativação lógica, alinhada ao princípio de integridade da constitution.
- CNPJ é opcional nesta spec; validação de formato quando informado.
- Multi-tenancy é **shared database, tenant-scoped data** (decisão técnica no plano; requisito funcional: isolamento lógico garantido).
- Idioma da interface: **português (Brasil)**.

## Out of Scope

- Gestão de usuários dentro de uma entidade (Spec 02).
- Módulos operacionais: obras, contratos, medições, financeiro.
- Billing/planos por entidade.
- Customização de branding por tenant (logo, cores).
- SSO/OAuth para operadores de plataforma.
- Self-service de cadastro de entidade (apenas operador de plataforma cadastra).
