-- CreateEnum
CREATE TYPE "EtapaOS" AS ENUM ('AGUARDANDO_APROVACAO', 'REGISTRADA', 'EXECUTADA', 'FINALIZADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "registros_diarios" ADD COLUMN     "aprovado_em" TIMESTAMP(3),
ADD COLUMN     "aprovado_por_id" TEXT,
ADD COLUMN     "etapa" "EtapaOS" NOT NULL DEFAULT 'REGISTRADA',
ADD COLUMN     "executado_em" TIMESTAMP(3),
ADD COLUMN     "executado_por_id" TEXT,
ADD COLUMN     "finalizado_em" TIMESTAMP(3),
ADD COLUMN     "finalizado_por_id" TEXT,
ADD COLUMN     "numero_os" VARCHAR(20);

-- CreateTable
CREATE TABLE "configuracoes_obras" (
    "entity_id" TEXT NOT NULL,
    "exige_aprovacao_os" BOOLEAN NOT NULL DEFAULT false,
    "aprovadores" TEXT[] DEFAULT ARRAY['ADMIN', 'COORDENADOR']::TEXT[],
    "exige_conferencia" BOOLEAN NOT NULL DEFAULT true,
    "conferentes" TEXT[] DEFAULT ARRAY['ADMIN', 'COORDENADOR']::TEXT[],
    "meta_dias" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_obras_pkey" PRIMARY KEY ("entity_id")
);

-- CreateTable
CREATE TABLE "usuario_servicos" (
    "user_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_servicos_pkey" PRIMARY KEY ("user_id","centro_custo_id")
);

-- CreateIndex
CREATE INDEX "usuario_servicos_entity_id_idx" ON "usuario_servicos"("entity_id");

-- CreateIndex
CREATE INDEX "registros_diarios_entity_id_etapa_idx" ON "registros_diarios"("entity_id", "etapa");

-- CreateIndex
CREATE UNIQUE INDEX "registros_diarios_entity_id_numero_os_key" ON "registros_diarios"("entity_id", "numero_os");

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_aprovado_por_id_fkey" FOREIGN KEY ("aprovado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_executado_por_id_fkey" FOREIGN KEY ("executado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_diarios" ADD CONSTRAINT "registros_diarios_finalizado_por_id_fkey" FOREIGN KEY ("finalizado_por_id") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_obras" ADD CONSTRAINT "configuracoes_obras_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_servicos" ADD CONSTRAINT "usuario_servicos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_servicos" ADD CONSTRAINT "usuario_servicos_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_servicos" ADD CONSTRAINT "usuario_servicos_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══ Dados ═══════════════════════════════════════════════════════

-- Papéis novos: Coordenador (aprova e confere) e Fiscal (registra e dá baixa)
INSERT INTO "tenant_roles" ("id", "code", "name", "description")
VALUES
  (gen_random_uuid()::text, 'COORDENADOR', 'Coordenador', 'Aprova e confere as ordens de serviço'),
  (gen_random_uuid()::text, 'FISCAL', 'Fiscal', 'Registra ocorrências e dá baixa em campo')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "tenant_role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "tenant_roles" r CROSS JOIN "tenant_permissions" p
WHERE r."code" = 'COORDENADOR'
  AND p."code" IN ('dashboard.view', 'users.view', 'licitacoes.view', 'centros_custo.view', 'centros_custo.registros.edit')
ON CONFLICT DO NOTHING;

INSERT INTO "tenant_role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "tenant_roles" r CROSS JOIN "tenant_permissions" p
WHERE r."code" = 'FISCAL'
  AND p."code" IN ('dashboard.view', 'licitacoes.view', 'centros_custo.view', 'centros_custo.registros.edit')
ON CONFLICT DO NOTHING;

-- Etapa de cada ocorrência a partir do status de texto de hoje
UPDATE "registros_diarios" r
SET "etapa" = CASE
      WHEN lower(s.txt) LIKE '%conclu%' OR lower(s.txt) LIKE '%finaliz%' THEN 'FINALIZADA'::"EtapaOS"
      WHEN lower(s.txt) LIKE '%executad%' THEN 'EXECUTADA'::"EtapaOS"
      WHEN lower(s.txt) LIKE '%cancel%' THEN 'CANCELADA'::"EtapaOS"
      ELSE 'REGISTRADA'::"EtapaOS"
    END,
    "executado_em" = CASE WHEN lower(s.txt) LIKE '%conclu%' OR lower(s.txt) LIKE '%finaliz%' OR lower(s.txt) LIKE '%executad%' THEN r."updated_at" END,
    "finalizado_em" = CASE WHEN lower(s.txt) LIKE '%conclu%' OR lower(s.txt) LIKE '%finaliz%' THEN r."updated_at" END
FROM (
  SELECT v."registro_diario_id", v."valor_texto" AS txt
  FROM "registro_diario_valores" v
  JOIN "centro_custo_propriedades" p ON p."id" = v."propriedade_id"
  WHERE p."nome" = 'Status'
) s
WHERE s."registro_diario_id" = r."id";

-- Status de texto passa a refletir a etapa
UPDATE "registro_diario_valores" v
SET "valor_texto" = CASE r."etapa"
      WHEN 'AGUARDANDO_APROVACAO' THEN 'Aguardando aprovação'
      WHEN 'REGISTRADA' THEN 'Registrada'
      WHEN 'EXECUTADA' THEN 'Executada'
      WHEN 'FINALIZADA' THEN 'Finalizada'
      ELSE 'Cancelada'
    END
FROM "registros_diarios" r, "centro_custo_propriedades" p
WHERE v."registro_diario_id" = r."id" AND p."id" = v."propriedade_id" AND p."nome" = 'Status';

-- Número oficial da OS (sequencial por entidade e ano, pela data de criação)
WITH n AS (
  SELECT "id", "entity_id",
         EXTRACT(YEAR FROM ("created_at" - INTERVAL '3 hours'))::int AS ano,
         ROW_NUMBER() OVER (
           PARTITION BY "entity_id", EXTRACT(YEAR FROM ("created_at" - INTERVAL '3 hours'))
           ORDER BY "created_at", "id"
         ) AS k
  FROM "registros_diarios"
)
UPDATE "registros_diarios" r
SET "numero_os" = 'OS ' || n.ano || '/' || LPAD(n.k::text, 4, '0')
FROM n WHERE n."id" = r."id";

-- O contador continua de onde parou
INSERT INTO "sequencias" ("entity_id", "chave", "ultimo", "updated_at")
SELECT "entity_id", 'OS-' || split_part(substr("numero_os", 4), '/', 1), MAX(split_part("numero_os", '/', 2)::int), NOW()
FROM "registros_diarios"
WHERE "numero_os" IS NOT NULL
GROUP BY "entity_id", split_part(substr("numero_os", 4), '/', 1)
ON CONFLICT ("entity_id", "chave") DO UPDATE SET "ultimo" = GREATEST("sequencias"."ultimo", EXCLUDED."ultimo");
