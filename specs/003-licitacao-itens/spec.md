# Feature Specification: Spec 03 — Licitações e Importação de Itens

**Feature Branch**: `003-licitacao-itens`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Spec 03 — Usuário tenant cadastra licitação e importa itens (produtos ou serviços) via planilha ou colunas em textarea (categoria opcional, descrição, unidade de medida, valor opcional). Instruções claras de upload. Textareas devem ter o mesmo número de linhas para permitir cadastro. Itens podem ser desativados. Auditoria com data de cadastro e usuário responsável."

**Constitution**: MUST comply with `.specify/memory/constitution.md` (Gestão de Obras Públicas). Specs define *what* and *why* only — no implementation stack unless required for constraints (React/TS frontend, PostgreSQL backend, audit, RBAC, soft delete).

**Depends on**:

- [Spec 01 — Cadastro de Entidades (Tenants)](../001-tenant-entities/spec.md) — entidade ativa como contexto de isolamento.
- [Spec 02 — Base do Sistema e Usuários (Tenant)](../002-system-base-users/spec.md) — autenticação tenant, RBAC, layout administrativo e auditoria tenant.

**Blocks**: Specs futuras de contratos, obras e medições que consumirão itens de licitação como base cadastral.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar Licitação no Tenant (Priority: P1)

Como usuário autorizado da entidade, quero cadastrar uma licitação com dados identificadores para organizar a importação de itens (produtos ou serviços) daquela licitação.

**Why this priority**: A licitação é o agregador de itens; sem ela não há contexto para importação nem rastreabilidade posterior.

**Independent Test**: Autenticar no tenant, criar licitação com campos obrigatórios e verificar que ela aparece na listagem da entidade com status ativo e metadados de cadastro.

**Acceptance Scenarios**:

1. **Given** usuário tenant autenticado com permissão de gestão de licitações, **When** cadastra licitação com identificação e objeto/descrição resumida, **Then** a licitação é criada vinculada à entidade corrente e fica disponível para importação de itens.
2. **Given** usuário sem permissão de gestão, **When** tenta cadastrar licitação, **Then** a operação é negada no servidor.
3. **Given** campos obrigatórios ausentes ou inválidos, **When** submete o formulário, **Then** o cadastro é bloqueado com indicação clara dos campos incorretos.
4. **Given** licitação criada, **When** consulta detalhes, **Then** visualiza data de cadastro e nome do usuário que cadastrou.
5. **Given** criação bem-sucedida, **When** a operação conclui, **Then** auditoria tenant registra ação, ator, entidade, timestamp e dados da licitação.

---

### User Story 2 - Importar Itens via Planilha (Priority: P2)

Como usuário autorizado, quero importar itens de uma licitação a partir de planilha para agilizar o cadastro em massa de produtos ou serviços.

**Why this priority**: Importação em lote é o principal ganho operacional desta spec e reduz erro manual em licitações com muitos itens.

**Independent Test**: Na tela de uma licitação existente, fazer upload de planilha válida e verificar itens criados com mapeamento correto das colunas.

**Acceptance Scenarios**:

1. **Given** licitação ativa e planilha no formato aceito, **When** usuário faz upload seguindo as instruções exibidas na tela, **Then** o sistema importa os itens vinculados à licitação.
2. **Given** planilha com colunas `categoria`, `descricao`, `unidade`, `valor`, **When** importação é processada, **Then** cada linha vira um item com os campos correspondentes (`categoria` e `valor` podem ficar vazios quando opcionais).
3. **Given** planilha sem coluna `categoria` ou `valor`, **When** importação é processada, **Then** itens são criados com esses campos nulos/vazios, desde que `descricao` e `unidade` estejam preenchidos.
4. **Given** planilha com linhas inválidas (ex.: descrição ou unidade ausente), **When** importação é processada, **Then** o sistema rejeita a importação ou reporta linhas com erro sem persistir lote parcial inconsistente (decisão: rejeitar lote inteiro se houver erro de validação — ver Assumptions).
5. **Given** importação bem-sucedida, **When** conclui, **Then** auditoria registra quantidade de itens importados, usuário responsável, data/hora e licitação afetada.
6. **Given** tela de importação, **When** usuário acessa, **Then** vê instruções claras: formato aceito, colunas esperadas, exemplo de cabeçalho, ordem das colunas e link para modelo de planilha para download.

---

### User Story 3 - Importar Itens via Colunas em Textarea (Priority: P2)

Como usuário autorizado, quero colar conteúdo em textareas separados por coluna (uma linha = um item) para importar itens sem depender de arquivo, com validação rigorosa de alinhamento entre colunas.

