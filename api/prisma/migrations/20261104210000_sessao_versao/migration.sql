-- Cinturão: revogação de acesso. O token leva a versão do login; sair, desativar, excluir
-- ou trocar a senha soma 1 e os tokens antigos deixam de valer. Padrão 0 = ninguém é deslogado.
ALTER TABLE "tenant_users" ADD COLUMN "sessao_versao" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_operators" ADD COLUMN "sessaoVersao" INTEGER NOT NULL DEFAULT 0;
