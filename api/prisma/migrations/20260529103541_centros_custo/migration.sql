-- CreateEnum
CREATE TYPE "CentroCustoStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PropriedadeTipo" AS ENUM ('TEXTO', 'DATA', 'VALOR', 'BOOLEAN', 'ITEM_LICITACAO', 'ITENS_LICITACAO');

-- CreateEnum
CREATE TYPE "PropriedadeProductionRole" AS ENUM ('NONE', 'INICIO', 'CONCLUSAO');

-- CreateTable
CREATE TABLE "centros_custo" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "data_prevista_inicio" DATE,
    "data_prevista_fim" DATE,
    "data_realizada_inicio" DATE,
    "data_realizada_fim" DATE,
    "status" "CentroCustoStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centro_custo_licitacoes" (
    "centro_custo_id" TEXT NOT NULL,
    "licitacao_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centro_custo_licitacoes_pkey" PRIMARY KEY ("centro_custo_id","licitacao_id")
);

-- CreateTable
CREATE TABLE "centro_custo_propriedades" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "tipo" "PropriedadeTipo" NOT NULL,
    "status" "CentroCustoStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centro_custo_propriedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centro_custo_propriedade_configs" (
    "id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "propriedade_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "column_order" INTEGER NOT NULL,
    "production_role" "PropriedadeProductionRole" NOT NULL DEFAULT 'NONE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "centro_custo_propriedade_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_diarios" (
    "id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_diario_valores" (
    "id" TEXT NOT NULL,
    "registro_diario_id" TEXT NOT NULL,
    "propriedade_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "valor_texto" VARCHAR(2000),
    "valor_data" DATE,
    "valor_decimal" DECIMAL(15,4),
    "valor_boolean" BOOLEAN,

    CONSTRAINT "registro_diario_valores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_diario_valor_itens" (
    "registro_diario_valor_id" TEXT NOT NULL,
    "licitacao_item_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,

    CONSTRAINT "registro_diario_valor_itens_pkey" PRIMARY KEY ("registro_diario_valor_id","licitacao_item_id")
);

-- CreateIndex
CREATE INDEX "centros_custo_entity_id_status_idx" ON "centros_custo"("entity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "centros_custo_entity_id_nome_key" ON "centros_custo"("entity_id", "nome");

-- CreateIndex
CREATE INDEX "centro_custo_propriedades_entity_id_status_idx" ON "centro_custo_propriedades"("entity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "centro_custo_propriedades_entity_id_nome_key" ON "centro_custo_propriedades"("entity_id", "nome");

-- CreateIndex
CREATE INDEX "centro_custo_propriedade_configs_centro_custo_id_active_col_idx" ON "centro_custo_propriedade_configs"("centro_custo_id", "active", "column_order");

-- CreateIndex
CREATE UNIQUE INDEX "centro_custo_propriedade_configs_centro_custo_id_propriedad_key" ON "centro_custo_propriedade_configs"("centro_custo_id", "propriedade_id");

-- CreateIndex
CREATE INDEX "registros_diarios_centro_custo_id_data_idx" ON "registros_diarios"("centro_custo_id", "data");

-- CreateIndex
CREATE INDEX "registros_diarios_entity_id_centro_custo_id_data_idx" ON "registros_diarios"("entity_id", "centro_custo_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "registro_diario_valores_registro_diario_id_propriedade_id_key" ON "registro_diario_valores"("registro_diario_id", "propriedade_id");

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo_licitacoes" ADD CONSTRAINT "centro_custo_licitacoes_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo_licitacoes" ADD CONSTRAINT "centro_custo_licitacoes_licitacao_id_fkey" FOREIGN KEY ("licitacao_id") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo_licitacoes" ADD CONSTRAINT "centro_custo_licitacoes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo_propriedades" ADD CONSTRAINT "centro_custo_propriedades_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo_propriedades" ADD CONSTRAINT "centro_custo_propriedades_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo_propriedade_configs" ADD CONSTRAINT "centro_custo_propriedade_configs_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo_propriedade_configs" ADD CONSTRAINT "centro_custo_propriedade_configs_propriedade_id_fkey" FOREIGN KEY ("propriedade_id") REFERENCES "centro_custo_propriedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centro_custo_propriedade_configs" ADD CONSTRAINT "centro_custo_propriedade_configs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_diario_valores" ADD CONSTRAINT "registro_diario_valores_registro_diario_id_fkey" FOREIGN KEY ("registro_diario_id") REFERENCES "registros_diarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_diario_valores" ADD CONSTRAINT "registro_diario_valores_propriedade_id_fkey" FOREIGN KEY ("propriedade_id") REFERENCES "centro_custo_propriedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_diario_valores" ADD CONSTRAINT "registro_diario_valores_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_diario_valor_itens" ADD CONSTRAINT "registro_diario_valor_itens_registro_diario_valor_id_fkey" FOREIGN KEY ("registro_diario_valor_id") REFERENCES "registro_diario_valores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_diario_valor_itens" ADD CONSTRAINT "registro_diario_valor_itens_licitacao_item_id_fkey" FOREIGN KEY ("licitacao_item_id") REFERENCES "licitacao_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_diario_valor_itens" ADD CONSTRAINT "registro_diario_valor_itens_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
