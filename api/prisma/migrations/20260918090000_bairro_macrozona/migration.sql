-- AlterEnum
ALTER TYPE "CadastroAuxiliarTipo" ADD VALUE 'MACROZONA';

-- AlterTable
ALTER TABLE "cadastros_auxiliares" ADD COLUMN     "macrozona_id" TEXT;

-- CreateIndex
CREATE INDEX "cadastros_auxiliares_macrozona_id_idx" ON "cadastros_auxiliares"("macrozona_id");

-- AddForeignKey
ALTER TABLE "cadastros_auxiliares" ADD CONSTRAINT "cadastros_auxiliares_macrozona_id_fkey" FOREIGN KEY ("macrozona_id") REFERENCES "cadastros_auxiliares"("id") ON DELETE SET NULL ON UPDATE CASCADE;
