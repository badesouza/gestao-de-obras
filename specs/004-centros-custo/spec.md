# Feature Specification: Spec 04 — Centros de Custo e Registro Diário

**Feature Branch**: `004-centros-custo`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "Spec 04 — Usuário tenant cadastra centros de custo vinculados a uma ou mais licitações para uso de itens. Centro de custo com nome, datas previstas e realizadas de início/fim. Propriedades reutilizáveis com tipos (string, data, money, item de licitação, etc.) associadas a um ou vários centros. Menu com listagem configurada; detalhe com cabeçalho da entidade/centro e abas: Registro Diário (grade estilo Excel com colunas=propriedades, primeira coluna=data, navegação por mês, edição por tipo incluindo seleção de item com busca), Painel de Desempenho (a definir), Produção Diária (agrupamento por dia: tarefas cadastradas, iniciadas e concluídas conforme propriedades do centro)."

**Constitution**: MUST comply with `.specify/memory/constitution.md` (Gestão de Obras Públicas). Specs define *what* and *why* only — no implementation stack unless required for constraints (React/TS frontend, PostgreSQL backend, audit, RBAC, soft delete).

**Depends on**:

- [Spec 01 — Cadastro de Entidades (Tenants)](../001-tenant-entities/spec.md) — entidade ativa como contexto de isolamento.
- [Spec 02 — Base do Sistema e Usuários (Tenant)](../002-system-base-users/spec.md) — autenticação tenant, RBAC, layout administrativo e auditoria tenant.
- [Spec 03 — Licitações e Importação de Itens](../003-licitacao-itens/spec.md) — licitações e itens ativos utilizados em propriedades do tipo item e no vínculo centro ↔ licitação.

**Blocks**: Specs futuras de medições, contratos, relatórios financeiros consolidados e Painel de Desempenho detalhado (KPIs avançados).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar Centro de Custo (Priority: P1)

Como usuário autorizado da entidade, quero cadastrar um centro de custo com nome, período previsto e realizado, para organizar o acompanhamento operacional de obras ou frentes de serviço.

**Why this priority**: O centro de custo é a unidade central desta spec; sem ele não há registro diário nem dashboards.

**Independent Test**: Autenticar no tenant, criar centro de custo com campos obrigatórios e verificar que aparece na listagem com status ativo e metadados de cadastro.

**Acceptance Scenarios**:

1. **Given** usuário autenticado com permissão de gestão de centros de custo, **When** cadastra centro com **nome** e datas previstas de início/fim, **Then** o centro é criado vinculado à entidade corrente.
2. **Given** centro criado, **When** informa datas **realizadas** de início e/ou fim, **Then** o sistema persiste e exibe essas datas no detalhe.
3. **Given** datas previstas informadas, **When** data de fim prevista é anterior à de início prevista, **Then** o cadastro é bloqueado com mensagem clara.
4. **Given** datas realizadas informadas, **When** data de fim realizada é anterior à de início realizada, **Then** o cadastro/atualização é bloqueado.
5. **Given** usuário sem permissão de gestão, **When** tenta cadastrar centro de custo, **Then** a operação é negada no servidor.
6. **Given** criação bem-sucedida, **When** conclui, **Then** auditoria registra ação, ator, entidade, timestamp e dados do centro.

---

### User Story 2 - Vincular Licitações ao Centro de Custo (Priority: P1)

Como usuário autorizado, quero associar uma ou mais licitações ativas a um centro de custo para utilizar os itens dessas licitações nos registros diários.

**Why this priority**: O vínculo com licitação habilita propriedades do tipo item e garante rastreabilidade entre execução e base licitatória.

**Independent Test**: No cadastro ou edição do centro, selecionar duas licitações ativas; ao usar propriedade tipo item no registro diário, itens de ambas devem aparecer na busca.

**Acceptance Scenarios**:

1. **Given** centro de custo e licitações ativas no tenant, **When** vincula uma ou mais licitações, **Then** associação é persistida e exibida na listagem/detalhe do centro.
2. **Given** licitação inativa ou de outro tenant, **When** tenta vincular, **Then** operação é rejeitada no servidor.
3. **Given** centro sem licitação vinculada, **When** tenta salvar configuração com propriedade tipo item de licitação, **Then** sistema bloqueia ou exige vínculo (decisão: bloquear configuração — ver Assumptions).
4. **Given** centro com licitações A e B, **When** usuário busca item em propriedade tipo item, **Then** resultados incluem apenas itens **ativos** das licitações vinculadas.
5. **Given** alteração de vínculos, **When** conclui, **Then** auditoria registra licitações anterior/novo conjunto.

