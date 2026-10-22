-- Modelo de acesso "Secretário(a)": acompanha tudo e aprova (OS e pedido), sem cadastros nem senhas
INSERT INTO "tenant_roles" ("id", "code", "name", "description")
SELECT gen_random_uuid()::text, 'SECRETARIO', 'Secretário(a)', 'Acompanha tudo e aprova: OS e pedido. Não mexe em cadastro nem em senha.'
WHERE NOT EXISTS (SELECT 1 FROM "tenant_roles" WHERE "code" = 'SECRETARIO');
