-- CreateEnum
CREATE TYPE "AditivoTipo" AS ENUM ('PRAZO', 'VALOR', 'QUANTIDADE');

-- AlterTable
ALTER TABLE "fornecedores" ADD COLUMN     "endereco" VARCHAR(400),
ADD COLUMN     "nome_fantasia" VARCHAR(250);

-- AlterTable
ALTER TABLE "licitacao_items" ADD COLUMN     "contrato_id" TEXT,
ADD COLUMN     "lote_id" TEXT,
ADD COLUMN     "marca" VARCHAR(120);

-- AlterTable
ALTER TABLE "licitacoes" ADD COLUMN     "data_homologacao" DATE,
ADD COLUMN     "modalidade" VARCHAR(80),
ADD COLUMN     "numero_processo" VARCHAR(60),
ADD COLUMN     "tipo" VARCHAR(30);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "licitacao_id" TEXT NOT NULL,
    "numero" VARCHAR(60) NOT NULL,
    "fornecedor_id" TEXT,
    "vigencia_de" DATE NOT NULL,
    "vigencia_ate" DATE NOT NULL,
    "vigencia_original" DATE,
    "valor" DECIMAL(15,2),
    "status" "LicitacaoStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_lotes" (
    "id" TEXT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "descricao" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_aditivos" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "contrato_id" TEXT NOT NULL,
    "numero" VARCHAR(40) NOT NULL,
    "tipo" "AditivoTipo" NOT NULL,
    "data_publicacao" DATE NOT NULL,
    "vigencia_anterior" DATE,
    "nova_vigencia" DATE,
    "percentual" DECIMAL(7,4),
    "lote_id" TEXT,
    "valor_aditivado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "observacao" VARCHAR(1000),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_aditivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato_aditivo_itens" (
    "id" TEXT NOT NULL,
    "aditivo_id" TEXT NOT NULL,
    "licitacao_item_id" TEXT NOT NULL,
    "quantidade_anterior" DECIMAL(15,4),
    "quantidade_nova" DECIMAL(15,4),
    "valor_anterior" DECIMAL(15,4),
    "valor_novo" DECIMAL(15,4),

    CONSTRAINT "contrato_aditivo_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_contratacao" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "licitacao_id" TEXT,
    "contrato_id" TEXT,
    "aditivo_id" TEXT,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_contratacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contratos_entity_id_vigencia_ate_idx" ON "contratos"("entity_id", "vigencia_ate");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_licitacao_id_numero_key" ON "contratos"("licitacao_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_lotes_contrato_id_numero_key" ON "contrato_lotes"("contrato_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "contrato_aditivos_contrato_id_numero_key" ON "contrato_aditivos"("contrato_id", "numero");

-- CreateIndex
CREATE INDEX "contrato_aditivo_itens_aditivo_id_idx" ON "contrato_aditivo_itens"("aditivo_id");

-- CreateIndex
CREATE INDEX "documentos_contratacao_licitacao_id_idx" ON "documentos_contratacao"("licitacao_id");

-- CreateIndex
CREATE INDEX "documentos_contratacao_contrato_id_idx" ON "documentos_contratacao"("contrato_id");

-- AddForeignKey
ALTER TABLE "licitacao_items" ADD CONSTRAINT "licitacao_items_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licitacao_items" ADD CONSTRAINT "licitacao_items_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "contrato_lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_licitacao_id_fkey" FOREIGN KEY ("licitacao_id") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_lotes" ADD CONSTRAINT "contrato_lotes_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aditivos" ADD CONSTRAINT "contrato_aditivos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aditivos" ADD CONSTRAINT "contrato_aditivos_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "contrato_lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aditivos" ADD CONSTRAINT "contrato_aditivos_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aditivo_itens" ADD CONSTRAINT "contrato_aditivo_itens_aditivo_id_fkey" FOREIGN KEY ("aditivo_id") REFERENCES "contrato_aditivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato_aditivo_itens" ADD CONSTRAINT "contrato_aditivo_itens_licitacao_item_id_fkey" FOREIGN KEY ("licitacao_item_id") REFERENCES "licitacao_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_contratacao" ADD CONSTRAINT "documentos_contratacao_licitacao_id_fkey" FOREIGN KEY ("licitacao_id") REFERENCES "licitacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_contratacao" ADD CONSTRAINT "documentos_contratacao_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_contratacao" ADD CONSTRAINT "documentos_contratacao_aditivo_id_fkey" FOREIGN KEY ("aditivo_id") REFERENCES "contrato_aditivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

