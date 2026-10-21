-- AlterTable
ALTER TABLE "equipes" ADD COLUMN     "veiculo_id" TEXT;

-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN     "acessos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "admin_geral" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "celular" VARCHAR(20),
ADD COLUMN     "equipe_id" TEXT,
ADD COLUMN     "senha_definida" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "tenant_user_links" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_user_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_user_links_token_hash_key" ON "tenant_user_links"("token_hash");

-- CreateIndex
CREATE INDEX "tenant_user_links_user_id_created_at_idx" ON "tenant_user_links"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "cadastros_auxiliares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "cadastros_auxiliares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_links" ADD CONSTRAINT "tenant_user_links_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_user_links" ADD CONSTRAINT "tenant_user_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ═══ Dados: novos modelos de acesso e caixas de quem já existe ═══
-- O perfil vira só o "modelo" que pré-marca as caixas. Cada usuário ganha as
-- caixas equivalentes ao que já podia fazer (nada muda no dia a dia).

INSERT INTO "tenant_roles" ("id", "code", "name", "description")
SELECT gen_random_uuid()::text, 'COMPRAS', 'Compras e almoxarifado', 'Revisa e envia pedido, registra recebimento'
WHERE NOT EXISTS (SELECT 1 FROM "tenant_roles" WHERE "code" = 'COMPRAS');
INSERT INTO "tenant_roles" ("id", "code", "name", "description")
SELECT gen_random_uuid()::text, 'CONSULTA', 'Consulta', 'Só vê o painel e os relatórios'
WHERE NOT EXISTS (SELECT 1 FROM "tenant_roles" WHERE "code" = 'CONSULTA');

-- administradores: acesso a tudo
UPDATE "tenant_users" u SET "admin_geral" = true
FROM "tenant_roles" r WHERE r."id" = u."role_id" AND r."code" = 'ADMIN';

-- caixas de tela, conforme o perfil de hoje
UPDATE "tenant_users" u SET "acessos" = CASE r."code"
  WHEN 'ADMIN' THEN ARRAY['painel.sala','painel.mapa','painel.relatorios','os.lista','os.minhas','os.central','os.abrir','os.triar','os.aprovar','os.baixa','os.conferir','os.reabrir','os.cancelar','compras.orcamentos','compras.pedidos','compras.saldos','compras.orcar','compras.lancar','compras.revisar','compras.aprovar','compras.enviar','compras.receber','contratos.ver','contratos.cadastrar','contratos.aditivo','contratos.importar','cad.orgao','cad.lugares','cad.pessoas','cad.veiculos','cad.centros','cad.servicos','cad.regras']
  WHEN 'COORDENADOR' THEN ARRAY['painel.sala','painel.mapa','painel.relatorios','os.lista','os.minhas','os.central','os.abrir','os.triar','os.baixa','compras.orcamentos','compras.pedidos','compras.saldos','contratos.ver']
  WHEN 'FISCAL' THEN ARRAY['painel.sala','painel.mapa','painel.relatorios','os.lista','os.minhas','os.central','os.abrir','os.baixa','compras.orcamentos','compras.pedidos','compras.saldos','contratos.ver']
  WHEN 'ENGINEER' THEN ARRAY['painel.sala','painel.mapa','painel.relatorios','os.lista','os.minhas','os.central','os.abrir','os.baixa','compras.orcamentos','compras.pedidos','compras.saldos','contratos.ver','contratos.importar']
  ELSE ARRAY['painel.sala','painel.mapa','painel.relatorios','os.lista','os.minhas','compras.saldos','contratos.ver']
END
FROM "tenant_roles" r WHERE r."id" = u."role_id";

-- caixas dos passos do fluxo, conforme a tela Regras de hoje (perfis que aprovam, conferem, revisam…)
UPDATE "tenant_users" u SET "acessos" = u."acessos"
  || CASE WHEN COALESCE((SELECT c."aprovadores" FROM "configuracoes_obras" c WHERE c."entity_id" = u."entity_id"), ARRAY['ADMIN','COORDENADOR']) @> ARRAY[r."code"] THEN ARRAY['os.aprovar'] ELSE ARRAY[]::text[] END
  || CASE WHEN COALESCE((SELECT c."conferentes" FROM "configuracoes_obras" c WHERE c."entity_id" = u."entity_id"), ARRAY['ADMIN','COORDENADOR']) @> ARRAY[r."code"] THEN ARRAY['os.conferir','os.reabrir','os.cancelar'] ELSE ARRAY[]::text[] END
  || CASE WHEN COALESCE((SELECT c."aprovadores" FROM "configuracoes_obras" c WHERE c."entity_id" = u."entity_id"), ARRAY['ADMIN','COORDENADOR']) @> ARRAY[r."code"] THEN ARRAY['os.cancelar'] ELSE ARRAY[]::text[] END
  || CASE WHEN COALESCE((SELECT c."revisores_compra" FROM "configuracoes_obras" c WHERE c."entity_id" = u."entity_id"), ARRAY['ADMIN','COORDENADOR']) @> ARRAY[r."code"] THEN ARRAY['compras.revisar'] ELSE ARRAY[]::text[] END
  || CASE WHEN COALESCE((SELECT c."aprovadores_compra" FROM "configuracoes_obras" c WHERE c."entity_id" = u."entity_id"), ARRAY['ADMIN']) @> ARRAY[r."code"] THEN ARRAY['compras.aprovar'] ELSE ARRAY[]::text[] END
FROM "tenant_roles" r
WHERE r."id" = u."role_id" AND r."code" <> 'ADMIN';

-- sem repetição
UPDATE "tenant_users" SET "acessos" = ARRAY(SELECT DISTINCT unnest("acessos") ORDER BY 1);

-- Engenheiro/Fiscal → Fiscal; Operador → Consulta (as caixas acima já guardam o que cada um podia)
UPDATE "tenant_users" SET "role_id" = (SELECT "id" FROM "tenant_roles" WHERE "code" = 'FISCAL')
WHERE "role_id" = (SELECT "id" FROM "tenant_roles" WHERE "code" = 'ENGINEER');
UPDATE "tenant_users" SET "role_id" = (SELECT "id" FROM "tenant_roles" WHERE "code" = 'CONSULTA')
WHERE "role_id" = (SELECT "id" FROM "tenant_roles" WHERE "code" = 'OPERATOR');

-- líder de equipe já fica ligado à equipe que lidera
UPDATE "tenant_users" u SET "equipe_id" = e."cadastro_id"
FROM "equipes" e WHERE e."lider_user_id" = u."id" AND u."equipe_id" IS NULL;
