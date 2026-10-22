-- Central de Solicitações: toda OS passa pelo crivo do responsável

-- CreateEnum
CREATE TYPE "OrigemOS" AS ENUM ('ESCRITORIO', 'CAMPO', 'MUNICIPE');

-- AlterTable
ALTER TABLE "registros_diarios" ADD COLUMN     "origem" "OrigemOS" NOT NULL DEFAULT 'ESCRITORIO',
ADD COLUMN     "recusado_em" TIMESTAMP(3),
ADD COLUMN     "recusado_por_id" TEXT,
ADD COLUMN     "motivo_recusa" TEXT;

-- CreateIndex
CREATE INDEX "registros_diarios_entity_id_origem_etapa_idx" ON "registros_diarios"("entity_id", "origem", "etapa");

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_recusado_por_id_fkey" FOREIGN KEY ("recusado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- As OS que vieram de pedido do munícipe ficam marcadas como MUNICIPE (o resto fica ESCRITORIO)
UPDATE "registros_diarios" r SET "origem" = 'MUNICIPE'
  FROM "solicitacoes_municipe" s WHERE s."registro_diario_id" = r."id";

-- A aprovação deixa de ser opcional
ALTER TABLE "configuracoes_obras" ALTER COLUMN "exige_aprovacao_os" SET DEFAULT true;
UPDATE "configuracoes_obras" SET "exige_aprovacao_os" = true, "aprovacao_origens" = ARRAY['ESCRITORIO', 'MUNICIPE', 'CAMPO']::TEXT[];
