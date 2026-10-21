-- AlterTable
ALTER TABLE "centros_custo" ADD COLUMN     "cor" VARCHAR(9),
ADD COLUMN     "ficha_salva_em" TIMESTAMP(3),
ADD COLUMN     "municipe_pode" BOOLEAN,
ADD COLUMN     "nome_municipe" VARCHAR(200),
ADD COLUMN     "prazo_dias" INTEGER,
ADD COLUMN     "subtipos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tipo_servico" VARCHAR(20);

-- CreateTable
CREATE TABLE "servico_campos" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "servico_id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "detalhe" VARCHAR(300),
    "tipo" VARCHAR(20) NOT NULL,
    "opcoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "momento" VARCHAR(10) NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servico_campos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "servico_campos_servico_id_ordem_idx" ON "servico_campos"("servico_id", "ordem");

-- AddForeignKey
ALTER TABLE "servico_campos" ADD CONSTRAINT "servico_campos_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servico_campos" ADD CONSTRAINT "servico_campos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "centros_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