---

### User Story 3 - Cadastrar Propriedades Reutilizáveis (Priority: P1)

Como usuário autorizado, quero cadastrar propriedades no catálogo da entidade (nome, tipo, configurações) para reutilizá-las em um ou vários centros de custo.

**Why this priority**: Propriedades compartilhadas evitam duplicação e padronizam colunas do registro diário entre centros.

**Independent Test**: Criar propriedades de tipos distintos (texto, data, valor, item); associar a dois centros; ambos exibem a mesma definição de coluna.

**Acceptance Scenarios**:

1. **Given** usuário com permissão de gestão de propriedades, **When** cadastra propriedade com **nome** e **tipo**, **Then** propriedade fica disponível no catálogo da entidade.
2. **Given** tipos suportados (`TEXTO`, `DATA`, `VALOR`, `ITEM_LICITACAO`, `ITENS_LICITACAO`, `BOOLEAN`), **When** seleciona tipo, **Then** interface de cadastro exibe ajuda contextual sobre uso da propriedade.
3. **Given** propriedade já usada em centros de custo, **When** altera **tipo**, **Then** operação é bloqueada (tipo imutável após uso) ou exige confirmação explícita conforme regra no plano.
4. **Given** propriedade cadastrada, **When** associa a múltiplos centros de custo, **Then** mesma definição é referenciada (não copiada) em cada centro.
5. **Given** propriedade desativada, **When** consulta centros existentes, **Then** deixa de estar disponível para novos registros, mas valores históricos permanecem consultáveis.

---

### User Story 4 - Configurar Propriedades do Centro de Custo (Priority: P2)

Como usuário autorizado, quero escolher quais propriedades do catálogo compõem o registro diário de um centro e definir a ordem das colunas (exceto a coluna fixa de data).

**Why this priority**: Cada centro pode ter conjunto e ordem de colunas adequados à sua operação, mantendo catálogo unificado.

**Independent Test**: No centro X, selecionar 4 propriedades em ordem definida; aba Registro Diário exibe colunas nessa ordem após a coluna Data.

**Acceptance Scenarios**:

1. **Given** catálogo de propriedades da entidade, **When** configura centro de custo selecionando propriedades e ordem, **Then** configuração é salva e refletida na grade do registro diário.
2. **Given** propriedade tipo item, **When** inclui no centro sem licitação vinculada, **Then** configuração é bloqueada com orientação para vincular licitação.
3. **Given** propriedades designadas como **marcador de início** ou **marcador de conclusão** (para Produção Diária), **When** salva configuração, **Then** no máximo uma propriedade por papel por centro (início/conclusão).
4. **Given** alteração de ordem das colunas, **When** salva, **Then** grade do registro diário atualiza ordem sem perder dados históricos.
5. **Given** remoção de propriedade da configuração do centro, **When** confirma, **Then** coluna deixa de aparecer para novos registros; dados antigos permanecem armazenados e consultáveis em histórico.

---

### User Story 5 - Registro Diário em Grade (Estilo Planilha) (Priority: P2)

Como usuário autorizado, quero registrar atividades diárias em uma grade onde as colunas são as propriedades configuradas, a primeira coluna é sempre a **data**, posso adicionar linhas, navegar entre meses e editar células conforme o tipo da propriedade.

**Why this priority**: Registro diário é a principal interface operacional solicitada e espelha o fluxo em planilha Excel.

**Independent Test**: Abrir detalhe do centro → aba Registro Diário → navegar para mês corrente → adicionar linha com data e valores → salvar → recarregar mês e ver linha persistida.

**Acceptance Scenarios**:

