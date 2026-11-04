/**
 * Cinturão de Segurança — kit Node v1 (04/11/2026).
 *
 * Revogação de acesso com JWT (linha 3 do quadro: "sair, desativar e excluir derrubam o acesso na hora").
 *
 * O JWT vale sozinho até vencer; apagar do navegador não adianta se alguém copiou. A saída:
 *  1. coluna `sessao_versao` (inteiro, padrão 0) em cada tabela de quem faz login;
 *  2. o token leva a versão (`sv`) do momento do login;
 *  3. a cada pedido, o servidor lê do banco status + versão e recusa (401) se a pessoa não está ativa
 *     ou se a versão do token é diferente da do banco;
 *  4. sair, desativar, excluir, trocar/criar senha e mudar o perfil somam 1 na versão
 *     (`sessaoVersao: { increment: 1 }`) → todos os tokens antigos daquela pessoa caem.
 *
 * Token antigo, de antes da mudança, não tem `sv` e conta como 0 — ninguém é deslogado na
 * publicação, e o 1º "sair" já derruba.
 *
 * Efeito colateral (avise o usuário): "sair" num aparelho encerra os outros aparelhos da mesma pessoa.
 *
 * Migração (gerar e conferir; aplicar no deploy):
 *   Prisma:  sessaoVersao Int @default(0) @map("sessao_versao")   → npx prisma migrate dev --create-only
 *   SQL:     ALTER TABLE "usuarios" ADD COLUMN "sessao_versao" INTEGER NOT NULL DEFAULT 0;
 *   knex:    t.integer('sessao_versao').notNullable().defaultTo(0)
 */

export const CAMPO_VERSAO = 'sv';

/** Versão que vai no token (no login e em qualquer token novo) */
export function comVersao<T extends object>(payload: T, sessaoVersao: number): T & { sv: number } {
  return { ...payload, sv: sessaoVersao };
}

/** Versão que veio no token; token antigo sem o campo = 0 */
export function versaoDoToken(payload: unknown): number {
  const v = (payload as Record<string, unknown> | null | undefined)?.[CAMPO_VERSAO];
  return typeof v === 'number' && Number.isInteger(v) ? v : 0;
}

/**
 * Confere o token contra o banco. `usuario` é o que veio do banco (null = excluído).
 * Devolve true se o acesso continua valendo.
 */
export function sessaoValida(payload: unknown, usuario: { ativo: boolean; sessaoVersao: number } | null): boolean {
  if (!usuario || !usuario.ativo) return false;
  return versaoDoToken(payload) === usuario.sessaoVersao;
}
