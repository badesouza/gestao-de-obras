# Feature Specification: Spec 02 — Base do Sistema e Usuários (Tenant)

**Feature Branch**: `002-system-base-users`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Spec 02 — Base do sistema e usuários dentro de uma entidade (tenant). Autenticação, níveis de acesso, perfis, permissões, layout administrativo, sidebar, menu e proteção de rotas. Perfis iniciais: Administrador, Engenheiro/Fiscal, Operador. Todos os usuários e operações são escopados à entidade."

**Constitution**: MUST comply with `.specify/memory/constitution.md` (Gestão de Obras Públicas). Specs define *what* and *why* only — no implementation stack unless required for constraints (React/TS frontend, PostgreSQL backend, audit, RBAC, financial traceability).

**Depends on**: [Spec 01 — Cadastro de Entidades (Tenants)](../001-tenant-entities/spec.md) — entidade ativa e slug de acesso devem existir antes de provisionar usuários.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Autenticação Segura no Contexto da Entidade (Priority: P1)

Como usuário cadastrado em uma entidade, quero autenticar pelo link exclusivo da minha entidade para acessar apenas os dados e funcionalidades daquele tenant.

**Why this priority**: Autenticação tenant-scoped é o alicerce de isolamento multi-tenant; sem ela não há segurança nem auditoria confiável por entidade.

**Independent Test**: Pode ser testado acessando `/t/{slug}/login`, autenticando com credenciais válidas/inválidas e verificando que a sessão carrega contexto da entidade correta.

**Acceptance Scenarios**:

1. **Given** entidade ativa e usuário ativo vinculado a ela, **When** acessa o link exclusivo da entidade e autentica com e-mail e senha corretos, **Then** é autenticado no contexto da entidade e redirecionado à área administrativa tenant.
2. **Given** credenciais corretas de usuário de outra entidade, **When** tenta login no link de entidade A, **Then** acesso é negado (usuário não pertence ao tenant).
3. **Given** entidade inativa, **When** usuário tenta autenticar pelo link da entidade, **Then** recebe mensagem de suspensão e login é bloqueado.
4. **Given** um usuário autenticado no tenant A, **When** encerra sessão, **Then** perde acesso e retorna ao login da entidade A.
5. **Given** sessão expirada, **When** tenta acessar rota protegida, **Then** é redirecionado ao login da mesma entidade preservando slug.

---

### User Story 2 - Layout Administrativo e Navegação Tenant (Priority: P2)

Como usuário autenticado, quero layout administrativo consistente (sidebar, menu, cabeçalho) que identifique claramente a entidade em que opero.

**Why this priority**: Estrutura visual uniforme e contexto de entidade visível reduzem erros operacionais em ambiente multi-tenant.

**Independent Test**: Pode ser testado com sessão autenticada tenant, verificando layout, nome da entidade no cabeçalho, menu responsivo e conformidade com DESIGN.md.

**Acceptance Scenarios**:

1. **Given** usuário autenticado, **When** acessa rotas internas do tenant, **Then** vê layout com sidebar, menu, cabeçalho exibindo nome da entidade, nome/perfil do usuário e logout.
2. **Given** viewport mobile (< 768px), **When** abre menu, **Then** sidebar colapsa em drawer utilizável (alvos mín. 44px).
3. **Given** item de menu ativo, **When** navega entre páginas, **Then** item permanece destacado.
4. **Given** identidade visual, **When** telas administrativas são exibidas, **Then** seguem `frontend/DESIGN.md`.
5. **Given** usuário autenticado no tenant A, **When** visualiza cabeçalho, **Then** NÃO vê opções de gestão de entidades (reservadas à Spec 01 / área plataforma).

---

### User Story 3 - Proteção de Rotas por Permissão e Tenant (Priority: P3)

Como gestor da entidade, quero que rotas e dados sejam protegidos por perfil e isolados por tenant, impedindo acesso cruzado entre entidades.

**Why this priority**: RBAC + isolamento tenant são requisitos constitucionais em sistema público multi-órgão.

**Independent Test**: Autenticar perfis diferentes no mesmo tenant e tentar acessar rotas/dados de outro tenant via URL ou API.

**Acceptance Scenarios**:

1. **Given** usuário sem permissão para rota, **When** acessa URL diretamente, **Then** recebe 403 ou redirecionamento seguro sem expor dados.
2. **Given** usuário Operador, **When** visualiza menu, **Then** vê apenas itens permitidos ao seu perfil dentro do tenant.
3. **Given** usuário Engenheiro/Fiscal, **When** tenta gestão de usuários, **Then** acesso negado no servidor.
4. **Given** usuário autenticado no tenant A, **When** tenta acessar recurso do tenant B (mesmo conhecendo ID), **Then** acesso negado no servidor.
5. **Given** tentativa de acesso negado ou cross-tenant, **When** ocorre, **Then** auditoria registra ator, entidade, rota/ação e resultado.

---

### User Story 4 - Gestão de Usuários e Perfis dentro da Entidade (Priority: P4)

Como Administrador da entidade, quero cadastrar, editar e desativar usuários do meu tenant e atribuir perfis, sem afetar outras entidades.

**Why this priority**: Operação contínua de cada órgão depende de administração local de contas escopada ao tenant.

**Independent Test**: Login como Administrador tenant, CRUD de usuários, verificação de que usuários só existem/valem na entidade corrente.

**Acceptance Scenarios**:

1. **Given** Administrador tenant autenticado, **When** cadastra usuário com nome, e-mail, perfil e senha, **Then** usuário é vinculado à entidade corrente e consegue autenticar pelo link da entidade.
2. **Given** e-mail já usado na mesma entidade, **When** tenta cadastrar outro usuário, **Then** cadastro é rejeitado.
3. **Given** e-mail usado em outra entidade, **When** cadastra na entidade corrente, **Then** cadastro é permitido (unicidade é por tenant).
4. **Given** usuário existente, **When** Administrador altera perfil, **Then** permissões mudam na próxima requisição autenticada no mesmo tenant.
5. **Given** desativação de usuário, **When** confirma, **Then** sessões invalidadas e login bloqueado na entidade; auditoria registrada com contexto tenant.

---

### Edge Cases