1. **Given** centro configurado com propriedades, **When** acessa aba **Registro Diário**, **Then** visualiza grade com **primeira coluna fixa "Data"** e demais colunas na ordem configurada.
2. **Given** grade exibida, **When** adiciona nova linha, **Then** linha editável é inserida e usuário preenche data e células das propriedades.
3. **Given** mês selecionado (ex.: maio/2026), **When** navega **avançar/retroceder** mês, **Then** grade exibe apenas registros daquele mês calendário e permite continuar edição.
4. **Given** célula tipo **TEXTO**, **When** edita, **Then** aceita texto livre dentro do limite definido no plano.
5. **Given** célula tipo **DATA**, **When** edita, **Then** usa seletor/input de data validado.
6. **Given** célula tipo **VALOR**, **When** edita, **Then** aceita formato monetário pt-BR e valida no servidor.
7. **Given** célula tipo **ITEM_LICITACAO**, **When** edita, **Then** abre busca com campo de pesquisa listando itens ativos das licitações vinculadas ao centro.
8. **Given** célula tipo **ITENS_LICITACAO**, **When** edita, **Then** permite selecionar múltiplos itens com busca (mesma origem de licitações vinculadas).
9. **Given** célula tipo **BOOLEAN**, **When** edita, **Then** exibe controle sim/não (checkbox ou equivalente acessível).
10. **Given** linha sem data ou com data inválida, **When** tenta salvar, **Then** operação é bloqueada indicando a linha/campo.
11. **Given** alteração em célula, **When** salva, **Then** auditoria registra alteração do registro diário (ator, timestamp, valores relevantes).
12. **Given** usuário com permissão apenas de visualização, **When** acessa aba, **Then** grade é somente leitura.

---

### User Story 6 - Produção Diária (Dashboard por Dia) (Priority: P2)

Como usuário autorizado, quero visualizar na aba **Produção Diária** um resumo agrupado por dia com quantidade de tarefas cadastradas, iniciadas e concluídas, com base nos registros diários e nas propriedades marcadoras do centro.

**Why this priority**: Consolida operação diária em indicadores simples para acompanhamento gerencial imediato.

**Independent Test**: Inserir 3 registros no mesmo dia, marcar 2 como iniciados e 1 como concluído via propriedades configuradas; aba Produção Diária deve refletir contagens corretas.

**Acceptance Scenarios**:

1. **Given** registros diários no mês, **When** acessa aba **Produção Diária**, **Then** visualiza cards/tabela agrupados por **dia** com: **cadastradas**, **iniciadas**, **concluídas**.
2. **Given** definição de produção do centro, **When** calcula **cadastradas**, **Then** conta linhas de registro diário naquele dia (coluna Data).
3. **Given** propriedade configurada como **marcador de início**, **When** registro possui valor preenchido/verdadeiro nessa propriedade, **Then** conta como **iniciada** naquele dia.
4. **Given** propriedade configurada como **marcador de conclusão**, **When** registro possui valor preenchido/verdadeiro, **Then** conta como **concluída** naquele dia.
5. **Given** navegação de mês na aba Produção Diária, **When** avança/retrocede mês, **Then** agregações atualizam para o mês selecionado (paridade com Registro Diário).
6. **Given** dia sem registros, **When** consulta, **Then** exibe zero cadastradas/iniciadas/concluídas ou omite dia conforme UX definida no plano (decisão: exibir dias do mês com zero).

---

### User Story 7 - Listar e Detalhar Centros de Custo (Priority: P3)

Como usuário autorizado, quero listar centros de custo da entidade com resumo de licitações vinculadas e propriedades configuradas, e acessar detalhe com cabeçalho institucional e menu horizontal de abas.

**Why this priority**: Navegação e contexto são pré-requisito de uso das abas operacionais.

**Independent Test**: Listagem exibe centros; ao detalhar, cabeçalho mostra entidade + centro; menu horizontal contém Registro Diário, Painel de Desempenho e Produção Diária.

**Acceptance Scenarios**:

1. **Given** centros cadastrados, **When** acessa menu **Centros de Custo**, **Then** vê listagem com nome, período previsto, quantidade de licitações e propriedades configuradas.
2. **Given** item da listagem, **When** clica em **Detalhar**, **Then** abre página com **título/cabeçalho** contendo dados da **entidade** e do **centro de custo** (nome, datas previstas/realizadas, licitações).
3. **Given** página de detalhe, **When** carrega, **Then** exibe **menu horizontal** com abas: **Registro Diário**, **Painel de Desempenho**, **Produção Diária**.
4. **Given** usuário com permissão de visualização, **When** acessa listagem e detalhe, **Then** consulta permitida sem ações de edição.

---

### User Story 8 - Painel de Desempenho (Priority: P4 — placeholder)

