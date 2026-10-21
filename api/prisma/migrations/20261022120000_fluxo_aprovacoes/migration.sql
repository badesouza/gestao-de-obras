-- AlterTable
ALTER TABLE "configuracoes_obras" ADD COLUMN     "aprovacao_origens" TEXT[] DEFAULT ARRAY['ESCRITORIO', 'MUNICIPE', 'CAMPO']::TEXT[],
ADD COLUMN     "conferencia_propria_bloqueada" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "exige_revisao_compra" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pedido_so_de_orcamento" BOOLEAN NOT NULL DEFAULT false;


-- Antes, uma chave só ligava revisão e aprovação juntas: a revisão segue a mesma escolha
UPDATE "configuracoes_obras" SET "exige_revisao_compra" = "exige_aprovacao_compra";
