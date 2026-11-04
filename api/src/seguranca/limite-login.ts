/**
 * Cinturão de Segurança — kit Node v1 (04/11/2026).
 *
 * Limite de tentativas de senha, em memória (1 instância por sistema).
 *  - 5 erros em 10 min para o mesmo e-mail no mesmo IP  → 429 até a janela passar.
 *  - 20 erros em 10 min do mesmo IP (qualquer e-mail)   → 429 (quem testa uma senha em muitos e-mails).
 *  - Acertou a senha → zera o e-mail naquele IP.
 *
 * A tentativa é contada ANTES de conferir a senha (vários pedidos ao mesmo tempo não passam do
 * limite); no fim, 2xx zera, 401/403 fica contado e qualquer outra resposta (400 de formulário,
 * 500) devolve a tentativa.
 *
 * O IP tem que ser o IP real: ligue o trustProxy (Fastify) / 'trust proxy' (Express) com 1 salto.
 * Ver README.md. Nunca leia o X-Forwarded-For na mão.
 *
 * Sem dependências. Os adaptadores usam tipos estruturais para servir a Fastify 4/5 e Express 4/5.
 */

export interface OpcoesLimiteLogin {
  /** erros por e-mail+IP dentro da janela (padrão 5) */
  maximo?: number;
  /** erros por IP, qualquer e-mail (padrão 20) */
  maximoPorIp?: number;
  /** janela em minutos (padrão 10) */
  minutos?: number;
  /** teto de chaves na memória (padrão 50 mil); passou, limpa as mais antigas */
  tetoChaves?: number;
}

export interface Bloqueio {
  bloqueado: true;
  esperaSegundos: number;
  mensagem: string;
}

/** Recibo de uma tentativa: guarde e chame concluir() com o status da resposta */
export interface Tentativa {
  concluir(status: number): void;
}

export class LimiteLogin {
  private readonly maximo: number;
  private readonly maximoPorIp: number;
  private readonly janelaMs: number;
  private readonly tetoChaves: number;
  private readonly erros = new Map<string, number[]>();

  constructor(opcoes: OpcoesLimiteLogin = {}) {
    this.maximo = opcoes.maximo ?? 5;
    this.maximoPorIp = opcoes.maximoPorIp ?? 20;
    this.janelaMs = (opcoes.minutos ?? 10) * 60_000;
    this.tetoChaves = opcoes.tetoChaves ?? 50_000;
    /* limpeza periódica; unref para não segurar o processo aberto (testes, scripts) */
    const t = setInterval(() => this.limpar(), 5 * 60_000);
    (t as unknown as { unref?: () => void }).unref?.();
  }

  /**
   * Confere e já reserva a tentativa. Devolve o bloqueio (responda 429) ou o recibo da tentativa.
   * `email` vazio conta só no IP.
   */
  tentar(emailBruto: unknown, ipBruto: unknown): Bloqueio | Tentativa {
    const agora = Date.now();
    const ip = String(ipBruto ?? '').trim() || 'sem-ip';
    const email = String(emailBruto ?? '').trim().toLowerCase().slice(0, 200);
    const chaveIp = `ip|${ip}`;
    const chaveEmail = `em|${email}|${ip}`;

    const porIp = this.vivos(chaveIp, agora);
    if (porIp.length >= this.maximoPorIp) return this.bloqueio(porIp, agora);
    const porEmail = email ? this.vivos(chaveEmail, agora) : [];
    if (email && porEmail.length >= this.maximo) return this.bloqueio(porEmail, agora);

    porIp.push(agora);
    this.erros.set(chaveIp, porIp);
    if (email) {
      porEmail.push(agora);
      this.erros.set(chaveEmail, porEmail);
    }
    if (this.erros.size > this.tetoChaves) this.limpar(true);

    let concluida = false;
    return {
      concluir: (status: number) => {
        if (concluida) return;
        concluida = true;
        if (status >= 200 && status < 300) {
          /* acertou: zera o e-mail neste IP e devolve a tentativa do IP */
          if (email) this.erros.delete(chaveEmail);
          this.devolver(chaveIp, agora);
        } else if (status === 401 || status === 403) {
          /* errou: fica contado */
        } else {
          /* formulário inválido, 429, erro do servidor: não conta */
          this.devolver(chaveIp, agora);
          if (email) this.devolver(chaveEmail, agora);
        }
      },
    };
  }

  /** Zera tudo (só para testes) */
  zerarTudo() {
    this.erros.clear();
  }

  private vivos(chave: string, agora: number) {
    return (this.erros.get(chave) ?? []).filter((t) => agora - t < this.janelaMs);
  }