**Why this priority**: Oferece alternativa acessível quando o usuário copia dados de outro sistema ou documento, mantendo a mesma estrutura da planilha.

**Independent Test**: Na licitação, preencher textareas de colunas com o mesmo número de linhas e confirmar criação de itens; repetir com contagem divergente e verificar bloqueio.

**Acceptance Scenarios**:

1. **Given** licitação ativa, **When** usuário cola linhas em textareas de `descricao` e `unidade` (obrigatórios) e opcionalmente `categoria` e `valor`, **Then** cada linha na mesma posição compõe um item.
2. **Given** textareas com quantidades de linhas diferentes entre colunas informadas, **When** tenta confirmar importação, **Then** o sistema bloqueia o cadastro e exibe mensagem indicando quais colunas divergem e quantas linhas cada uma possui.
3. **Given** colunas opcionais não utilizadas, **When** usuário não preenche textarea de `categoria` ou `valor`, **Then** essas colunas são ignoradas na composição dos itens (não exigem textarea).
4. **Given** coluna opcional utilizada parcialmente, **When** possui número de linhas diferente das colunas obrigatórias, **Then** importação é bloqueada pela regra de paridade de linhas.
5. **Given** linhas em branco no fim de um textarea, **When** usuário confirma, **Then** linhas vazias são ignoradas no cálculo de paridade e na criação de itens.
6. **Given** importação via textarea bem-sucedida, **When** conclui, **Then** itens ficam visíveis na listagem da licitação e auditoria registra operação com usuário e timestamp.

---

### User Story 4 - Consultar Licitações e Itens (Priority: P3)

Como usuário autorizado, quero listar licitações da entidade e visualizar os itens importados de cada licitação para consulta operacional.

**Why this priority**: Consulta é necessária para validar importações e apoiar etapas futuras (contratos, obras).

**Independent Test**: Listar licitações, abrir detalhe e ver tabela de itens ativos com filtros básicos.

**Acceptance Scenarios**:

1. **Given** licitações cadastradas no tenant, **When** usuário acessa listagem, **Then** vê identificação, objeto resumido, quantidade de itens ativos e data de cadastro.
2. **Given** licitação com itens, **When** abre detalhe, **Then** visualiza tabela com categoria, descrição, unidade, valor (quando informado) e status do item.
3. **Given** listagem de itens, **When** filtra por descrição ou categoria, **Then** resultados respeitam o tenant e a licitação selecionada.
4. **Given** usuário com permissão apenas de visualização, **When** acessa listagens, **Then** consulta é permitida sem ações de importação ou desativação.

---

### User Story 5 - Desativar Itens de Licitação (Priority: P3)

Como usuário autorizado, quero desativar itens que não devem mais ser exibidos ou reutilizados, preservando histórico e auditoria.

**Why this priority**: Itens desatualizados ou incorretos não devem ser apagados fisicamente em contexto público; desativação lógica mantém rastreabilidade.

**Independent Test**: Desativar item e verificar que some das listagens padrão mas permanece consultável em visão administrativa/histórico conforme permissão.

**Acceptance Scenarios**:

1. **Given** item ativo, **When** usuário autorizado desativa, **Then** status muda para inativo e item deixa de aparecer nas listagens operacionais padrão.
2. **Given** item inativo, **When** usuário consulta visão com filtro "incluir inativos", **Then** item permanece consultável com indicação de status.
3. **Given** desativação, **When** conclui, **Then** auditoria registra ator, entidade, licitação, item, timestamp e status anterior/novo.
4. **Given** item já desativado, **When** tenta desativar novamente, **Then** operação é idempotente ou informa que item já está inativo.
5. **Given** usuário sem permissão de gestão, **When** tenta desativar item, **Then** operação negada no servidor.

---

### Edge Cases

- Planilha vazia ou só com cabeçalho → rejeitar com mensagem clara.
- Planilha com colunas fora de ordem mas cabeçalhos reconhecíveis → mapear por nome de coluna (não só posição fixa).
- Cabeçalhos em variações comuns (`descrição` / `descricao`, `unidade` / `unidade de medida`) → normalizar no backend.
- Valor com vírgula decimal (`1.234,56`) ou ponto → normalizar conforme locale pt-BR no backend.
- Textarea com linhas contendo apenas espaços → tratar como linha vazia.
- Importação duplicada na mesma licitação → permitir (itens distintos); usuário desativa duplicatas manualmente nesta spec.
- Licitação de outro tenant acessada por URL → negado no servidor.
- Entidade inativa → bloquear importação e cadastro.
- Arquivo planilha corrompido ou formato não suportado → erro amigável com orientação para usar modelo ou textarea.
- Item com descrição muito longa → validar limite máximo definido no plano e rejeitar linha inválida.

