-- CreateEnum
CREATE TYPE "LicitacaoStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "licitacoes" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "identificacao" VARCHAR(100) NOT NULL,
    "objeto" VARCHAR(500) NOT NULL,
    "status" "LicitacaoStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licitacao_items" (
    "id" TEXT NOT NULL,
    "licitacao_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "categoria" VARCHAR(100),
    "descricao" VARCHAR(500) NOT NULL,
    "unidade_medida" VARCHAR(50) NOT NULL,
    "valor_unitario" DECIMAL(15,4),
    "status" "LicitacaoStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licitacao_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "licitacoes_entity_id_status_idx" ON "licitacoes"("entity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "licitacoes_entity_id_identificacao_key" ON "licitacoes"("entity_id", "identificacao");

-- CreateIndex
CREATE INDEX "licitacao_items_licitacao_id_status_idx" ON "licitacao_items"("licitacao_id", "status");

-- CreateIndex
CREATE INDEX "licitacao_items_entity_id_licitacao_id_idx" ON "licitacao_items"("entity_id", "licitacao_id");

-- AddForeignKey
ALTER TABLE "licitacoes" ADD CONSTRAINT "licitacoes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacoes" ADD CONSTRAINT "licitacoes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacao_items" ADD CONSTRAINT "licitacao_items_licitacao_id_fkey" FOREIGN KEY ("licitacao_id") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacao_items" ADD CONSTRAINT "licitacao_items_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacao_items" ADD CONSTRAINT "licitacao_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