Como usuário autorizado, quero acessar a aba **Painel de Desempenho** reservada para indicadores avançados que serão definidos em spec futura.

**Why this priority**: Escopo explícito do usuário, porém conteúdo ainda não definido; nesta spec apenas placeholder navegável.

**Independent Test**: Aba acessível no menu; exibe mensagem de "em definição" ou estado vazio documentado sem erro.

**Acceptance Scenarios**:

1. **Given** detalhe do centro de custo, **When** clica aba **Painel de Desempenho**, **Then** conteúdo placeholder é exibido indicando que indicadores serão definidos posteriormente.
2. **Given** placeholder, **When** usuário consulta, **Then** nenhuma métrica falsa ou dado inventado é apresentado.

---

### Edge Cases

- Centro de custo sem propriedades configuradas → Registro Diário exibe apenas coluna Data e orientação para configurar propriedades.
- Registro diário com data duplicada na mesma linha de atividade → permitir múltiplas linhas no mesmo dia (cada linha = uma tarefa/atividade).
- Item de licitação desativado após seleção em registro histórico → exibir referência armazenada; não permitir re-seleção em novos registros.
- Licitação desvinculada do centro com registros que referenciam seus itens → manter histórico; bloquear novas seleções dessa licitação.
- Propriedade removida da configuração do centro → coluna oculta em novos registros; histórico preservado.
- Navegação de mês em fevereiro/ano bissexto → exibir 28 ou 29 dias corretamente no contexto do mês.
- Entidade inativa → bloquear cadastro, configuração e edição de registros.
- Centro de custo inativo → bloquear novos registros diários; consulta histórica permitida conforme permissão.
- Timezone: datas de registro diário são **datas de calendário** (sem hora) no fuso da entidade (assumption: America/Sao_Paulo).
- Produção Diária com marcadores não configurados → iniciadas/concluídas exibem zero com nota explicativa na UI.

## Requirements *(mandatory)*

### Functional Requirements

**Contexto e isolamento**

- **FR-001**: Todo centro de custo, propriedade, registro diário e vínculo MUST pertencer a exatamente uma **Entidade (tenant)**.
- **FR-002**: Toda operação MUST validar sessão tenant e `entityId` no servidor (Spec 02).
- **FR-003**: Sistema MUST impedir acesso cross-tenant a centros, propriedades, registros e vínculos.

**Centro de custo**

- **FR-004**: Sistema MUST permitir cadastro de centro de custo com campos obrigatórios: **nome**; campos opcionais: **data prevista início**, **data prevista fim**, **data realizada início**, **data realizada fim**.
- **FR-005**: Centro de custo MUST possuir status (ativo/inativo); exclusão física MUST NOT ser permitida nesta spec.
- **FR-006**: Centro MUST registrar **data de cadastro** e **usuário que cadastrou** (metadados imutáveis de criação).
- **FR-007**: Centro MUST poder vincular **uma ou mais licitações ativas** da mesma entidade (relação N:N).
- **FR-008**: Usuário autorizado MUST poder listar e consultar centros de custo da entidade.

**Catálogo de propriedades (reutilizáveis)**

- **FR-009**: Sistema MUST permitir cadastro de **Propriedade** no catálogo da entidade com **nome** (único por entidade) e **tipo**.
- **FR-010**: Tipos MUST incluir no mínimo: `TEXTO`, `DATA`, `VALOR`, `ITEM_LICITACAO`, `ITENS_LICITACAO`, `BOOLEAN`.
- **FR-011**: Uma propriedade MUST poder ser associada a **um ou vários** centros de custo (reutilização via referência, não duplicação de definição).
- **FR-012**: Propriedade MUST possuir status ativo/inativo; propriedades inativas MUST NOT estar disponíveis para novas configurações.
- **FR-013**: Propriedade MUST registrar metadados de criação (`createdAt`, `createdBy`).

**Configuração de propriedades por centro**

- **FR-014**: Cada centro MUST definir **subconjunto ordenado** de propriedades do catálogo que compõem suas colunas de registro diário.
- **FR-015**: Ordem das colunas MUST ser persistida e respeitada na grade (após coluna fixa Data).
- **FR-016**: Centro MUST poder designar no máximo **uma** propriedade como **marcador de início** e **uma** como **marcador de conclusão** para Produção Diária (apenas tipos compatíveis: `BOOLEAN`, `DATA` ou `TEXTO` não vazio — validação exata no plano).
- **FR-017**: Configuração com propriedade `ITEM_LICITACAO` ou `ITENS_LICITACAO` MUST exigir ao menos uma licitação vinculada ao centro.

