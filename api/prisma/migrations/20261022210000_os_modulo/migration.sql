-- AlterTable
ALTER TABLE "registro_midias" ADD COLUMN     "momento" VARCHAR(10);

-- AlterTable
ALTER TABLE "registros_diarios" ADD COLUMN     "campos" JSONB,
ADD COLUMN     "devolvido_em" TIMESTAMP(3),
ADD COLUMN     "equipe_id" TEXT,
ADD COLUMN     "motivo_devolucao" TEXT,
ADD COLUMN     "trabalharam" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "registros_diarios_entity_id_equipe_id_idx" ON "registros_diarios"("entity_id", "equipe_id");

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "cadastros_auxiliares"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- OS antigas: a equipe estava escrita no campo "Equipe / Turma"; liga ao cadastro quando o nome bate
UPDATE "registros_diarios" r
SET "equipe_id" = c."id"
FROM "registro_diario_valores" v
JOIN "centro_custo_propriedades" p ON p."id" = v."propriedade_id" AND p."nome" = 'Equipe / Turma'
JOIN "cadastros_auxiliares" c ON c."tipo" = 'EQUIPE' AND lower(trim(c."nome")) = lower(trim(v."valor_texto"))
WHERE v."registro_diario_id" = r."id" AND c."entity_id" = r."entity_id" AND r."equipe_id" IS NULL;
