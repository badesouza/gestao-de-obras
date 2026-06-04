# Planejamento: Modulo de Compras

## Objetivo

Criar um fluxo onde o usuario seleciona uma licitacao, direciona itens com quantidades para servicos urbanos especificos, agrupa tudo em uma requisicao e depois consolida uma solicitacao final unica para o setor de compras.

## Visao Geral Do Fluxo

1. **Requisicao**
   - Documento interno criado pela Secretaria de Obras.
   - Pode estar em rascunho, enviada, aprovada, rejeitada ou cancelada.
   - Tem identificacao, data, responsavel, justificativa, observacoes e status.

2. **Itens Da Requisicao**
   - Cada item vem de um item de licitacao.
   - O usuario informa a quantidade solicitada.
   - O sistema calcula valor estimado: `quantidade * valorUnitario`.
   - Cada item pode ser vinculado a um ou mais servicos urbanos.

3. **Direcionamento Para Servicos Urbanos**
   - Exemplo:
     - Cimento CP II: 120 sacos -> Construcao Civil.
     - Tinta viaria: 40 baldes -> Pintura.
     - Lampada LED: 80 unidades -> Iluminacao Publica.
   - Esse vinculo permite saber para qual frente de trabalho aquela compra esta sendo solicitada.

4. **Solicitacao De Compras**
   - Documento final consolidado.
   - Pode juntar uma ou varias requisicoes aprovadas.
   - Agrupa itens iguais para evitar compras duplicadas.
   - Exemplo:
     - Requisicao A pediu 50 sacos de cimento.
     - Requisicao B pediu 70 sacos de cimento.
     - Solicitacao final para compras: 120 sacos de cimento.

## Estrutura De Banco Sugerida

### `requisicoes`

- `id`
- `entityId`
- `numero`
- `licitacaoId`
- `status`
- `justificativa`
- `observacoes`
- `createdByUserId`
- `submittedAt`
- `approvedAt`
- `createdAt`
- `updatedAt`

### `requisicao_itens`

- `id`
- `requisicaoId`
- `licitacaoItemId`
- `descricaoSnapshot`
- `unidadeMedidaSnapshot`
- `valorUnitarioSnapshot`
- `quantidade`
- `valorTotal`
- `observacoes`

### `requisicao_item_servicos`

- `id`
- `requisicaoItemId`
- `servicoSlug`
- `servicoNome`
- `quantidadeDirecionada`

### `solicitacoes_compras`

- `id`
- `entityId`
- `numero`
- `status`
- `createdByUserId`
- `sentToComprasAt`
- `createdAt`
- `updatedAt`

### `solicitacao_compra_itens`

- `id`
- `solicitacaoCompraId`
- `licitacaoItemId`
- `descricaoSnapshot`
- `unidadeMedidaSnapshot`
- `quantidadeTotal`
- `valorUnitarioSnapshot`
- `valorTotal`

### `solicitacao_compra_requisicoes`

- `solicitacaoCompraId`
- `requisicaoId`

## Status Recomendados

### `RequisicaoStatus`

- `DRAFT`
- `SUBMITTED`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `IN_PURCHASE_REQUEST`

### `SolicitacaoCompraStatus`

- `DRAFT`
- `READY_TO_SEND`
- `SENT`
- `CANCELLED`

## APIs Necessarias

### Requisicoes

- `GET /requisicoes`
- `POST /requisicoes`
- `GET /requisicoes/:id`
- `PATCH /requisicoes/:id`
- `POST /requisicoes/:id/items`
- `PATCH /requisicoes/:id/items/:itemId`
- `DELETE /requisicoes/:id/items/:itemId`
- `POST /requisicoes/:id/submit`
- `POST /requisicoes/:id/approve`
- `POST /requisicoes/:id/reject`
- `POST /requisicoes/:id/cancel`

### Solicitacoes De Compras

