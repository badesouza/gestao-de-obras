-- Tipos de veículo/equipamento cadastrados pelo órgão (no lugar da lista fixa de sugestões)
CREATE TABLE "tipos_frota" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_frota_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_frota_entity_id_nome_key" ON "tipos_frota"("entity_id", "nome");
CREATE INDEX "tipos_frota_entity_id_idx" ON "tipos_frota"("entity_id");

ALTER TABLE "cadastros_auxiliares" ADD COLUMN "tipo_frota_id" TEXT;
ALTER TABLE "cadastros_auxiliares" ADD CONSTRAINT "cadastros_auxiliares_tipo_frota_id_fkey" FOREIGN KEY ("tipo_frota_id") REFERENCES "tipos_frota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- os 4 tipos de partida em cada órgão
INSERT INTO "tipos_frota" ("id", "entity_id", "nome", "ordem", "updated_at")
SELECT gen_random_uuid()::text, e."id", t.nome, t.ordem, CURRENT_TIMESTAMP
FROM "entities" e
CROSS JOIN (VALUES ('Veículos', 1), ('Máquinas', 2), ('Equipamentos', 3), ('Móveis', 4)) AS t(nome, ordem)
ON CONFLICT DO NOTHING;

-- o que já existe ganha um tipo: máquinas pesadas, demais veículos e equipamentos
UPDATE "cadastros_auxiliares" a SET "tipo_frota_id" = t."id"
FROM "tipos_frota" t
WHERE t."entity_id" = a."entity_id" AND a."tipo_frota_id" IS NULL AND a."tipo" IN ('VEICULO', 'EQUIPAMENTO')
  AND t."nome" = CASE
    WHEN a."tipo" = 'VEICULO' AND (COALESCE(a."subtipo", '') || ' ' || a."nome") ~* '(retro|escavadeira|patrol|motoniveladora|trator|carregadeira|rolo)' THEN 'Máquinas'
    WHEN a."tipo" = 'VEICULO' THEN 'Veículos'
    ELSE 'Equipamentos'
  END;