- Slug de entidade inexistente na URL → página de entidade não encontrada (404), sem expor existência de outros tenants.
- Usuário tenta trocar slug na URL manualmente após login → sessão invalidada ou acesso negado se slug ≠ tenant da sessão.
- Último Administrador ativo do tenant → desativação bloqueada.
- E-mail duplicado no mesmo tenant → rejeitar com mensagem clara.
- Entidade desativada com sessões ativas → invalidação imediata de sessões tenant.
- Bootstrap: entidade recém-criada sem usuários → primeiro Administrador tenant criado pelo operador de plataforma ou seed por entidade (ver Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

**Multi-tenancy e contexto**

- **FR-001**: Todo usuário, sessão, permissão e dado operacional MUST pertencer a exatamente uma **Entidade (tenant)**.
- **FR-002**: Sistema MUST autenticar usuários tenant exclusivamente pelo **link exclusivo da entidade** (ex.: `/t/{slug}/login`).
- **FR-003**: Sistema MUST carregar contexto de entidade em toda sessão autenticada tenant e validá-lo em cada requisição.
- **FR-004**: Sistema MUST impedir acesso cross-tenant em rotas, consultas e mutações — isolamento MUST ser enforced no servidor.
- **FR-005**: Sistema MUST bloquear operações tenant quando entidade estiver inativa (Spec 01).

**Autenticação e Sessão**

- **FR-006**: Sistema MUST permitir login tenant com e-mail e senha para usuários ativos da entidade.
- **FR-007**: Sistema MUST negar login se usuário não pertencer à entidade do link acessado.
- **FR-008**: Sistema MUST encerrar sessão (logout) invalidando credenciais no contexto tenant.
- **FR-009**: Sistema MUST expirar sessões inativas após período configurável (padrão: 8 horas).
- **FR-010**: Sistema MUST aplicar política mínima de senha: 8+ caracteres, ao menos uma letra e um número.
- **FR-011**: Sistema MUST bloquear login de usuários inativos.

**Layout e Navegação**

- **FR-012**: Sistema MUST exibir layout administrativo unificado (sidebar + cabeçalho + conteúdo) em rotas internas tenant autenticadas.
- **FR-013**: Cabeçalho MUST exibir nome da entidade e identificação do usuário (nome + perfil).
- **FR-014**: Menu lateral MUST refletir permissões efetivas do usuário no tenant corrente.
- **FR-015**: Navegação MUST ser responsiva (hamburger/drawer em mobile).
- **FR-016**: Interface MUST seguir `frontend/DESIGN.md`.

**Autorização (RBAC tenant)**

- **FR-017**: Sistema MUST suportar três perfis iniciais **por entidade**: Administrador, Engenheiro/Fiscal, Operador.
- **FR-018**: Permissões MUST ser granulares e escopadas ao tenant (ex.: `users.view`, `users.manage`).
- **FR-019**: Validação de permissões MUST ocorrer no servidor; ocultar menu no frontend NÃO substitui validação server-side.
- **FR-020**: Perfil **Administrador** (tenant) MUST gerenciar usuários e configurações base da entidade, sem acesso à gestão de entidades (Spec 01).
- **FR-021**: Perfil **Engenheiro/Fiscal** MUST acessar módulos operacionais/fiscais futuros, sem gestão de usuários.
- **FR-022**: Perfil **Operador** MUST acessar funcionalidades operacionais básicas, sem administração.

**Gestão de Usuários (tenant)**

- **FR-023**: Administrador tenant MUST listar, criar, editar e desativar usuários **da entidade corrente apenas**.
- **FR-024**: E-mail MUST ser único **dentro da entidade** (pode repetir entre entidades diferentes).
- **FR-025**: Administrador MUST atribuir exatamente um perfil por usuário.
- **FR-026**: Sistema MUST impedir desativação do último Administrador ativo do tenant.
- **FR-027**: Administrador MUST poder redefinir senha de usuários do tenant.

**Auditoria**

- **FR-028**: Auditoria MUST incluir contexto de entidade em todos os registros tenant.
- **FR-029**: Sistema MUST auditar: Usuário, Perfil, Permissão, tentativas de acesso negado e tentativas cross-tenant.
- **FR-030**: Registros MUST conter: ator, entidade, timestamp, ação, valores anterior/novo.
- **FR-031**: Registros de auditoria MUST NOT ser editáveis ou excluíveis por usuários.

**Rotas e Estrutura Base**

- **FR-032**: Rotas tenant MUST usar prefixo com slug da entidade (ex.: `/t/{slug}/...`).
- **FR-033**: Sistema MUST incluir dashboard placeholder tenant acessível a perfis autenticados.
- **FR-034**: Item de menu "Usuários" MUST ser visível apenas com permissão `users.view` ou superior.
- **FR-035**: Área de gestão de entidades (Spec 01) MUST NOT ser acessível por usuários tenant.

### Key Entities

- **Entidade (Tenant)**: Referenciada da Spec 01; contexto obrigatório de toda operação desta spec.
- **Usuário (Tenant)**: Pessoa com acesso a uma entidade. Atributos: entidade_id, nome, e-mail (único por entidade), senha, status, perfil, datas, último login.
- **Perfil**: Papel funcional por entidade. Valores iniciais: Administrador, Engenheiro/Fiscal, Operador. Escopo tenant.
- **Permissão**: Capacidade atômica escopada ao tenant. Atributos: código, descrição, módulo.
- **Sessão (Tenant)**: Contexto autenticado. Atributos: usuário, entidade, início, expiração, status.
- **Registro de Auditoria (Tenant)**: Trilha imutável com entidade_id obrigatório.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuário completa login tenant pelo link da entidade em menos de 30 segundos.
- **SC-002**: 100% das tentativas cross-tenant testadas são bloqueadas no servidor.
- **SC-003**: Administrador tenant cadastra usuário e este autentica na mesma entidade em menos de 3 minutos.
- **SC-004**: Menu exibe zero itens não autorizados em testes com 3 perfis no mesmo tenant.
- **SC-005**: 100% das operações de usuário e acessos negados geram auditoria com entidade identificada.
- **SC-006**: Layout utilizável em mobile (768px) com contexto de entidade visível.
- **SC-007**: Entidade inativa bloqueia 100% dos logins tenant testados.

## Assumptions

- Spec 01 já provisionou entidade ativa com slug antes de implementar esta spec.
- Primeiro **Administrador tenant** é criado pelo operador de plataforma ao provisionar entidade, ou via seed automático por entidade.
- Autenticação tenant via e-mail/senha; SSO fora do escopo.
- Recuperação de senha por e-mail fora do escopo; reset pelo Administrador tenant.
- Perfis e permissões são seed por entidade (mesmos três perfis iniciais replicados em cada tenant).
- Dashboard tenant é placeholder até specs de obras.
- Idioma: português (Brasil).
- Operador de plataforma (Spec 01) e usuários tenant são domínios de autenticação separados.

## Out of Scope

- CRUD de entidades / gestão de tenants (Spec 01).
- Módulos de obras, contratos, medições, financeiro.
- SSO, OAuth, 2FA.
- Recuperação automática de senha.
- Customização de perfis/permissões pela UI tenant.
- Usuário pertencente a múltiplas entidades simultaneamente.