- `GET /solicitacoes-compras`
- `POST /solicitacoes-compras/from-requisicoes`
- `GET /solicitacoes-compras/:id`
- `POST /solicitacoes-compras/:id/send`
- `GET /solicitacoes-compras/:id/export`

## Telas Necessarias

1. **Lista De Requisicoes**
   - Numero.
   - Licitacao.
   - Status.
   - Valor estimado.
   - Criado por.
   - Data.
   - Acoes.

2. **Criar Requisicao**
   - Selecionar licitacao.
   - Justificativa.
   - Observacoes.

3. **Detalhe Da Requisicao**
   - Cabecalho com status.
   - Busca de itens da licitacao.
   - Adicao de item com quantidade.
   - Direcionamento por servico urbano.
   - Totalizador por item, servico e requisicao.
   - Botoes: salvar rascunho, enviar, aprovar, rejeitar, cancelar.

4. **Gerar Solicitacao De Compras**
   - Selecionar requisicoes aprovadas.
   - Previa dos itens consolidados.
   - Mostrar agrupamento por item.
   - Mostrar origem por requisicao.
   - Gerar solicitacao unica.

5. **Detalhe Da Solicitacao De Compras**
   - Itens consolidados.
   - Quantidade total.
   - Valor estimado total.
   - Requisicoes de origem.
   - Exportar PDF/Excel.
   - Marcar como enviada para compras.

## Regras De Negocio

- So permitir criar requisicao usando licitacao ativa.
- So permitir item ativo da licitacao.
- Quantidade deve ser maior que zero.
- Se o item tiver quantidade contratada/importada, opcionalmente validar saldo disponivel.
- Nao permitir editar requisicao depois de aprovada, exceto por perfil autorizado.
- Solicitacao de compras so pode usar requisicoes aprovadas.
- Ao gerar solicitacao, agrupar itens iguais pelo `licitacaoItemId`.
- Guardar snapshots de descricao, unidade e valor unitario para preservar historico mesmo se o item original mudar depois.
- Registrar auditoria em criacao, envio, aprovacao, rejeicao, geracao de solicitacao e envio para compras.

## Permissoes

- `requisicoes.view`
- `requisicoes.create`
- `requisicoes.edit`
- `requisicoes.submit`
- `requisicoes.approve`
- `requisicoes.cancel`
- `compras-solicitacoes.view`
- `compras-solicitacoes.generate`
- `compras-solicitacoes.send`
- `compras-solicitacoes.export`

## Fases De Implementacao

1. **Base tecnica**
   - Criar enums, tabelas Prisma e migrations.
   - Gerar Prisma Client.
   - Criar services e schemas Zod.

2. **CRUD de requisicoes**
   - Listar, criar, editar, detalhar.
   - Adicionar/remover itens.
   - Direcionar quantidades para servicos urbanos.

3. **Workflow**
   - Enviar requisicao.
   - Aprovar/rejeitar.
   - Cancelar.
   - Auditoria.

4. **Solicitacao de compras**
   - Selecionar requisicoes aprovadas.
   - Consolidar itens.
   - Gerar documento unico.
   - Marcar requisicoes como vinculadas a solicitacao.

5. **Frontend**
   - Menu novo.
   - Lista de requisicoes.
   - Tela de criacao/detalhe.
   - Tela de consolidacao.
   - Tela da solicitacao final.

6. **Exportacao**
   - Primeiro Excel/CSV.
   - Depois PDF formal com cabecalho da entidade, brasao, numero da solicitacao e assinaturas.

7. **Validacao e refinamento**
   - Testar saldos, quantidades, status e permissoes.
   - Melhorar UX de selecao de itens.
   - Criar filtros por servico urbano, licitacao e status.

## Recomendacao

Comecar pelo modulo **Requisicoes** em rascunho/aprovacao, depois implementar a consolidacao em **Solicitacao de Compras**. Isso evita misturar fluxo operacional com documento final logo no inicio.