**Registro diário**

- **FR-018**: Sistema MUST persistir **Registro Diário** por centro de custo: cada **linha** representa uma atividade/tarefa; **primeira coluna** MUST ser sempre **Data** (obrigatória).
- **FR-019**: Demais colunas MUST corresponder às propriedades configuradas; valores MUST ser validados no **backend** conforme tipo.
- **FR-020**: Interface da aba Registro Diário MUST ser **grade editável estilo planilha** (linhas × colunas), equivalente funcional a Excel para o escopo desta spec.
- **FR-021**: Usuário MUST poder **adicionar linhas** manualmente.
- **FR-022**: Usuário MUST poder **avançar e retroceder meses**; grade MUST filtrar registros pelo mês/ano selecionado.
- **FR-023**: Células tipo item MUST oferecer **busca/pesquisa** sobre itens ativos das licitações vinculadas ao centro.
- **FR-024**: Edição MUST respeitar permissões (visualização vs edição); persistência MUST gerar auditoria.

**Produção diária**

- **FR-025**: Aba **Produção Diária** MUST agregar registros **por dia** no mês selecionado.
- **FR-026**: Para cada dia, MUST exibir: **tarefas cadastradas** (contagem de linhas), **iniciadas** e **concluídas** conforme marcadores configurados.
- **FR-027**: Navegação de mês MUST ser consistente com Registro Diário (mesmo mês/ano selecionado ou sincronizado).

**Painel de desempenho**

- **FR-028**: Aba **Painel de Desempenho** MUST existir no menu horizontal com **placeholder** explícito; indicadores MUST NOT ser implementados nesta spec.

**Autorização (RBAC)**

- **FR-029**: Sistema MUST introduzir permissões tenant granulares, no mínimo: `centros_custo.view`, `centros_custo.manage`, `centros_custo.propriedades.manage`, `centros_custo.registros.edit`.
- **FR-030**: Perfil **Administrador** MUST possuir todas as permissões de centros de custo.
- **FR-031**: Perfil **Engenheiro/Fiscal** MUST possuir `view` + `registros.edit` + consulta de propriedades; gestão de catálogo conforme matriz no plano.
- **FR-032**: Perfil **Operador** MUST possuir `centros_custo.view` por padrão; edição de registros negada salvo ajuste futuro.
- **FR-033**: Validação de permissões MUST ocorrer no servidor em todos os endpoints.

**Interface e navegação**

- **FR-034**: Módulo MUST ser acessível no menu lateral tenant para usuários com `centros_custo.view`.
- **FR-035**: Telas MUST seguir `frontend/DESIGN.md` e layout administrativo tenant existente.
- **FR-036**: Página de detalhe MUST exibir cabeçalho com **dados da entidade** e **dados do centro de custo** antes do menu horizontal de abas.
- **FR-037**: Menu horizontal MUST conter abas nesta ordem: **Registro Diário**, **Painel de Desempenho**, **Produção Diária**.

**Auditoria**

- **FR-038**: Sistema MUST auditar: criação/alteração/desativação de centro de custo, propriedade, configuração de propriedades, vínculos licitação, criação/alteração de registro diário.
- **FR-039**: Cada registro MUST conter: entidade, ator, timestamp, ação, recurso, valores anterior/novo quando aplicável.
- **FR-040**: Metadados de criação MUST ser consultáveis na interface de detalhe.

### Key Entities

- **Centro de Custo**: Unidade operacional/financeira no tenant. Atributos: entidade_id, nome, datas previstas (início/fim), datas realizadas (início/fim), status, created_at, created_by_user_id, updated_at.
- **Vínculo Centro ↔ Licitação**: Associação N:N entre centro de custo e licitações ativas da entidade para origem de itens.
- **Propriedade (catálogo)**: Definição reutilizável na entidade. Atributos: entidade_id, nome, tipo (enum), status, created_at, created_by_user_id.
- **Configuração de Propriedade do Centro**: Associação N:N ordenada entre centro e propriedades; atributos: ordem_coluna, papel_producao (NONE | INICIO | CONCLUSAO).
- **Registro Diário (linha)**: Atividade registrada em um dia. Atributos: centro_id, entidade_id, data (date), created_at, updated_by, updated_at.
- **Valor de Propriedade (célula)**: Valor tipado por linha e propriedade. Atributos: registro_id, propriedade_id, valor conforme tipo (texto, data, decimal, referência(s) item licitação, boolean).
- **Item de Licitação** (Spec 03): Referenciado em células tipo item; somente itens ativos e licitações vinculadas.

