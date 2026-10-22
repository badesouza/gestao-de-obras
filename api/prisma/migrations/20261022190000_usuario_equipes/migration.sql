-- CreateTable
CREATE TABLE "usuario_equipes" (
    "user_id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_equipes_pkey" PRIMARY KEY ("user_id","equipe_id")
);

-- CreateIndex
CREATE INDEX "usuario_equipes_entity_id_idx" ON "usuario_equipes"("entity_id");

-- CreateIndex
CREATE INDEX "usuario_equipes_equipe_id_idx" ON "usuario_equipes"("equipe_id");

-- AddForeignKey
ALTER TABLE "usuario_equipes" ADD CONSTRAINT "usuario_equipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_equipes" ADD CONSTRAINT "usuario_equipes_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "cadastros_auxiliares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_equipes" ADD CONSTRAINT "usuario_equipes_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Quem já tinha equipe continua nela
INSERT INTO "usuario_equipes" ("user_id", "equipe_id", "entity_id")
SELECT "id", "equipe_id", "entity_id" FROM "tenant_users" WHERE "equipe_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Equipe "Escritório": demandas internas da Secretaria (toda OS tem equipe, inclusive a do escritório)
INSERT INTO "cadastros_auxiliares" ("id", "entity_id", "tipo", "nome", "updated_at")
SELECT gen_random_uuid()::text, e."id", 'EQUIPE', 'Escritório', NOW()
FROM "entities" e
WHERE NOT EXISTS (SELECT 1 FROM "cadastros_auxiliares" c WHERE c."entity_id" = e."id" AND c."tipo" = 'EQUIPE' AND lower(c."nome") IN ('escritório', 'escritorio'));

UPDATE "cadastros_auxiliares" SET "ativo" = true
WHERE "tipo" = 'EQUIPE' AND lower("nome") IN ('escritório', 'escritorio');

INSERT INTO "equipes" ("id", "entity_id", "cadastro_id", "updated_at")
SELECT gen_random_uuid()::text, c."entity_id", c."id", NOW()
FROM "cadastros_auxiliares" c
WHERE c."tipo" = 'EQUIPE' AND lower(c."nome") IN ('escritório', 'escritorio')
  AND NOT EXISTS (SELECT 1 FROM "equipes" q WHERE q."cadastro_id" = c."id");
