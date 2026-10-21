-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PedidoCompraStatus" ADD VALUE 'EM_REVISAO';
ALTER TYPE "PedidoCompraStatus" ADD VALUE 'AGUARDANDO_APROVACAO';
ALTER TYPE "PedidoCompraStatus" ADD VALUE 'APROVADO';

-- AlterTable
ALTER TABLE "configuracoes_obras" ADD COLUMN     "aprovadores_compra" TEXT[] DEFAULT ARRAY['ADMIN']::TEXT[],
ADD COLUMN     "exige_aprovacao_compra" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "revisores_compra" TEXT[] DEFAULT ARRAY['ADMIN', 'COORDENADOR']::TEXT[];

-- AlterTable
ALTER TABLE "pedidos_compra" ADD COLUMN     "aprovado_em" TIMESTAMP(3),
ADD COLUMN     "aprovado_por_id" TEXT,
ADD COLUMN     "devolvido_em" TIMESTAMP(3),
ADD COLUMN     "devolvido_motivo" VARCHAR(1000),
ADD COLUMN     "enviado_revisao_em" TIMESTAMP(3),
ADD COLUMN     "revisado_em" TIMESTAMP(3),
ADD COLUMN     "revisado_por_id" TEXT;

-- AddForeignKey
ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_revisado_por_id_fkey" FOREIGN KEY ("revisado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_compra" ADD CONSTRAINT "pedidos_compra_aprovado_por_id_fkey" FOREIGN KEY ("aprovado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