### Tipos de propriedade — Referência *(informativo na UI)*

| Tipo | Uso na célula | Exemplo |
|------|---------------|---------|
| TEXTO | Texto livre | "Frente A — bloco 2" |
| DATA | Data | 15/05/2026 |
| VALOR | Monetário pt-BR | 1.250,00 |
| ITEM_LICITACAO | Um item (busca) | Cimento CP II |
| ITENS_LICITACAO | Vários itens (busca) | Cimento + Areia |
| BOOLEAN | Sim/Não | ☑ Iniciada |

### Registro Diário — Layout esperado *(informativo)*

| Data | [Propriedade 1] | [Propriedade 2] | … |
|------|-----------------|-----------------|-----|
| 01/05/2026 | … | … | … |
| 01/05/2026 | … | … | … |

- Coluna **Data** fixa e sempre primeira.
- Demais colunas = propriedades configuradas do centro, na ordem definida.
- Navegação por mês filtra linhas pela coluna Data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuário autorizado cadastra centro de custo, vincula licitação e configura 5 propriedades em menos de 10 minutos.
- **SC-002**: 100% dos valores de célula são validados no servidor conforme tipo da propriedade.
- **SC-003**: Navegação avançar/retroceder mês atualiza Registro Diário e Produção Diária de forma consistente em 100% dos casos testados.
- **SC-004**: Busca de item em célula retorna apenas itens ativos das licitações vinculadas ao centro (zero resultados de licitação não vinculada).
- **SC-005**: Produção Diária reflete corretamente contagens de cadastradas/iniciadas/concluídas para cenário de teste com 10+ registros em 3 dias distintos.
- **SC-006**: 100% das mutações em centro, propriedade e registro diário geram auditoria com ator identificado.
- **SC-007**: Zero vazamento cross-tenant em testes de acesso direto por ID.
- **SC-008**: Aba Painel de Desempenho acessível sem erro, exibindo placeholder documentado.

## Assumptions

- Rotas tenant usam UUID da entidade (`/t/{entityId}/...`), conforme Specs 01–03.
- Licitações e itens seguem regras da Spec 03 (itens inativos excluídos de seleção).
- **Coluna Data** é coluna fixa do sistema no Registro Diário, não uma Propriedade do catálogo.
- Cada **linha** do registro diário = uma **tarefa/atividade**; múltiplas linhas no mesmo dia são permitidas.
- **Cadastradas** (Produção Diária) = quantidade de linhas de registro naquele dia.
- **Iniciadas/Concluídas** derivam de propriedades configuradas com papel INICIO/CONCLUSAO no centro.
- Para `BOOLEAN`: verdadeiro = marcador ativo; para `DATA`: preenchida = marcador ativo; detalhes por tipo no plano.
- Painel de Desempenho fica **fora do escopo funcional** nesta spec (somente placeholder).
- Valores monetários: decimal no backend, formatação pt-BR na UI.
- Idioma: **português (Brasil)**.
- Permissões novas serão adicionadas ao seed RBAC no plano de implementação.
- Sincronização de mês entre abas Registro Diário e Produção Diária via estado de navegação compartilhado na URL ou contexto da página (detalhe no plano).

## Out of Scope

- Indicadores e gráficos do **Painel de Desempenho** (spec futura dedicada).
- Importação/exportação Excel do registro diário (pode ser spec futura).
- Aprovação workflow de registros diários.
- Cálculo financeiro consolidado, saldos orçamentários ou integração contábil.
- Notificações, alertas de prazo ou SLA automático.
- Anexos/arquivos por linha de registro.
- Regras automáticas de preenchimento ou fórmulas entre colunas (estilo Excel avançado).
- Vinculação de centro de custo a contratos/obras além das licitações (spec futura).
- Reativação de centro ou propriedade desativada (spec futura).
