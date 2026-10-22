-- Veículos e equipamentos ligados aos serviços (antes ficava só na ficha do serviço, em campos_comuns.equipamentos)
CREATE TABLE "servico_frota" (
    "servico_id" TEXT NOT NULL,
    "cadastro_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servico_frota_pkey" PRIMARY KEY ("servico_id","cadastro_id")
);

CREATE INDEX "servico_frota_cadastro_id_idx" ON "servico_frota"("cadastro_id");
CREATE INDEX "servico_frota_entity_id_idx" ON "servico_frota"("entity_id");

ALTER TABLE "servico_frota" ADD CONSTRAINT "servico_frota_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "centros_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "servico_frota" ADD CONSTRAINT "servico_frota_cadastro_id_fkey" FOREIGN KEY ("cadastro_id") REFERENCES "cadastros_auxiliares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- o que as fichas já salvas tinham marcado vira vínculo
INSERT INTO "servico_frota" ("servico_id", "cadastro_id", "entity_id")
SELECT DISTINCT c."id", e.valor, c."entity_id"
FROM "centros_custo" c
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c."campos_comuns"::jsonb -> 'equipamentos', '[]'::jsonb)) AS e(valor)
JOIN "cadastros_auxiliares" a ON a."id" = e.valor AND a."entity_id" = c."entity_id" AND a."tipo" IN ('VEICULO', 'EQUIPAMENTO')
ON CONFLICT DO NOTHING;