  private devolver(chave: string, marca: number) {
    const lista = this.erros.get(chave);
    if (!lista) return;
    const i = lista.lastIndexOf(marca);
    if (i >= 0) lista.splice(i, 1);
    if (lista.length === 0) this.erros.delete(chave);
  }

  private bloqueio(lista: number[], agora: number): Bloqueio {
    const maisAntigo = Math.min(...lista);
    const esperaSegundos = Math.max(1, Math.ceil((maisAntigo + this.janelaMs - agora) / 1000));
    const minutos = Math.ceil(esperaSegundos / 60);
    return {
      bloqueado: true,
      esperaSegundos,
      mensagem: `Muitas tentativas de senha. Aguarde ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} e tente de novo.`,
    };
  }

  private limpar(forcar = false) {
    const agora = Date.now();
    for (const [chave, lista] of this.erros) {
      const vivos = lista.filter((t) => agora - t < this.janelaMs);
      if (vivos.length === 0) this.erros.delete(chave);
      else this.erros.set(chave, vivos);
    }
    if (forcar && this.erros.size > this.tetoChaves) {
      /* ainda cheio (ataque com muitos IPs): descarta as chaves mais antigas */
      const sobra = this.erros.size - Math.floor(this.tetoChaves * 0.8);
      let i = 0;
      for (const chave of this.erros.keys()) {
        if (i++ >= sobra) break;
        this.erros.delete(chave);
      }
    }
  }
}

function ehBloqueio(r: Bloqueio | Tentativa): r is Bloqueio {
  return (r as Bloqueio).bloqueado === true;
}

/* ───────────────────────── Fastify (4 e 5) ───────────────────────── */

export interface PedidoFastify {
  ip: string;
  body?: unknown;
}
export interface RespostaFastify {
  statusCode: number;
  code(status: number): RespostaFastify;
  header(nome: string, valor: string): RespostaFastify;
  send(corpo?: unknown): unknown;
}

const TENTATIVA = Symbol('cinturao.tentativa');

/**
 * Ganchos para pôr nas opções da rota de login:
 *   fastify.post('/auth/login', { ...protecaoLogin }, handler)
 * `responder` monta o corpo do 429 no formato de erro do sistema.
 */
export function limiteLoginFastify(
  limite: LimiteLogin,
  opcoes: {
    campoEmail?: string;
    responder?: (mensagem: string) => unknown;
  } = {},
) {
  const campo = opcoes.campoEmail ?? 'email';
  const responder = opcoes.responder ?? ((mensagem: string) => ({ code: 'TOO_MANY_ATTEMPTS', message: mensagem }));
  return {
    preHandler: async (req: PedidoFastify, reply: RespostaFastify) => {
      const corpo = (req.body ?? {}) as Record<string, unknown>;
      const r = limite.tentar(corpo[campo], req.ip);
      if (ehBloqueio(r)) {
        return reply.code(429).header('Retry-After', String(r.esperaSegundos)).send(responder(r.mensagem));
      }
      (req as unknown as Record<symbol, Tentativa>)[TENTATIVA] = r;
    },
    onResponse: async (req: PedidoFastify, reply: RespostaFastify) => {
      (req as unknown as Record<symbol, Tentativa | undefined>)[TENTATIVA]?.concluir(reply.statusCode);
    },
  };
}

/* ───────────────────────── Express (4 e 5) ───────────────────────── */

export interface PedidoExpress {
  ip?: string;
  body?: unknown;
}
export interface RespostaExpress {
  statusCode: number;
  status(s: number): RespostaExpress;
  set(nome: string, valor: string): RespostaExpress;
  json(corpo: unknown): unknown;
  on(evento: 'finish' | 'close', fn: () => void): unknown;
}

/**
 * Middleware para a rota de login (depois do express.json()):
 *   router.post('/login', limiteLoginExpress(limite), login)
 */
export function limiteLoginExpress(
  limite: LimiteLogin,
  opcoes: { campoEmail?: string; responder?: (mensagem: string) => unknown } = {},
) {
  const campo = opcoes.campoEmail ?? 'email';
  const responder = opcoes.responder ?? ((mensagem: string) => ({ error: mensagem, message: mensagem }));
  return (req: PedidoExpress, res: RespostaExpress, next: () => void) => {
    const corpo = (req.body ?? {}) as Record<string, unknown>;
    const r = limite.tentar(corpo[campo], req.ip);
    if (ehBloqueio(r)) {
      res.status(429).set('Retry-After', String(r.esperaSegundos)).json(responder(r.mensagem));
      return;
    }
    res.on('finish', () => r.concluir(res.statusCode));
    res.on('close', () => r.concluir(res.statusCode >= 200 && res.statusCode < 300 ? res.statusCode : 499));
    next();
  };
}
