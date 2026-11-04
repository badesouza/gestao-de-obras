/**
 * Cinturão de Segurança — kit Node v1 (04/11/2026).
 *
 * Avisos que o navegador respeita, em toda resposta (API e site):
 *  - Strict-Transport-Security: só HTTPS por 1 ano (ligar só em produção, atrás do HTTPS do Railway);
 *  - X-Frame-Options + CSP frame-ancestors: outro site não abre o sistema dentro de moldura;
 *  - X-Content-Type-Options: nosniff — não "adivinhar" que um arquivo é página;
 *  - Referrer-Policy: não vazar o endereço completo (códigos de link) para sites de fora;
 *  - Permissions-Policy: câmera/microfone/GPS só para o próprio site; o resto desligado;
 *  - Content-Security-Policy: só regras que não quebram tela (moldura, <base>, plugins, destino de
 *    formulário). A regra forte (de onde vêm scripts, imagens, conexões) vai em modo RELATÓRIO
 *    (Content-Security-Policy-Report-Only): o navegador só avisa no console o que bloquearia.
 *    Depois de uns dias sem aviso nas telas, dá para passar a regra forte para valer.
 *
 * Sem dependências. Não sobrescreve cabeçalho que a rota já pôs.
 */

export interface OpcoesCabecalhos {
  /** liga o HSTS (padrão: NODE_ENV === 'production') */
  hsts?: boolean;
  /** 'SAMEORIGIN' (padrão) ou 'DENY' */
  moldura?: 'SAMEORIGIN' | 'DENY';
  /** CSP que vale de verdade (padrão: CSP_SEGURA) */
  csp?: string | null;
  /** CSP só em relatório (padrão: nenhuma; passe a sua, ex.: montarCspRelatorio({...})) */
  cspRelatorio?: string | null;
  /** Permissions-Policy (padrão: PERMISSOES_PADRAO) */
  permissoes?: string;
}

/** Regras de CSP que não quebram tela nenhuma */
export const CSP_SEGURA = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'";

/** Câmera, microfone e GPS só para o próprio site (molduras de fora não pedem); resto desligado */
export const PERMISSOES_PADRAO =
  'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), hid=(), midi=(), browsing-topics=()';

/** Monta uma CSP forte para usar em modo relatório (liste os sites de fora que as telas usam) */
export function montarCspRelatorio(fora: {
  scripts?: string[];
  estilos?: string[];
  fontes?: string[];
  imagens?: string[];
  conexoes?: string[];
  molduras?: string[];
} = {}) {
  const j = (l?: string[]) => (l && l.length ? ' ' + l.join(' ') : '');
  return [
    "default-src 'self'",
    `script-src 'self'${j(fora.scripts)}`,
    `style-src 'self' 'unsafe-inline'${j(fora.estilos)}`,
    `font-src 'self' data:${j(fora.fontes)}`,
    `img-src 'self' data: blob:${j(fora.imagens)}`,
    "media-src 'self' data: blob:",
    `connect-src 'self'${j(fora.conexoes)}`,
    `frame-src 'self'${j(fora.molduras)}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ');
}

/** Lista final de cabeçalhos (útil para testar) */
export function cabecalhosSeguranca(opcoes: OpcoesCabecalhos = {}): Record<string, string> {
  const h: Record<string, string> = {
    'X-Frame-Options': opcoes.moldura ?? 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': opcoes.permissoes ?? PERMISSOES_PADRAO,
  };
  const csp = opcoes.csp === undefined ? CSP_SEGURA : opcoes.csp;
  if (csp) h['Content-Security-Policy'] = csp;
  if (opcoes.cspRelatorio) h['Content-Security-Policy-Report-Only'] = opcoes.cspRelatorio;
  if (opcoes.hsts ?? process.env.NODE_ENV === 'production') {
    /* sem includeSubDomains: um subdomínio só em http não fica fora do ar */
    h['Strict-Transport-Security'] = 'max-age=31536000';
  }
  return h;
}

/* ───────────────────────── Fastify (4 e 5) ───────────────────────── */

export interface InstanciaFastify {
  addHook(
    nome: 'onSend',
    fn: (req: unknown, reply: { hasHeader(n: string): boolean; header(n: string, v: string): unknown }, payload: unknown) => Promise<unknown>,
  ): unknown;
}

/**
 * Chame na instância raiz, antes de registrar as rotas:
 *   ligarCabecalhosFastify(fastify, { cspRelatorio: montarCspRelatorio({...}) })
 * (no Fastify, gancho posto na raiz antes do register vale para todas as rotas e para o @fastify/static)
 */
export function ligarCabecalhosFastify(fastify: InstanciaFastify, opcoes: OpcoesCabecalhos = {}) {
  const lista = Object.entries(cabecalhosSeguranca(opcoes));
  fastify.addHook('onSend', async (_req, reply, payload) => {
    for (const [nome, valor] of lista) if (!reply.hasHeader(nome)) reply.header(nome, valor);
    return payload;
  });
}

/* ───────────────────────── Express (4 e 5) ───────────────────────── */

/**
 * Primeiro app.use() do sistema:
 *   app.disable('x-powered-by');
 *   app.use(cabecalhosExpress({ ... }))
 */
export function cabecalhosExpress(opcoes: OpcoesCabecalhos = {}) {
  const lista = Object.entries(cabecalhosSeguranca(opcoes));
  return (_req: unknown, res: { getHeader(n: string): unknown; setHeader(n: string, v: string): unknown }, next: () => void) => {
    for (const [nome, valor] of lista) if (res.getHeader(nome) === undefined) res.setHeader(nome, valor);
    next();
  };
}
