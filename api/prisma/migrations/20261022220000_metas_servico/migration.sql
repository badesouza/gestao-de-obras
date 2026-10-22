-- CreateTable
CREATE TABLE IF NOT EXISTS "metas_servico" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "meta_registros" DECIMAL(14,2),
    "meta_producao" DECIMAL(14,2),
    "meta_horas" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metas_servico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "metas_servico_centro_custo_id_year_idx" ON "metas_servico"("centro_custo_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "metas_servico_entity_id_centro_custo_id_year_month_key" ON "metas_servico"("entity_id", "centro_custo_id", "year", "month");