## Requirements *(mandatory)*

### Functional Requirements

**Contexto e isolamento**

- **FR-001**: Toda licitação e item MUST pertencer a exatamente uma **Entidade (tenant)**.
- **FR-002**: Toda operação MUST validar sessão tenant e `entityId` no servidor (Spec 02).
- **FR-003**: Sistema MUST impedir acesso cross-tenant a licitações e itens.

**Licitação**

- **FR-004**: Sistema MUST permitir cadastro de licitação no ambiente tenant com campos obrigatórios mínimos: **identificação** (ex.: número/processo) e **objeto/descrição resumida**.
- **FR-005**: Licitação MUST possuir status (ativo/inativo) — desativação lógica; exclusão física MUST NOT ser permitida nesta spec.
- **FR-006**: Licitação MUST registrar **data de cadastro** e **usuário que cadastrou** (metadados imutáveis de criação).
- **FR-007**: Usuário autorizado MUST poder listar e consultar licitações da entidade corrente.

**Item de licitação**

- **FR-008**: Item MUST estar vinculado a uma licitação e à entidade tenant.
- **FR-009**: Item MUST possuir campos: **descrição** (obrigatório), **unidade de medida** (obrigatório), **categoria** (opcional), **valor unitário** (opcional).
- **FR-010**: Item MUST possuir status **ativo/inativo**; itens inativos MUST NOT aparecer em listagens operacionais padrão.
- **FR-011**: Item MUST registrar **data de cadastro** e **usuário que cadastrou** no momento da criação (importação ou cadastro unitário futuro).
- **FR-012**: Exclusão física de itens MUST NOT ser permitida; desativação lógica MUST ser usada.

**Importação via planilha**

- **FR-013**: Sistema MUST aceitar importação de itens via upload de planilha (.csv, .xlsx) vinculada a uma licitação.
- **FR-014**: Planilha MUST suportar colunas: `categoria` (opcional), `descricao` (obrigatório), `unidade` (obrigatório), `valor` (opcional).
- **FR-015**: Interface MUST exibir **instruções claras** de importação: colunas aceitas, obrigatoriedade, exemplo, formato de arquivo e **modelo para download**.
- **FR-016**: Validação de planilha MUST ocorrer no **backend**; frontend pode pré-validar apenas para UX.
- **FR-017**: Linhas sem `descricao` ou `unidade` MUST ser rejeitadas com indicação de número da linha.
- **FR-018**: Importação MUST ser **atômica por operação**: se qualquer linha falhar validação, nenhum item daquele lote MUST ser persistido (rollback).

**Importação via textarea (colunas)**

- **FR-019**: Sistema MUST oferecer modo alternativo de importação com **textarea por coluna** informada.
- **FR-020**: Cada linha não vazia em um textarea MUST corresponder a um item na mesma posição das demais colunas informadas.
- **FR-021**: Sistema MUST **bloquear** confirmação quando textareas de colunas informadas tiverem **quantidade de linhas diferentes** (após ignorar linhas vazias finais).
- **FR-022**: Mensagem de erro MUST indicar colunas divergentes e contagem de linhas de cada uma.
- **FR-023**: Colunas opcionais (`categoria`, `valor`) MUST ser exigidas na paridade **somente se** o usuário tiver preenchido aquele textarea (coluna utilizada).

**Autorização (RBAC)**

- **FR-024**: Sistema MUST introduzir permissões tenant granulares, no mínimo: `licitacoes.view`, `licitacoes.manage`, `licitacoes.items.import`, `licitacoes.items.deactivate`.
- **FR-025**: Perfil **Administrador** MUST possuir todas as permissões de licitações.
- **FR-026**: Perfil **Engenheiro/Fiscal** MUST possuir `licitacoes.view` e `licitacoes.items.import` (consulta + importação); desativação conforme matriz no plano.
- **FR-027**: Perfil **Operador** MUST possuir `licitacoes.view` por padrão; importação/desativação negadas salvo ajuste futuro de matriz.
- **FR-028**: Validação de permissões MUST ocorrer no servidor em todos os endpoints.

**Interface e navegação**

