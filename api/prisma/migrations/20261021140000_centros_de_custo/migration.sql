-- CreateEnum
CREATE TYPE "TipoCentroDeCusto" AS ENUM ('SECRETARIA', 'SETOR', 'PROGRAMA', 'OBRA', 'OUTRO');

-- AlterTable
ALTER TABLE "centros_custo" ADD COLUMN     "centro_de_custo_padrao_id" TEXT;

-- AlterTable
ALTER TABLE "pedido_compra_item_origens" ADD COLUMN     "centro_de_custo_id" TEXT;

-- AlterTable
ALTER TABLE "registros_diarios" ADD COLUMN     "centro_de_custo_id" TEXT;

-- AlterTable
ALTER TABLE "solicitacao_servico_itens" ADD COLUMN     "centro_de_custo_id" TEXT,
ADD COLUMN     "servico_nome" VARCHAR(160),
ADD COLUMN     "servico_slug" VARCHAR(80);

-- CreateTable
CREATE TABLE "centros_de_custo" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "tipo" "TipoCentroDeCusto" NOT NULL DEFAULT 'SETOR',
    "descricao" VARCHAR(1000),
    "responsavel" VARCHAR(160),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pai_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centros_de_custo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "centros_de_custo_entity_id_ativo_idx" ON "centros_de_custo"("entity_id", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "centros_de_custo_entity_id_codigo_key" ON "centros_de_custo"("entity_id", "codigo");

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_centro_de_custo_padrao_id_fkey" FOREIGN KEY ("centro_de_custo_padrao_id") REFERENCES "centros_de_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_centro_de_custo_id_fkey" FOREIGN KEY ("centro_de_custo_id") REFERENCES "centros_de_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_servico_itens" ADD CONSTRAINT "solicitacao_servico_itens_centro_de_custo_id_fkey" FOREIGN KEY ("centro_de_custo_id") REFERENCES "centros_de_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_compra_item_origens" ADD CONSTRAINT "pedido_compra_item_origens_centro_de_custo_id_fkey" FOREIGN KEY ("centro_de_custo_id") REFERENCES "centros_de_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_de_custo" ADD CONSTRAINT "centros_de_custo_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_de_custo" ADD CONSTRAINT "centros_de_custo_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "centros_de_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

