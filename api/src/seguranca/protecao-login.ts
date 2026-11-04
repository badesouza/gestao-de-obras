import { LimiteLogin, limiteLoginFastify } from './limite-login.js';

/* Cinturão (kit-node): 5 senhas erradas em 10 min por e-mail+IP, 20 por IP → 429.
   Uma instância para os dois logins (órgão e plataforma): o contador do IP é o mesmo. */
export const limiteLogin = new LimiteLogin({ maximo: 5, maximoPorIp: 20, minutos: 10 });

/** Ganchos da rota POST de login: fastify.post('/auth/login', { ...protecaoLogin }, handler) */
export const protecaoLogin = limiteLoginFastify(limiteLogin, {
  campoEmail: 'email',
  responder: (message) => ({ code: 'TOO_MANY_ATTEMPTS', message }),
});

/**
 * Saltos de proxy em que confiamos para achar o IP real (Railway = 1).
 * O IP vem do X-Forwarded-For que o próprio proxy do Railway escreve (o último da lista);
 * o que o visitante põe no cabeçalho fica antes e é ignorado.
 */
export const SALTOS_DE_PROXY = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10) || 0;