- **FR-029**: Módulo MUST ser acessível no menu lateral tenant (Spec 02) para usuários com `licitacoes.view`.
- **FR-030**: Telas MUST seguir `frontend/DESIGN.md` e layout administrativo tenant existente.
- **FR-031**: Fluxo de importação MUST permitir alternar entre **upload de planilha** e **colunas textarea** na mesma licitação.

**Auditoria**

- **FR-032**: Sistema MUST auditar: criação de licitação, importação de itens (planilha e textarea), desativação de item e desativação de licitação.
- **FR-033**: Cada registro MUST conter: **entidade**, **ator (usuário)**, **timestamp**, **ação**, **recurso** (licitação/item), **valores anterior/novo** quando aplicável.
- **FR-034**: Registros de auditoria MUST NOT ser editáveis ou excluíveis por usuários.
- **FR-035**: Metadados de criação em licitação/item (`createdAt`, `createdBy`) MUST ser consultáveis na interface de detalhe.

### Key Entities

- **Licitação**: Processo licitatório cadastrado no tenant. Atributos: entidade_id, identificação (número/processo), objeto/descrição, status, created_at, created_by_user_id, updated_at.
- **Item de Licitação**: Produto ou serviço vinculado a uma licitação. Atributos: licitação_id, entidade_id, categoria (opcional), descrição, unidade_medida, valor_unitario (opcional), status (ativo/inativo), created_at, created_by_user_id.
- **Lote de Importação** (conceitual): Operação de importação (planilha ou textarea). Atributos: licitação_id, origem (arquivo|textarea), quantidade_itens, usuário, timestamp — registrada em auditoria (persistência dedicada opcional no plano).
- **Registro de Auditoria (Tenant)**: Trilha imutável com entidade_id obrigatório (Spec 02).

### Importação — Referência para Usuário *(informativo na UI)*

Modelo de planilha esperado:

| categoria | descricao | unidade | valor |
|-----------|-----------|---------|-------|
| Material de construção | Cimento Portland CP II | saco 50kg | 32,50 |
| Serviço | Execução de alvenaria | m² | 85,00 |

- **categoria**: opcional; agrupamento/classificação do item.
- **descricao**: obrigatório; nome ou especificação do produto/serviço.
- **unidade**: obrigatório; unidade de medida (ex.: `un`, `m²`, `kg`, `h`).
- **valor**: opcional; valor unitário de referência; aceitar formato decimal pt-BR.

Modo textarea: uma coluna por textarea; cada **linha** = um item; todas as colunas preenchidas devem ter o **mesmo número de linhas**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuário autorizado cadastra licitação e importa planilha de 50 itens válidos em menos de 5 minutos (incluindo download do modelo).
- **SC-002**: 100% das tentativas de importação com textareas de contagem de linhas divergente são bloqueadas no servidor.
- **SC-003**: 100% dos itens importados registram usuário e data de cadastro consultáveis.
- **SC-004**: 100% das desativações de item geram auditoria com ator e entidade identificados.
- **SC-005**: Instruções de importação visíveis na tela permitem conclusão sem suporte externo em teste com usuário novo (tarefa observada).
- **SC-006**: Zero vazamento cross-tenant em testes de acesso direto a licitações/itens por ID.
- **SC-007**: Itens inativos não aparecem em 100% das listagens operacionais padrão testadas.

## Assumptions

- Rotas tenant usam identificador UUID da entidade (`/t/{entityId}/...`), conforme implementação atual das Specs 01/02.
- Formatos de planilha aceitos: **CSV (UTF-8)** e **XLSX**; modelo oficial disponível para download em ambos formatos.
- Importação é **atômica**: falha em uma linha invalida todo o lote (evita inconsistência parcial).
- Valores monetários são armazenados como decimal; formatação pt-BR na UI; validação no backend.
- Unidades de medida são texto livre nesta spec (catálogo padronizado fica para spec futura).
- Licitação não executa fase externa do processo licitatório (publicação, disputa, homologação) — apenas cadastro e itens.
- Cadastro manual unitário de item (sem importação) fica fora do escopo; foco em importação em lote.
- Idioma: **português (Brasil)**.
- Permissões novas serão adicionadas ao seed RBAC tenant (Spec 02) no plano de implementação.

## Out of Scope

- Publicação oficial, integração PNCP/compras.gov ou sistemas externos de licitação.
- Edição em massa ou reimportação que substitua itens existentes (merge/sync).
- Reativação de itens desativados (pode entrar em spec futura).
- Vinculação de itens a contratos, obras ou medições (specs futuras).
- Catálogo nacional de unidades de medida ou categorias padronizadas.
- Workflow de aprovação multi-nível da importação.
- OCR ou importação de PDF.
