CREATE TYPE "SolicitacaoServicoStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONSOLIDATED');

CREATE TYPE "PedidoCompraStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED');

CREATE TABLE "solicitacoes_servico" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "servico_slug" VARCHAR(80) NOT NULL,
    "servico_nome" VARCHAR(160) NOT NULL,
    "licitacao_id" TEXT NOT NULL,
    "status" "SolicitacaoServicoStatus" NOT NULL DEFAULT 'DRAFT',
    "prioridade" VARCHAR(20) NOT NULL DEFAULT 'Media',
    "justificativa" VARCHAR(2000) NOT NULL,
    "observacoes" VARCHAR(2000),
    "created_by_user_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitacoes_servico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "solicitacao_servico_itens" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "solicitacao_servico_id" TEXT NOT NULL,
    "licitacao_item_id" TEXT NOT NULL,
    "descricao_snapshot" VARCHAR(500) NOT NULL,
    "unidade_medida_snapshot" VARCHAR(50) NOT NULL,
    "valor_unitario_snapshot" DECIMAL(15,4) NOT NULL,
    "quantidade" DECIMAL(15,4) NOT NULL,
    "valor_total" DECIMAL(15,4) NOT NULL,
    "observacoes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacao_servico_itens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pedidos_compra" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "status" "PedidoCompraStatus" NOT NULL DEFAULT 'DRAFT',
    "observacoes" VARCHAR(2000),
    "created_by_user_id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_compra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pedido_compra_itens" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "pedido_compra_id" TEXT NOT NULL,
    "licitacao_item_id" TEXT NOT NULL,
    "descricao_snapshot" VARCHAR(500) NOT NULL,
    "unidade_medida_snapshot" VARCHAR(50) NOT NULL,
    "valor_unitario_snapshot" DECIMAL(15,4) NOT NULL,
    "quantidade_total" DECIMAL(15,4) NOT NULL,
    "valor_total" DECIMAL(15,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_compra_itens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pedido_compra_item_origens" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "pedido_compra_item_id" TEXT NOT NULL,
    "solicitacao_servico_id" TEXT NOT NULL,
    "solicitacao_servico_item_id" TEXT NOT NULL,
    "servico_slug" VARCHAR(80) NOT NULL,
    "servico_nome" VARCHAR(160) NOT NULL,
    "quantidade" DECIMAL(15,4) NOT NULL,
    "valor_total" DECIMAL(15,4) NOT NULL,

    CONSTRAINT "pedido_compra_item_origens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pedido_compra_recebimentos" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "pedido_compra_item_id" TEXT NOT NULL,
    "quantidade" DECIMAL(15,4) NOT NULL,
    "recebido_em" DATE NOT NULL,
    "responsavel" VARCHAR(160) NOT NULL,
    "observacoes" VARCHAR(1000),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_compra_recebimentos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitacoes_servico_entity_id_numero_key" ON "solicitacoes_servico"("entity_id", "numero");
CREATE INDEX "solicitacoes_servico_entity_id_servico_slug_status_idx" ON "solicitacoes_servico"("entity_id", "servico_slug", "status");
CREATE INDEX "solicitacoes_servico_entity_id_licitacao_id_idx" ON "solicitacoes_servico"("entity_id", "licitacao_id");

CREATE INDEX "solicitacao_servico_itens_solicitacao_servico_id_idx" ON "solicitacao_servico_itens"("solicitacao_servico_id");
CREATE INDEX "solicitacao_servico_itens_entity_id_licitacao_item_id_idx" ON "solicitacao_servico_itens"("entity_id", "licitacao_item_id");

CREATE UNIQUE INDEX "pedidos_compra_entity_id_numero_key" ON "pedidos_compra"("entity_id", "numero");
CREATE INDEX "pedidos_compra_entity_id_status_idx" ON "pedidos_compra"("entity_id", "status");

CREATE UNIQUE INDEX "pedido_compra_itens_pedido_compra_id_licitacao_item_id_key" ON "pedido_compra_itens"("pedido_compra_id", "licitacao_item_id");
CREATE INDEX "pedido_compra_itens_entity_id_licitacao_item_id_idx" ON "pedido_compra_itens"("entity_id", "licitacao_item_id");

CREATE INDEX "pedido_compra_item_origens_pedido_compra_item_id_idx" ON "pedido_compra_item_origens"("pedido_compra_item_id");
CREATE INDEX "pedido_compra_item_origens_solicitacao_servico_id_idx" ON "pedido_compra_item_origens"("solicitacao_servico_id");

CREATE INDEX "pedido_compra_recebimentos_pedido_compra_item_id_idx" ON "pedido_compra_recebimentos"("pedido_compra_item_id");
CREATE INDEX "pedido_compra_recebimentos_entity_id_recebido_em_idx" ON "pedido_compra_recebimentos"("entity_id", "recebido_em");

ALTER TABLE "solicitacoes_servico" ADD CONSTRAINT "solicitacoes_servico_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_servico" ADD CONSTRAINT "solicitacoes_servico_licitacao_id_fkey" FOREIGN KEY ("licitacao_id") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitacoes_servico" ADD CONSTRAINT "solicitacoes_servico_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitacao_servico_itens" ADD CONSTRAINT "solicitacao_servico_itens_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitacao_servico_itens" ADD CONSTRAINT "solicitacao_servico_itens_solicitacao_servico_id_fkey" FOREIGN KEY ("solicitacao_servico_id") REFERENCES "solicitacoes_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitacao_servico_itens" ADD CONSTRAINT "solicitacao_servico_itens_licitacao_item_id_fkey" FOREIGN KEY ("licitacao_item_id") REFERENCES "licitacao_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pedido_compra_itens" ADD CONSTRAINT "pedido_compra_itens_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_compra_itens" ADD CONSTRAINT "pedido_compra_itens_pedido_compra_id_fkey" FOREIGN KEY ("pedido_compra_id") REFERENCES "pedidos_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedido_compra_itens" ADD CONSTRAINT "pedido_compra_itens_licitacao_item_id_fkey" FOREIGN KEY ("licitacao_item_id") REFERENCES "licitacao_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pedido_compra_item_origens" ADD CONSTRAINT "pedido_compra_item_origens_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_compra_item_origens" ADD CONSTRAINT "pedido_compra_item_origens_pedido_compra_item_id_fkey" FOREIGN KEY ("pedido_compra_item_id") REFERENCES "pedido_compra_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedido_compra_item_origens" ADD CONSTRAINT "pedido_compra_item_origens_solicitacao_servico_id_fkey" FOREIGN KEY ("solicitacao_servico_id") REFERENCES "solicitacoes_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_compra_item_origens" ADD CONSTRAINT "pedido_compra_item_origens_solicitacao_servico_item_id_fkey" FOREIGN KEY ("solicitacao_servico_item_id") REFERENCES "solicitacao_servico_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pedido_compra_recebimentos" ADD CONSTRAINT "pedido_compra_recebimentos_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_compra_recebimentos" ADD CONSTRAINT "pedido_compra_recebimentos_pedido_compra_item_id_fkey" FOREIGN KEY ("pedido_compra_item_id") REFERENCES "pedido_compra_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedido_compra_recebimentos" ADD CONSTRAINT "pedido_compra_recebimentos_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
