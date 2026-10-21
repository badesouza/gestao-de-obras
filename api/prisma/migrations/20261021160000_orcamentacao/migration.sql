-- CreateEnum
CREATE TYPE "OrcamentoStatus" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'CONVERTIDO', 'CANCELADO');

-- AlterTable
ALTER TABLE "pedidos_compra" ADD COLUMN     "orcamento_id" TEXT;

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" VARCHAR(2000),
    "bairro" VARCHAR(150),
    "logradouro" VARCHAR(300),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "servico_slug" VARCHAR(80),
    "servico_nome" VARCHAR(160),
    "centro_de_custo_id" TEXT,
    "status" "OrcamentoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "enviado_em" TIMESTAMP(3),
    "revisado_em" TIMESTAMP(3),
    "revisado_por_id" TEXT,
    "aprovado_em" TIMESTAMP(3),
    "aprovado_por_id" TEXT,
    "devolvido_em" TIMESTAMP(3),
    "devolvido_motivo" VARCHAR(1000),
    "convertido_em" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamento_itens" (
    "id" TEXT NOT NULL,
    "orcamento_id" TEXT NOT NULL,
    "licitacao_item_id" TEXT NOT NULL,
    "descricao_snapshot" VARCHAR(500) NOT NULL,
    "unidade_medida_snapshot" VARCHAR(50) NOT NULL,
    "valor_unitario_snapshot" DECIMAL(15,4) NOT NULL,
    "quantidade" DECIMAL(15,4) NOT NULL,
    "valor_total" DECIMAL(15,4) NOT NULL,
    "servico_slug" VARCHAR(80),
    "servico_nome" VARCHAR(160),
    "centro_de_custo_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orcamento_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamento_fotos" (
    "id" TEXT NOT NULL,
    "orcamento_id" TEXT NOT NULL,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orcamento_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orcamentos_entity_id_status_idx" ON "orcamentos"("entity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_entity_id_numero_key" ON "orcamentos"("entity_id", "numero");

-- CreateIndex
CREATE INDEX "orcamento_itens_orcamento_id_idx" ON "orcamento_itens"("orcamento_id");

-- CreateIndex
CREATE INDEX "orcamento_fotos_orcamento_id_idx" ON "orcamento_fotos"("orcamento_id");

-- AddForeignKey
ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_centro_de_custo_id_fkey" FOREIGN KEY ("centro_de_custo_id") REFERENCES "centros_de_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_aprovado_por_id_fkey" FOREIGN KEY ("aprovado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_licitacao_item_id_fkey" FOREIGN KEY ("licitacao_item_id") REFERENCES "licitacao_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_centro_de_custo_id_fkey" FOREIGN KEY ("centro_de_custo_id") REFERENCES "centros_de_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_fotos" ADD CONSTRAINT "orcamento_fotos_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

