-- Modelo de acesso "Engenheiro(a) civil" (reaproveita o perfil ENGINEER, antes "Engenheiro/Fiscal")
INSERT INTO "tenant_roles" ("id", "code", "name", "description")
SELECT gen_random_uuid()::text, 'ENGINEER', 'Engenheiro(a) civil', 'Orça, confere a baixa, cuida dos itens e aditivos do contrato'
WHERE NOT EXISTS (SELECT 1 FROM "tenant_roles" WHERE "code" = 'ENGINEER');

UPDATE "tenant_roles"
SET "name" = 'Engenheiro(a) civil', "description" = 'Orça, confere a baixa, cuida dos itens e aditivos do contrato'
WHERE "code" = 'ENGINEER';
